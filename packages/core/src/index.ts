export const CORE_PACKAGE_NAME = "@benjamolina/antigravity-guard-core"
export {
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_OAUTH_CLIENT,
  ANTIGRAVITY_VERSION_FALLBACK,
  GEMINI_CLI_HEADERS,
} from "./constants.ts"
export type { AntigravityEndpoints } from "./constants.ts"
export { calculateTokenExpiry } from "./expiry.ts"
export { buildAntigravityHeaders } from "./headers.ts"
export type { AntigravityHeaderOptions, AntigravityHeaders } from "./headers.ts"
export {
  buildAuthorizationUrl,
  buildCodeExchangeForm,
  buildRefreshForm,
} from "./oauth.ts"
export type { AuthorizationCodeExchange, OAuthClientConfig } from "./oauth.ts"
