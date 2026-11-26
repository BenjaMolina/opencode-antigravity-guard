import type { AccountManager } from "./accounts.ts"
import {
  accessTokenExpired,
  classifyModelQuotaFamily,
  formatRefreshParts,
  parseRefreshParts,
  type ManagedAccount,
  type OAuthAuthDetails,
  type QuotaGroup,
  type QuotaGroupSummary,
} from "./account-helpers.ts"
import { ANTIGRAVITY_ENDPOINTS } from "./constants.ts"
import type { AccountMetadataV3 } from "./storage.ts"

export const DEFAULT_QUOTA_FETCH_TIMEOUT_MS = 10_000
export const DEFAULT_POOL_QUOTA_REFRESH_COOLDOWN_MS = 60_000

export type { QuotaGroup, QuotaGroupSummary }

export interface QuotaSummary {
  groups: Partial<Record<QuotaGroup, QuotaGroupSummary>>
  modelCount: number
  error?: string
}

export interface GeminiCliQuotaModel {
  modelId: string
  remainingFraction: number
  resetTime?: string
}

export interface GeminiCliQuotaSummary {
  models: GeminiCliQuotaModel[]
  error?: string
}

export interface GeminiCliQuotaBucket {
  remainingAmount?: string
  remainingFraction?: number
  resetTime?: string
  tokenType?: string
  modelId?: string
}

export interface RetrieveUserQuotaResponse {
  buckets?: GeminiCliQuotaBucket[]
}

export type AccountQuotaStatus = "ok" | "disabled" | "error"

export interface AccountQuotaResult {
  index: number
  email?: string
  refreshToken?: string
  status: AccountQuotaStatus
  error?: string
  disabled?: boolean
  quota?: QuotaSummary
  geminiCliQuota?: GeminiCliQuotaSummary
  updatedAccount?: AccountMetadataV3
}

export interface FetchAvailableModelsResponse {
  models?: Record<string, FetchAvailableModelEntry>
}

export interface FetchAvailableModelEntry {
  quotaInfo?: {
    remainingFraction?: number
    resetTime?: string
  }
  displayName?: string
  modelName?: string
}

export interface FetchAvailableModelsOptions {
  endpoint?: string
  userAgent?: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  signal?: AbortSignal
}

export interface FetchGeminiCliQuotaOptions {
  endpoint?: string
  platform?: string
  arch?: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  signal?: AbortSignal
}

export interface CheckAccountsQuotaDependencies {
  refreshAuth: (
    auth: OAuthAuthDetails,
    account: AccountMetadataV3,
  ) => Promise<OAuthAuthDetails | undefined>
  resolveProjectContext: (
    auth: OAuthAuthDetails,
    account: AccountMetadataV3,
  ) => Promise<{ auth: OAuthAuthDetails; effectiveProjectId: string }>
  getUserAgent?: () => string
  endpoint?: string
  platform?: string
  arch?: string
  fetch?: typeof globalThis.fetch
  timeoutMs?: number
  signal?: AbortSignal
  now?: () => number
  onQuotaFetchLog?: (
    stage: "start" | "complete" | "error",
    count?: number,
    detail?: string,
  ) => void
  onQuotaStatusLog?: (
    email: string | undefined,
    index: number,
    remainingPercent: number,
    family: string,
  ) => void
}

export interface PoolQuotaRefreshCoordinatorOptions {
  cooldownMs?: number
  now?: () => number
}

export interface PoolQuotaRefreshCoordinator {
  triggerForAll(
    accountManager: AccountManager,
    runCheck: (accounts: AccountMetadataV3[]) => Promise<AccountQuotaResult[]>,
    onError?: (error: unknown) => void,
  ): Promise<void>
  refreshSingle(
    account: ManagedAccount,
    accountManager: AccountManager,
    runCheck: (accounts: AccountMetadataV3[]) => Promise<AccountQuotaResult[]>,
    onError?: (error: unknown) => void,
  ): Promise<boolean>
}

function buildAuthFromAccount(account: AccountMetadataV3): OAuthAuthDetails {
  return {
    type: "oauth",
    refresh: formatRefreshParts({
      refreshToken: account.refreshToken,
      projectId: account.projectId,
      managedProjectId: account.managedProjectId,
    }),
    access: undefined,
    expires: undefined,
  }
}

