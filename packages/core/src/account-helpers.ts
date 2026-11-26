import type { Fingerprint, FingerprintVersion } from "./fingerprint.ts"
import type {
  CooldownReason,
  HeaderStyle,
  ModelFamily,
  RateLimitStateV3,
} from "./storage.ts"

export const DEFAULT_SOFT_QUOTA_REFRESH_TTL_MS = 120_000
export const DEFAULT_SOFT_QUOTA_NEAR_THRESHOLD_MARGIN = 10

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60 * 1_000

export interface RefreshParts {
  refreshToken: string
  projectId?: string
  managedProjectId?: string
}

export interface OAuthAuthDetails {
  type: "oauth"
  refresh: string
  access?: string
  expires?: number
}

export type QuotaGroup = "claude" | "gemini-pro" | "gemini-flash"

export interface QuotaGroupSummary {
  remainingFraction?: number
  resetTime?: string
  modelCount: number
}

export function parseRefreshParts(refresh: string): RefreshParts {
  const [refreshToken = "", projectId = "", managedProjectId = ""] = (
    refresh ?? ""
  ).split("|")
  return {
    refreshToken,
    projectId: projectId || undefined,
    managedProjectId: managedProjectId || undefined,
  }
}

export function formatRefreshParts(parts: RefreshParts): string {
  const projectSegment = parts.projectId ?? ""
  const base = `${parts.refreshToken}|${projectSegment}`
  return parts.managedProjectId ? `${base}|${parts.managedProjectId}` : base
}

export function accessTokenExpired(
  auth: Pick<OAuthAuthDetails, "access" | "expires">,
): boolean {
  if (!auth.access || typeof auth.expires !== "number") {
    return true
  }
  return auth.expires <= Date.now() + ACCESS_TOKEN_EXPIRY_BUFFER_MS
}

export function formatAccountLabel(
  email: string | undefined,
  accountIndex: number,
): string {
  return email || `Account ${accountIndex + 1}`
}

export function classifyModelQuotaFamily(model: string): QuotaGroup {
  const lower = model.toLowerCase()
  if (lower.includes("claude")) {
    return "claude"
  }
  if (lower.includes("flash")) {
    return "gemini-flash"
  }
  return "gemini-pro"
}

function decodeEscapedText(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
}

function normalizeGoogleVerificationUrl(rawUrl: string): string | undefined {
  const normalized = decodeEscapedText(rawUrl)
    .trim()
    .replace(/[),.;!?]+$/, "")
  if (!normalized) {
    return undefined
  }
  try {
    const parsed = new URL(normalized)
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "accounts.google.com" ||
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.port !== ""
    ) {
      return undefined
    }
    return parsed.toString()
  } catch {
    return undefined
  }
}

function selectBestVerificationUrl(urls: string[]): string | undefined {
  const unique = Array.from(
    new Set(
      urls
        .map((url) => normalizeGoogleVerificationUrl(url))
        .filter(Boolean) as string[],
    ),
  )
  if (unique.length === 0) {
    return undefined
  }
  unique.sort((a, b) => {
    const score = (value: string): number => {
      let total = 0
      if (value.includes("plt=")) total += 4
      if (value.includes("/signin/continue")) total += 3
      if (value.includes("continue=")) total += 2
      if (value.includes("service=cloudcode")) total += 1
      return total
    }
    return score(b) - score(a)
  })
  return unique[0]
}

export interface VerificationErrorDetails {
  validationRequired: boolean
  message?: string
  verifyUrl?: string
}

