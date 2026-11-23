export const CORE_PACKAGE_NAME = "@benjamolina/antigravity-guard-core"
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
  createAntigravityVersionState,
  fetchAntigravityHubVersion,
} from "./version.ts"
export type {
  AntigravityVersionState,
  FetchAntigravityHubVersionOptions,
} from "./version.ts"