export function normalizeRemainingFraction(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0
  }
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

export function parseQuotaResetTime(resetTime?: string): number | null {
  if (!resetTime) return null
  const timestamp = Date.parse(resetTime)
  if (!Number.isFinite(timestamp)) {
    return null
  }
  return timestamp
}

export function classifyQuotaGroup(
  modelName: string,
  displayName?: string,
): QuotaGroup | null {
  const combined = `${modelName} ${displayName ?? ""}`.toLowerCase()
  if (combined.includes("claude")) {
    return "claude"
  }
  const isGemini3Or4 =
    combined.includes("gemini-3") ||
    combined.includes("gemini 3") ||
    combined.includes("gemini-4") ||
    combined.includes("gemini 4")
  if (!isGemini3Or4) {
    return null
  }
  const family = classifyModelQuotaFamily(modelName)
  return family === "gemini-flash" ? "gemini-flash" : "gemini-pro"
}

export function aggregateQuota(
  models?: Record<string, FetchAvailableModelEntry>,
): QuotaSummary {
  const groups: Partial<Record<QuotaGroup, QuotaGroupSummary>> = {}
  if (!models) {
    return { groups, modelCount: 0 }
  }

  let totalCount = 0
  for (const [modelName, entry] of Object.entries(models)) {
    const group = classifyQuotaGroup(modelName, entry.displayName ?? entry.modelName)
    if (!group) {
      continue
    }
    const quotaInfo = entry.quotaInfo
    const remainingFraction = quotaInfo
      ? normalizeRemainingFraction(quotaInfo.remainingFraction)
      : undefined
    const resetTime = quotaInfo?.resetTime
    const resetTimestamp = parseQuotaResetTime(resetTime)

    totalCount += 1

    const existing = groups[group]
    const nextCount = (existing?.modelCount ?? 0) + 1
    const useCurrentQuota =
      remainingFraction !== undefined &&
      (existing?.remainingFraction === undefined ||
        remainingFraction < existing.remainingFraction)
    const nextRemaining = useCurrentQuota ? remainingFraction : existing?.remainingFraction
    const nextResetTime = useCurrentQuota
      ? resetTime
      : existing?.resetTime ?? (resetTimestamp === null ? undefined : resetTime)

    groups[group] = {
      remainingFraction: nextRemaining,
      resetTime: nextResetTime,
      modelCount: nextCount,
    }
  }

  return { groups, modelCount: totalCount }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  options?: {
    fetch?: typeof globalThis.fetch
    timeoutMs?: number
    signal?: AbortSignal
  },
): Promise<Response> {
  const fetchImpl = options?.fetch ?? globalThis.fetch
  const rawTimeout = options?.timeoutMs
  const timeoutMs =
    typeof rawTimeout === "number" && Number.isFinite(rawTimeout) && rawTimeout > 0
      ? rawTimeout
      : DEFAULT_QUOTA_FETCH_TIMEOUT_MS
  const callerSignal = options?.signal
  callerSignal?.throwIfAborted()

  const controller = new AbortController()
  const onCallerAbort = () => controller.abort(callerSignal?.reason)
  callerSignal?.addEventListener("abort", onCallerAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
    callerSignal?.removeEventListener("abort", onCallerAbort)
  }
}

function normalizeEndpointBase(endpoint: string): string {
  return endpoint.replace(/\/+$/, "")
}

export async function fetchAvailableModels(
  accessToken: string,
  projectId: string,
  options?: FetchAvailableModelsOptions,
): Promise<FetchAvailableModelsResponse> {
  const endpoint = normalizeEndpointBase(
    options?.endpoint ?? ANTIGRAVITY_ENDPOINTS.production,
  )
  const quotaUserAgent = options?.userAgent || "antigravity/windows/amd64"
  const errors: string[] = []

  const body = projectId ? { project: projectId } : {}
  const response = await fetchWithTimeout(
    `${endpoint}/v1internal:fetchAvailableModels`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": quotaUserAgent,
      },
      body: JSON.stringify(body),
    },
    options,
  )

  if (response.ok) {
    const parsed: unknown = await response.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {}
    }
    return parsed as FetchAvailableModelsResponse
  }

  const message = await response.text().catch(() => "")
  const snippet = message.trim().slice(0, 200)
  errors.push(
    `fetchAvailableModels ${response.status} at ${endpoint}${snippet ? `: ${snippet}` : ""}`,
  )

  throw new Error(errors.join("; ") || "fetchAvailableModels failed")
}

