import type { HeaderStyle, ModelFamily } from "./storage.ts"

export const FIRST_RETRY_DELAY_MS = 1_000
export const SWITCH_ACCOUNT_DELAY_MS = 5_000
export const RATE_LIMIT_DEDUP_WINDOW_MS = 2_000
export const RATE_LIMIT_STATE_RESET_MS = 120_000
export const MAX_CONSECUTIVE_FAILURES = 5
export const FAILURE_COOLDOWN_MS = 30_000
export const FAILURE_STATE_RESET_MS = 120_000
export const CAPACITY_BACKOFF_BASE_DELAY_MS = 1_000
export const CAPACITY_BACKOFF_MAX_DELAY_MS = 8_000
export const MAX_CAPACITY_RETRIES_PER_ENDPOINT = 3

export interface RateLimitBodyInfo {
  retryDelayMs: number | null
  message?: string
  quotaResetTime?: string
  reason?: string
}

export interface DedupedRateLimitBackoff {
  attempt: number
  delayMs: number
  isDuplicate: boolean
}

export interface RateLimitBackoffTrackerOptions {
  dedupWindowMs?: number
  stateResetMs?: number
  now?: () => number
}

export interface RateLimitBackoffTracker {
  getBackoff(
    accountKey: string | number,
    quotaKey: string,
    serverRetryAfterMs: number | null,
    maxBackoffMs?: number,
  ): DedupedRateLimitBackoff
  reset(accountKey: string | number, quotaKey: string): void
  resetAllForAccount(accountKey: string | number): void
  clear(): void
}

export interface AccountFailureResult {
  failures: number
  shouldCooldown: boolean
  cooldownMs: number
}

export interface AccountFailureTrackerOptions {
  maxConsecutiveFailures?: number
  cooldownMs?: number
  stateResetMs?: number
  now?: () => number
}

export interface AccountFailureTracker {
  trackFailure(accountKey: string | number): AccountFailureResult
  reset(accountKey: string | number): void
  clear(): void
}

function getHeaderCaseInsensitive(
  headers: Pick<Headers, "get"> | Record<string, string | undefined> | undefined,
  name: string,
): string | null {
  if (!headers) {
    return null
  }
  if (typeof (headers as Pick<Headers, "get">).get === "function") {
    return (headers as Pick<Headers, "get">).get(name)
  }
  const lower = name.toLowerCase()
  for (const [key, val] of Object.entries(headers as Record<string, string | undefined>)) {
    if (key.toLowerCase() === lower && typeof val === "string") {
      return val
    }
  }
  return null
}

export function retryAfterMsFromHeaders(
  headers: Pick<Headers, "get"> | Record<string, string | undefined> | undefined,
  defaultRetryMs = 60_000,
): number {
  const retryAfterMsHeader = getHeaderCaseInsensitive(headers, "retry-after-ms")
  if (retryAfterMsHeader) {
    const parsed = Number.parseInt(retryAfterMsHeader, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed
    }
  }

  const retryAfterHeader = getHeaderCaseInsensitive(headers, "retry-after")
  if (retryAfterHeader) {
    const parsed = Number.parseInt(retryAfterHeader, 10)
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed * 1_000
    }
  }

  return defaultRetryMs
}

export function retryAfterMsFromResponse(
  response: Pick<Response, "headers">,
  defaultRetryMs = 60_000,
): number {
  return retryAfterMsFromHeaders(response.headers, defaultRetryMs)
}

const SIMPLE_DURATION_REGEX = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i
const COMPOUND_DURATION_FULL_REGEX = /^(?:\d+(?:\.\d+)?(?:h|m(?!s)|s|ms))+$/i
const COMPOUND_DURATION_TOKEN_REGEX = /(\d+(?:\.\d+)?)(h|m(?!s)|s|ms)/gi

export function parseDurationToMs(duration: string): number | null {
  const trimmed = duration.trim()
  if (!trimmed) {
    return null
  }

  const simpleMatch = trimmed.match(SIMPLE_DURATION_REGEX)
  if (simpleMatch) {
    const value = Number.parseFloat(simpleMatch[1]!)
    if (!Number.isFinite(value)) {
      return null
    }
    const unit = (simpleMatch[2] || "s").toLowerCase()
    switch (unit) {
      case "h":
        return value * 3_600 * 1_000
      case "m":
        return value * 60 * 1_000
      case "s":
        return value * 1_000
      case "ms":
        return value
      default:
        return value * 1_000
    }
  }

  if (!COMPOUND_DURATION_FULL_REGEX.test(trimmed)) {
    return null
  }

  COMPOUND_DURATION_TOKEN_REGEX.lastIndex = 0
  let totalMs = 0
  let matchFound = false
  let match = COMPOUND_DURATION_TOKEN_REGEX.exec(trimmed)
  while (match !== null) {
    matchFound = true
    const value = Number.parseFloat(match[1]!)
    if (!Number.isFinite(value)) {
      return null
    }
    const unit = match[2]!.toLowerCase()
    switch (unit) {
      case "h":
        totalMs += value * 3_600 * 1_000
        break
      case "m":
        totalMs += value * 60 * 1_000
        break
      case "s":
        totalMs += value * 1_000
        break
      case "ms":
        totalMs += value
        break
    }
    match = COMPOUND_DURATION_TOKEN_REGEX.exec(trimmed)
  }

  return matchFound ? totalMs : null
}

