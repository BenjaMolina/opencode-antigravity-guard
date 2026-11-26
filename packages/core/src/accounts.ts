import {
  clearExpiredRateLimits,
  calculateBackoffMs,
  formatRefreshParts,
  getQuotaKey,
  isOverSoftQuotaThreshold,
  isRateLimitedForFamily,
  isRateLimitedForHeaderStyle,
  needsActiveQuotaRefresh,
  parseRefreshParts,
  resolveQuotaGroup,
  type ManagedAccount,
  type OAuthAuthDetails,
  type QuotaGroup,
  type QuotaGroupSummary,
  type QuotaKey,
  type RateLimitReason,
} from "./account-helpers.ts"
import type { AccountSelectionStrategy } from "./config.ts"
import { ANTIGRAVITY_VERSION_FALLBACK } from "./constants.ts"
import {
  MAX_FINGERPRINT_HISTORY,
  generateFingerprint as coreGenerateFingerprint,
  updateFingerprintVersion as coreUpdateFingerprintVersion,
  type Fingerprint,
  type FingerprintVersion,
} from "./fingerprint.ts"
import {
  HealthScoreTracker,
  TokenBucketTracker,
  getHealthTracker,
  getTokenTracker,
  selectHybridAccount,
  type AccountWithMetrics,
} from "./rotation.ts"
import {
  loadAccountsFromPath,
  saveAccountsReplaceToPath,
  saveAccountsToPath,
  type AccountMetadataV3,
  type AccountStorageIoOptions,
  type AccountStorageV4,
  type CooldownReason,
  type HeaderStyle,
  type ModelFamily,
} from "./storage.ts"

function clampNonNegativeInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }
  return value < 0 ? 0 : Math.floor(value)
}

export interface AccountManagerDependencies {
  storagePath?: string
  storageIo?: AccountStorageIoOptions
  loadAccounts?: () => Promise<AccountStorageV4 | null>
  saveAccounts?: (state: AccountStorageV4) => Promise<void>
  saveAccountsReplace?: (state: AccountStorageV4) => Promise<void>
  generateFingerprint?: () => Fingerprint
  updateFingerprintVersion?: (fingerprint: Fingerprint) => boolean
  getVersion?: () => string
  onDebugLog?: (message: string) => void
  healthTracker?: HealthScoreTracker
  tokenTracker?: TokenBucketTracker
  now?: () => number
}

export class AccountManager {
  private accounts: ManagedAccount[] = []
  private cursor = 0
  private currentAccountIndexByFamily: Record<ModelFamily, number> = {
    claude: -1,
    gemini: -1,
  }
  private sessionOffsetApplied: Record<ModelFamily, boolean> = {
    claude: false,
    gemini: false,
  }
  private lastToastAccountIndex = -1
  private lastToastTime = 0

  private savePending = false
  private saveTimeout: ReturnType<typeof setTimeout> | null = null
  private savePromiseResolvers: Array<() => void> = []
  private lastSavedSnapshot: string | null = null
  private readonly deps: AccountManagerDependencies

  static async loadFromDisk(
    authFallback?: OAuthAuthDetails,
    deps: AccountManagerDependencies = {},
  ): Promise<AccountManager> {
    const stored = deps.loadAccounts
      ? await deps.loadAccounts()
      : deps.storagePath
        ? await loadAccountsFromPath(deps.storagePath, deps.storageIo)
        : null
    return new AccountManager(authFallback, stored, deps)
  }

