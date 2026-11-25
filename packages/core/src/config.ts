import { existsSync, readFileSync, statSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export type AccountSelectionStrategy = "sticky" | "round-robin" | "hybrid"
export type SchedulingMode = "cache_first" | "balance" | "performance_first"

export interface SharedSignatureCacheConfig {
  enabled: boolean
  memory_ttl_seconds: number
  disk_ttl_seconds: number
  write_interval_seconds: number
}

export interface SharedGuardConfig {
  account_selection_strategy: AccountSelectionStrategy
  pid_offset_enabled: boolean
  switch_on_first_rate_limit: boolean
  scheduling_mode: SchedulingMode
  max_cache_first_wait_seconds: number
  failure_ttl_seconds: number
  default_retry_after_seconds: number
  max_backoff_seconds: number
  request_jitter_max_ms: number
  soft_quota_threshold_percent: number
  soft_quota_allow_sdk_fallback: boolean
  quota_refresh_interval_minutes: number
  soft_quota_cache_ttl_minutes: "auto" | number
  keep_thinking: boolean
  proactive_token_refresh: boolean
  signature_cache: SharedSignatureCacheConfig
}

export const DEFAULT_SHARED_GUARD_CONFIG: SharedGuardConfig = Object.freeze({
  account_selection_strategy: "hybrid",
  pid_offset_enabled: false,
  switch_on_first_rate_limit: true,
  scheduling_mode: "cache_first",
  max_cache_first_wait_seconds: 60,
  failure_ttl_seconds: 3_600,
  default_retry_after_seconds: 60,
  max_backoff_seconds: 60,
  request_jitter_max_ms: 0,
  soft_quota_threshold_percent: 70,
  soft_quota_allow_sdk_fallback: false,
  quota_refresh_interval_minutes: 15,
  soft_quota_cache_ttl_minutes: "auto",
  keep_thinking: false,
  proactive_token_refresh: true,
  signature_cache: Object.freeze({
    enabled: true,
    memory_ttl_seconds: 3_600,
    disk_ttl_seconds: 172_800,
    write_interval_seconds: 60,
  }),
})

export type SharedGuardPathSource = "opencode" | "pi"

export interface SharedGuardPaths {
  source: SharedGuardPathSource
  configDir: string
  userConfigPath: string
  accountsPath: string
  logsDir: string
  projectConfigPaths: readonly string[]
}

export interface ResolveSharedGuardPathsOptions {
  cwd?: string
  homeDir?: string
  env?: Record<string, string | undefined>
}

export function resolveSharedGuardPaths(
  options: ResolveSharedGuardPathsOptions = {},
): SharedGuardPaths {
  const env = options.env ?? process.env
  const home = options.homeDir ?? homedir()
  const cwd = options.cwd ?? process.cwd()

  const explicitOpencodeDir = env.OPENCODE_CONFIG_DIR?.trim()
  if (explicitOpencodeDir) {
    return buildGuardPaths("opencode", explicitOpencodeDir, cwd)
  }

  const xdgConfig = env.XDG_CONFIG_HOME?.trim()
  if (xdgConfig) {
    const xdgOpencodeDir = join(xdgConfig, "opencode")
    if (isExistingDirectory(xdgOpencodeDir)) {
      return buildGuardPaths("opencode", xdgOpencodeDir, cwd)
    }
  }

  const homeOpencodeDir = join(home, ".config", "opencode")
  if (isExistingDirectory(homeOpencodeDir)) {
    return buildGuardPaths("opencode", homeOpencodeDir, cwd)
  }

  const piAgentDir = resolvePiAgentDir(env, home)
  return buildGuardPaths("pi", piAgentDir, cwd)
}

function resolvePiAgentDir(
  env: Record<string, string | undefined>,
  home: string,
): string {
  return env.PI_CODING_AGENT_DIR?.trim() || join(home, ".pi", "agent")
}

function isExistingDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function buildGuardPaths(
  source: SharedGuardPathSource,
  configDir: string,
  cwd: string,
): SharedGuardPaths {
  return {
    source,
    configDir,
    userConfigPath: join(configDir, "antigravity.json"),
    accountsPath: join(configDir, "antigravity-accounts.json"),
    logsDir: join(configDir, "antigravity-logs"),
    projectConfigPaths: [
      join(cwd, ".opencode", "antigravity.json"),
      join(cwd, ".pi", "antigravity.json"),
    ],
  }
}

export function loadSharedGuardConfig(
  options: ResolveSharedGuardPathsOptions = {},
): SharedGuardConfig {
  const env = options.env ?? process.env
  const home = options.homeDir ?? homedir()
  const paths = resolveSharedGuardPaths(options)
  let config = cloneDefaultSharedGuardConfig()

  const hasExplicitOpencodeDir = Boolean(env.OPENCODE_CONFIG_DIR?.trim())
  const userConfigPath =
    paths.source === "opencode" && !hasExplicitOpencodeDir && !existsSync(paths.userConfigPath)
      ? join(resolvePiAgentDir(env, home), "antigravity.json")
      : paths.userConfigPath

  for (const filePath of [userConfigPath, ...paths.projectConfigPaths]) {
    const partial = readPartialSharedGuardConfig(filePath)
    if (partial) {
      config = mergeSharedGuardConfig(config, partial)
    }
  }

  return config
}

function cloneDefaultSharedGuardConfig(): SharedGuardConfig {
  return {
    ...DEFAULT_SHARED_GUARD_CONFIG,
    signature_cache: { ...DEFAULT_SHARED_GUARD_CONFIG.signature_cache },
  }
}

interface PartialSharedGuardConfig extends Omit<Partial<SharedGuardConfig>, "signature_cache"> {
  signature_cache?: Partial<SharedSignatureCacheConfig>
}

function mergeSharedGuardConfig(
  base: SharedGuardConfig,
  override: PartialSharedGuardConfig,
): SharedGuardConfig {
  return {
    ...base,
    ...override,
    signature_cache: override.signature_cache
      ? {
          ...base.signature_cache,
          ...override.signature_cache,
        }
      : base.signature_cache,
  }
}

function readPartialSharedGuardConfig(path: string): PartialSharedGuardConfig | null {
  try {
    if (!existsSync(path)) {
      return null
    }
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown
    if (!isRecord(raw)) {
      return null
    }
    return sanitizePartialSharedGuardConfig(raw)
  } catch {
    return null
  }
}

const STRATEGIES = new Set<AccountSelectionStrategy>(["sticky", "round-robin", "hybrid"])
const SCHEDULING_MODES = new Set<SchedulingMode>(["cache_first", "balance", "performance_first"])

function sanitizePartialSharedGuardConfig(raw: Record<string, unknown>): PartialSharedGuardConfig {
  const out: PartialSharedGuardConfig = {}

  if (typeof raw.account_selection_strategy === "string" && STRATEGIES.has(raw.account_selection_strategy as AccountSelectionStrategy)) {
    out.account_selection_strategy = raw.account_selection_strategy as AccountSelectionStrategy
  }
  if (typeof raw.pid_offset_enabled === "boolean") out.pid_offset_enabled = raw.pid_offset_enabled
  if (typeof raw.switch_on_first_rate_limit === "boolean") out.switch_on_first_rate_limit = raw.switch_on_first_rate_limit
  if (typeof raw.scheduling_mode === "string" && SCHEDULING_MODES.has(raw.scheduling_mode as SchedulingMode)) {
    out.scheduling_mode = raw.scheduling_mode as SchedulingMode
  }

  const maxCacheWait = boundedNumber(raw.max_cache_first_wait_seconds, 5, 300)
  if (maxCacheWait !== undefined) out.max_cache_first_wait_seconds = maxCacheWait

  const failureTtl = boundedNumber(raw.failure_ttl_seconds, 60, 7_200)
  if (failureTtl !== undefined) out.failure_ttl_seconds = failureTtl

  const defaultRetry = boundedNumber(raw.default_retry_after_seconds, 1, 300)
  if (defaultRetry !== undefined) out.default_retry_after_seconds = defaultRetry

  const maxBackoff = boundedNumber(raw.max_backoff_seconds, 5, 300)
  if (maxBackoff !== undefined) out.max_backoff_seconds = maxBackoff

  const jitter = boundedNumber(raw.request_jitter_max_ms, 0, 5_000)
  if (jitter !== undefined) out.request_jitter_max_ms = jitter

  const softThreshold = boundedNumber(raw.soft_quota_threshold_percent, 1, 100)
  if (softThreshold !== undefined) out.soft_quota_threshold_percent = softThreshold

  if (typeof raw.soft_quota_allow_sdk_fallback === "boolean") {
    out.soft_quota_allow_sdk_fallback = raw.soft_quota_allow_sdk_fallback
  }

  const refreshMinutes = boundedNumber(raw.quota_refresh_interval_minutes, 0, 60)
  if (refreshMinutes !== undefined) out.quota_refresh_interval_minutes = refreshMinutes

  if (raw.soft_quota_cache_ttl_minutes === "auto") {
    out.soft_quota_cache_ttl_minutes = "auto"
  } else {
    const cacheTtl = boundedNumber(raw.soft_quota_cache_ttl_minutes, 1, 120)
    if (cacheTtl !== undefined) out.soft_quota_cache_ttl_minutes = cacheTtl
  }

  if (typeof raw.keep_thinking === "boolean") out.keep_thinking = raw.keep_thinking
  if (typeof raw.proactive_token_refresh === "boolean") out.proactive_token_refresh = raw.proactive_token_refresh

  if (isRecord(raw.signature_cache)) {
    const sig: Partial<SharedSignatureCacheConfig> = {}
    if (typeof raw.signature_cache.enabled === "boolean") sig.enabled = raw.signature_cache.enabled
    const memTtl = boundedNumber(raw.signature_cache.memory_ttl_seconds, 60, 86_400)
    if (memTtl !== undefined) sig.memory_ttl_seconds = memTtl
    const diskTtl = boundedNumber(raw.signature_cache.disk_ttl_seconds, 3_600, 604_800)
    if (diskTtl !== undefined) sig.disk_ttl_seconds = diskTtl
    const writeInt = boundedNumber(raw.signature_cache.write_interval_seconds, 10, 600)
    if (writeInt !== undefined) sig.write_interval_seconds = writeInt
    if (Object.keys(sig).length > 0) out.signature_cache = sig
  }

  return out
}

function boundedNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    return undefined
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