function parseResetAfterFromMessage(message: string | undefined): number | null {
  if (!message) {
    return null
  }
  const afterMatch = message.match(/reset after\s+([0-9hms.]+)/i)
  const rawDuration = afterMatch?.[1]
  return rawDuration ? parseDurationToMs(rawDuration) : null
}

export function extractRateLimitBodyInfo(body: unknown): RateLimitBodyInfo {
  if (!body || typeof body !== "object") {
    return { retryDelayMs: null }
  }

  const error = (body as { error?: unknown }).error
  const rawMessage =
    error && typeof error === "object"
      ? (error as { message?: unknown }).message
      : undefined
  const message = typeof rawMessage === "string" ? rawMessage : undefined

  const details =
    error && typeof error === "object"
      ? (error as { details?: unknown[] }).details
      : undefined

  let reason: string | undefined
  if (Array.isArray(details)) {
    for (const detail of details) {
      if (!detail || typeof detail !== "object") continue
      const type = (detail as { "@type"?: unknown })["@type"]
      if (typeof type === "string" && type.includes("google.rpc.ErrorInfo")) {
        const detailReason = (detail as { reason?: unknown }).reason
        if (typeof detailReason === "string") {
          reason = detailReason
          break
        }
      }
    }

    for (const detail of details) {
      if (!detail || typeof detail !== "object") continue
      const type = (detail as { "@type"?: unknown })["@type"]
      if (typeof type === "string" && type.includes("google.rpc.RetryInfo")) {
        const retryDelay = (detail as { retryDelay?: unknown }).retryDelay
        if (typeof retryDelay === "string") {
          const retryDelayMs = parseDurationToMs(retryDelay)
          if (retryDelayMs !== null) {
            return { retryDelayMs, message, reason }
          }
        }
      }
    }

    for (const detail of details) {
      if (!detail || typeof detail !== "object") continue
      const metadata = (detail as { metadata?: Record<string, unknown> }).metadata
      if (metadata && typeof metadata === "object") {
        const quotaResetDelay = metadata.quotaResetDelay
        const quotaResetTime =
          typeof metadata.quotaResetTimeStamp === "string"
            ? metadata.quotaResetTimeStamp
            : undefined
        if (typeof quotaResetDelay === "string") {
          const quotaResetDelayMs = parseDurationToMs(quotaResetDelay)
          if (quotaResetDelayMs !== null) {
            return {
              retryDelayMs: quotaResetDelayMs,
              message,
              quotaResetTime,
              reason,
            }
          }
        }
      }
    }
  }

  const messageResetMs = parseResetAfterFromMessage(message)
  if (messageResetMs !== null) {
    return { retryDelayMs: messageResetMs, message, reason }
  }

  return { retryDelayMs: null, message, reason }
}

export function extractRateLimitTextInfo(text: string): RateLimitBodyInfo {
  const trimmed = text.trim()
  if (!trimmed) {
    return { retryDelayMs: null }
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown
    return extractRateLimitBodyInfo(parsed)
  } catch {
    const fallbackDelay = parseResetAfterFromMessage(trimmed)
    return {
      retryDelayMs: fallbackDelay,
      message: trimmed.slice(0, 500),
    }
  }
}

export async function extractRetryInfoFromBody(
  response: Response,
): Promise<RateLimitBodyInfo> {
  try {
    if (response.bodyUsed) {
      return { retryDelayMs: null }
    }
    const text = await response.clone().text()
    try {
      const parsed = JSON.parse(text) as unknown
      return extractRateLimitBodyInfo(parsed)
    } catch {
      return { retryDelayMs: null }
    }
  } catch {
    return { retryDelayMs: null }
  }
}