export async function fetchGeminiCliQuota(
  accessToken: string,
  projectId: string,
  options?: FetchGeminiCliQuotaOptions,
): Promise<RetrieveUserQuotaResponse> {
  const endpoint = normalizeEndpointBase(
    options?.endpoint ?? ANTIGRAVITY_ENDPOINTS.production,
  )
  const platform = options?.platform || process.platform || "darwin"
  const arch = options?.arch || process.arch || "arm64"
  const geminiCliUserAgent = `GeminiCLI/1.0.0/gemini-2.5-pro (${platform}; ${arch})`
  const body = projectId ? { project: projectId } : {}

  try {
    const response = await fetchWithTimeout(
      `${endpoint}/v1internal:retrieveUserQuota`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "User-Agent": geminiCliUserAgent,
        },
        body: JSON.stringify(body),
      },
      options,
    )

    if (response.ok) {
      const parsed: unknown = await response.json()
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { buckets: [] }
      }
      return parsed as RetrieveUserQuotaResponse
    }

    return { buckets: [] }
  } catch {
    return { buckets: [] }
  }
}

export function aggregateGeminiCliQuota(
  response: RetrieveUserQuotaResponse,
): GeminiCliQuotaSummary {
  const models: GeminiCliQuotaModel[] = []
  if (!response.buckets || response.buckets.length === 0) {
    return { models }
  }

  for (const bucket of response.buckets) {
    if (!bucket.modelId) {
      continue
    }
    const modelId = bucket.modelId
    const isRelevantModel =
      modelId.startsWith("gemini-3-") || modelId === "gemini-2.5-pro"
    if (!isRelevantModel) {
      continue
    }
    models.push({
      modelId: bucket.modelId,
      remainingFraction: normalizeRemainingFraction(bucket.remainingFraction),
      resetTime: bucket.resetTime,
    })
  }

  models.sort((a, b) => a.modelId.localeCompare(b.modelId))
  return { models }
}

function applyAccountUpdates(
  account: AccountMetadataV3,
  auth: OAuthAuthDetails,
): AccountMetadataV3 | undefined {
  const parts = parseRefreshParts(auth.refresh)
  if (!parts.refreshToken) {
    return undefined
  }

  const updated: AccountMetadataV3 = {
    ...account,
    refreshToken: parts.refreshToken,
    projectId: parts.projectId ?? account.projectId,
    managedProjectId: parts.managedProjectId ?? account.managedProjectId,
  }

  const changed =
    updated.refreshToken !== account.refreshToken ||
    updated.projectId !== account.projectId ||
    updated.managedProjectId !== account.managedProjectId

  return changed ? updated : undefined
}

