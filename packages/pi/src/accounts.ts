import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import {
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
  AccountManager,
  DEFAULT_POOL_QUOTA_REFRESH_COOLDOWN_MS,
  DEFAULT_SOFT_QUOTA_NEAR_THRESHOLD_MARGIN,
  DEFAULT_SOFT_QUOTA_REFRESH_TTL_MS,
  HealthScoreTracker,
  ProactiveRefreshQueue,
  TokenBucketTracker,
  calculateBackoffMs,
  checkAccountsQuotaWithDeps,
  computeSoftQuotaCacheTtlMs,
  createAccountFailureTracker,
  createPoolQuotaRefreshCoordinator,
  createRateLimitBackoffTracker,
  extractRateLimitTextInfo,
  extractVerificationErrorDetails,
  formatAccountLabel,
  formatRefreshParts,
  formatWaitTime,
  generateFingerprint,
  getQuotaKey,
  headerStyleToQuotaKey,
  loadAccountsFromPath,
  parseRateLimitReason,
  parseRefreshParts,
  resolveQuotaGroup,
  resolveSharedGuardPaths,
  retryAfterMsFromHeaders,
  saveAccountsReplaceToPath,
  saveAccountsToPath,
  updateFingerprintVersion,
  type AccountMetadataV3,
  type AccountQuotaResult,
  type ManagedAccount,
  type ModelFamily,
  type OAuthAuthDetails,
  type ResolveSharedGuardPathsOptions,
  type SharedGuardConfig,
} from "@benjamolina/antigravity-guard-core"

import { AuthHttpError, refreshCredentials } from "./auth-http.ts"
import { defaultProjectId } from "./project.ts"
import {
  createPoolUnavailableError,
  type PoolUnavailableErrorDescriptor,
  type StreamTransportError,
} from "./stream.ts"

const PI_PROVIDER_KEY = "antigravity-guard"
export const SHARED_POOL_PLACEHOLDER_ACCESS = "shared-pool-pending-refresh"
const POOL_SYNCED_MARKER = "poolSynced"
const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 60_000

export interface PiAuthJsonEntry {
  type: "oauth"
  refresh: string
  access: string
  expires: number
  projectId?: string
  email?: string
  poolSynced?: boolean
}

export function resolvePiAuthJsonPath(options: ResolveSharedGuardPathsOptions = {}): string {
  const env = options.env ?? process.env
  const home = options.homeDir ?? homedir()
  const piDir = env.PI_CODING_AGENT_DIR?.trim() || join(home, ".pi", "agent")
  return join(piDir, "auth.json")
}

export function readPiAuthEntry(authJsonPath: string): PiAuthJsonEntry | null {
  try {
    if (!existsSync(authJsonPath)) return null
    const raw = JSON.parse(readFileSync(authJsonPath, "utf8")) as unknown
    if (!isRecord(raw)) return null
    const entry = raw[PI_PROVIDER_KEY]
    if (!isRecord(entry) || entry.type !== "oauth" || typeof entry.refresh !== "string" || !entry.refresh.trim()) {
      return null
    }
    const rawAccess = typeof entry.access === "string" ? entry.access : ""
    const isPlaceholder = rawAccess === SHARED_POOL_PLACEHOLDER_ACCESS
    const isPoolSynced = isPlaceholder || entry[POOL_SYNCED_MARKER] === true
    return {
      type: "oauth",
      refresh: entry.refresh.trim(),
      access: isPlaceholder ? "" : rawAccess,
      expires:
        !isPlaceholder && typeof entry.expires === "number" && Number.isFinite(entry.expires)
          ? entry.expires
          : 0,
      ...(typeof entry.projectId === "string" && entry.projectId.trim() ? { projectId: entry.projectId.trim() } : {}),
      ...(typeof entry.email === "string" && entry.email.trim() ? { email: entry.email.trim() } : {}),
      ...(isPoolSynced ? { poolSynced: true } : {}),
    }
  } catch {
    return null
  }
}

function buildPiAuthEntryObject(
  account: ManagedAccount,
  nowMs = Date.now(),
): Record<string, unknown> {
  const projectId =
    account.parts.projectId ??
    account.parts.managedProjectId ??
    defaultProjectId(account.email ?? "antigravity-default")
  const hasRealAccess =
    Boolean(account.access) &&
    account.access !== SHARED_POOL_PLACEHOLDER_ACCESS &&
    Boolean(account.expires)

  return {
    type: "oauth",
    refresh: account.parts.refreshToken,
    access: hasRealAccess ? account.access! : SHARED_POOL_PLACEHOLDER_ACCESS,
    expires: hasRealAccess ? account.expires! : nowMs + 365 * 24 * 60 * 60 * 1_000,
    projectId,
    [POOL_SYNCED_MARKER]: true,
    ...(account.email ? { email: account.email } : {}),
  }
}

