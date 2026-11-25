import { randomBytes } from "node:crypto"
import {
  appendFileSync,
  existsSync,
  promises as fs,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"

import type { Fingerprint, FingerprintVersion } from "./fingerprint.ts"

export type ModelFamily = "claude" | "gemini"
export type HeaderStyle = "antigravity" | "gemini-cli" | "agy-sdk"

export interface StorageLogger {
  info?: (message: string, meta?: Record<string, unknown>) => void
  warn?: (message: string, meta?: Record<string, unknown>) => void
  error?: (message: string, meta?: Record<string, unknown>) => void
}

export type FileLockFn = (path: string) => Promise<() => Promise<void>>

export interface AccountStorageIoOptions {
  lock?: FileLockFn
  logger?: StorageLogger
}

export const GITIGNORE_ENTRIES: string[] = [
  ".gitignore",
  "antigravity-accounts.json",
  "antigravity-accounts.json.*.tmp",
  "antigravity-signature-cache.json",
  "antigravity-logs/",
]

export async function ensureGitignore(
  configDir: string,
  logger?: StorageLogger,
): Promise<void> {
  const gitignorePath = join(configDir, ".gitignore")

  try {
    let content: string
    let existingLines: string[] = []

    try {
      content = await fs.readFile(gitignorePath, "utf-8")
      existingLines = content.split("\n").map((line) => line.trim())
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        return
      }
      content = ""
    }

    const missingEntries = GITIGNORE_ENTRIES.filter(
      (entry) => !existingLines.includes(entry),
    )

    if (missingEntries.length === 0) {
      return
    }

    if (content === "") {
      await fs.writeFile(
        gitignorePath,
        missingEntries.join("\n") + "\n",
        "utf-8",
      )
      logger?.info?.("Created .gitignore in config directory")
    } else {
      const suffix = content.endsWith("\n") ? "" : "\n"
      await fs.appendFile(
        gitignorePath,
        suffix + missingEntries.join("\n") + "\n",
        "utf-8",
      )
      logger?.info?.("Updated .gitignore with missing entries", {
        added: missingEntries,
      })
    }
  } catch {
    // Non-critical feature
  }
}

export function ensureGitignoreSync(
  configDir: string,
  logger?: StorageLogger,
): void {
  const gitignorePath = join(configDir, ".gitignore")

  try {
    let content: string
    let existingLines: string[] = []

    if (existsSync(gitignorePath)) {
      content = readFileSync(gitignorePath, "utf-8")
      existingLines = content.split("\n").map((line) => line.trim())
    } else {
      content = ""
    }

    const missingEntries = GITIGNORE_ENTRIES.filter(
      (entry) => !existingLines.includes(entry),
    )

    if (missingEntries.length === 0) {
      return
    }

    if (content === "") {
      writeFileSync(gitignorePath, missingEntries.join("\n") + "\n", "utf-8")
      logger?.info?.("Created .gitignore in config directory")
    } else {
      const suffix = content.endsWith("\n") ? "" : "\n"
      appendFileSync(
        gitignorePath,
        suffix + missingEntries.join("\n") + "\n",
        "utf-8",
      )
      logger?.info?.("Updated .gitignore with missing entries", {
        added: missingEntries,
      })
    }
  } catch {
    // Non-critical feature
  }
}

export interface RateLimitState {
  claude?: number
  gemini?: number
}

export interface RateLimitStateV3 {
  claude?: number
  "gemini-antigravity"?: number
  "gemini-cli"?: number
  [key: string]: number | undefined
}

export interface AccountMetadataV1 {
  email?: string
  refreshToken: string
  projectId?: string
  managedProjectId?: string
  addedAt: number
  lastUsed: number
  isRateLimited?: boolean
  rateLimitResetTime?: number
  lastSwitchReason?: "rate-limit" | "initial" | "rotation"
}

export interface AccountStorageV1 {
  version: 1
  accounts: AccountMetadataV1[]
  activeIndex: number
}

export interface AccountMetadata {
  email?: string
  refreshToken: string
  projectId?: string
  managedProjectId?: string
  addedAt: number
  lastUsed: number
  lastSwitchReason?: "rate-limit" | "initial" | "rotation"
  rateLimitResetTimes?: RateLimitState
}

export interface AccountStorage {
  version: 2
  accounts: AccountMetadata[]
  activeIndex: number
}

export type CooldownReason =
  | "auth-failure"
  | "network-error"
  | "project-error"
  | "validation-required"