  constructor(
    authFallback?: OAuthAuthDetails,
    stored?: AccountStorageV4 | null,
    deps: AccountManagerDependencies = {},
  ) {
    this.deps = deps
    const makeFingerprint =
      deps.generateFingerprint ??
      (() =>
        coreGenerateFingerprint({
          version: deps.getVersion?.() ?? ANTIGRAVITY_VERSION_FALLBACK,
        }))
    const syncFingerprint =
      deps.updateFingerprintVersion ??
      ((fp: Fingerprint) =>
        coreUpdateFingerprintVersion(
          fp,
          deps.getVersion?.() ?? ANTIGRAVITY_VERSION_FALLBACK,
        ))

    const authParts = authFallback ? parseRefreshParts(authFallback.refresh) : null

    if (stored && stored.accounts.length === 0) {
      this.accounts = []
      this.cursor = 0
      return
    }

    if (stored && stored.accounts.length > 0) {
      const baseNow = this.nowMs()
      this.accounts = stored.accounts
        .map((acc, index): ManagedAccount | null => {
          if (!acc.refreshToken || typeof acc.refreshToken !== "string") {
            return null
          }
          const matchesFallback = !!(
            authFallback &&
            authParts &&
            authParts.refreshToken &&
            acc.refreshToken === authParts.refreshToken
          )

          return {
            index,
            email: acc.email,
            addedAt: clampNonNegativeInt(acc.addedAt, baseNow),
            lastUsed: clampNonNegativeInt(acc.lastUsed, 0),
            parts: {
              refreshToken: acc.refreshToken,
              projectId: acc.projectId,
              managedProjectId: acc.managedProjectId,
            },
            access: matchesFallback ? authFallback?.access : undefined,
            expires: matchesFallback ? authFallback?.expires : undefined,
            enabled: acc.enabled !== false,
            rateLimitResetTimes: acc.rateLimitResetTimes ?? {},
            lastSwitchReason: acc.lastSwitchReason,
            coolingDownUntil: acc.coolingDownUntil,
            cooldownReason: acc.cooldownReason,
            touchedForQuota: {},
            fingerprint: acc.fingerprint ?? makeFingerprint(),
            fingerprintHistory: acc.fingerprintHistory ?? [],
            cachedQuota: acc.cachedQuota as
              | Partial<Record<QuotaGroup, QuotaGroupSummary>>
              | undefined,
            cachedQuotaUpdatedAt: acc.cachedQuotaUpdatedAt,
            verificationRequired: acc.verificationRequired,
            verificationRequiredAt: acc.verificationRequiredAt,
            verificationRequiredReason: acc.verificationRequiredReason,
            verificationUrl: acc.verificationUrl,
          }
        })
        .filter((a): a is ManagedAccount => a !== null)

      let fingerprintVersionChanged = false
      for (const acc of this.accounts) {
        if (acc.fingerprint && syncFingerprint(acc.fingerprint)) {
          fingerprintVersionChanged = true
        }
      }

      this.cursor = clampNonNegativeInt(stored.activeIndex, 0)
      if (this.accounts.length > 0) {
        this.cursor = this.cursor % this.accounts.length
        const defaultIndex = this.cursor
        this.currentAccountIndexByFamily.claude =
          clampNonNegativeInt(stored.activeIndexByFamily?.claude, defaultIndex) %
          this.accounts.length
        this.currentAccountIndexByFamily.gemini =
          clampNonNegativeInt(stored.activeIndexByFamily?.gemini, defaultIndex) %
          this.accounts.length
      }

      if (fingerprintVersionChanged) {
        this.requestSaveToDisk()
      }

      return
    }

    if (authFallback) {
      const parts = parseRefreshParts(authFallback.refresh)
      if (parts.refreshToken) {
        const now = this.nowMs()
        this.accounts = [
          {
            index: 0,
            email: undefined,
            addedAt: now,
            lastUsed: 0,
            parts,
            access: authFallback.access,
            expires: authFallback.expires,
            enabled: true,
            rateLimitResetTimes: {},
            touchedForQuota: {},
          },
        ]
        this.cursor = 0
        this.currentAccountIndexByFamily.claude = 0
        this.currentAccountIndexByFamily.gemini = 0
      }
    }
  }

  private nowMs(): number {
    return (this.deps.now ?? Date.now)()
  }

  private createFingerprint(): Fingerprint {
    if (this.deps.generateFingerprint) {
      return this.deps.generateFingerprint()
    }
    return coreGenerateFingerprint({
      version: this.deps.getVersion?.() ?? ANTIGRAVITY_VERSION_FALLBACK,
    })
  }

  private migrateFingerprintVersion(fp: Fingerprint): boolean {
    if (this.deps.updateFingerprintVersion) {
      return this.deps.updateFingerprintVersion(fp)
    }
    return coreUpdateFingerprintVersion(
      fp,
      this.deps.getVersion?.() ?? ANTIGRAVITY_VERSION_FALLBACK,
    )
  }

  private async persistState(state: AccountStorageV4): Promise<void> {
    if (this.deps.saveAccounts) {
      await this.deps.saveAccounts(state)
      return
    }
    if (this.deps.storagePath) {
      await saveAccountsToPath(this.deps.storagePath, state, this.deps.storageIo)
    }
  }

  async saveToDiskReplace(): Promise<void> {
    const state = this.buildStorageState()
    if (this.deps.saveAccountsReplace) {
      await this.deps.saveAccountsReplace(state)
    } else if (this.deps.storagePath) {
      await saveAccountsReplaceToPath(
        this.deps.storagePath,
        state,
        this.deps.storageIo,
      )
    } else if (this.deps.saveAccounts) {
      await this.deps.saveAccounts(state)
    }
    this.lastSavedSnapshot = JSON.stringify(state)
  }

  getAccountCount(): number {
    return this.getEnabledAccounts().length
  }

  getTotalAccountCount(): number {
    return this.accounts.length
  }

  getEnabledAccounts(): ManagedAccount[] {
    return this.accounts.filter((account) => account.enabled !== false)
  }

  getAccountsSnapshot(): ManagedAccount[] {
    return this.accounts.map((a) => ({
      ...a,
      parts: { ...a.parts },
      rateLimitResetTimes: { ...a.rateLimitResetTimes },
    }))
  }

  getCurrentAccountForFamily(family: ModelFamily): ManagedAccount | null {
    const currentIndex = this.currentAccountIndexByFamily[family]
    if (currentIndex >= 0 && currentIndex < this.accounts.length) {
      const account = this.accounts[currentIndex] ?? null
      if (account && account.enabled !== false) {
        return account
      }
    }
    return null
  }

