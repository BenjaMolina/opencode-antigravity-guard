import type { OAuthClientConfig } from "./oauth.ts"

export const ANTIGRAVITY_ENDPOINTS = Object.freeze({
  authorize: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  userInfo: "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
  daily: "https://daily-cloudcode-pa.sandbox.googleapis.com",
  autopush: "https://autopush-cloudcode-pa.sandbox.googleapis.com",
  production: "https://cloudcode-pa.googleapis.com",
})

export type AntigravityEndpoints = typeof ANTIGRAVITY_ENDPOINTS

export const ANTIGRAVITY_OAUTH_CLIENT: OAuthClientConfig = Object.freeze({
  clientId: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
  clientSecret: "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",
  scopes: Object.freeze([
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
  ]),
  redirectUri: "http://localhost:51121/oauth-callback",
  authorizeEndpoint: ANTIGRAVITY_ENDPOINTS.authorize,
  tokenEndpoint: ANTIGRAVITY_ENDPOINTS.token,
})

export const ANTIGRAVITY_MIN_VERSION = "2.9.1"

export const ANTIGRAVITY_VERSION_FALLBACK = "2.34.0"

export const ANTIGRAVITY_HUB_MANIFEST_URL =
  "https://antigravity-hub-auto-updater-974169037036.us-central1.run.app/manifest/latest-arm64-mac.yml"

export const ANTIGRAVITY_HUB_PLATFORM = "darwin/arm64"

const SEMVER_TRIPLE_REGEX = /^(\d+)\.(\d+)\.(\d+)$/
const HUB_MANIFEST_VERSION_REGEX = /^\s*version\s*:\s*['"]?(\d+\.\d+\.\d+)['"]?\s*$/m

export function compareAntigravityVersions(left: string, right: string): number {
  const leftMatch = SEMVER_TRIPLE_REGEX.exec(left.trim())
  const rightMatch = SEMVER_TRIPLE_REGEX.exec(right.trim())
  if (!leftMatch || !rightMatch) {
    return Number.NaN
  }

  for (let index = 1; index <= 3; index += 1) {
    const leftPart = Number(leftMatch[index] ?? "0")
    const rightPart = Number(rightMatch[index] ?? "0")
    if (leftPart > rightPart) return 1
    if (leftPart < rightPart) return -1
  }
  return 0
}

export function isSupportedAntigravityVersion(
  version: string,
  minVersion = ANTIGRAVITY_MIN_VERSION,
): boolean {
  const comparison = compareAntigravityVersions(version, minVersion)
  return !Number.isNaN(comparison) && comparison >= 0
}

export function parseAntigravityHubManifestVersion(
  manifestYaml: string,
  minVersion = ANTIGRAVITY_MIN_VERSION,
): string | null {
  const match = HUB_MANIFEST_VERSION_REGEX.exec(manifestYaml)
  const candidate = match?.[1]
  if (!candidate || !isSupportedAntigravityVersion(candidate, minVersion)) {
    return null
  }
  return candidate
}

export const GEMINI_CLI_HEADERS = Object.freeze({
  "User-Agent": "google-api-nodejs-client/9.15.1",
  "X-Goog-Api-Client": "gl-node/22.17.0",
  "Client-Metadata": "ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI",
})