export interface AccountMetadataV3 {
  email?: string
  refreshToken: string
  projectId?: string
  managedProjectId?: string
  addedAt: number
  lastUsed: number
  enabled?: boolean
  lastSwitchReason?: "rate-limit" | "initial" | "rotation"
  rateLimitResetTimes?: RateLimitStateV3
  coolingDownUntil?: number
  cooldownReason?: CooldownReason
  fingerprint?: Fingerprint
  fingerprintHistory?: FingerprintVersion[]
  verificationRequired?: boolean
  verificationRequiredAt?: number
  verificationRequiredReason?: string
  verificationUrl?: string
  cachedQuota?: Record<
    string,
    { remainingFraction?: number; resetTime?: string; modelCount: number }
  >
  cachedQuotaUpdatedAt?: number
}

export interface AccountStorageV3 {
  version: 3
  accounts: AccountMetadataV3[]
  activeIndex: number
  activeIndexByFamily?: {
    claude?: number
    gemini?: number
  }
}

export interface AccountStorageV4 {
  version: 4
  accounts: AccountMetadataV3[]
  activeIndex: number
  activeIndexByFamily?: {
    claude?: number
    gemini?: number
  }
}

type AnyAccountStorage =
  | AccountStorageV1
  | AccountStorage
  | AccountStorageV3
  | AccountStorageV4

const STALE_LOCK_MS = 10_000
const DEFAULT_LOCK_RETRIES = 5
const DEFAULT_LOCK_MIN_TIMEOUT_MS = 100
const DEFAULT_LOCK_MAX_TIMEOUT_MS = 1_000

function getLockPath(path: string): string {
  return `${path}.lock`
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Pure-Node atomic directory lock (`mkdir(path + ".lock")`) used when no external
 * lock provider (e.g. `proper-lockfile`) is injected.
 */
export async function acquireDefaultDirLock(path: string): Promise<() => Promise<void>> {
  const lockPath = getLockPath(path)

  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.mkdir(lockPath)
      return async () => {
        try {
          await fs.rm(lockPath, { recursive: true, force: true })
        } catch {
          // Best-effort unlock
        }
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== "EEXIST" && code !== "ELOCKED") {
        throw error
      }

      // Check for stale directory lock (> 10s old)
      try {
        const stat = await fs.lstat(lockPath)
        if (stat.isDirectory() && Date.now() - stat.mtimeMs > STALE_LOCK_MS) {
          await fs.rm(lockPath, { recursive: true, force: true })
          continue
        }
        if (stat.isFile()) {
          // Surface ELOCKED immediately so acquireFileLock's legacy .lock file recovery handles it cleanly
          const locked = Object.assign(new Error("Lock file is already being held"), {
            code: "ELOCKED",
          })
          throw locked
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ELOCKED") {
          throw statError
        }
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") {
          continue
        }
      }

      if (attempt >= DEFAULT_LOCK_RETRIES) {
        const locked = Object.assign(new Error("Lock file is already being held"), {
          code: "ELOCKED",
        })
        throw locked
      }

      const waitMs = Math.min(
        DEFAULT_LOCK_MAX_TIMEOUT_MS,
        DEFAULT_LOCK_MIN_TIMEOUT_MS * 2 ** attempt,
      )
      await sleep(waitMs)
    }
  }
}

async function tryRecoverLegacyLockfile(
  path: string,
  logger?: StorageLogger,
): Promise<boolean> {
  const lockPath = getLockPath(path)

  try {
    const lockStat = await fs.lstat(lockPath)
    if (!lockStat.isFile()) {
      return false
    }

    await fs.unlink(lockPath)
    logger?.warn?.("Removed legacy lock file that blocked account storage lock", {
      lockPath,
    })
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== "ENOENT") {
      logger?.warn?.("Failed to remove legacy account storage lock file", {
        lockPath,
        error: String(error),
      })
    }
    return false
  }
}

async function acquireFileLock(
  path: string,
  lockFn: FileLockFn,
  logger?: StorageLogger,
): Promise<() => Promise<void>> {
  try {
    return await lockFn(path)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== "ELOCKED" && code !== "EEXIST") {
      throw error
    }

    const recovered = await tryRecoverLegacyLockfile(path, logger)
    if (!recovered) {
      throw error
    }

    return await lockFn(path)
  }
}