export async function checkAccountsQuotaWithDeps(
  accounts: AccountMetadataV3[],
  deps: CheckAccountsQuotaDependencies,
): Promise<AccountQuotaResult[]> {
  const results: AccountQuotaResult[] = []
  deps.onQuotaFetchLog?.("start", accounts.length)

  for (const [index, account] of accounts.entries()) {
    deps.signal?.throwIfAborted()
    const disabled = account.enabled === false
    let auth = buildAuthFromAccount(account)

    try {
      if (accessTokenExpired(auth, deps.now?.())) {
        const refreshed = await deps.refreshAuth(auth, account)
        if (!refreshed) {
          throw new Error("Token refresh failed")
        }
        auth = refreshed
      }

      const projectContext = await deps.resolveProjectContext(auth, account)
      auth = projectContext.auth
      const updatedAccount = applyAccountUpdates(account, auth)

      const userAgent = deps.getUserAgent?.() || "antigravity/windows/amd64"
      const [antigravityResponse, geminiCliResponse] = await Promise.all([
        fetchAvailableModels(auth.access ?? "", projectContext.effectiveProjectId, {
          endpoint: deps.endpoint,
          userAgent,
          fetch: deps.fetch,
          timeoutMs: deps.timeoutMs,
          signal: deps.signal,
        }).catch((): FetchAvailableModelsResponse => ({ models: undefined })),
        fetchGeminiCliQuota(auth.access ?? "", projectContext.effectiveProjectId, {
          endpoint: deps.endpoint,
          platform: deps.platform,
          arch: deps.arch,
          fetch: deps.fetch,
          timeoutMs: deps.timeoutMs,
          signal: deps.signal,
        }),
      ])

      const quotaResult: QuotaSummary =
        antigravityResponse.models === undefined
          ? {
              groups: {},
              modelCount: 0,
              error: "Failed to fetch Antigravity quota",
            }
          : aggregateQuota(antigravityResponse.models)

      const geminiCliQuotaResult = aggregateGeminiCliQuota(geminiCliResponse)
      if (
        geminiCliResponse.buckets === undefined ||
        geminiCliResponse.buckets.length === 0
      ) {
        geminiCliQuotaResult.error =
          geminiCliQuotaResult.models.length === 0
            ? "No Gemini CLI quota available"
            : undefined
      }

      results.push({
        index,
        email: account.email,
        refreshToken: account.refreshToken,
        status: "ok",
        disabled,
        quota: quotaResult,
        geminiCliQuota: geminiCliQuotaResult,
        updatedAccount,
      })

      for (const [family, groupQuota] of Object.entries(quotaResult.groups)) {
        const remainingPercent = (groupQuota.remainingFraction ?? 0) * 100
        deps.onQuotaStatusLog?.(account.email, index, remainingPercent, family)
      }
    } catch (error) {
      if (deps.signal?.aborted) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      results.push({
        index,
        email: account.email,
        refreshToken: account.refreshToken,
        status: "error",
        disabled,
        error: message,
      })
      deps.onQuotaFetchLog?.(
        "error",
        undefined,
        `account=${account.email ?? index} error=${message}`,
      )
    }
  }

  deps.onQuotaFetchLog?.(
    "complete",
    accounts.length,
    `ok=${results.filter((r) => r.status === "ok").length} errors=${results.filter((r) => r.status === "error").length}`,
  )
  return results
}

export function createPoolQuotaRefreshCoordinator(
  options: PoolQuotaRefreshCoordinatorOptions = {},
): PoolQuotaRefreshCoordinator {
  const cooldownMs = options.cooldownMs ?? DEFAULT_POOL_QUOTA_REFRESH_COOLDOWN_MS
  let lastPoolRefreshTime: number | null = null

  const resolveAccountRef = (
    accountManager: AccountManager,
    result: AccountQuotaResult,
  ): string | undefined => {
    const rotated = result.updatedAccount?.refreshToken
    if (
      rotated &&
      accountManager.getAccounts().some((acc) => acc.parts.refreshToken === rotated)
    ) {
      return rotated
    }
    return result.refreshToken
  }

  return {
    async triggerForAll(accountManager, runCheck, onError) {
      const now = (options.now ?? Date.now)()
      if (
        lastPoolRefreshTime !== null &&
        now - lastPoolRefreshTime >= 0 &&
        now - lastPoolRefreshTime < cooldownMs
      ) {
        return
      }
      lastPoolRefreshTime = now

      try {
        const accountsMetadata = accountManager.getAccountsForQuotaCheck()
        if (accountsMetadata.length === 0) {
          return
        }
        const results = await runCheck(accountsMetadata)
        for (const result of results) {
          if (result.status === "ok" && result.quota && !result.quota.error) {
            const targetToken = resolveAccountRef(accountManager, result)
            if (targetToken) {
              accountManager.updateQuotaCache(targetToken, result.quota.groups)
            }
          }
        }
      } catch (error) {
        onError?.(error)
      }
    },

    async refreshSingle(account, accountManager, runCheck, onError) {
      try {
        const meta: AccountMetadataV3 = {
          email: account.email,
          refreshToken: account.parts.refreshToken,
          projectId: account.parts.projectId,
          managedProjectId: account.parts.managedProjectId,
          addedAt: account.addedAt,
          lastUsed: account.lastUsed,
          enabled: account.enabled,
        }
        const results = await runCheck([meta])
        const res = results[0]
        if (res && res.status === "ok" && res.quota && !res.quota.error) {
          const targetToken = resolveAccountRef(accountManager, res)
          if (targetToken) {
            accountManager.updateQuotaCache(targetToken, res.quota.groups)
            return true
          }
        }
        return false
      } catch (error) {
        onError?.(error)
        return false
      }
    },
  }
}