export function extractVerificationErrorDetails(
  bodyText: string,
): VerificationErrorDetails {
  const decodedBody = decodeEscapedText(bodyText)
  const lowerBody = decodedBody.toLowerCase()
  let validationRequired = lowerBody.includes("validation_required")
  let message: string | undefined
  const structuredUrls: string[] = []
  const textUrls: string[] = []

  const collectUrlsFromText = (text: string): void => {
    for (const match of text.matchAll(
      /https:\/\/accounts\.google\.com\/[^\s"'<>]+/gi,
    )) {
      if (match[0]) {
        textUrls.push(match[0])
      }
    }
  }

  const tryParseJson = (rawText: string, fallbackDecoded: string): unknown => {
    try {
      return JSON.parse(rawText)
    } catch {
      return JSON.parse(fallbackDecoded)
    }
  }

  const payloads: unknown[] = []
  const rawTrimmed = bodyText.trim()
  const decodedTrimmed = decodedBody.trim()
  if (
    rawTrimmed.startsWith("{") ||
    rawTrimmed.startsWith("[") ||
    decodedTrimmed.startsWith("{") ||
    decodedTrimmed.startsWith("[")
  ) {
    try {
      payloads.push(tryParseJson(rawTrimmed, decodedTrimmed))
    } catch {
      // Ignore non-JSON body prefix
    }
  }

  for (const rawLine of bodyText.split("\n")) {
    const line = rawLine.trim()
    if (!line.startsWith("data:")) {
      continue
    }
    const payloadText = line.slice(5).trim()
    if (!payloadText || payloadText === "[DONE]") {
      continue
    }
    const decodedPayloadText = decodeEscapedText(payloadText).trim()
    try {
      payloads.push(tryParseJson(payloadText, decodedPayloadText))
    } catch {
      collectUrlsFromText(decodedPayloadText)
    }
  }

  const visited = new Set<unknown>()
  const walk = (value: unknown, key?: string): void => {
    if (typeof value === "string") {
      const normalizedValue = decodeEscapedText(value)
      const lowerValue = normalizedValue.toLowerCase()
      const lowerKey = key?.toLowerCase() ?? ""

      if (lowerValue.includes("validation_required")) {
        validationRequired = true
      }
      if (
        !message &&
        (lowerKey.includes("message") ||
          lowerKey.includes("detail") ||
          lowerKey.includes("description"))
      ) {
        message = normalizedValue
      }
      if (
        lowerKey.includes("validation_url") ||
        lowerKey.includes("verify_url") ||
        lowerKey.includes("verification_url") ||
        lowerKey === "url"
      ) {
        structuredUrls.push(normalizedValue)
      }
      collectUrlsFromText(normalizedValue)
      return
    }

    if (!value || typeof value !== "object" || visited.has(value)) {
      return
    }

    visited.add(value)

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item)
      }
      return
    }

    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      walk(childValue, childKey)
    }
  }

  for (const payload of payloads) {
    walk(payload)
  }

  collectUrlsFromText(decodedBody)

  if (!validationRequired) {
    validationRequired =
      lowerBody.includes("verification required") ||
      lowerBody.includes("verify your account") ||
      lowerBody.includes("account verification")
  }

  if (!message) {
    const fallback = decodedBody
      .split("\n")
      .map((line) => line.trim())
      .find(
        (line) =>
          line &&
          !line.startsWith("data:") &&
          /(verify|validation|required)/i.test(line),
      )
    if (fallback) {
      message = fallback
    }
  }

  return {
    validationRequired,
    message,
    verifyUrl: selectBestVerificationUrl([...structuredUrls, ...textUrls]),
  }
}

export type RateLimitReason =
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMIT_EXCEEDED"
  | "MODEL_CAPACITY_EXHAUSTED"
  | "SERVER_ERROR"
  | "UNKNOWN"

export interface RateLimitBackoffResult {
  backoffMs: number
  reason: RateLimitReason
}

const QUOTA_EXHAUSTED_BACKOFFS = [60_000, 300_000, 1_800_000, 7_200_000] as const
const RATE_LIMIT_EXCEEDED_BACKOFF = 30_000
const MODEL_CAPACITY_EXHAUSTED_BASE_BACKOFF = 45_000
const MODEL_CAPACITY_EXHAUSTED_JITTER_MAX = 30_000
const SERVER_ERROR_BACKOFF = 20_000
const UNKNOWN_BACKOFF = 60_000
const MIN_BACKOFF_MS = 2_000

function generateJitter(maxJitterMs: number): number {
  return Math.random() * maxJitterMs - maxJitterMs / 2
}

export function parseRateLimitReason(
  reason: string | undefined,
  message: string | undefined,
  status?: number,
): RateLimitReason {
  if (status === 529 || status === 503) return "MODEL_CAPACITY_EXHAUSTED"
  if (status === 500) return "SERVER_ERROR"

  if (reason) {
    switch (reason.toUpperCase()) {
      case "QUOTA_EXHAUSTED":
        return "QUOTA_EXHAUSTED"
      case "RATE_LIMIT_EXCEEDED":
        return "RATE_LIMIT_EXCEEDED"
      case "MODEL_CAPACITY_EXHAUSTED":
        return "MODEL_CAPACITY_EXHAUSTED"
    }
  }

  if (message) {
    const lower = message.toLowerCase()
    if (
      lower.includes("capacity") ||
      lower.includes("overloaded") ||
      lower.includes("resource exhausted")
    ) {
      return "MODEL_CAPACITY_EXHAUSTED"
    }
    if (
      lower.includes("per minute") ||
      lower.includes("rate limit") ||
      lower.includes("too many requests") ||
      lower.includes("presque")
    ) {
      return "RATE_LIMIT_EXCEEDED"
    }
    if (lower.includes("exhausted") || lower.includes("quota")) {
      return "QUOTA_EXHAUSTED"
    }
  }

  if (status === 429) {
    return "UNKNOWN"
  }

  return "UNKNOWN"
}