  markSwitched(
    account: ManagedAccount,
    reason: "rate-limit" | "initial" | "rotation",
    family: ModelFamily,
  ): void {
    account.lastSwitchReason = reason
    this.currentAccountIndexByFamily[family] = account.index
  }

  shouldShowAccountToast(accountIndex: number, debounceMs = 30000): boolean {
    const now = this.nowMs()
    if (accountIndex !== this.lastToastAccountIndex) {
      return true
    }
    return now - this.lastToastTime >= debounceMs
  }

  markToastShown(accountIndex: number): void {
    this.lastToastAccountIndex = accountIndex
    this.lastToastTime = this.nowMs()
  }

  getCurrentOrNextForFamily(
    family: ModelFamily,
    model?: string | null,
    strategy: AccountSelectionStrategy = "sticky",
    headerStyle: HeaderStyle = "antigravity",
    pidOffsetEnabled = false,
    softQuotaThresholdPercent = 100,
    softQuotaCacheTtlMs = 10 * 60 * 1000,
    excludeIndices?: Set<number>,
  ): ManagedAccount | null {
    const quotaKey = getQuotaKey(family, headerStyle, model)

    if (strategy === "round-robin") {
      const next = this.getNextForFamily(
        family,
        model,
        headerStyle,
        softQuotaThresholdPercent,
        softQuotaCacheTtlMs,
        excludeIndices,
      )
      if (next) {
        this.markTouchedForQuota(next, quotaKey)
        this.currentAccountIndexByFamily[family] = next.index
      }
      return next
    }

    if (strategy === "hybrid") {
      const healthTracker = this.deps.healthTracker ?? getHealthTracker()
      const tokenTracker = this.deps.tokenTracker ?? getTokenTracker()
      const now = this.nowMs()

      const accountsWithMetrics: AccountWithMetrics[] = this.accounts
        .filter((acc) => acc.enabled !== false && !excludeIndices?.has(acc.index))
        .map((acc) => {
          clearExpiredRateLimits(acc, now)
          return {
            index: acc.index,
            lastUsed: acc.lastUsed,
            healthScore: healthTracker.getScore(acc.index),
            isRateLimited:
              isRateLimitedForFamily(acc, family, model, now) ||
              isOverSoftQuotaThreshold(
                acc,
                family,
                softQuotaThresholdPercent,
                softQuotaCacheTtlMs,
                model,
                this.deps.onDebugLog,
                now,
              ),
            isCoolingDown: this.isAccountCoolingDown(acc),
          }
        })

      const currentIndex = this.currentAccountIndexByFamily[family] ?? null
      const selectedIndex = selectHybridAccount(
        accountsWithMetrics,
        tokenTracker,
        currentIndex,
      )
      if (selectedIndex !== null) {
        const selected = this.accounts[selectedIndex]
        if (selected) {
          selected.lastUsed = this.nowMs()
          this.markTouchedForQuota(selected, quotaKey)
          this.currentAccountIndexByFamily[family] = selected.index
          return selected
        }
      }
    }

    if (
      pidOffsetEnabled &&
      !this.sessionOffsetApplied[family] &&
      this.accounts.length > 1
    ) {
      const pidOffset = process.pid % this.accounts.length
      const baseIndex = this.currentAccountIndexByFamily[family] ?? 0
      const newIndex = (baseIndex + pidOffset) % this.accounts.length

      this.deps.onDebugLog?.(
        `[Account] Applying PID offset: pid=${process.pid} offset=${pidOffset} family=${family} index=${baseIndex}->${newIndex}`,
      )

      this.currentAccountIndexByFamily[family] = newIndex
      this.sessionOffsetApplied[family] = true
    }

    const current = this.getCurrentAccountForFamily(family)
    if (current && !excludeIndices?.has(current.index)) {
      const now = this.nowMs()
      clearExpiredRateLimits(current, now)
      const isLimitedForRequestedStyle = isRateLimitedForHeaderStyle(
        current,
        family,
        headerStyle,
        model,
        now,
      )
      const isOverThreshold = isOverSoftQuotaThreshold(
        current,
        family,
        softQuotaThresholdPercent,
        softQuotaCacheTtlMs,
        model,
        this.deps.onDebugLog,
        now,
      )
      if (
        !isLimitedForRequestedStyle &&
        !isOverThreshold &&
        !this.isAccountCoolingDown(current)
      ) {
        this.markTouchedForQuota(current, quotaKey)
        return current
      }
    }

    const next = this.getNextForFamily(
      family,
      model,
      headerStyle,
      softQuotaThresholdPercent,
      softQuotaCacheTtlMs,
      excludeIndices,
    )
    if (next) {
      this.markTouchedForQuota(next, quotaKey)
      this.currentAccountIndexByFamily[family] = next.index
    }
    return next
  }

