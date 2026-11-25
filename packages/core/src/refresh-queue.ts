import type { ManagedAccount, OAuthAuthDetails } from "./account-helpers.ts"

export interface RefreshableAccountStore {
  getAccounts(): ManagedAccount[]
  toAuthDetails(account: ManagedAccount): OAuthAuthDetails
  updateFromAuth(account: ManagedAccount, auth: OAuthAuthDetails): void
  saveToDisk(): Promise<void>
}

export interface ProactiveRefreshConfig {
  enabled: boolean
  bufferSeconds: number
  checkIntervalSeconds: number
}

export const DEFAULT_PROACTIVE_REFRESH_CONFIG: ProactiveRefreshConfig = {
  enabled: true,
  bufferSeconds: 1_800,
  checkIntervalSeconds: 300,
}

export interface ProactiveRefreshQueueOptions<
  TManager extends RefreshableAccountStore = RefreshableAccountStore,
> {
  config?: Partial<ProactiveRefreshConfig>
  refreshToken: (
    auth: OAuthAuthDetails,
    account: ManagedAccount,
  ) => Promise<OAuthAuthDetails | undefined>
  onAfterSave?: (manager: TManager) => void | Promise<void>
  logger?: {
    debug?: (message: string, meta?: Record<string, unknown>) => void
    warn?: (message: string, meta?: Record<string, unknown>) => void
    error?: (message: string, meta?: Record<string, unknown>) => void
  }
}

interface RefreshQueueState {
  isRunning: boolean
  initialTimeoutHandle: ReturnType<typeof setTimeout> | null
  intervalHandle: ReturnType<typeof setInterval> | null
  isRefreshing: boolean
  lastCheckTime: number
  lastRefreshTime: number
  refreshCount: number
  errorCount: number
}

export class ProactiveRefreshQueue<
  TManager extends RefreshableAccountStore = RefreshableAccountStore,