export function calculateBackoffMs(
  reason: RateLimitReason,
  consecutiveFailures: number,
  retryAfterMs?: number | null,
): number {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.max(retryAfterMs, MIN_BACKOFF_MS)
  }

  switch (reason) {
    case "QUOTA_EXHAUSTED": {
      const index = Math.min(
        consecutiveFailures,
        QUOTA_EXHAUSTED_BACKOFFS.length - 1,
      )
      return QUOTA_EXHAUSTED_BACKOFFS[index] ?? UNKNOWN_BACKOFF
    }
    case "RATE_LIMIT_EXCEEDED":
      return RATE_LIMIT_EXCEEDED_BACKOFF
    case "MODEL_CAPACITY_EXHAUSTED":
      return (
        MODEL_CAPACITY_EXHAUSTED_BASE_BACKOFF +
        generateJitter(MODEL_CAPACITY_EXHAUSTED_JITTER_MAX)
      )
    case "SERVER_ERROR":
      return SERVER_ERROR_BACKOFF
    case "UNKNOWN":
    default:
      return UNKNOWN_BACKOFF
  }
}

export type BaseQuotaKey = "claude" | "gemini-antigravity" | "gemini-cli"
export type QuotaKey = BaseQuotaKey | `${BaseQuotaKey}:${string}`

export interface ManagedAccount {
  index: number
  email?: string
  addedAt: number
  lastUsed: number
  parts: RefreshParts
  access?: string
  expires?: number
  enabled: boolean
  rateLimitResetTimes: RateLimitStateV3
  lastSwitchReason?: "rate-limit" | "initial" | "rotation"
  coolingDownUntil?: number
  cooldownReason?: CooldownReason
  touchedForQuota: Record<string, number>
  consecutiveFailures?: number
  lastFailureTime?: number
  fingerprint?: Fingerprint
  fingerprintHistory?: FingerprintVersion[]
  cachedQuota?: Partial<Record<QuotaGroup, QuotaGroupSummary>>
  cachedQuotaUpdatedAt?: number
  verificationRequired?: boolean
  verificationRequiredAt?: number
  verificationRequiredReason?: string
  verificationUrl?: string
}

export function getQuotaKey(
  family: ModelFamily,
  headerStyle: HeaderStyle,
  model?: string | null,
): QuotaKey {
  if (family === "claude") {
    return "claude"
  }
  const base =
    headerStyle === "gemini-cli" ? "gemini-cli" : "gemini-antigravity"
  if (model) {
    return `${base}:${model}`
  }
  return base
}

export function isRateLimitedForQuotaKey(
  account: ManagedAccount,
  key: QuotaKey,
): boolean {
  const resetTime = account.rateLimitResetTimes[key]
  return resetTime !== undefined && Date.now() < resetTime
}

export function clearExpiredRateLimits(account: ManagedAccount): void {
  const now = Date.now()
  const keys = Object.keys(account.rateLimitResetTimes) as QuotaKey[]
  for (const key of keys) {
    const resetTime = account.rateLimitResetTimes[key]
    if (resetTime !== undefined && now >= resetTime) {
      delete account.rateLimitResetTimes[key]
    }
  }
}

export function isRateLimitedForHeaderStyle(
  account: ManagedAccount,
  family: ModelFamily,
  headerStyle: HeaderStyle,
  model?: string | null,
): boolean {
  clearExpiredRateLimits(account)

  if (family === "claude") {
    return isRateLimitedForQuotaKey(account, "claude")
  }

  if (model) {
    const modelKey = getQuotaKey(family, headerStyle, model)
    if (isRateLimitedForQuotaKey(account, modelKey)) {
      return true
    }
  }

  const baseKey = getQuotaKey(family, headerStyle)
  return isRateLimitedForQuotaKey(account, baseKey)
}