  getNextForFamily(
    family: ModelFamily,
    model?: string | null,
    headerStyle: HeaderStyle = "antigravity",
    softQuotaThresholdPercent = 100,
    softQuotaCacheTtlMs = 10 * 60 * 1000,
    excludeIndices?: Set<number>,
  ): ManagedAccount | null {
    const now = this.nowMs()
    const available = this.accounts.filter((a) => {
      clearExpiredRateLimits(a, now)
      return (
        a.enabled !== false &&
        !excludeIndices?.has(a.index) &&
        !isRateLimitedForHeaderStyle(a, family, headerStyle, model, now) &&
        !isOverSoftQuotaThreshold(
          a,
          family,
          softQuotaThresholdPercent,
          softQuotaCacheTtlMs,
          model,
          this.deps.onDebugLog,
          now,
        ) &&
        !this.isAccountCoolingDown(a)
      )
    })

    if (available.length === 0) {
      return null
    }

    const account = available[this.cursor % available.length]
    if (!account) {
      return null
    }

    this.cursor++
    return account
  }

  markRateLimited(
    account: ManagedAccount,
    retryAfterMs: number,
    family: ModelFamily,
    headerStyle: HeaderStyle = "antigravity",
    model?: string | null,
  ): void {
    const key = getQuotaKey(family, headerStyle, model)
    account.rateLimitResetTimes[key] = this.nowMs() + retryAfterMs
  }

  markAccountUsed(accountIndex: number): void {
    const account = this.accounts.find((a) => a.index === accountIndex)
    if (account) {
      account.lastUsed = this.nowMs()
    }
  }

  markRateLimitedWithReason(
    account: ManagedAccount,
    family: ModelFamily,
    headerStyle: HeaderStyle,
    model: string | null | undefined,
    reason: RateLimitReason,
    retryAfterMs?: number | null,
    failureTtlMs = 3_600_000,
  ): number {
    const now = this.nowMs()

    if (
      account.lastFailureTime !== undefined &&
      now - account.lastFailureTime > failureTtlMs
    ) {
      account.consecutiveFailures = 0
    }

    const failures = (account.consecutiveFailures ?? 0) + 1
    account.consecutiveFailures = failures
    account.lastFailureTime = now

    const backoffMs = calculateBackoffMs(reason, failures - 1, retryAfterMs)
    const key = getQuotaKey(family, headerStyle, model)
    account.rateLimitResetTimes[key] = now + backoffMs

    return backoffMs
  }

  markRequestSuccess(account: ManagedAccount): void {
    if (account.consecutiveFailures) {
      account.consecutiveFailures = 0
    }
  }

  clearAllRateLimitsForFamily(family: ModelFamily, model?: string | null): void {
    for (const account of this.accounts) {
      if (family === "claude") {
        delete account.rateLimitResetTimes.claude
      } else {
        const antigravityKey = getQuotaKey(family, "antigravity", model)
        const cliKey = getQuotaKey(family, "gemini-cli", model)
        delete account.rateLimitResetTimes[antigravityKey]
        delete account.rateLimitResetTimes[cliKey]
      }
      account.consecutiveFailures = 0
    }
  }

  shouldTryOptimisticReset(family: ModelFamily, model?: string | null): boolean {
    const minWaitMs = this.getMinWaitTimeForFamily(family, model)
    return minWaitMs > 0 && minWaitMs <= 2_000
  }

  markAccountCoolingDown(
    account: ManagedAccount,
    cooldownMs: number,
    reason: CooldownReason,
  ): void {
    account.coolingDownUntil = this.nowMs() + cooldownMs
    account.cooldownReason = reason
  }

  isAccountCoolingDown(account: ManagedAccount): boolean {
    if (account.coolingDownUntil === undefined) {
      return false
    }
    if (this.nowMs() >= account.coolingDownUntil) {
      this.clearAccountCooldown(account)
      return false
    }
    return true
  }

  clearAccountCooldown(account: ManagedAccount): void {
    delete account.coolingDownUntil
    delete account.cooldownReason
  }

  getAccountCooldownReason(account: ManagedAccount): CooldownReason | undefined {
    return this.isAccountCoolingDown(account) ? account.cooldownReason : undefined
  }

  markTouchedForQuota(account: ManagedAccount, quotaKey: string): void {
    account.touchedForQuota[quotaKey] = this.nowMs()
  }

  isFreshForQuota(account: ManagedAccount, quotaKey: string): boolean {
    const touchedAt = account.touchedForQuota[quotaKey]
    if (!touchedAt) return true

    const resetTime = account.rateLimitResetTimes[quotaKey as QuotaKey]
    if (resetTime && touchedAt < resetTime) return true

    return false
  }

  getFreshAccountsForQuota(
    quotaKey: string,
    family: ModelFamily,
    model?: string | null,
  ): ManagedAccount[] {
    const now = this.nowMs()
    return this.accounts.filter((acc) => {
      clearExpiredRateLimits(acc, now)
      return (
        acc.enabled !== false &&
        this.isFreshForQuota(acc, quotaKey) &&
        !isRateLimitedForFamily(acc, family, model, now) &&
        !this.isAccountCoolingDown(acc)
      )
    })
  }

  isRateLimitedForHeaderStyle(
    account: ManagedAccount,
    family: ModelFamily,
    headerStyle: HeaderStyle,
    model?: string | null,
  ): boolean {
    return isRateLimitedForHeaderStyle(account, family, headerStyle, model, this.nowMs())
  }

