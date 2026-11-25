export const CORE_PACKAGE_NAME = "@benjamolina/antigravity-guard-core"
export {
  DEFAULT_SOFT_QUOTA_NEAR_THRESHOLD_MARGIN,
  DEFAULT_SOFT_QUOTA_REFRESH_TTL_MS,
  accessTokenExpired,
  calculateBackoffMs,
  classifyModelQuotaFamily,
  clearExpiredRateLimits,
  computeSoftQuotaCacheTtlMs,
  extractVerificationErrorDetails,
  formatAccountLabel,
  formatRefreshParts,
  getQuotaKey,
  isOverSoftQuotaThreshold,
  isRateLimitedForFamily,
  isRateLimitedForHeaderStyle,
  isRateLimitedForQuotaKey,
  needsActiveQuotaRefresh,
  parseRateLimitReason,
  parseRefreshParts,
  resolveQuotaGroup,
} from "./account-helpers.ts"
export type {
  BaseQuotaKey,
  ManagedAccount,
  OAuthAuthDetails,
  QuotaGroup,
  QuotaGroupSummary,
  QuotaKey,
  RateLimitBackoffResult,
  RateLimitReason,
  RefreshParts,
  VerificationErrorDetails,
} from "./account-helpers.ts"
export {
  DEFAULT_SHARED_GUARD_CONFIG,
  loadSharedGuardConfig,
  resolveSharedGuardPaths,
} from "./config.ts"
export type {
  AccountSelectionStrategy,
  ResolveSharedGuardPathsOptions,
  SchedulingMode,
  SharedGuardConfig,
  SharedGuardPathSource,
  SharedGuardPaths,
  SharedSignatureCacheConfig,
} from "./config.ts"
export {
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_HUB_MANIFEST_URL,
  ANTIGRAVITY_HUB_PLATFORM,
  ANTIGRAVITY_MIN_VERSION,
  ANTIGRAVITY_OAUTH_CLIENT,
  ANTIGRAVITY_VERSION_FALLBACK,
  GEMINI_CLI_HEADERS,
  compareAntigravityVersions,
  isSupportedAntigravityVersion,
  parseAntigravityHubManifestVersion,
} from "./constants.ts"
export type { AntigravityEndpoints } from "./constants.ts"
export { calculateTokenExpiry } from "./expiry.ts"
export {
  MAX_FINGERPRINT_HISTORY,
  buildFingerprintHeaders,
  collectCurrentFingerprint,
  createSessionFingerprintStore,
  generateFingerprint,
  updateFingerprintVersion,
} from "./fingerprint.ts"
export type {
  ClientMetadata,
  Fingerprint,
  FingerprintHeaders,
  FingerprintVersion,
  GenerateFingerprintOptions,
  SessionFingerprintStore,
  SessionFingerprintStoreOptions,
} from "./fingerprint.ts"
export {
  buildAntigravityHeaders,
  buildAntigravityHubHeaders,
  formatAntigravityHubUserAgent,
} from "./headers.ts"
export type {
  AntigravityHeaderOptions,
  AntigravityHeaders,
  AntigravityHubHeaderOptions,
  AntigravityHubHeaders,
} from "./headers.ts"
export {
  buildAuthorizationUrl,
  buildCodeExchangeForm,
  buildRefreshForm,
} from "./oauth.ts"
export type { AuthorizationCodeExchange, OAuthClientConfig } from "./oauth.ts"
export {
  DEFAULT_PROACTIVE_REFRESH_CONFIG,
  ProactiveRefreshQueue,
} from "./refresh-queue.ts"
export type {
  ProactiveRefreshConfig,
  ProactiveRefreshQueueOptions,
  RefreshableAccountStore,
} from "./refresh-queue.ts"
export {
  DEFAULT_HEALTH_SCORE_CONFIG,
  DEFAULT_TOKEN_BUCKET_CONFIG,
  HealthScoreTracker,
  TokenBucketTracker,
  addJitter,
  getHealthTracker,
  getTokenTracker,
  initHealthTracker,
  initTokenTracker,
  randomDelay,
  selectHybridAccount,
  sortByLruWithHealth,
} from "./rotation.ts"
export type {
  AccountWithMetrics,
  HealthScoreConfig,
  TokenBucketConfig,
} from "./rotation.ts"
export {
  GITIGNORE_ENTRIES,
  acquireDefaultDirLock,
  clearAccountsAtPath,
  deduplicateAccountsByEmail,
  ensureGitignore,
  ensureGitignoreSync,
  loadAccountsFromPath,
  mergeAccountStorage,
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  saveAccountsReplaceToPath,
  saveAccountsToPath,
} from "./storage.ts"
export type {
  AccountMetadata,
  AccountMetadataV1,
  AccountMetadataV3,
  AccountStorage,
  AccountStorageIoOptions,
  AccountStorageV1,
  AccountStorageV3,
  AccountStorageV4,
  CooldownReason,
  FileLockFn,
  HeaderStyle,
  ModelFamily,
  RateLimitState,
  RateLimitStateV3,
  StorageLogger,
} from "./storage.ts"
export {
  createAntigravityVersionState,
  fetchAntigravityHubVersion,
} from "./version.ts"
export type {
  AntigravityVersionState,
  FetchAntigravityHubVersionOptions,
} from "./version.ts"
