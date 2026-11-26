import * as crypto from "node:crypto"
import * as os from "node:os"

import {
  ANTIGRAVITY_HUB_PLATFORM,
  ANTIGRAVITY_VERSION_FALLBACK,
  isSupportedAntigravityVersion,
} from "./constants.ts"
import { formatAntigravityHubUserAgent } from "./headers.ts"

const OS_VERSIONS: Record<string, readonly string[]> = {
  darwin: ["10.15.7", "11.6.8", "12.6.3", "13.5.2", "14.2.1", "14.5"],
  win32: ["10.0.19041", "10.0.19042", "10.0.19043", "10.0.22000", "10.0.22621", "10.0.22631"],
  linux: ["5.15.0", "5.19.0", "6.1.0", "6.2.0", "6.5.0", "6.6.0"],
}

const ARCHITECTURES = ["x64", "arm64"] as const
const IDE_TYPES = ["ANTIGRAVITY"] as const
const PLATFORM_CHOICES = ["darwin", "win32"] as const

const SDK_CLIENTS = [
  "google-cloud-sdk vscode_cloudshelleditor/0.1",
  "google-cloud-sdk vscode/1.86.0",
  "google-cloud-sdk vscode/1.87.0",
  "google-cloud-sdk vscode/1.96.0",
] as const

export interface ClientMetadata {
  ideType: string
  platform: string
  pluginType: string
}

export interface Fingerprint {
  deviceId: string
  sessionToken: string
  userAgent: string
  apiClient: string
  clientMetadata: ClientMetadata
  createdAt: number
  /** @deprecated Kept for backward compatibility with stored fingerprints */
  quotaUser?: string
}

export interface FingerprintVersion {
  fingerprint: Fingerprint
  timestamp: number
  reason: "initial" | "regenerated" | "restored"
}

export const MAX_FINGERPRINT_HISTORY = 5

export interface FingerprintHeaders {
  "User-Agent": string
}

export interface GenerateFingerprintOptions {
  version?: string
}

function randomFrom<T>(arr: readonly [T, ...T[]]): T {
  const index = Math.floor(Math.random() * arr.length)
  return arr[index] ?? arr[0]
}

function platformToDisplayName(platform: string): "WINDOWS" | "MACOS" {
  return platform === "win32" ? "WINDOWS" : "MACOS"
}

function generateDeviceId(): string {
  return crypto.randomUUID()
}

function generateSessionToken(): string {
  return crypto.randomBytes(16).toString("hex")
}

function resolveSupportedVersion(version?: string): string {
  if (typeof version !== "string") {
    return ANTIGRAVITY_VERSION_FALLBACK
  }
  const trimmed = version.trim()
  return isSupportedAntigravityVersion(trimmed) ? trimmed : ANTIGRAVITY_VERSION_FALLBACK
}

export function generateFingerprint(options: GenerateFingerprintOptions = {}): Fingerprint {
  const platform = randomFrom(PLATFORM_CHOICES)
  const arch = randomFrom(ARCHITECTURES)
  const version = resolveSupportedVersion(options.version)
  void OS_VERSIONS[platform]

  return {
    deviceId: generateDeviceId(),
    sessionToken: generateSessionToken(),
    userAgent: formatAntigravityHubUserAgent({
      version,
      platform: `${platform}/${arch}`,
    }),
    apiClient: randomFrom(SDK_CLIENTS),
    clientMetadata: {
      ideType: randomFrom(IDE_TYPES),
      platform: platformToDisplayName(platform),
      pluginType: "GEMINI",
    },
    createdAt: Date.now(),
  }
}

export function collectCurrentFingerprint(options: GenerateFingerprintOptions = {}): Fingerprint {
  const platform = os.platform()
  const arch = os.arch()
  const version = resolveSupportedVersion(options.version)

  return {
    deviceId: generateDeviceId(),
    sessionToken: generateSessionToken(),
    userAgent: formatAntigravityHubUserAgent({
      version,
      platform: `${platform}/${arch}`,
    }),
    apiClient: "google-cloud-sdk vscode_cloudshelleditor/0.1",
    clientMetadata: {
      ideType: "ANTIGRAVITY",
      platform: platformToDisplayName(platform),
      pluginType: "GEMINI",
    },
    createdAt: Date.now(),
  }
}

const DIRECT_ANTIGRAVITY_UA_REGEX =
  /^antigravity\/(?:hub\/|cli\/)?[\d.]+(?:\s+([a-z0-9_-]+\/[a-z0-9_-]+)(?:\s+.*)?|\s+.*)?$/i
const BROWSER_ANTIGRAVITY_UA_REGEX = /\bAntigravity\/[\d.]+/i

export function updateFingerprintVersion(
  fingerprint: Fingerprint,
  version = ANTIGRAVITY_VERSION_FALLBACK,
): boolean {
  const trimmedVersion = version.trim()
  if (!isSupportedAntigravityVersion(trimmedVersion)) {
    return false
  }

  const directMatch = DIRECT_ANTIGRAVITY_UA_REGEX.exec(fingerprint.userAgent.trim())
  let nextUserAgent: string | null = null

  if (directMatch) {
    const platform = directMatch[1] ?? ANTIGRAVITY_HUB_PLATFORM
    nextUserAgent = formatAntigravityHubUserAgent({
      version: trimmedVersion,
      platform,
    })
  } else if (BROWSER_ANTIGRAVITY_UA_REGEX.test(fingerprint.userAgent)) {
    nextUserAgent = formatAntigravityHubUserAgent({
      version: trimmedVersion,
      platform: ANTIGRAVITY_HUB_PLATFORM,
    })
  }

  if (!nextUserAgent || nextUserAgent === fingerprint.userAgent) {
    return false
  }

  fingerprint.userAgent = nextUserAgent
  return true
}

export function buildFingerprintHeaders(
  fingerprint: Fingerprint | null,
): Partial<FingerprintHeaders> {
  if (!fingerprint) {
    return {}
  }

  return {
    "User-Agent": fingerprint.userAgent,
  }
}

export interface SessionFingerprintStore {
  get(): Fingerprint
  regenerate(): Fingerprint
  syncVersion(version?: string): boolean
}

export interface SessionFingerprintStoreOptions {
  getVersion?: () => string
}

export function createSessionFingerprintStore(
  options: SessionFingerprintStoreOptions = {},
): SessionFingerprintStore {
  const resolveVersion = options.getVersion ?? (() => ANTIGRAVITY_VERSION_FALLBACK)
  let current: Fingerprint | null = null

  return {
    get(): Fingerprint {
      if (!current) {
        current = generateFingerprint({ version: resolveVersion() })
      }
      return current
    },
    regenerate(): Fingerprint {
      current = generateFingerprint({ version: resolveVersion() })
      return current
    },
    syncVersion(version = resolveVersion()): boolean {
      const trimmed = version.trim()
      if (!isSupportedAntigravityVersion(trimmed)) {
        return false
      }
      if (!current) {
        current = generateFingerprint({ version: trimmed })
        return true
      }
      return updateFingerprintVersion(current, trimmed)
    },
  }
}