  getAvailableHeaderStyle(
    account: ManagedAccount,
    family: ModelFamily,
    model?: string | null,
  ): HeaderStyle | null {
    const now = this.nowMs()
    clearExpiredRateLimits(account, now)
    if (family === "claude") {
      return isRateLimitedForHeaderStyle(account, family, "antigravity", undefined, now)
        ? null
        : "antigravity"
    }
    if (!isRateLimitedForHeaderStyle(account, family, "antigravity", model, now)) {
      return "antigravity"
    }
    if (!isRateLimitedForHeaderStyle(account, family, "gemini-cli", model, now)) {
      return "gemini-cli"
    }
    return null
  }

  hasOtherAccountWithAntigravityAvailable(
    currentAccountIndex: number,
    family: ModelFamily,
    model?: string | null,
  ): boolean {
    if (family === "claude") {
      return false
    }

    const now = this.nowMs()
    return this.accounts.some((acc) => {
      if (acc.index === currentAccountIndex) {
        return false
      }
      if (acc.enabled === false) {
        return false
      }
      if (this.isAccountCoolingDown(acc)) {
        return false
      }
      clearExpiredRateLimits(acc, now)
      return !isRateLimitedForHeaderStyle(acc, family, "antigravity", model, now)
    })
  }

  setAccountEnabled(accountIndex: number, enabled: boolean): boolean {
    const account = this.accounts[accountIndex]
    if (!account) {
      return false
    }
    account.enabled = enabled

    if (!enabled) {
      for (const family of Object.keys(
        this.currentAccountIndexByFamily,
      ) as ModelFamily[]) {
        if (this.currentAccountIndexByFamily[family] === accountIndex) {
          const next = this.accounts.find(
            (a, i) => i !== accountIndex && a.enabled !== false,
          )
          this.currentAccountIndexByFamily[family] = next?.index ?? -1
        }
      }
    }

    this.requestSaveToDisk()
    return true
  }

  markAccountVerificationRequired(
    accountIndex: number,
    reason?: string,
    verifyUrl?: string,
  ): boolean {
    const account = this.accounts[accountIndex]
    if (!account) {
      return false
    }

    account.verificationRequired = true
    account.verificationRequiredAt = this.nowMs()
    account.verificationRequiredReason = reason?.trim() || undefined

    const normalizedVerifyUrl = verifyUrl?.trim()
    if (normalizedVerifyUrl) {
      account.verificationUrl = normalizedVerifyUrl
    }

    if (account.enabled !== false) {
      this.setAccountEnabled(accountIndex, false)
    } else {
      this.requestSaveToDisk()
    }

    return true
  }

  clearAccountVerificationRequired(
    accountIndex: number,
    enableAccount = false,
  ): boolean {
    const account = this.accounts[accountIndex]
    if (!account) {
      return false
    }

    const wasVerificationRequired = account.verificationRequired === true
    const hadMetadata =
      account.verificationRequiredAt !== undefined ||
      account.verificationRequiredReason !== undefined ||
      account.verificationUrl !== undefined

    account.verificationRequired = false
    account.verificationRequiredAt = undefined
    account.verificationRequiredReason = undefined
    account.verificationUrl = undefined

    if (enableAccount && wasVerificationRequired && account.enabled === false) {
      this.setAccountEnabled(accountIndex, true)
    } else if (wasVerificationRequired || hadMetadata) {
      this.requestSaveToDisk()
    }

    return true
  }

  upsertAccount(input: {
    refreshToken: string
    email?: string
    projectId?: string
    managedProjectId?: string
    access?: string
    expires?: number
    activate?: boolean
  }): ManagedAccount {
    const now = this.nowMs()
    const existing = this.accounts.find(
      (acc) =>
        acc.parts.refreshToken === input.refreshToken ||
        (input.email && acc.email === input.email),
    )

    if (existing) {
      existing.parts = {
        refreshToken: input.refreshToken,
        projectId: existing.parts.projectId ?? input.projectId,
        managedProjectId:
          existing.parts.managedProjectId ?? input.managedProjectId,
      }
      if (input.email) existing.email = input.email
      if (input.access) existing.access = input.access
      if (input.expires !== undefined) existing.expires = input.expires
      existing.lastUsed = Math.max(existing.lastUsed, now)
      if (input.activate) {
        existing.enabled = true
        existing.verificationRequired = false
        existing.verificationRequiredAt = undefined
        existing.verificationRequiredReason = undefined
        existing.verificationUrl = undefined
        existing.coolingDownUntil = undefined
        existing.cooldownReason = undefined
        if (this.currentAccountIndexByFamily.claude < 0) {
          this.currentAccountIndexByFamily.claude = existing.index
        }
        if (this.currentAccountIndexByFamily.gemini < 0) {
          this.currentAccountIndexByFamily.gemini = existing.index
        }
      }
      if (!existing.fingerprint) {
        existing.fingerprint = this.createFingerprint()
      }
      return existing
    }

    const created: ManagedAccount = {
      index: this.accounts.length,
      email: input.email,
      addedAt: now,
      lastUsed: 0,
      parts: {
        refreshToken: input.refreshToken,
        projectId: input.projectId,
        managedProjectId: input.managedProjectId,
      },
      access: input.access,
      expires: input.expires,
      enabled: true,
      rateLimitResetTimes: {},
      touchedForQuota: {},
      fingerprint: this.createFingerprint(),
      fingerprintHistory: [],
    }
    this.accounts.push(created)
    if (this.currentAccountIndexByFamily.claude < 0) {
      this.currentAccountIndexByFamily.claude = created.index
    }
    if (this.currentAccountIndexByFamily.gemini < 0) {
      this.currentAccountIndexByFamily.gemini = created.index
    }
    return created
  }