async function ensureSecurePermissions(path: string): Promise<void> {
  try {
    await fs.chmod(path, 0o600)
  } catch {
    // Ignore errors (Windows or unsupported FS)
  }
}

async function ensureFileExists(path: string): Promise<void> {
  try {
    await fs.access(path)
  } catch {
    await fs.mkdir(dirname(path), { recursive: true })
    await fs.writeFile(
      path,
      JSON.stringify({ version: 4, accounts: [], activeIndex: 0 }, null, 2),
      { encoding: "utf-8", mode: 0o600 },
    )
  }
}

async function withFileLock<T>(
  path: string,
  options: AccountStorageIoOptions,
  fn: () => Promise<T>,
): Promise<T> {
  await ensureFileExists(path)
  const lockFn = options.lock ?? acquireDefaultDirLock
  let release: (() => Promise<void>) | null = null
  try {
    release = await acquireFileLock(path, lockFn, options.logger)
    return await fn()
  } finally {
    if (release) {
      try {
        await release()
      } catch (unlockError) {
        options.logger?.warn?.("Failed to release lock", {
          error: String(unlockError),
        })
      }
    }
  }
}

export function mergeAccountStorage(
  existing: AccountStorageV4,
  incoming: AccountStorageV4,
): AccountStorageV4 {
  const accountMap = new Map<string, AccountMetadataV3>()

  for (const acc of existing.accounts) {
    if (acc.refreshToken) {
      accountMap.set(acc.refreshToken, acc)
    }
  }

  for (const acc of incoming.accounts) {
    if (acc.refreshToken) {
      let existingAcc = accountMap.get(acc.refreshToken)
      let staleRefreshTokenToDelete: string | undefined
      if (!existingAcc && acc.email) {
        for (const [token, candidate] of accountMap.entries()) {
          if (candidate.email === acc.email) {
            existingAcc = candidate
            staleRefreshTokenToDelete = token
            break
          }
        }
      }
      if (existingAcc) {
        const currLastUsed = acc.lastUsed || 0
        const existLastUsed = existingAcc.lastUsed || 0
        const currAddedAt = acc.addedAt || 0
        const existAddedAt = existingAcc.addedAt || 0
        const incomingIsOlderOnTokenChange =
          staleRefreshTokenToDelete !== undefined &&
          (currLastUsed < existLastUsed ||
            (currLastUsed === existLastUsed && currAddedAt < existAddedAt))

        if (incomingIsOlderOnTokenChange) {
          continue
        }

        if (staleRefreshTokenToDelete !== undefined) {
          accountMap.delete(staleRefreshTokenToDelete)
        }

        const incomingRateLimitResetTimes = acc.rateLimitResetTimes
        const mergedRateLimitResetTimes =
          incomingRateLimitResetTimes === undefined
            ? existingAcc.rateLimitResetTimes
            : Object.keys(incomingRateLimitResetTimes).length === 0
              ? undefined
              : {
                  ...existingAcc.rateLimitResetTimes,
                  ...incomingRateLimitResetTimes,
                }
        accountMap.set(acc.refreshToken, {
          ...existingAcc,
          ...acc,
          projectId: existingAcc.projectId ?? acc.projectId,
          managedProjectId: existingAcc.managedProjectId ?? acc.managedProjectId,
          rateLimitResetTimes: mergedRateLimitResetTimes,
          lastUsed: Math.max(existLastUsed, currLastUsed),
        })
      } else {
        accountMap.set(acc.refreshToken, acc)
      }
    }
  }

  return {
    version: 4,
    accounts: deduplicateAccountsByEmail(Array.from(accountMap.values())),
    activeIndex: incoming.activeIndex,
    activeIndexByFamily: incoming.activeIndexByFamily,
  }
}

export function deduplicateAccountsByEmail<
  T extends { email?: string; lastUsed?: number; addedAt?: number },
