import { randomBytes } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import {
  AccountManager,
  HealthScoreTracker,
  ProactiveRefreshQueue,
  TokenBucketTracker,
  accessTokenExpired,
  computeSoftQuotaCacheTtlMs,
  extractVerificationErrorDetails,
  formatAccountLabel,
  generateFingerprint,
  loadAccountsFromPath,
  parseRateLimitReason,
  parseRefreshParts,
  resolveSharedGuardPaths,
  saveAccountsReplaceToPath,
  saveAccountsToPath,
  updateFingerprintVersion,
  type ManagedAccount,
  type ModelFamily,
  type OAuthAuthDetails,
  type ResolveSharedGuardPathsOptions,
  type SharedGuardConfig,
} from "@benjamolina/antigravity-guard-core"

import { AuthHttpError, refreshCredentials } from "./auth-http.ts"
import { defaultProjectId } from "./project.ts"

const PI_PROVIDER_KEY = "antigravity-guard"
const SHARED_POOL_PLACEHOLDER_ACCESS = "shared-pool-pending-refresh"
const POOL_SYNCED_MARKER = "poolSynced"

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

function buildPiAuthEntryObject(account: ManagedAccount): Record<string, unknown> {
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
    expires: hasRealAccess ? account.expires! : Date.now() + 365 * 24 * 60 * 60 * 1_000,
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

    existingRoot[PI_PROVIDER_KEY] = buildPiAuthEntryObject(account)
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
}

export interface PiAccountPool {
  getManager(): AccountManager | null
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
  acquireCredentials(input: {
    modelId: string
    fetch: typeof globalThis.fetch
    signal: AbortSignal
    excludeIndices?: ReadonlySet<number>
    excludeRefreshTokens?: ReadonlySet<string>
  }): Promise<SelectedPoolCredentials | null>
  recordSuccess(account: ManagedAccount): Promise<void>
  recordHttpFailure(input: {
    account: ManagedAccount
    modelId: string
    status?: number
    body?: string
    message?: string
  }): Promise<{ rotated: boolean; quarantined: boolean }>
  stopBackgroundRefresh(): void
}

export function resolvePiModelFamily(modelId: string): ModelFamily {
  return modelId.toLowerCase().includes("claude") ? "claude" : "gemini"
}

