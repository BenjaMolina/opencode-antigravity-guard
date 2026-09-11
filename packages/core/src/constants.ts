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

export const ANTIGRAVITY_VERSION_FALLBACK = "1.19.4"

export const GEMINI_CLI_HEADERS = Object.freeze({
  "User-Agent": "google-api-nodejs-client/9.15.1",
  "X-Goog-Api-Client": "gl-node/22.17.0",
  "Client-Metadata": "ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI",
})