function writeAuthJsonAtomic(authJsonPath: string, root: Record<string, unknown>): void {
  mkdirSync(dirname(authJsonPath), { recursive: true })
  const tempPath = `${authJsonPath}.${randomBytes(6).toString("hex")}.tmp`
  try {
    writeFileSync(tempPath, `${JSON.stringify(root, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    })
    renameSync(tempPath, authJsonPath)
  } catch (error) {
    try {
      unlinkSync(tempPath)
    } catch {
      // Ignore cleanup failure
    }
    throw error
  }
}

export function seedPiAuthJsonIfMissing(
  authJsonPath: string,
  account: ManagedAccount,
  nowMs = Date.now(),
): boolean {
  try {
    let existingRoot: Record<string, unknown> = {}
    if (existsSync(authJsonPath)) {
      const parsed = JSON.parse(readFileSync(authJsonPath, "utf8")) as unknown
      if (!isRecord(parsed)) {
        return false
      }
      if (isRecord(parsed[PI_PROVIDER_KEY]) && parsed[PI_PROVIDER_KEY]?.type === "oauth") {
        return false
      }
      existingRoot = { ...parsed }
    }

    existingRoot[PI_PROVIDER_KEY] = buildPiAuthEntryObject(account, nowMs)
    writeAuthJsonAtomic(authJsonPath, existingRoot)
    return true
  } catch {
    return false
  }
}

export function syncPiAuthJsonWithPool(
  authJsonPath: string,
  activeManager: AccountManager,
): boolean {
  try {
    if (!existsSync(authJsonPath)) {
      return false
    }
    const parsed = JSON.parse(readFileSync(authJsonPath, "utf8")) as unknown
    if (!isRecord(parsed) || !isRecord(parsed[PI_PROVIDER_KEY])) {
      return false
    }

    const entry = parsed[PI_PROVIDER_KEY]
    const rawRefresh =
      typeof entry?.refresh === "string"
        ? entry.refresh
        : ""
    const currentRefresh = parseRefreshParts(rawRefresh).refreshToken
    const stillPresent =
      Boolean(currentRefresh) &&
      activeManager.getAccounts().some((acc) => acc.parts.refreshToken === currentRefresh)

    if (stillPresent) {
      if (entry[POOL_SYNCED_MARKER] === true) {
        return false
      }
      const updatedRoot: Record<string, unknown> = {
        ...parsed,
        [PI_PROVIDER_KEY]: { ...entry, [POOL_SYNCED_MARKER]: true },
      }
      writeAuthJsonAtomic(authJsonPath, updatedRoot)
      return true
    }

    const updatedRoot: Record<string, unknown> = { ...parsed }
    const replacement =
      activeManager.getEnabledAccounts()[0] ?? activeManager.getAccounts()[0]
    if (replacement) {
      updatedRoot[PI_PROVIDER_KEY] = buildPiAuthEntryObject(replacement)
    } else {
      delete updatedRoot[PI_PROVIDER_KEY]
    }
    writeAuthJsonAtomic(authJsonPath, updatedRoot)
    return true
  } catch {
    return false
  }
}

export interface PiAccountPoolOptions extends ResolveSharedGuardPathsOptions {
  fetch?: typeof globalThis.fetch
  now?: () => number
  getVersion: () => string
  getConfig: () => SharedGuardConfig
}

export interface SelectedPoolCredentials {
  account: ManagedAccount
  accessToken: string
  projectId: string
  userAgent: string
  tokenConsumed?: boolean
}

export interface PiAccountPool {
  getManager(): AccountManager | null
  hasManagedPoolHistory(): boolean
  getAccountsPath(): string
  loadOrRefresh(cwd?: string): Promise<AccountManager>
  recordLoginAccount(input: {
    refreshToken: string
    access: string
    expires: number
    projectId?: string
    email?: string
  }): Promise<void>
  removeAccountByIndex(
    index: number,
    cwd?: string,
  ): Promise<{ manager: AccountManager; removed: boolean }>
  syncAuthAfterAccountToggle(activeManager?: AccountManager): void
  refreshQuotasLive(input?: {
    cwd?: string
    fetch?: typeof globalThis.fetch
    signal?: AbortSignal
  }): Promise<{ manager: AccountManager; results: AccountQuotaResult[] | null }>
  resolvePoolUnavailableOutcome(input: {
    modelId: string
    fetch: typeof globalThis.fetch
    signal: AbortSignal
    alreadyWaitedForSoftQuota?: boolean
    alreadyWaitedForRateLimit?: boolean
  }): Promise<
    | { action: "wait-and-retry"; waitMs: number; kind: "soft-quota" | "rate-limit" }
    | { action: "error"; error: StreamTransportError }
  >
  acquireCredentials(input: {
    modelId: string
    fetch: typeof globalThis.fetch
    signal: AbortSignal
    excludeIndices?: ReadonlySet<number>
    excludeRefreshTokens?: ReadonlySet<string>
  }): Promise<SelectedPoolCredentials | null>
  recordSuccess(account: ManagedAccount, fetch?: typeof globalThis.fetch): Promise<void>
  recordHttpFailure(input: {
    account: ManagedAccount
    modelId: string
    status?: number
    body?: string
    headers?: Record<string, string>
    message?: string
    tokenConsumed?: boolean
  }): Promise<{ rotated: boolean; quarantined: boolean }>
  stopBackgroundRefresh(): void
}

export function resolvePiModelFamily(modelId: string): ModelFamily {
  return modelId.toLowerCase().includes("claude") ? "claude" : "gemini"
}

export function createPiAccountPool(options: PiAccountPoolOptions): PiAccountPool {
  const nowFn = () => (options.now ?? Date.now)()
  const isOffline = () =>
    /^(1|true|yes)$/i.test((options.env ?? process.env).PI_OFFLINE ?? "")
  const healthTracker = new HealthScoreTracker()
  const tokenTracker = new TokenBucketTracker()
  const rateLimitTracker = createRateLimitBackoffTracker({ now: nowFn })
  const failureTracker = createAccountFailureTracker({ now: nowFn })
  const poolQuotaCoordinator = createPoolQuotaRefreshCoordinator({ now: nowFn })
  const lastQuotaAttemptAtByToken = new Map<string, number>()
  const quotaRefreshInProgressByToken = new Set<string>()
  let currentCwd = options.cwd
  let manager: AccountManager | null = null
  let managedPoolHistory = false
  let refreshQueue: ProactiveRefreshQueue | null = null
  let stopped = false

  const currentPaths = () =>
    resolveSharedGuardPaths({
      ...options,
      cwd: currentCwd ?? options.cwd,
    })

  const makeManagerDeps = (accountsPath: string) => ({
    storagePath: accountsPath,
    loadAccounts: () => loadAccountsFromPath(accountsPath),
    saveAccounts: (state: Parameters<typeof saveAccountsToPath>[1]) =>
      saveAccountsToPath(accountsPath, state),
    saveAccountsReplace: (state: Parameters<typeof saveAccountsReplaceToPath>[1]) =>
      saveAccountsReplaceToPath(accountsPath, state),
    generateFingerprint: () =>
      generateFingerprint({ version: options.getVersion() }),
    updateFingerprintVersion: (fp: Parameters<typeof updateFingerprintVersion>[0]) =>
      updateFingerprintVersion(fp, options.getVersion()),
    getVersion: options.getVersion,
    healthTracker,
    tokenTracker,
    now: nowFn,
  })

  const currentAuthJsonPath = () =>
    resolvePiAuthJsonPath({
      ...options,
      cwd: currentCwd ?? options.cwd,
    })

  const refreshAccountAccessToken = async (
    account: ManagedAccount,
    fetchFn: typeof globalThis.fetch,
    signal?: AbortSignal,
  ): Promise<
    | { ok: true; access: string; expires: number }
    | { ok: false; invalidGrant: boolean; aborted: boolean }
  > => {
    try {
      const previousRefresh = account.parts.refreshToken
      const nowFn = options.now ?? Date.now
      const refreshed = await refreshCredentials({
        credentials: {
          refresh: previousRefresh,
          access: account.access ?? "",
          expires: account.expires ?? 0,
        },
        fetch: fetchFn,
        now: nowFn,
        signal,
      })
      account.parts.refreshToken = refreshed.refresh
      account.access = refreshed.access
      account.expires = refreshed.expires
      if (refreshed.refresh !== previousRefresh) {
        account.lastUsed = Math.max(account.lastUsed, nowFn())
      }
      return { ok: true, access: refreshed.access, expires: refreshed.expires }
    } catch (error) {
      const aborted =
        Boolean(signal?.aborted) ||
        (error instanceof AuthHttpError && error.kind === "aborted")
      const invalidGrant =
        !aborted && error instanceof AuthHttpError && error.code === "invalid_grant"
      return { ok: false, invalidGrant, aborted }
    }
  }

  const startOrUpdateProactiveRefresh = (activeManager: AccountManager): void => {
    const cfg = options.getConfig()
    const env = options.env ?? process.env
    const offline = /^(1|true|yes)$/i.test(env.PI_OFFLINE ?? "")
    if (!cfg.proactive_token_refresh || offline) {
      refreshQueue?.stop()
      return
    }
    if (!refreshQueue) {
      refreshQueue = new ProactiveRefreshQueue({
        config: { enabled: true },
        onAfterSave: (savedManager: AccountManager) => {
          syncPiAuthJsonWithPool(currentAuthJsonPath(), savedManager)
        },
        refreshToken: async (auth: OAuthAuthDetails, account: ManagedAccount) => {
          const priorRefreshToken = account.parts.refreshToken
          const outcome = await refreshAccountAccessToken(
            account,
            options.fetch ?? globalThis.fetch,
          )
          const liveManager = manager ?? activeManager
          if (!outcome.ok) {
            if (outcome.invalidGrant) {
              const target = liveManager
                .getAccounts()
                .find(
                  (acc) =>
                    acc === account ||
                    acc.parts.refreshToken === priorRefreshToken ||
                    acc.parts.refreshToken === account.parts.refreshToken,
                )
              if (target && liveManager.removeAccount(target)) {
                await liveManager.saveToDiskReplace()
              }
              syncPiAuthJsonWithPool(currentAuthJsonPath(), liveManager)
            }
            return undefined
          }
          const postRefreshTarget = liveManager
            .getAccounts()
            .find(
              (acc) =>
                acc === account ||
                acc.parts.refreshToken === priorRefreshToken ||
                acc.parts.refreshToken === account.parts.refreshToken,
            )
          if (postRefreshTarget && postRefreshTarget !== account) {
            postRefreshTarget.lastUsed = Math.max(postRefreshTarget.lastUsed, account.lastUsed)
          }
          const parsed = parseRefreshParts(auth.refresh)
          return {
            type: "oauth",
            refresh: formatRefreshParts({
              refreshToken: account.parts.refreshToken,
              projectId: parsed.projectId ?? account.parts.projectId,
              managedProjectId: parsed.managedProjectId ?? account.parts.managedProjectId,
            }),
            access: outcome.access,
            expires: outcome.expires,
          }
        },
      })
    }
    refreshQueue.setAccountManager(activeManager)
    refreshQueue.start()
  }

  const runQuotaCheck = async (
    accountsMetadata: AccountMetadataV3[],
    fetchFn: typeof globalThis.fetch,
    signal?: AbortSignal,
  ): Promise<AccountQuotaResult[]> => {
    return checkAccountsQuotaWithDeps(accountsMetadata, {
      fetch: fetchFn,
      signal,
      now: nowFn,
      platform: process.platform,
      arch: process.arch,
      getUserAgent: () =>
        generateFingerprint({ version: options.getVersion() }).userAgent,
      refreshAuth: async (_auth, accMeta) => {
        const liveManager = manager
        const liveAccount = liveManager
          ?.getAccounts()
          .find((a) => a.parts.refreshToken === accMeta.refreshToken)

        if (
          liveAccount?.access &&
          typeof liveAccount.expires === "number" &&
          liveAccount.expires > nowFn() + ACCESS_TOKEN_EXPIRY_BUFFER_MS
        ) {
          return {
            type: "oauth",
            refresh: formatRefreshParts(liveAccount.parts),
            access: liveAccount.access,
            expires: liveAccount.expires,
          }
        }

        const tempAccount: ManagedAccount =
          liveAccount ?? {
            index: 0,
            email: accMeta.email,
            addedAt: accMeta.addedAt,
            lastUsed: accMeta.lastUsed,
            parts: {
              refreshToken: accMeta.refreshToken,
              projectId: accMeta.projectId,
              managedProjectId: accMeta.managedProjectId,
            },
            enabled: accMeta.enabled !== false,
            rateLimitResetTimes: {},
            touchedForQuota: {},
          }

        const priorToken = tempAccount.parts.refreshToken
        const refreshed = await refreshAccountAccessToken(tempAccount, fetchFn, signal)
        const postManager = manager ?? liveManager
        const postAccount = postManager
          ?.getAccounts()
          .find(
            (a) =>
              a === liveAccount ||
              a.parts.refreshToken === tempAccount.parts.refreshToken ||
              a.parts.refreshToken === priorToken,
          )

        if (!refreshed.ok) {
          if (refreshed.aborted || signal?.aborted) {
            throw new AuthHttpError("aborted", "Generation was cancelled.")
          }
          if (refreshed.invalidGrant && postManager && postAccount) {
            healthTracker.reset(postAccount.index)
            if (postManager.removeAccount(postAccount)) {
              await postManager.saveToDiskReplace()
            }
            syncPiAuthJsonWithPool(currentAuthJsonPath(), postManager)
          }
          return undefined
        }

        if (postAccount && postAccount !== tempAccount) {
          postAccount.parts.refreshToken = tempAccount.parts.refreshToken
          postAccount.access = tempAccount.access
          postAccount.expires = tempAccount.expires
          postAccount.lastUsed = Math.max(postAccount.lastUsed, tempAccount.lastUsed)
        }
        if (postManager) {
          await postManager.saveToDisk()
          syncPiAuthJsonWithPool(currentAuthJsonPath(), postManager)
        }

        return {
          type: "oauth",
          refresh: formatRefreshParts((postAccount ?? tempAccount).parts),
          access: refreshed.access,
          expires: refreshed.expires,
        }
      },
      resolveProjectContext: async (auth, accMeta) => ({
        auth,
        effectiveProjectId:
          accMeta.projectId ||
          accMeta.managedProjectId ||
          defaultProjectId(accMeta.email ?? ANTIGRAVITY_DEFAULT_PROJECT_ID),
      }),
    })
  }

  const triggerBackgroundQuotaRefreshForAccount = (
    account: ManagedAccount,
    fetchFn: typeof globalThis.fetch,
  ): void => {
    const cfg = options.getConfig()
    if (stopped || isOffline() || cfg.quota_refresh_interval_minutes <= 0) {
      return
    }
    if (account.enabled === false) {
      return
    }
    const tokenKey = account.parts.refreshToken
    if (!tokenKey || quotaRefreshInProgressByToken.has(tokenKey)) {
      return
    }

    const now = nowFn()
    const intervalMs = cfg.quota_refresh_interval_minutes * 60_000
    const cacheAge =
      account.cachedQuotaUpdatedAt != null ? now - account.cachedQuotaUpdatedAt : Infinity
    const lastAttempt = lastQuotaAttemptAtByToken.get(tokenKey)
    const attemptAge = lastAttempt != null ? now - lastAttempt : Infinity

    if (cacheAge < intervalMs || attemptAge < intervalMs) {
      return
    }

    quotaRefreshInProgressByToken.add(tokenKey)
    lastQuotaAttemptAtByToken.set(tokenKey, now)

    void (async () => {
      try {
        const activeManager = manager
        if (!activeManager || stopped) return
        const updated = await poolQuotaCoordinator.refreshSingle(
          account,
          activeManager,
          (accs) => runQuotaCheck(accs, fetchFn),
        )
        if (updated && !stopped && manager === activeManager) {
          await activeManager.saveToDisk()
        }
      } catch {
        // Non-fatal background quota refresh
      } finally {
        quotaRefreshInProgressByToken.delete(tokenKey)
      }
    })()
  }

  return {
    getManager(): AccountManager | null {
      return manager
    },
    hasManagedPoolHistory(): boolean {
      return managedPoolHistory || (manager?.getTotalAccountCount() ?? 0) > 0
    },
    getAccountsPath(): string {
      return currentPaths().accountsPath
    },
    async loadOrRefresh(cwd?: string): Promise<AccountManager> {
      stopped = false
      if (cwd !== undefined) {
        currentCwd = cwd
      }
      const paths = currentPaths()
      const deps = makeManagerDeps(paths.accountsPath)
      const previousAccounts = manager?.getAccounts() ?? []
      const stored = await loadAccountsFromPath(paths.accountsPath)
      if (stored !== null) {
        managedPoolHistory = true
      }
      manager = new AccountManager(undefined, stored, deps)
      for (const acc of manager.getAccounts()) {
        const prior = previousAccounts.find(
          (prev) => prev.parts.refreshToken === acc.parts.refreshToken,
        )
        if (prior?.access && prior.expires && prior.expires > nowFn()) {
          acc.access = prior.access
          acc.expires = prior.expires
        }
      }
      manager.syncAllAccountFingerprintVersions(options.getVersion())

      const authJsonPath = currentAuthJsonPath()
      const standaloneAuth = readPiAuthEntry(authJsonPath)

      if (standaloneAuth) {
        const parsed = parseRefreshParts(standaloneAuth.refresh)
        const refreshToken = parsed.refreshToken
        if (refreshToken) {
          const existingByToken = manager
            .getAccounts()
            .find((acc) => acc.parts.refreshToken === refreshToken)

          if (standaloneAuth.poolSynced || stored !== null) {
            if (
              existingByToken &&
              standaloneAuth.access &&
              standaloneAuth.expires > nowFn() &&
              standaloneAuth.expires > (existingByToken.expires ?? 0)
            ) {
              existingByToken.access = standaloneAuth.access
              existingByToken.expires = standaloneAuth.expires
            } else if (!existingByToken) {
              syncPiAuthJsonWithPool(authJsonPath, manager)
            }
          } else if (!existingByToken) {
            manager.upsertAccount({
              refreshToken,
              email: standaloneAuth.email,
              projectId: standaloneAuth.projectId ?? parsed.projectId,
              managedProjectId: parsed.managedProjectId,
              access: standaloneAuth.access || undefined,
              expires: standaloneAuth.expires || undefined,
            })
            await manager.saveToDisk()
            syncPiAuthJsonWithPool(authJsonPath, manager)
          }
        }
      } else {
        const firstEnabled = manager.getEnabledAccounts()[0]
        if (firstEnabled) {
          seedPiAuthJsonIfMissing(authJsonPath, firstEnabled, nowFn())
        }
      }

      if (manager.getTotalAccountCount() > 0) {
        managedPoolHistory = true
      }
      startOrUpdateProactiveRefresh(manager)
      return manager
    },
    async recordLoginAccount(input): Promise<void> {
      managedPoolHistory = true
      const active = manager ?? (await this.loadOrRefresh())
      active.upsertAccount({
        refreshToken: input.refreshToken,
        email: input.email,
        projectId: input.projectId,
        access: input.access,
        expires: input.expires,
        activate: true,
      })
      await active.saveToDisk()
      syncPiAuthJsonWithPool(currentAuthJsonPath(), active)
    },
    async removeAccountByIndex(
      index: number,
      cwd?: string,
    ): Promise<{ manager: AccountManager; removed: boolean }> {
      const active = await this.loadOrRefresh(cwd)
      const removed = active.removeAccountByIndex(index)
      if (removed) {
        await active.saveToDiskReplace()
        syncPiAuthJsonWithPool(currentAuthJsonPath(), active)
      }
      return { manager: active, removed }
    },
    syncAuthAfterAccountToggle(activeManager?: AccountManager): void {
      const target = activeManager ?? manager
      if (!target) return
      const authPath = currentAuthJsonPath()
      if (existsSync(authPath)) {
        syncPiAuthJsonWithPool(authPath, target)
      } else {
        const firstEnabled = target.getEnabledAccounts()[0]
        if (firstEnabled) {
          seedPiAuthJsonIfMissing(authPath, firstEnabled, nowFn())
        }
      }
    },
    async refreshQuotasLive(input): Promise<{
      manager: AccountManager
      results: AccountQuotaResult[] | null
    }> {
      const active = await this.loadOrRefresh(input?.cwd)
      if (isOffline() || active.getTotalAccountCount() === 0) {
        return { manager: active, results: null }
      }

      const fetchFn = input?.fetch ?? options.fetch ?? globalThis.fetch
      const metadata = active.getAccountsForQuotaCheck()
      const attemptNow = nowFn()
      for (const meta of metadata) {
        if (meta.refreshToken) {
          lastQuotaAttemptAtByToken.set(meta.refreshToken, attemptNow)
        }
      }

      const results = await runQuotaCheck(metadata, fetchFn, input?.signal)
      const liveManager = manager ?? active
      let anyUpdated = false
      for (const res of results) {
        if (res.status === "ok" && res.quota && !res.quota.error) {
          const rotated = res.updatedAccount?.refreshToken
          const targetToken =
            rotated &&
            liveManager.getAccounts().some((acc) => acc.parts.refreshToken === rotated)
              ? rotated
              : res.refreshToken
          if (targetToken) {
            liveManager.updateQuotaCache(targetToken, res.quota.groups)
            anyUpdated = true
          }
        }
      }
      if (anyUpdated) {
        await liveManager.saveToDisk()
      }
      return { manager: liveManager, results }
    },
    async resolvePoolUnavailableOutcome(input): Promise<
      | { action: "wait-and-retry"; waitMs: number; kind: "soft-quota" | "rate-limit" }
      | { action: "error"; error: StreamTransportError }
    > {
      const toUnavailableError = (
        descriptor: PoolUnavailableErrorDescriptor,
      ): { action: "error"; error: StreamTransportError } => ({
        action: "error",
        error: createPoolUnavailableError(descriptor),
      })

      if (!manager || manager.getTotalAccountCount() === 0) {
        return toUnavailableError({ reason: "no-accounts" })
      }

      const enabledCount = manager.getAccountCount()
      if (enabledCount === 0) {
        return toUnavailableError({ reason: "no-enabled-accounts" })
      }

      const cfg = options.getConfig()
      const family = resolvePiModelFamily(input.modelId)
      const threshold = cfg.soft_quota_threshold_percent
      const cacheTtlMs = computeSoftQuotaCacheTtlMs(
        cfg.soft_quota_cache_ttl_minutes,
        cfg.quota_refresh_interval_minutes,
      )
      const maxWaitMs = (cfg.max_rate_limit_wait_seconds ?? 300) * 1_000
      const now = nowFn()
      const enabledAccounts = manager.getEnabledAccounts()
      const quotaGroup = resolveQuotaGroup(family, input.modelId)

      let softBlockedCount = 0
      let rateLimitedCount = 0
      let bestCandidate: { waitMs: number; kind: "soft-quota" | "rate-limit" } | null = null
      let minAnyWaitMs = Infinity

      for (const acc of enabledAccounts) {
        const overSoft = manager.isAccountOverSoftQuota(acc, family, threshold, cacheTtlMs, input.modelId)
        const rateLimited = manager.isRateLimitedForHeaderStyle(acc, family, "antigravity", input.modelId)
        const coolingDown = manager.isAccountCoolingDown(acc)
        if (overSoft) softBlockedCount += 1
        if (rateLimited) rateLimitedCount += 1

        const parsedSoft = overSoft && acc.cachedQuota?.[quotaGroup]?.resetTime
          ? Date.parse(acc.cachedQuota[quotaGroup]!.resetTime!)
          : NaN
        const softWait = overSoft
          ? Number.isFinite(parsedSoft) && parsedSoft > now ? parsedSoft - now : Infinity
          : 0
        const rlReset = !rateLimited
          ? 0
          : family === "claude"
            ? acc.rateLimitResetTimes.claude ?? 0
            : Math.max(
                acc.rateLimitResetTimes[getQuotaKey(family, "antigravity", input.modelId)] ?? 0,
                acc.rateLimitResetTimes[getQuotaKey(family, "antigravity")] ?? 0,
              )
        const rlWait = rlReset > now ? rlReset - now : 0
        const cdWait = coolingDown && (acc.coolingDownUntil ?? 0) > now ? acc.coolingDownUntil! - now : 0
        const accWait = Math.max(softWait, rlWait, cdWait)
        if (accWait <= 0 || !Number.isFinite(accWait)) continue

        if (accWait < minAnyWaitMs) minAnyWaitMs = accWait
        const kind: "soft-quota" | "rate-limit" = softWait > 0 && softWait >= rlWait && softWait >= cdWait ? "soft-quota" : "rate-limit"
        const skipped = kind === "soft-quota" ? input.alreadyWaitedForSoftQuota : input.alreadyWaitedForRateLimit
        if (!skipped && (!bestCandidate || accWait < bestCandidate.waitMs)) bestCandidate = { waitMs: accWait, kind }
      }

      if (bestCandidate && !isOffline() && (maxWaitMs === 0 || bestCandidate.waitMs <= maxWaitMs)) {
        return { action: "wait-and-retry", waitMs: bestCandidate.waitMs, kind: bestCandidate.kind }
      }

      if (softBlockedCount === enabledCount) {
        const softQuotaWaitMs = manager.getMinWaitTimeForSoftQuota(family, threshold, cacheTtlMs, input.modelId)
        if (
          !isOffline() &&
          !stopped &&
          manager.shouldRefreshAllQuotas(family, threshold, cacheTtlMs, input.modelId)
        ) {
          const hasUnattemptedRecently = enabledAccounts.some((acc) => {
            const prev = lastQuotaAttemptAtByToken.get(acc.parts.refreshToken)
            return prev === undefined || now - prev >= DEFAULT_POOL_QUOTA_REFRESH_COOLDOWN_MS
          })
          if (hasUnattemptedRecently) {
            const activeRef = manager
            void poolQuotaCoordinator
              .triggerForAll(activeRef, (accs) => runQuotaCheck(accs, input.fetch))
              .then(async () => {
                if (!stopped && manager === activeRef) await activeRef.saveToDisk()
              })
              .catch(() => undefined)
          }
        }
        return toUnavailableError({
          reason: "soft-quota",
          accountCount: enabledCount,
          thresholdPercent: threshold,
          family,
          waitMs: softQuotaWaitMs,
        })
      }

      const fallbackWaitMs = Number.isFinite(minAnyWaitMs) ? minAnyWaitMs : 0
      if (rateLimitedCount > 0 || softBlockedCount > 0) {
        return toUnavailableError({
          reason: "rate-limited",
          accountCount: enabledCount,
          family,
          waitMs: fallbackWaitMs,
        })
      }

      return toUnavailableError({
        reason: "pool-unavailable",
        accountCount: enabledCount,
        waitMs: fallbackWaitMs > 0 ? fallbackWaitMs : null,
      })
    },
    async acquireCredentials(input): Promise<SelectedPoolCredentials | null> {
      if (!manager || manager.getTotalAccountCount() === 0) {
        return null
      }

      const cfg = options.getConfig()
      const family = resolvePiModelFamily(input.modelId)
      const cacheTtlMs = computeSoftQuotaCacheTtlMs(
        cfg.soft_quota_cache_ttl_minutes,
        cfg.quota_refresh_interval_minutes,
      )
      const triedRefreshTokens = new Set<string>(input.excludeRefreshTokens)
      if (input.excludeIndices) {
        for (const idx of input.excludeIndices) {
          const acc = manager.getAccounts()[idx]
          if (acc) {
            triedRefreshTokens.add(acc.parts.refreshToken)
          }
        }
      }

      if (
        !isOffline() &&
        cfg.soft_quota_threshold_percent < 100 &&
        triedRefreshTokens.size === 0
      ) {
        const enabledSnapshot = [...manager.getEnabledAccounts()]
        let anyQuotaUpdated = false
        for (const candidate of enabledSnapshot) {
          if (input.signal.aborted) {
            throw new AuthHttpError("aborted", "Generation was cancelled.")
          }
          const liveManager = manager
          if (!liveManager) break
          const liveCandidate = liveManager
            .getEnabledAccounts()
            .find((acc) => acc.parts.refreshToken === candidate.parts.refreshToken)
          if (!liveCandidate) continue

          if (
            liveManager.needsActiveQuotaRefresh(
              liveCandidate,
              family,
              cfg.soft_quota_threshold_percent,
              DEFAULT_SOFT_QUOTA_REFRESH_TTL_MS,
              DEFAULT_SOFT_QUOTA_NEAR_THRESHOLD_MARGIN,
              input.modelId,
            )
          ) {
            const tokenKey = liveCandidate.parts.refreshToken
            if (liveCandidate.cachedQuota == null) {
              const lastAttempt = lastQuotaAttemptAtByToken.get(tokenKey)
              if (
                lastAttempt !== undefined &&
                nowFn() - lastAttempt >= 0 &&
                nowFn() - lastAttempt < DEFAULT_POOL_QUOTA_REFRESH_COOLDOWN_MS
              ) {
                continue
              }
            }
            lastQuotaAttemptAtByToken.set(tokenKey, nowFn())
            const updated = await poolQuotaCoordinator.refreshSingle(
              liveCandidate,
              liveManager,
              (accs) => runQuotaCheck(accs, input.fetch, input.signal),
            )
            if (input.signal.aborted) {
              throw new AuthHttpError("aborted", "Generation was cancelled.")
            }
            if (updated) {
              anyQuotaUpdated = true
            }
          }
        }
        if (anyQuotaUpdated && manager) {
          await manager.saveToDisk()
        }
      }

      while (manager.getAccountCount() > 0) {
        if (input.signal.aborted) {
          throw new AuthHttpError("aborted", "Generation was cancelled.")
        }

        const excludedIndices = new Set<number>()
        for (const acc of manager.getAccounts()) {
          if (
            triedRefreshTokens.has(acc.parts.refreshToken) ||
            manager.isRateLimitedForHeaderStyle(acc, family, "antigravity", input.modelId)
          ) {
            excludedIndices.add(acc.index)
          }
        }

        const candidate = manager.getCurrentOrNextForFamily(
          family,
          input.modelId,
          cfg.account_selection_strategy,
          "antigravity",
          cfg.pid_offset_enabled,
          cfg.soft_quota_threshold_percent,
          cacheTtlMs,
          excludedIndices,
        )
        if (!candidate) {
          return null
        }

        triedRefreshTokens.add(candidate.parts.refreshToken)

        const isTokenExpired =
          !candidate.access ||
          typeof candidate.expires !== "number" ||
          candidate.expires <= nowFn() + ACCESS_TOKEN_EXPIRY_BUFFER_MS
        if (isTokenExpired) {
          const priorCandidateToken = candidate.parts.refreshToken
          const refreshed = await refreshAccountAccessToken(
            candidate,
            input.fetch,
            input.signal,
          )
          const liveManager = manager
          if (!liveManager) {
            return null
          }
          const liveCandidate =
            liveManager
              .getAccounts()
              .find(
                (acc) =>
                  acc === candidate ||
                  acc.parts.refreshToken === candidate.parts.refreshToken ||
                  acc.parts.refreshToken === priorCandidateToken,
              ) ?? candidate

          if (!refreshed.ok) {
            if (refreshed.aborted || input.signal.aborted) {
              throw new AuthHttpError("aborted", "Generation was cancelled.")
            }
            if (refreshed.invalidGrant) {
              healthTracker.reset(liveCandidate.index)
              liveManager.removeAccount(liveCandidate)
              await liveManager.saveToDiskReplace()
              syncPiAuthJsonWithPool(currentAuthJsonPath(), liveManager)
              continue
            }
            healthTracker.recordFailure(liveCandidate.index)
            liveManager.markAccountCoolingDown(liveCandidate, 60_000, "auth-failure")
            continue
          }
          if (liveCandidate !== candidate) {
            liveCandidate.parts.refreshToken = candidate.parts.refreshToken
            liveCandidate.access = candidate.access
            liveCandidate.expires = candidate.expires
            liveCandidate.lastUsed = Math.max(liveCandidate.lastUsed, candidate.lastUsed)
          }
          triedRefreshTokens.add(liveCandidate.parts.refreshToken)
          await liveManager.saveToDisk()
          syncPiAuthJsonWithPool(currentAuthJsonPath(), liveManager)
        }

        const tokenConsumed =
          cfg.account_selection_strategy === "hybrid"
            ? tokenTracker.consume(candidate.index)
            : false

        const projectId =
          candidate.parts.projectId ??
          candidate.parts.managedProjectId ??
          defaultProjectId(candidate.email ?? "antigravity-default")
        const userAgent =
          candidate.fingerprint?.userAgent ??
          generateFingerprint({ version: options.getVersion() }).userAgent

        return {
          account: candidate,
          accessToken: candidate.access!,
          projectId,
          userAgent,
          tokenConsumed,
        }
      }

      return null
    },
    async recordSuccess(account, fetchFn): Promise<void> {
      if (!manager) return
      const liveAccount =
        manager
          .getAccounts()
          .find((acc) => acc.parts.refreshToken === account.parts.refreshToken) ?? account
      healthTracker.recordSuccess(liveAccount.index)
      rateLimitTracker.resetAllForAccount(liveAccount.parts.refreshToken)
      failureTracker.reset(liveAccount.parts.refreshToken)
      manager.markAccountUsed(liveAccount.index)
      manager.markRequestSuccess(liveAccount)
      manager.requestSaveToDisk()
      triggerBackgroundQuotaRefreshForAccount(
        liveAccount,
        fetchFn ?? options.fetch ?? globalThis.fetch,
      )
    },
    async recordHttpFailure(input): Promise<{ rotated: boolean; quarantined: boolean }> {
      if (!manager) {
        return { rotated: false, quarantined: false }
      }
      const cfg = options.getConfig()
      const family = resolvePiModelFamily(input.modelId)
      const liveAccount =
        manager
          .getAccounts()
          .find((acc) => acc.parts.refreshToken === input.account.parts.refreshToken) ??
        input.account

      if (input.tokenConsumed) {
        tokenTracker.refund(liveAccount.index)
      }

      if (input.status === 403 && input.body) {
        const details = extractVerificationErrorDetails(input.body)
        if (details.validationRequired) {
          healthTracker.recordFailure(liveAccount.index)
          manager.markAccountVerificationRequired(
            liveAccount.index,
            details.message,
            details.verifyUrl,
          )
          manager.markAccountCoolingDown(
            liveAccount,
            10 * 60_000,
            "validation-required",
          )
          await manager.saveToDisk()
          return { rotated: manager.getAccountCount() > 0, quarantined: true }
        }
      }

      if (input.status === 429 || input.status === 503 || input.status === 529) {
        const bodyInfo = extractRateLimitTextInfo(input.body ?? "")
        const reason = parseRateLimitReason(
          bodyInfo.reason,
          bodyInfo.message ?? input.body ?? input.message,
          input.status,
        )

        if (reason === "MODEL_CAPACITY_EXHAUSTED" || reason === "SERVER_ERROR") {
          const tracked = failureTracker.trackFailure(liveAccount.parts.refreshToken)
          if (tracked.shouldCooldown) {
            healthTracker.recordFailure(liveAccount.index)
            manager.markAccountCoolingDown(
              liveAccount,
              tracked.cooldownMs,
              "project-error",
            )
            await manager.saveToDisk()
          }
          return { rotated: manager.getAccountCount() > 1, quarantined: false }
        }

        healthTracker.recordRateLimit(liveAccount.index)
        const defaultRetryMs = (cfg.default_retry_after_seconds ?? 60) * 1_000
        const maxBackoffMs = (cfg.max_backoff_seconds ?? 60) * 1_000
        const explicitHeaderRetryMs = retryAfterMsFromHeaders(input.headers, 0)
        const explicitServerRetryMs =
          bodyInfo.retryDelayMs ?? (explicitHeaderRetryMs > 0 ? explicitHeaderRetryMs : null)
        const trackerSeedMs = explicitServerRetryMs ?? defaultRetryMs

        const quotaKey = headerStyleToQuotaKey("antigravity", family)
        const { delayMs } = rateLimitTracker.getBackoff(
          liveAccount.parts.refreshToken,
          quotaKey,
          trackerSeedMs,
          maxBackoffMs,
        )

        const failureTtlMs = cfg.failure_ttl_seconds * 1_000
        const priorFailures =
          liveAccount.lastFailureTime !== undefined &&
          nowFn() - liveAccount.lastFailureTime > failureTtlMs
            ? 0
            : (liveAccount.consecutiveFailures ?? 0)
        const smartBackoffMs = calculateBackoffMs(
          reason,
          priorFailures,
          explicitServerRetryMs,
        )
        const effectiveDelayMs =
          reason === "UNKNOWN" && explicitServerRetryMs === null
            ? Math.max(delayMs, smartBackoffMs)
            : smartBackoffMs

        manager.markRateLimitedWithReason(
          liveAccount,
          family,
          "antigravity",
          input.modelId,
          reason,
          effectiveDelayMs,
          failureTtlMs,
        )
        await manager.saveToDisk()
        return { rotated: manager.getAccountCount() > 0, quarantined: false }
      }

      if (input.status === 401) {
        healthTracker.recordFailure(liveAccount.index)
        liveAccount.access = undefined
        liveAccount.expires = 0
        return { rotated: manager.getAccountCount() > 0, quarantined: false }
      }

      const tracked = failureTracker.trackFailure(liveAccount.parts.refreshToken)
      if (tracked.shouldCooldown) {
        healthTracker.recordFailure(liveAccount.index)
        manager.markAccountCoolingDown(liveAccount, tracked.cooldownMs, "project-error")
        await manager.saveToDisk()
      }
      return { rotated: manager.getAccountCount() > 1, quarantined: false }
    },
    stopBackgroundRefresh(): void {
      stopped = true
      refreshQueue?.stop()
    },
  }
}

export function formatPoolAccountSummary(
  accounts: readonly ManagedAccount[],
  accountsPath: string,
  strategy: string,
  nowMs = Date.now(),
): string {
  if (accounts.length === 0) {
    return `No Antigravity Guard accounts found at \`${accountsPath}\`. Run \`/login antigravity-guard\` to add an account.`
  }

  const lines = [
    `### Antigravity Guard Account Pool (${accounts.length} total, strategy: \`${strategy}\`)`,
    `Pool file: \`${accountsPath}\``,
    "",
    "| # | Account | Status | Project | Details |",
    "| - | ------- | ------ | ------- | ------- |",
  ]

  for (const acc of accounts) {
    const label = formatAccountLabel(acc.email, acc.index)
    const project = acc.parts.projectId ?? acc.parts.managedProjectId ?? "-"
    let status = acc.enabled !== false ? "enabled" : "disabled"
    const notes: string[] = []
    if (acc.verificationRequired) {
      status = "quarantined (403)"
      if (acc.verificationUrl) notes.push(acc.verificationUrl)
    } else if (acc.coolingDownUntil && acc.coolingDownUntil > nowMs) {
      status = `cooldown (${acc.cooldownReason ?? "active"})`
    }
    const activeLimits = Object.entries(acc.rateLimitResetTimes)
      .filter(([, reset]) => typeof reset === "number" && reset > nowMs)
      .map(([key, reset]) => `${key}: ${Math.ceil(((reset ?? 0) - nowMs) / 1000)}s`)
    if (activeLimits.length > 0) {
      notes.push(`rate-limited (${activeLimits.join(", ")})`)
    }
    lines.push(`| ${acc.index + 1} | ${label} | ${status} | \`${project}\` | ${notes.join(" ") || "ready"} |`)
  }

  return lines.join("\n")
}

export function formatPoolQuotaSummary(
  accounts: readonly ManagedAccount[],
  softThresholdPercent: number,
  liveResults?: readonly AccountQuotaResult[] | null,
  nowMs = Date.now(),
): string {
  if (accounts.length === 0) {
    return "No Antigravity Guard accounts configured. Run `/login antigravity-guard` first."
  }

  const lines = [
    `### Antigravity Guard Quota Summary (soft threshold: ${softThresholdPercent}%)`,
    "",
    "| # | Account | Claude | Gemini Pro / 4 | Gemini Flash | Updated |",
    "| - | ------- | ------ | -------------- | ------------ | ------- |",
  ]

  const fmtGroup = (entry?: { remainingFraction?: number; resetTime?: string }): string => {
    if (!entry || entry.remainingFraction === undefined) return "n/a"
    const used = ((1 - Math.max(0, Math.min(1, entry.remainingFraction))) * 100).toFixed(0)
    return `${used}% used`
  }

  for (const acc of accounts) {
    const label = formatAccountLabel(acc.email, acc.index)
    const claude = fmtGroup(acc.cachedQuota?.claude)
    const pro = fmtGroup(acc.cachedQuota?.["gemini-pro"])
    const flash = fmtGroup(acc.cachedQuota?.["gemini-flash"])
    const updated = acc.cachedQuotaUpdatedAt
      ? `${Math.max(0, Math.round((nowMs - acc.cachedQuotaUpdatedAt) / 60_000))}m ago`
      : "cached on next check"
    lines.push(`| ${acc.index + 1} | ${label} | ${claude} | ${pro} | ${flash} | ${updated} |`)
  }

  const cliLines: string[] = []
  if (liveResults) {
    for (const res of liveResults) {
      const models = res.geminiCliQuota?.models
      if (models && models.length > 0) {
        const label = formatAccountLabel(res.email, res.index)
        const summary = models
          .map((m) => {
            const used =
              m.remainingFraction !== undefined
                ? `${((1 - Math.max(0, Math.min(1, m.remainingFraction))) * 100).toFixed(0)}% used`
                : "n/a"
            return `\`${m.modelId}\` (${used})`
          })
          .join(", ")
        cliLines.push(`- **${label}**: ${summary}`)
      }
    }
  }

  if (cliLines.length > 0) {
    lines.push("", "#### Gemini CLI Quota", ...cliLines)
  }

  return lines.join("\n")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