export function isRateLimitedForFamily(
  account: ManagedAccount,
  family: ModelFamily,
  model?: string | null,
): boolean {
  if (family === "claude") {
    return isRateLimitedForQuotaKey(account, "claude")
  }

  const antigravityIsLimited = isRateLimitedForHeaderStyle(
    account,
    family,
    "antigravity",
    model,
  )
  const cliIsLimited = isRateLimitedForHeaderStyle(
    account,
    family,
    "gemini-cli",
    model,
  )

  return antigravityIsLimited && cliIsLimited
}

export function resolveQuotaGroup(
  family: ModelFamily,
  model?: string | null,
): QuotaGroup {
  if (model) {
    return classifyModelQuotaFamily(model)
  }
  return family === "claude" ? "claude" : "gemini-pro"
}

export function isOverSoftQuotaThreshold(
  account: ManagedAccount,
  family: ModelFamily,
  thresholdPercent: number,
  cacheTtlMs: number,
  model?: string | null,
  onDebugLog?: (message: string) => void,
): boolean {
  if (thresholdPercent >= 100) return false
  if (!account.cachedQuota) return false

  const quotaGroup = resolveQuotaGroup(family, model)
  const groupData = account.cachedQuota[quotaGroup]
  if (groupData?.remainingFraction == null) return false

  const remainingFraction = Math.max(0, Math.min(1, groupData.remainingFraction))
  const usedPercent = (1 - remainingFraction) * 100
  const isOverThreshold = usedPercent >= thresholdPercent

  if (!isOverThreshold) return false

  const now = Date.now()
  if (groupData.resetTime) {
    const resetTimestamp = Date.parse(groupData.resetTime)
    if (Number.isFinite(resetTimestamp) && resetTimestamp > now) {
      const accountLabel = formatAccountLabel(account.email, account.index)
      const message = `[SoftQuota] Skipping ${accountLabel}: ${quotaGroup} usage ${usedPercent.toFixed(1)}% >= threshold ${thresholdPercent}% (resets: ${groupData.resetTime})`
      onDebugLog?.(message)
      return true
    }
  }

  const accountLabel = formatAccountLabel(account.email, account.index)
  const resetSuffix = groupData.resetTime
    ? ` (resets: ${groupData.resetTime})`
    : ""

  if (account.cachedQuotaUpdatedAt == null) {
    return false
  }

  const age = now - account.cachedQuotaUpdatedAt
  const isStale = age > cacheTtlMs

  if (isStale) {
    const message = `[SoftQuota] Skipping ${accountLabel}: ${quotaGroup} usage ${usedPercent.toFixed(1)}% >= threshold ${thresholdPercent}%${resetSuffix} (stale cache, age=${Math.round(age / 1000)}s)`
    onDebugLog?.(message)
    return true
  }

  const message = `[SoftQuota] Skipping ${accountLabel}: ${quotaGroup} usage ${usedPercent.toFixed(1)}% >= threshold ${thresholdPercent}%${resetSuffix}`
  onDebugLog?.(message)
  return true
}

export function needsActiveQuotaRefresh(
  account: ManagedAccount,
  family: ModelFamily,
  thresholdPercent: number,
  refreshTtlMs: number = DEFAULT_SOFT_QUOTA_REFRESH_TTL_MS,
  nearThresholdMargin: number = DEFAULT_SOFT_QUOTA_NEAR_THRESHOLD_MARGIN,
  model?: string | null,
): boolean {
  if (account.enabled === false) return false
  if (thresholdPercent >= 100) return false

  if (!account.cachedQuota || account.cachedQuotaUpdatedAt == null) {
    return true
  }

  const age = Date.now() - account.cachedQuotaUpdatedAt
  if (age > refreshTtlMs) {
    return true
  }

  const quotaGroup = resolveQuotaGroup(family, model)
  const groupData = account.cachedQuota[quotaGroup]
  if (groupData?.remainingFraction == null) {
    return true
  }

  const remainingFraction = Math.max(0, Math.min(1, groupData.remainingFraction))
  const usedPercent = (1 - remainingFraction) * 100

  const warningStartPercent = Math.max(0, thresholdPercent - nearThresholdMargin)
  if (usedPercent >= warningStartPercent && usedPercent < thresholdPercent) {
    return true
  }

  return false
}

export function computeSoftQuotaCacheTtlMs(
  ttlConfig: "auto" | number,
  refreshIntervalMinutes: number,
): number {
  if (ttlConfig === "auto") {
    return Math.max(2 * refreshIntervalMinutes, 10) * 60 * 1000
  }
  return ttlConfig * 60 * 1000
}