  removeAccountByIndex(accountIndex: number): boolean {
    if (accountIndex < 0 || accountIndex >= this.accounts.length) {
      return false
    }
    const account = this.accounts[accountIndex]
    if (!account) {
      return false
    }
    return this.removeAccount(account)
  }

  removeAccount(account: ManagedAccount): boolean {
    const idx = this.accounts.indexOf(account)
    if (idx < 0) {
      return false
    }

    this.accounts.splice(idx, 1)
    this.accounts.forEach((acc, index) => {
      acc.index = index
    })

    if (this.accounts.length === 0) {
      this.cursor = 0
      this.currentAccountIndexByFamily.claude = -1
      this.currentAccountIndexByFamily.gemini = -1
      return true
    }

    if (this.cursor > idx) {
      this.cursor -= 1
    }
    this.cursor = this.cursor % this.accounts.length

    for (const family of ["claude", "gemini"] as ModelFamily[]) {
      if (this.currentAccountIndexByFamily[family] > idx) {
        this.currentAccountIndexByFamily[family] -= 1
      }
      if (this.currentAccountIndexByFamily[family] >= this.accounts.length) {
        this.currentAccountIndexByFamily[family] = -1
      }
    }

    return true
  }

  updateFromAuth(account: ManagedAccount, auth: OAuthAuthDetails): void {
    const parts = parseRefreshParts(auth.refresh)
    account.parts = {
      ...parts,
      projectId: account.parts.projectId ?? parts.projectId,
      managedProjectId: account.parts.managedProjectId ?? parts.managedProjectId,
    }
    account.access = auth.access
    account.expires = auth.expires
  }

  toAuthDetails(account: ManagedAccount): OAuthAuthDetails {
    return {
      type: "oauth",
      refresh: formatRefreshParts(account.parts),
      access: account.access,
      expires: account.expires,
    }
  }

  getMinWaitTimeForFamily(
    family: ModelFamily,
    model?: string | null,
    headerStyle?: HeaderStyle,
    strict?: boolean,
  ): number {
    const now = this.nowMs()
    const available = this.accounts.filter((a) => {
      clearExpiredRateLimits(a, now)
      return (
        a.enabled !== false &&
        (strict && headerStyle
          ? !isRateLimitedForHeaderStyle(a, family, headerStyle, model, now)
          : !isRateLimitedForFamily(a, family, model, now))
      )
    })
    if (available.length > 0) {
      return 0
    }

    const waitTimes: number[] = []
    for (const a of this.accounts) {
      if (a.enabled === false) continue
      if (family === "claude") {
        const t = a.rateLimitResetTimes.claude
        if (t !== undefined) waitTimes.push(Math.max(0, t - now))
      } else if (strict && headerStyle) {
        const modelKey = model ? getQuotaKey(family, headerStyle, model) : undefined
        const baseKey = getQuotaKey(family, headerStyle)
        const tModel = modelKey ? a.rateLimitResetTimes[modelKey] : undefined
        const tBase = a.rateLimitResetTimes[baseKey]
        const effectiveReset = Math.max(tModel ?? 0, tBase ?? 0)
        if (effectiveReset > 0) waitTimes.push(Math.max(0, effectiveReset - now))
      } else {
        const antigravityKey = getQuotaKey(family, "antigravity", model)
        const cliKey = getQuotaKey(family, "gemini-cli", model)

        const t1 = a.rateLimitResetTimes[antigravityKey]
        const t2 = a.rateLimitResetTimes[cliKey]

        const accountWait = Math.min(
          t1 !== undefined ? Math.max(0, t1 - now) : Infinity,
          t2 !== undefined ? Math.max(0, t2 - now) : Infinity,
        )
        if (accountWait !== Infinity) waitTimes.push(accountWait)
      }
    }

    return waitTimes.length > 0 ? Math.min(...waitTimes) : 0
  }

  getAccounts(): ManagedAccount[] {
    return [...this.accounts]
  }

