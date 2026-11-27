export const CORE_PACKAGE_NAME = "@benjamolina/antigravity-guard-core"
export { AccountManager } from "./accounts.ts"
export type { AccountManagerDependencies } from "./accounts.ts"
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
  SharedModelDiscoveryConfig,
  SharedSignatureCacheConfig,
} from "./config.ts"
export {
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_ENDPOINT_FALLBACKS,
  ANTIGRAVITY_HUB_MANIFEST_URL,
  ANTIGRAVITY_HUB_PLATFORM,
  ANTIGRAVITY_LOAD_ENDPOINTS,
  ANTIGRAVITY_MIN_VERSION,
  ANTIGRAVITY_OAUTH_CLIENT,
  ANTIGRAVITY_VERSION_FALLBACK,
  EMPTY_SCHEMA_PLACEHOLDER_DESCRIPTION,
  EMPTY_SCHEMA_PLACEHOLDER_NAME,
  GEMINI_CLI_HEADERS,
  MIN_THOUGHT_SIGNATURE_LENGTH,
  SEARCH_MODEL,
  SEARCH_SYSTEM_INSTRUCTION,
  SEARCH_THINKING_BUDGET_DEEP,
  SEARCH_THINKING_BUDGET_FAST,
  SEARCH_TIMEOUT_MS,
  SKIP_THOUGHT_SIGNATURE,
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
  CAPACITY_BACKOFF_BASE_DELAY_MS,
  CAPACITY_BACKOFF_MAX_DELAY_MS,
  FAILURE_COOLDOWN_MS,
  FAILURE_STATE_RESET_MS,
  FIRST_RETRY_DELAY_MS,
  MAX_CAPACITY_RETRIES_PER_ENDPOINT,
  MAX_CONSECUTIVE_FAILURES,
  RATE_LIMIT_DEDUP_WINDOW_MS,
  RATE_LIMIT_STATE_RESET_MS,
  SWITCH_ACCOUNT_DELAY_MS,
  abortableSleep,
  calculateCapacityBackoffMs,
  createAccountFailureTracker,
  createRateLimitBackoffTracker,
  extractRateLimitBodyInfo,
  extractRateLimitTextInfo,
  extractRetryInfoFromBody,
  formatWaitTime,
  headerStyleToQuotaKey,
  parseDurationToMs,
  retryAfterMsFromHeaders,
  retryAfterMsFromResponse,
} from "./retry.ts"
export type {
  AccountFailureResult,
  AccountFailureTracker,
  AccountFailureTrackerOptions,
  DedupedRateLimitBackoff,
  RateLimitBackoffTracker,
  RateLimitBackoffTrackerOptions,
  RateLimitBodyInfo,
} from "./retry.ts"
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
  updateExistingAccountCooldown,
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
  DEFAULT_POOL_QUOTA_REFRESH_COOLDOWN_MS,
  DEFAULT_QUOTA_FETCH_TIMEOUT_MS,
  aggregateGeminiCliQuota,
  aggregateQuota,
  checkAccountsQuotaWithDeps,
  classifyQuotaGroup,
  createPoolQuotaRefreshCoordinator,
  fetchAvailableModels,
  fetchGeminiCliQuota,
  normalizeRemainingFraction,
  parseQuotaResetTime,
} from "./quota.ts"
export type {
  AccountQuotaResult,
  AccountQuotaStatus,
  CheckAccountsQuotaDependencies,
  FetchAvailableModelEntry,
  FetchAvailableModelsOptions,
  FetchAvailableModelsResponse,
  FetchGeminiCliQuotaOptions,
  GeminiCliQuotaBucket,
  GeminiCliQuotaModel,
  GeminiCliQuotaSummary,
  PoolQuotaRefreshCoordinator,
  PoolQuotaRefreshCoordinatorOptions,
  QuotaSummary,
  RetrieveUserQuotaResponse,
} from "./quota.ts"
export {
  createAntigravityVersionState,
  fetchAntigravityHubVersion,
} from "./version.ts"
export type {
  AntigravityVersionState,
  FetchAntigravityHubVersionOptions,
} from "./version.ts"
export {
  cleanJSONSchemaForAntigravity,
  toGeminiSchema,
} from "./schema.ts"
export {
  SignatureCache,
  buildSignatureSessionKey,
  createSessionSignatureCache,
  createSignatureCache,
  isGemini3Or4SignatureModel,
  signatureCacheProjectKey,
  stripThinkingTierSuffixForCacheKey,
} from "./signature-cache.ts"
export type {
  SessionSignatureCache,
  SessionSignatureCacheOptions,
  SignatureCacheOptions,
  SignatureCacheStats,
  ThinkingCacheData,
} from "./signature-cache.ts"
export {
  executeAntigravitySearch,
  executeAntigravitySearchDetailed,
  formatAntigravitySearchResult,
  formatGroundingFooter,
  parseAntigravitySearchResponse,
  parseCandidateGrounding,
} from "./search.ts"
export type {
  AntigravitySearchResponse,
  CandidateGroundingSummary,
  ExecuteAntigravitySearchOptions,
  ExecuteAntigravitySearchOutcome,
  GroundingChunk,
  GroundingMetadata,
  GroundingSupport,
  SearchArgs,
  SearchCandidate,
  SearchResponse,
  SearchResult,
  UrlContextMetadata,
  UrlMetadata,
} from "./search.ts"