>(accounts: T[]): T[] {
  const emailToNewestIndex = new Map<string, number>()
  const indicesToKeep = new Set<number>()

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i]
    if (!acc) continue

    if (!acc.email) {
      indicesToKeep.add(i)
      continue
    }

    const existingIndex = emailToNewestIndex.get(acc.email)
    if (existingIndex === undefined) {
      emailToNewestIndex.set(acc.email, i)
      continue
    }

    const existing = accounts[existingIndex]
    if (!existing) {
      emailToNewestIndex.set(acc.email, i)
      continue
    }

    const currLastUsed = acc.lastUsed || 0
    const existLastUsed = existing.lastUsed || 0
    const currAddedAt = acc.addedAt || 0
    const existAddedAt = existing.addedAt || 0

    const isNewer =
      currLastUsed > existLastUsed ||
      (currLastUsed === existLastUsed && currAddedAt > existAddedAt)

    if (isNewer) {
      emailToNewestIndex.set(acc.email, i)
    }
  }

  for (const idx of emailToNewestIndex.values()) {
    indicesToKeep.add(idx)
  }

  const result: T[] = []
  for (let i = 0; i < accounts.length; i++) {
    if (indicesToKeep.has(i)) {
      const acc = accounts[i]
      if (acc) {
        result.push(acc)
      }
    }
  }

  return result
}

export function migrateV1ToV2(v1: AccountStorageV1): AccountStorage {
  return {
    version: 2,
    accounts: v1.accounts.map((acc) => {
      const rateLimitResetTimes: RateLimitState = {}
      if (
        acc.isRateLimited &&
        acc.rateLimitResetTime &&
        acc.rateLimitResetTime > Date.now()
      ) {
        rateLimitResetTimes.claude = acc.rateLimitResetTime
        rateLimitResetTimes.gemini = acc.rateLimitResetTime
      }
      return {
        email: acc.email,
        refreshToken: acc.refreshToken,
        projectId: acc.projectId,
        managedProjectId: acc.managedProjectId,
        addedAt: acc.addedAt,
        lastUsed: acc.lastUsed,
        lastSwitchReason: acc.lastSwitchReason,
        rateLimitResetTimes:
          Object.keys(rateLimitResetTimes).length > 0
            ? rateLimitResetTimes
            : undefined,
      }
    }),
    activeIndex: v1.activeIndex,
  }
}

export function migrateV2ToV3(v2: AccountStorage): AccountStorageV3 {
  return {
    version: 3,
    accounts: v2.accounts.map((acc) => {
      const rateLimitResetTimes: RateLimitStateV3 = {}
      if (
        acc.rateLimitResetTimes?.claude &&
        acc.rateLimitResetTimes.claude > Date.now()
      ) {
        rateLimitResetTimes.claude = acc.rateLimitResetTimes.claude
      }
      if (
        acc.rateLimitResetTimes?.gemini &&
        acc.rateLimitResetTimes.gemini > Date.now()
      ) {
        rateLimitResetTimes["gemini-antigravity"] =
          acc.rateLimitResetTimes.gemini
      }
      return {
        email: acc.email,
        refreshToken: acc.refreshToken,
        projectId: acc.projectId,
        managedProjectId: acc.managedProjectId,
        addedAt: acc.addedAt,
        lastUsed: acc.lastUsed,
        lastSwitchReason: acc.lastSwitchReason,
        rateLimitResetTimes:
          Object.keys(rateLimitResetTimes).length > 0
            ? rateLimitResetTimes
            : undefined,
      }
    }),
    activeIndex: v2.activeIndex,
  }
}

export function migrateV3ToV4(v3: AccountStorageV3): AccountStorageV4 {
  return {
    version: 4,
    accounts: v3.accounts.map((acc) => ({
      ...acc,
      fingerprint: undefined,
      fingerprintHistory: undefined,
    })),
    activeIndex: v3.activeIndex,
    activeIndexByFamily: v3.activeIndexByFamily,
  }
}

async function loadAccountsUnsafeAtPath(
  path: string,
): Promise<AccountStorageV4 | null> {
  try {
    await ensureSecurePermissions(path)

    const content = await fs.readFile(path, "utf-8")
    const parsed = JSON.parse(content)

    if (parsed.version === 1) {
      return migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(parsed)))
    }
    if (parsed.version === 2) {
      return migrateV3ToV4(migrateV2ToV3(parsed))
    }
    if (parsed.version === 3) {
      return migrateV3ToV4(parsed)
    }

    return {
      ...parsed,
      accounts: deduplicateAccountsByEmail(parsed.accounts),
    }
  } catch {
    return null
  }
}