  buildStorageState(): AccountStorageV4 {
    const claudeIndex = Math.max(0, this.currentAccountIndexByFamily.claude)
    const geminiIndex = Math.max(0, this.currentAccountIndexByFamily.gemini)

    return {
      version: 4,
      accounts: this.accounts.map((a) => ({
        email: a.email,
        refreshToken: a.parts.refreshToken,
        projectId: a.parts.projectId,
        managedProjectId: a.parts.managedProjectId,
        addedAt: a.addedAt,
        lastUsed: a.lastUsed,
        enabled: a.enabled,
        lastSwitchReason: a.lastSwitchReason,
        rateLimitResetTimes: { ...a.rateLimitResetTimes },
        coolingDownUntil: a.coolingDownUntil,
        cooldownReason: a.cooldownReason,
        fingerprint: a.fingerprint,
        fingerprintHistory: a.fingerprintHistory?.length
          ? a.fingerprintHistory
          : undefined,
        cachedQuota:
          a.cachedQuota && Object.keys(a.cachedQuota).length > 0
            ? a.cachedQuota
            : undefined,
        cachedQuotaUpdatedAt: a.cachedQuotaUpdatedAt,
        verificationRequired: a.verificationRequired,
        verificationRequiredAt: a.verificationRequiredAt,
        verificationRequiredReason: a.verificationRequiredReason,
        verificationUrl: a.verificationUrl,
      })),
      activeIndex: claudeIndex,
      activeIndexByFamily: {
        claude: claudeIndex,
        gemini: geminiIndex,
      },
    }
  }

  async saveToDisk(): Promise<void> {
    const state = this.buildStorageState()
    await this.persistState(state)
    this.lastSavedSnapshot = JSON.stringify(state)
  }

  requestSaveToDisk(): void {
    if (this.savePending) {
      return
    }
    this.savePending = true
    this.saveTimeout = setTimeout(() => {
      void this.executeSave()
    }, 5000)
  }

  async flushSaveToDisk(): Promise<void> {
    if (!this.savePending) {
      return
    }
    return new Promise<void>((resolve) => {
      this.savePromiseResolvers.push(resolve)
    })
  }

  private async executeSave(): Promise<void> {
    this.savePending = false
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
      this.saveTimeout = null
    }