export function formatWaitTime(ms: number): string {
  if (ms < 1_000) return `${ms}ms`
  const seconds = Math.ceil(ms / 1_000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

export function calculateCapacityBackoffMs(
  attemptIndex: number,
  randomFn: () => number = Math.random,
): number {
  const normalizedAttempt =
    Number.isFinite(attemptIndex) && attemptIndex > 0 ? Math.floor(attemptIndex) : 0
  const exponentialDelay = Math.min(
    CAPACITY_BACKOFF_BASE_DELAY_MS * Math.pow(2, normalizedAttempt),
    CAPACITY_BACKOFF_MAX_DELAY_MS,
  )
  const rawRandom = randomFn()
  const clampedRandom = Number.isFinite(rawRandom)
    ? Math.min(1, Math.max(0, rawRandom))
    : 0.5
  const jitter = exponentialDelay * (0.9 + clampedRandom * 0.2)
  return Math.round(jitter)
}

export function headerStyleToQuotaKey(
  headerStyle: HeaderStyle,
  family: ModelFamily,
): string {
  if (family === "claude") return "claude"
  return headerStyle === "antigravity" ? "gemini-antigravity" : "gemini-cli"
}

interface InternalRateLimitEntry {
  consecutive429: number
  lastAt: number
  quotaKey: string
}

export function createRateLimitBackoffTracker(
  options: RateLimitBackoffTrackerOptions = {},
): RateLimitBackoffTracker {
  const dedupWindowMs = options.dedupWindowMs ?? RATE_LIMIT_DEDUP_WINDOW_MS
  const stateResetMs = options.stateResetMs ?? RATE_LIMIT_STATE_RESET_MS
  const stateByAccountQuota = new Map<string, InternalRateLimitEntry>()

  const makeKey = (accountKey: string | number, quotaKey: string): string =>
    `${String(accountKey)}\u0000${quotaKey}`

  return {
    getBackoff(accountKey, quotaKey, serverRetryAfterMs, maxBackoffMs = 60_000) {
      const now = (options.now ?? Date.now)()
      const stateKey = makeKey(accountKey, quotaKey)
      const previous = stateByAccountQuota.get(stateKey)

      if (
        previous &&
        now - previous.lastAt >= 0 &&
        now - previous.lastAt < dedupWindowMs
      ) {
        const baseDelay = serverRetryAfterMs ?? 1_000
        const backoffDelay = Math.min(
          baseDelay * Math.pow(2, previous.consecutive429 - 1),
          maxBackoffMs,
        )
        return {
          attempt: previous.consecutive429,
          delayMs: Math.max(baseDelay, backoffDelay),
          isDuplicate: true,
        }
      }

      const attempt =
        previous &&
        now - previous.lastAt >= 0 &&
        now - previous.lastAt < stateResetMs
          ? previous.consecutive429 + 1
          : 1

      stateByAccountQuota.set(stateKey, {
        consecutive429: attempt,
        lastAt: now,
        quotaKey,
      })

      const baseDelay = serverRetryAfterMs ?? 1_000
      const backoffDelay = Math.min(
        baseDelay * Math.pow(2, attempt - 1),
        maxBackoffMs,
      )
      return {
        attempt,
        delayMs: Math.max(baseDelay, backoffDelay),
        isDuplicate: false,
      }
    },

    reset(accountKey, quotaKey) {
      stateByAccountQuota.delete(makeKey(accountKey, quotaKey))
    },

    resetAllForAccount(accountKey) {
      const prefix = `${String(accountKey)}\u0000`
      for (const key of stateByAccountQuota.keys()) {
        if (key.startsWith(prefix)) {
          stateByAccountQuota.delete(key)
        }
      }
    },

    clear() {
      stateByAccountQuota.clear()
    },
  }
}

interface InternalFailureEntry {
  consecutiveFailures: number
  lastFailureAt: number
}

export function createAccountFailureTracker(
  options: AccountFailureTrackerOptions = {},
): AccountFailureTracker {
  const maxFailures = options.maxConsecutiveFailures ?? MAX_CONSECUTIVE_FAILURES
  const cooldownMs = options.cooldownMs ?? FAILURE_COOLDOWN_MS
  const stateResetMs = options.stateResetMs ?? FAILURE_STATE_RESET_MS
  const failureState = new Map<string, InternalFailureEntry>()

  return {
    trackFailure(accountKey) {
      const now = (options.now ?? Date.now)()
      const key = String(accountKey)
      const previous = failureState.get(key)
      const failures =
        previous &&
        now - previous.lastFailureAt >= 0 &&
        now - previous.lastFailureAt < stateResetMs
          ? previous.consecutiveFailures + 1
          : 1

      failureState.set(key, { consecutiveFailures: failures, lastFailureAt: now })
      const shouldCooldown = failures >= maxFailures
      return {
        failures,
        shouldCooldown,
        cooldownMs: shouldCooldown ? cooldownMs : 0,
      }
    },

    reset(accountKey) {
      failureState.delete(String(accountKey))
    },

    clear() {
      failureState.clear()
    },
  }
}

export function abortableSleep(
  ms: number,
  signal?: AbortSignal | null,
): Promise<void> {
  const delayMs = Number.isFinite(ms) && ms > 0 ? ms : 0
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("Aborted"))
      return
    }

    const cleanup = () => {
      clearTimeout(timeout)
      signal?.removeEventListener("abort", onAbort)
    }

    const onAbort = () => {
      cleanup()
      reject(signal?.reason instanceof Error ? signal.reason : new Error("Aborted"))
    }

    const timeout = setTimeout(() => {
      cleanup()
      resolve()
    }, delayMs)

    signal?.addEventListener("abort", onAbort, { once: true })
  })
}