export async function loadAccountsFromPath(
  path: string,
  options: AccountStorageIoOptions = {},
): Promise<AccountStorageV4 | null> {
  try {
    await ensureSecurePermissions(path)

    const content = await fs.readFile(path, "utf-8")
    const data = JSON.parse(content) as AnyAccountStorage

    if (!Array.isArray(data.accounts)) {
      options.logger?.warn?.("Invalid storage format, ignoring")
      return null
    }

    let storage: AccountStorageV4

    if (data.version === 1) {
      options.logger?.info?.("Migrating account storage from v1 to v4")
      const v2 = migrateV1ToV2(data)
      const v3 = migrateV2ToV3(v2)
      storage = migrateV3ToV4(v3)
      try {
        await saveAccountsToPath(path, storage, options)
        options.logger?.info?.("Migration to v4 complete")
      } catch (saveError) {
        options.logger?.warn?.("Failed to persist migrated storage", {
          error: String(saveError),
        })
      }
    } else if (data.version === 2) {
      options.logger?.info?.("Migrating account storage from v2 to v4")
      const v3 = migrateV2ToV3(data)
      storage = migrateV3ToV4(v3)
      try {
        await saveAccountsToPath(path, storage, options)
        options.logger?.info?.("Migration to v4 complete")
      } catch (saveError) {
        options.logger?.warn?.("Failed to persist migrated storage", {
          error: String(saveError),
        })
      }
    } else if (data.version === 3) {
      options.logger?.info?.("Migrating account storage from v3 to v4")
      storage = migrateV3ToV4(data)
      try {
        await saveAccountsToPath(path, storage, options)
        options.logger?.info?.("Migration to v4 complete")
      } catch (saveError) {
        options.logger?.warn?.("Failed to persist migrated storage", {
          error: String(saveError),
        })
      }
    } else if (data.version === 4) {
      storage = data
    } else {
      options.logger?.warn?.("Unknown storage version, ignoring", {
        version: (data as { version?: unknown }).version,
      })
      return null
    }

    const validAccounts = storage.accounts.filter(
      (a): a is AccountMetadataV3 =>
        !!a &&
        typeof a === "object" &&
        typeof (a as AccountMetadataV3).refreshToken === "string",
    )

    const deduplicatedAccounts = deduplicateAccountsByEmail(validAccounts)

    let activeIndex =
      typeof storage.activeIndex === "number" &&
      Number.isFinite(storage.activeIndex)
        ? storage.activeIndex
        : 0
    if (deduplicatedAccounts.length > 0) {
      activeIndex = Math.min(activeIndex, deduplicatedAccounts.length - 1)
      activeIndex = Math.max(activeIndex, 0)
    } else {
      activeIndex = 0
    }

    return {
      version: 4,
      accounts: deduplicatedAccounts,
      activeIndex,
      activeIndexByFamily: storage.activeIndexByFamily,
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === "ENOENT") {
      return null
    }
    options.logger?.error?.("Failed to load account storage", {
      error: String(error),
    })
    return null
  }
}

export async function saveAccountsToPath(
  path: string,
  storage: AccountStorageV4,
  options: AccountStorageIoOptions = {},
): Promise<void> {
  const configDir = dirname(path)
  await fs.mkdir(configDir, { recursive: true })
  await ensureGitignore(configDir, options.logger)

  await withFileLock(path, options, async () => {
    const existing = await loadAccountsUnsafeAtPath(path)
    const merged = existing ? mergeAccountStorage(existing, storage) : storage

    const tempPath = `${path}.${randomBytes(6).toString("hex")}.tmp`
    const content = JSON.stringify(merged, null, 2)

    try {
      await fs.writeFile(tempPath, content, { encoding: "utf-8", mode: 0o600 })
      await fs.rename(tempPath, path)
    } catch (error) {
      try {
        await fs.unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }
      throw error
    }
  })
}

export async function saveAccountsReplaceToPath(
  path: string,
  storage: AccountStorageV4,
  options: AccountStorageIoOptions = {},
): Promise<void> {
  const configDir = dirname(path)
  await fs.mkdir(configDir, { recursive: true })
  await ensureGitignore(configDir, options.logger)

  await withFileLock(path, options, async () => {
    const tempPath = `${path}.${randomBytes(6).toString("hex")}.tmp`
    const content = JSON.stringify(storage, null, 2)

    try {
      await fs.writeFile(tempPath, content, { encoding: "utf-8", mode: 0o600 })
      await fs.rename(tempPath, path)
    } catch (error) {
      try {
        await fs.unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }
      throw error
    }
  })
}

export async function clearAccountsAtPath(
  path: string,
  options: AccountStorageIoOptions = {},
): Promise<void> {
  try {
    await fs.unlink(path)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== "ENOENT") {
      options.logger?.error?.("Failed to clear account storage", {
        error: String(error),
      })
    }
  }
}