    try {
      const state = this.buildStorageState()
      const snapshot = JSON.stringify(state)
      if (snapshot !== this.lastSavedSnapshot) {
        await this.persistState(state)
        this.lastSavedSnapshot = snapshot
      }
    } catch {
      // best-effort persistence; avoid unhandled rejection from timer-driven saves
    } finally {
      const resolvers = this.savePromiseResolvers
      this.savePromiseResolvers = []
      for (const resolve of resolvers) {
        resolve()
      }
    }
  }

  syncAllAccountFingerprintVersions(version?: string): boolean {
    let changed = false
    for (const acc of this.accounts) {
      if (!acc.fingerprint) continue
      const updated = version
        ? coreUpdateFingerprintVersion(acc.fingerprint, version)
        : this.migrateFingerprintVersion(acc.fingerprint)
      if (updated) changed = true
    }
    if (changed) {
      this.requestSaveToDisk()
    }
    return changed
  }

  regenerateAccountFingerprint(accountIndex: number): Fingerprint | null {
    const account = this.accounts[accountIndex]
    if (!account) return null

    if (account.fingerprint) {
      const historyEntry: FingerprintVersion = {
        fingerprint: account.fingerprint,
        timestamp: this.nowMs(),
        reason: "regenerated",
      }

      if (!account.fingerprintHistory) {
        account.fingerprintHistory = []
      }

      account.fingerprintHistory.unshift(historyEntry)

      if (account.fingerprintHistory.length > MAX_FINGERPRINT_HISTORY) {
        account.fingerprintHistory = account.fingerprintHistory.slice(
          0,
          MAX_FINGERPRINT_HISTORY,
        )
      }
    }

    account.fingerprint = this.createFingerprint()
    this.requestSaveToDisk()

    return account.fingerprint
  }

  restoreAccountFingerprint(
    accountIndex: number,
    historyIndex: number,
  ): Fingerprint | null {
    const account = this.accounts[accountIndex]
    if (!account) return null

    const history = account.fingerprintHistory
    if (!history || historyIndex < 0 || historyIndex >= history.length) {
      return null
    }

    const fingerprintToRestore = history[historyIndex]!.fingerprint

    if (account.fingerprint) {
      const historyEntry: FingerprintVersion = {
        fingerprint: account.fingerprint,
        timestamp: this.nowMs(),
        reason: "restored",
      }

      account.fingerprintHistory!.unshift(historyEntry)

      if (account.fingerprintHistory!.length > MAX_FINGERPRINT_HISTORY) {
        account.fingerprintHistory = account.fingerprintHistory!.slice(
          0,
          MAX_FINGERPRINT_HISTORY,
        )
      }
    }

    account.fingerprint = { ...fingerprintToRestore, createdAt: this.nowMs() }
    this.migrateFingerprintVersion(account.fingerprint)

    this.requestSaveToDisk()

    return account.fingerprint
  }

  getAccountFingerprintHistory(accountIndex: number): FingerprintVersion[] {
    const account = this.accounts[accountIndex]
    if (!account || !account.fingerprintHistory) {
      return []
    }
    return [...account.fingerprintHistory]
  }

  updateQuotaCache(
    accountRef: string | number,
    quotaGroups: Partial<Record<QuotaGroup, QuotaGroupSummary>>,
  ): void {
    const account =
      typeof accountRef === "number"
        ? this.accounts[accountRef]
        : this.accounts.find((a) => a.parts.refreshToken === accountRef)
    if (account) {
      account.cachedQuota = quotaGroups
      account.cachedQuotaUpdatedAt = this.nowMs()
      this.requestSaveToDisk()
    }
  }

  shouldRefreshAllQuotas(
    family?: ModelFamily,
    thresholdPercent = 100,
    cacheTtlMs = 10 * 60 * 1000,
    model?: string | null,
  ): boolean {
    const enabled = this.getEnabledAccounts()
    if (enabled.length === 0) return false

    const now = this.nowMs()
    const blockedCount = enabled.filter((acc) => {
      const isRateLimited = family
        ? isRateLimitedForFamily(acc, family, model, now)
        : Object.values(acc.rateLimitResetTimes).some(
            (t) => t !== undefined && t > now,
          )
      const isCoolingDown =
        acc.coolingDownUntil !== undefined && acc.coolingDownUntil > now
      const isOverSoftQuota = family
        ? isOverSoftQuotaThreshold(
            acc,
            family,
            thresholdPercent,
            cacheTtlMs,
            model,
            this.deps.onDebugLog,
            now,
          )
        : false
      return isRateLimited || isCoolingDown || isOverSoftQuota
    }).length

    return blockedCount / enabled.length >= 0.75
  }

  isAccountOverSoftQuota(
    account: ManagedAccount,
    family: ModelFamily,
    thresholdPercent: number,
    cacheTtlMs: number,
    model?: string | null,
  ): boolean {
    return isOverSoftQuotaThreshold(
      account,
      family,
      thresholdPercent,
      cacheTtlMs,
      model,
      this.deps.onDebugLog,
      this.nowMs(),
    )
  }

  needsActiveQuotaRefresh(
    account: ManagedAccount,
    family: ModelFamily,
    thresholdPercent: number,
    refreshTtlMs?: number,
    nearThresholdMargin?: number,
    model?: string | null,
  ): boolean {
    return needsActiveQuotaRefresh(
      account,
      family,
      thresholdPercent,
      refreshTtlMs,
      nearThresholdMargin,
      model,
      this.nowMs(),
    )
  }

  getAccountsForQuotaCheck(): AccountMetadataV3[] {
    return this.accounts.map((a) => ({
      email: a.email,
      refreshToken: a.parts.refreshToken,
      projectId: a.parts.projectId,
      managedProjectId: a.parts.managedProjectId,
      addedAt: a.addedAt,
      lastUsed: a.lastUsed,
      enabled: a.enabled,
    }))
  }

  getOldestQuotaCacheAge(): number | null {
    let oldest: number | null = null
    const now = this.nowMs()
    for (const acc of this.accounts) {
      if (acc.enabled === false) continue
      if (acc.cachedQuotaUpdatedAt == null) return null
      const age = now - acc.cachedQuotaUpdatedAt
      if (oldest === null || age > oldest) oldest = age
    }
    return oldest
  }

  areAllAccountsOverSoftQuota(
    family: ModelFamily,
    thresholdPercent: number,
    cacheTtlMs: number,
    model?: string | null,
  ): boolean {
    if (thresholdPercent >= 100) return false
    const enabled = this.accounts.filter((a) => a.enabled !== false)
    if (enabled.length === 0) return false
    const now = this.nowMs()
    return enabled.every((a) =>
      isOverSoftQuotaThreshold(
        a,
        family,
        thresholdPercent,
        cacheTtlMs,
        model,
        this.deps.onDebugLog,
        now,
      ),
    )
  }

  getMinWaitTimeForSoftQuota(
    family: ModelFamily,
    thresholdPercent: number,
    cacheTtlMs: number,
    model?: string | null,
  ): number | null {
    if (thresholdPercent >= 100) return 0

    const enabled = this.accounts.filter((a) => a.enabled !== false)
    if (enabled.length === 0) return null

    const now = this.nowMs()
    const available = enabled.filter(
      (a) =>
        !isOverSoftQuotaThreshold(
          a,
          family,
          thresholdPercent,
          cacheTtlMs,
          model,
          this.deps.onDebugLog,
          now,
        ),
    )
    if (available.length > 0) return 0

    if (!model && family !== "claude") return null
    const quotaGroup = resolveQuotaGroup(family, model)
    const waitTimes: number[] = []

    for (const acc of enabled) {
      const groupData = acc.cachedQuota?.[quotaGroup]
      if (groupData?.resetTime) {
        const resetTimestamp = Date.parse(groupData.resetTime)
        if (Number.isFinite(resetTimestamp)) {
          waitTimes.push(Math.max(0, resetTimestamp - now))
        }
      }
    }

    if (waitTimes.length === 0) return null
    const minWait = Math.min(...waitTimes)
    return minWait === 0 ? null : minWait
  }
}
