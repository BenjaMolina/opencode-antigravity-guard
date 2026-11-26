import {
  ANTIGRAVITY_HUB_MANIFEST_URL,
  ANTIGRAVITY_MIN_VERSION,
  ANTIGRAVITY_VERSION_FALLBACK,
  isSupportedAntigravityVersion,
  parseAntigravityHubManifestVersion,
} from "./constants.ts"

const DEFAULT_FETCH_TIMEOUT_MS = 5_000

export interface AntigravityVersionState {
  getVersion(): string
  setVersion(version: string): boolean
}

export function createAntigravityVersionState(
  initialVersion = ANTIGRAVITY_VERSION_FALLBACK,
): AntigravityVersionState {
  const trimmedInitial = initialVersion.trim()
  let current = isSupportedAntigravityVersion(trimmedInitial)
    ? trimmedInitial
    : ANTIGRAVITY_VERSION_FALLBACK

  return {
    getVersion(): string {
      return current
    },
    setVersion(version: string): boolean {
      const trimmed = version.trim()
      if (!isSupportedAntigravityVersion(trimmed)) {
        return false
      }
      current = trimmed
      return true
    },
  }
}

export interface FetchAntigravityHubVersionOptions {
  fetch?: typeof globalThis.fetch
  manifestUrl?: string
  timeoutMs?: number
  minVersion?: string
}

export async function fetchAntigravityHubVersion(
  options: FetchAntigravityHubVersionOptions = {},
): Promise<string | null> {
  const fetchFn = options.fetch ?? globalThis.fetch
  if (typeof fetchFn !== "function") {
    return null
  }

  const manifestUrl = options.manifestUrl ?? ANTIGRAVITY_HUB_MANIFEST_URL
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const minVersion = options.minVersion ?? ANTIGRAVITY_MIN_VERSION
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchFn(manifestUrl, {
      method: "GET",
      headers: {
        "User-Agent": "electron-builder",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      return null
    }
    const manifestYaml = await response.text()
    return parseAntigravityHubManifestVersion(manifestYaml, minVersion)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
