/**
 * Device Fingerprint Generator for Rate Limit Mitigation
 *
 * Ported from antigravity-claude-proxy PR #170
 * https://github.com/badrisnarayanan/antigravity-claude-proxy/pull/170
 *
 * Generates randomized device fingerprints to help distribute API usage
 * across different apparent device identities.
 */

import * as crypto from "node:crypto";
import * as os from "node:os";
import {
  ANTIGRAVITY_HUB_PLATFORM,
  formatAntigravityHubUserAgent,
  isSupportedAntigravityVersion,
} from "@benjamolina/antigravity-guard-core";
import { getAntigravityVersion } from "../constants";

const OS_VERSIONS: Record<string, string[]> = {
  darwin: ["10.15.7", "11.6.8", "12.6.3", "13.5.2", "14.2.1", "14.5"],
  win32: ["10.0.19041", "10.0.19042", "10.0.19043", "10.0.22000", "10.0.22621", "10.0.22631"],
  linux: ["5.15.0", "5.19.0", "6.1.0", "6.2.0", "6.5.0", "6.6.0"],
};

const ARCHITECTURES = ["x64", "arm64"];

const IDE_TYPES = [
  "ANTIGRAVITY",
] as const;

const PLATFORMS = [
  "WINDOWS",
  "MACOS",
] as const;

const SDK_CLIENTS = [
  "google-cloud-sdk vscode_cloudshelleditor/0.1",
  "google-cloud-sdk vscode/1.86.0",
  "google-cloud-sdk vscode/1.87.0",
  "google-cloud-sdk vscode/1.96.0",
];

export interface ClientMetadata {
  ideType: string;
  platform: string;
  pluginType: string;
}

export interface Fingerprint {
  deviceId: string;
  sessionToken: string;
  userAgent: string;
  apiClient: string;
  clientMetadata: ClientMetadata;
  createdAt: number;
  /** @deprecated Kept for backward compat with stored fingerprints */
  quotaUser?: string;
}

/**
 * Fingerprint version for history tracking.
 * Stores a snapshot of a fingerprint with metadata about when/why it was saved.
 */
export interface FingerprintVersion {
  fingerprint: Fingerprint;
  timestamp: number;
  reason: 'initial' | 'regenerated' | 'restored';
}

/** Maximum number of fingerprint versions to keep per account */
export const MAX_FINGERPRINT_HISTORY = 5;

export interface FingerprintHeaders {
  "User-Agent": string;
}

const PLATFORM_CHOICES = ["darwin", "win32"] as const;
type PlatformChoice = typeof PLATFORM_CHOICES[number];

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function platformToDisplayName(platform: string): "WINDOWS" | "MACOS" {
  return platform === "win32" ? "WINDOWS" : "MACOS";
}

function generateDeviceId(): string {
  return crypto.randomUUID();
}

function generateSessionToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Generate a randomized device fingerprint.
 * Each fingerprint represents a unique "device" identity.
 */
export function generateFingerprint(): Fingerprint {
  const platform = randomFrom(PLATFORM_CHOICES);
  const arch = randomFrom(ARCHITECTURES);
  const _osVersion = randomFrom(OS_VERSIONS[platform] ?? OS_VERSIONS.darwin!);

  return {
    deviceId: generateDeviceId(),
    sessionToken: generateSessionToken(),
    userAgent: formatAntigravityHubUserAgent({
      version: getAntigravityVersion(),
      platform: `${platform}/${arch}`,
    }),
    apiClient: randomFrom(SDK_CLIENTS),
    clientMetadata: {
      ideType: randomFrom(IDE_TYPES),
      platform: platformToDisplayName(platform),
      pluginType: "GEMINI",
    },
    createdAt: Date.now(),
  };
}

/**
 * Collect fingerprint based on actual current system.
 * Uses real OS info instead of randomized values.
 */
export function collectCurrentFingerprint(): Fingerprint {
  const platform = os.platform();
  const arch = os.arch();

  return {
    deviceId: generateDeviceId(),
    sessionToken: generateSessionToken(),
    userAgent: formatAntigravityHubUserAgent({
      version: getAntigravityVersion(),
      platform: `${platform}/${arch}`,
    }),
    apiClient: "google-cloud-sdk vscode_cloudshelleditor/0.1",
    clientMetadata: {
      ideType: "ANTIGRAVITY",
      platform: platformToDisplayName(platform),
      pluginType: "GEMINI",
    },
    createdAt: Date.now(),
  };
}

const DIRECT_ANTIGRAVITY_UA_REGEX =
  /^antigravity\/(?:hub\/|cli\/)?[\d.]+(?:\s+([a-z0-9_-]+\/[a-z0-9_-]+)(?:\s+.*)?|\s+.*)?$/i;
const BROWSER_ANTIGRAVITY_UA_REGEX = /\bAntigravity\/[\d.]+/i;

/**
 * Update the version and Hub family in a fingerprint's userAgent to match the target version.
 * Migrates Hub (`antigravity/hub/<ver> <os>/<arch>`), legacy (`antigravity/<ver> <os>/<arch>`),
 * CLI (`antigravity/cli/<ver> (...)`), and browser-style (`... Antigravity/<ver> ...`) shapes.
 * Rejects versions below the minimum supported floor (`2.9.1`) or malformed semver strings.
 * Returns true whenever `fingerprint.userAgent` changed.
 */
export function updateFingerprintVersion(
  fingerprint: Fingerprint,
  version = getAntigravityVersion(),
): boolean {
  const trimmedVersion = version.trim();
  if (!isSupportedAntigravityVersion(trimmedVersion)) {
    return false;
  }

  const directMatch = DIRECT_ANTIGRAVITY_UA_REGEX.exec(fingerprint.userAgent.trim());
  let nextUserAgent: string | null = null;

  if (directMatch) {
    const platform = directMatch[1] ?? ANTIGRAVITY_HUB_PLATFORM;
    nextUserAgent = formatAntigravityHubUserAgent({
      version: trimmedVersion,
      platform,
    });
  } else if (BROWSER_ANTIGRAVITY_UA_REGEX.test(fingerprint.userAgent)) {
    nextUserAgent = formatAntigravityHubUserAgent({
      version: trimmedVersion,
      platform: ANTIGRAVITY_HUB_PLATFORM,
    });
  }

  if (!nextUserAgent || nextUserAgent === fingerprint.userAgent) {
    return false;
  }

  fingerprint.userAgent = nextUserAgent;
  return true;
}

/**
 * Build HTTP headers from a fingerprint object.
 * These headers are used to identify the "device" making API requests.
 */
export function buildFingerprintHeaders(fingerprint: Fingerprint | null): Partial<FingerprintHeaders> {
  if (!fingerprint) {
    return {};
  }

  return {
    "User-Agent": fingerprint.userAgent,
  };
}

/**
 * Session-level fingerprint instance.
 * Generated once at module load, persists for the lifetime of the process.
 */
let sessionFingerprint: Fingerprint | null = null;

/**
 * Get or create the session fingerprint.
 * Returns the same fingerprint for all calls within a session.
 */
export function getSessionFingerprint(): Fingerprint {
  if (!sessionFingerprint) {
    sessionFingerprint = generateFingerprint();
  }
  return sessionFingerprint;
}

/**
 * Regenerate the session fingerprint.
 * Call this to get a fresh identity (e.g., after rate limiting).
 */
export function regenerateSessionFingerprint(): Fingerprint {
  sessionFingerprint = generateFingerprint();
  return sessionFingerprint;
}