export function createPiAccountPool(options: PiAccountPoolOptions): PiAccountPool {
  const healthTracker = new HealthScoreTracker()
  const tokenTracker = new TokenBucketTracker()
  let currentCwd = options.cwd
  let manager: AccountManager | null = null
  let refreshQueue: ProactiveRefreshQueue | null = null

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
            refresh: `${account.parts.refreshToken}|${parsed.projectId ?? ""}`,
            access: outcome.access,
            expires: outcome.expires,
          }
        },
      })
    }
    refreshQueue.setAccountManager(activeManager)
    refreshQueue.start()
  }

  return {
    getManager(): AccountManager | null {
      return manager
    },
    getAccountsPath(): string {
      return currentPaths().accountsPath
    },
    async loadOrRefresh(cwd?: string): Promise<AccountManager> {
      if (cwd !== undefined) {
        currentCwd = cwd
      }
      const paths = currentPaths()
      const deps = makeManagerDeps(paths.accountsPath)
      const previousAccounts = manager?.getAccounts() ?? []
      const stored = await loadAccountsFromPath(paths.accountsPath)
      manager = new AccountManager(undefined, stored, deps)
      for (const acc of manager.getAccounts()) {
        const prior = previousAccounts.find(
          (prev) => prev.parts.refreshToken === acc.parts.refreshToken,
        )
        if (prior?.access && prior.expires && prior.expires > Date.now()) {
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
            if (existingByToken && standaloneAuth.access && standaloneAuth.expires > Date.now()) {
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
          seedPiAuthJsonIfMissing(authJsonPath, firstEnabled)
        }
      }

      startOrUpdateProactiveRefresh(manager)
      return manager
    },
    async recordLoginAccount(input): Promise<void> {
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

        if (accessTokenExpired({ access: candidate.access, expires: candidate.expires })) {
          const refreshed = await refreshAccountAccessToken(
            candidate,
            input.fetch,
            input.signal,
          )
          if (!refreshed.ok) {
            if (refreshed.aborted || input.signal.aborted) {
              throw new AuthHttpError("aborted", "Generation was cancelled.")
            }
            if (refreshed.invalidGrant) {
              healthTracker.reset(candidate.index)
              manager.removeAccount(candidate)
              await manager.saveToDiskReplace()
              syncPiAuthJsonWithPool(currentAuthJsonPath(), manager)
              continue
            }
            healthTracker.recordFailure(candidate.index)
            manager.markAccountCoolingDown(candidate, 60_000, "auth-failure")
            continue
          }
          triedRefreshTokens.add(candidate.parts.refreshToken)
          await manager.saveToDisk()
          syncPiAuthJsonWithPool(currentAuthJsonPath(), manager)
        }

        if (cfg.account_selection_strategy === "hybrid") {
          tokenTracker.consume(candidate.index)
        }

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
        }
      }

      return null
    },
    async recordSuccess(account): Promise<void> {
      if (!manager) return
      healthTracker.recordSuccess(account.index)
      manager.markAccountUsed(account.index)
      manager.markRequestSuccess(account)
      manager.requestSaveToDisk()
    },
    async recordHttpFailure(input): Promise<{ rotated: boolean; quarantined: boolean }> {
      if (!manager) {
        return { rotated: false, quarantined: false }
      }
      const cfg = options.getConfig()
      const family = resolvePiModelFamily(input.modelId)

      if (input.status === 403 && input.body) {
        const details = extractVerificationErrorDetails(input.body)
        if (details.validationRequired) {
          healthTracker.recordFailure(input.account.index)
          manager.markAccountVerificationRequired(
            input.account.index,
            details.message,
            details.verifyUrl,
          )
          manager.markAccountCoolingDown(
            input.account,
            10 * 60_000,
            "validation-required",
          )
          await manager.saveToDisk()
          return { rotated: manager.getAccountCount() > 0, quarantined: true }
        }
      }

      if (input.status === 429 || input.status === 503 || input.status === 529) {
        healthTracker.recordRateLimit(input.account.index)
        const reason = parseRateLimitReason(undefined, input.body ?? input.message, input.status)
        manager.markRateLimitedWithReason(
          input.account,
          family,
          "antigravity",
          input.modelId,
          reason,
          null,
          cfg.failure_ttl_seconds * 1_000,
        )
        manager.requestSaveToDisk()
        return { rotated: manager.getAccountCount() > 0, quarantined: false }
      }

      if (input.status === 401) {
        healthTracker.recordFailure(input.account.index)
        input.account.access = undefined
        input.account.expires = 0
        return { rotated: manager.getAccountCount() > 0, quarantined: false }
      }

      return { rotated: false, quarantined: false }
    },
    stopBackgroundRefresh(): void {
      refreshQueue?.stop()
    },
  }
}

export function formatPoolAccountSummary(
  accounts: readonly ManagedAccount[],
  accountsPath: string,
  strategy: string,
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
    } else if (acc.coolingDownUntil && acc.coolingDownUntil > Date.now()) {
      status = `cooldown (${acc.cooldownReason ?? "active"})`
    }
    const activeLimits = Object.entries(acc.rateLimitResetTimes)
      .filter(([, reset]) => typeof reset === "number" && reset > Date.now())
      .map(([key, reset]) => `${key}: ${Math.ceil(((reset ?? 0) - Date.now()) / 1000)}s`)
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
      ? `${Math.max(0, Math.round((Date.now() - acc.cachedQuotaUpdatedAt) / 60_000))}m ago`
      : "cached on next check"
    lines.push(`| ${acc.index + 1} | ${label} | ${claude} | ${pro} | ${flash} | ${updated} |`)
  }

  return lines.join("\n")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
