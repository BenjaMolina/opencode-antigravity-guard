import {
  ANTIGRAVITY_HUB_PLATFORM,
  ANTIGRAVITY_VERSION_FALLBACK,
} from "./constants.ts"

export interface AntigravityHeaderOptions {
  version: string
  platform: string
}

export type AntigravityHeaders = Readonly<{
  "User-Agent": string
  "X-Goog-Api-Client": string
  "Client-Metadata": string
}>

export interface AntigravityHubHeaderOptions {
  version?: string
  platform?: string
}

export type AntigravityHubHeaders = Readonly<{
  "User-Agent": string
}>

export function buildAntigravityHeaders(options: AntigravityHeaderOptions): AntigravityHeaders {
  const platform = options.platform === "win32" ? "WINDOWS" : "MACOS"
  return Object.freeze({
    "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/${options.version} Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36`,
    "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
    "Client-Metadata": `{"ideType":"ANTIGRAVITY","platform":"${platform}","pluginType":"GEMINI"}`,
  })
}

export function formatAntigravityHubUserAgent(
  options: AntigravityHubHeaderOptions = {},
): string {
  const version = options.version ?? ANTIGRAVITY_VERSION_FALLBACK
  const platform = options.platform ?? ANTIGRAVITY_HUB_PLATFORM
  return `antigravity/hub/${version} ${platform}`
}

export function buildAntigravityHubHeaders(
  options: AntigravityHubHeaderOptions = {},
): AntigravityHubHeaders {
  return Object.freeze({
    "User-Agent": formatAntigravityHubUserAgent(options),
  })
}