> {
  private readonly config: ProactiveRefreshConfig
  private readonly refreshFn: ProactiveRefreshQueueOptions<TManager>["refreshToken"]
  private readonly onAfterSave: ProactiveRefreshQueueOptions<TManager>["onAfterSave"]
  private readonly logger: ProactiveRefreshQueueOptions<TManager>["logger"]
  private accountManager: TManager | null = null

  private state: RefreshQueueState = {
    isRunning: false,
    initialTimeoutHandle: null,
    intervalHandle: null,
    isRefreshing: false,
    lastCheckTime: 0,
    lastRefreshTime: 0,
    refreshCount: 0,
    errorCount: 0,
  }

  constructor(options: ProactiveRefreshQueueOptions<TManager>) {
    this.refreshFn = options.refreshToken
    this.onAfterSave = options.onAfterSave
    this.logger = options.logger
    this.config = {
      ...DEFAULT_PROACTIVE_REFRESH_CONFIG,
      ...options.config,
    }
  }

  setAccountManager(manager: TManager): void {
    this.accountManager = manager
  }

  needsRefresh(account: ManagedAccount): boolean {
    if (!account.expires) {
      return false
    }
    const now = Date.now()
    const bufferMs = this.config.bufferSeconds * 1000
    return account.expires <= now + bufferMs
  }

  isExpired(account: ManagedAccount): boolean {
    if (!account.expires) {
      return false
    }
    return account.expires <= Date.now()
  }

  getAccountsNeedingRefresh(): ManagedAccount[] {
    if (!this.accountManager) {
      return []
    }

    return this.accountManager.getAccounts().filter((account) => {
      if (account.enabled === false) {
        return false
      }
      if (this.isExpired(account)) {
        return false
      }
      return this.needsRefresh(account)
    })
  }

  async runCheckNow(): Promise<void> {
    if (this.state.isRefreshing || !this.accountManager) {
      return
    }

    const startedWhileRunning = this.state.isRunning
    this.state.isRefreshing = true
    this.state.lastCheckTime = Date.now()

    try {
      const accountsToRefresh = this.getAccountsNeedingRefresh()
      if (accountsToRefresh.length === 0) {
        return
      }

      this.logger?.debug?.("Found accounts needing refresh", {
        count: accountsToRefresh.length,
      })

      for (const snapshotAccount of accountsToRefresh) {
        if (startedWhileRunning && !this.state.isRunning) {
          break
        }
        const currentManager = this.accountManager
        if (!currentManager) {
          break
        }
        const liveAccount = currentManager
          .getAccounts()
          .find(
            (acc) =>
              acc === snapshotAccount ||
              acc.parts.refreshToken === snapshotAccount.parts.refreshToken,
          )
        if (
          !liveAccount ||
          liveAccount.enabled === false ||
          this.isExpired(liveAccount) ||
          !this.needsRefresh(liveAccount)
        ) {
          continue
        }
        try {
          const priorRefreshToken = liveAccount.parts.refreshToken
          const auth = currentManager.toAuthDetails(liveAccount)
          const refreshed = await this.refreshFn(auth, liveAccount)

          if (refreshed) {
            if (startedWhileRunning && !this.state.isRunning) {
              break
            }
            const postRefreshManager = this.accountManager ?? currentManager
            const targetAccount = postRefreshManager
              .getAccounts()
              .find(
                (acc) =>
                  acc === liveAccount ||
                  acc.parts.refreshToken === priorRefreshToken ||
                  acc.parts.refreshToken === liveAccount.parts.refreshToken,
              )
            if (targetAccount) {
              postRefreshManager.updateFromAuth(targetAccount, refreshed)
              this.state.refreshCount++
              this.state.lastRefreshTime = Date.now()

              let savedToDisk = false
              try {
                await postRefreshManager.saveToDisk()
                savedToDisk = true
              } catch (saveError) {
                this.logger?.warn?.("Failed to persist refreshed account to disk", {
                  accountIndex: targetAccount.index,
                  error:
                    saveError instanceof Error
                      ? saveError.message
                      : String(saveError),
                })
              }
              if (savedToDisk && (!startedWhileRunning || this.state.isRunning)) {
                try {
                  await this.onAfterSave?.(postRefreshManager)
                } catch {
                  // Non-fatal post-save hook
                }
              }
            }
          }
        } catch (error) {
          this.state.errorCount++
          this.logger?.warn?.("Failed to refresh account", {
            accountIndex: liveAccount.index,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    } finally {
      this.state.isRefreshing = false
    }
  }

  start(): void {
    if (this.state.isRunning) {
      return
    }
    if (!this.config.enabled) {
      this.logger?.debug?.("Proactive refresh disabled by config")
      return
    }

    this.state.isRunning = true
    const intervalMs = this.config.checkIntervalSeconds * 1000

    this.logger?.debug?.("Started proactive refresh queue", {
      checkIntervalSeconds: this.config.checkIntervalSeconds,
      bufferSeconds: this.config.bufferSeconds,
    })

    this.state.initialTimeoutHandle = setTimeout(() => {
      this.state.initialTimeoutHandle = null
      if (this.state.isRunning) {
        this.runCheckNow().catch((error) => {
          this.logger?.error?.("Initial check failed", {
            error: error instanceof Error ? error.message : String(error),
          })
        })
      }
    }, 5_000)

    this.state.intervalHandle = setInterval(() => {
      if (!this.state.isRunning) return
      this.runCheckNow().catch((error) => {
        this.logger?.error?.("Check failed", {
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }, intervalMs)
  }

  stop(): void {
    if (!this.state.isRunning) {
      return
    }

    this.state.isRunning = false

    if (this.state.initialTimeoutHandle) {
      clearTimeout(this.state.initialTimeoutHandle)
      this.state.initialTimeoutHandle = null
    }

    if (this.state.intervalHandle) {
      clearInterval(this.state.intervalHandle)
      this.state.intervalHandle = null
    }

    this.logger?.debug?.("Stopped proactive refresh queue", {
      refreshCount: this.state.refreshCount,
      errorCount: this.state.errorCount,
    })
  }

  getStats(): {
    isRunning: boolean
    isRefreshing: boolean
    lastCheckTime: number
    lastRefreshTime: number
    refreshCount: number
    errorCount: number
  } {
    return {
      isRunning: this.state.isRunning,
      isRefreshing: this.state.isRefreshing,
      lastCheckTime: this.state.lastCheckTime,
      lastRefreshTime: this.state.lastRefreshTime,
      refreshCount: this.state.refreshCount,
      errorCount: this.state.errorCount,
    }
  }

  isRunning(): boolean {
    return this.state.isRunning
  }
}
