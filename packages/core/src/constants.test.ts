import { describe, expect, it } from "vitest"

import {
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_HUB_MANIFEST_URL,
  ANTIGRAVITY_HUB_PLATFORM,
  ANTIGRAVITY_MIN_VERSION,
  ANTIGRAVITY_VERSION_FALLBACK,
  compareAntigravityVersions,
  isSupportedAntigravityVersion,
  parseAntigravityHubManifestVersion,
} from "./constants.ts"

describe("ANTIGRAVITY_ENDPOINTS", () => {
  it("exposes the fixed OAuth and Antigravity API endpoints", () => {
    expect(ANTIGRAVITY_ENDPOINTS).toEqual({
      authorize: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      userInfo: "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
      daily: "https://daily-cloudcode-pa.sandbox.googleapis.com",
      autopush: "https://autopush-cloudcode-pa.sandbox.googleapis.com",
      production: "https://cloudcode-pa.googleapis.com",
    })
  })
})

describe("Antigravity Hub version constants and validators", () => {
  it("exposes a Hub fallback version at or above the 2.9.1 minimum floor", () => {
    expect(ANTIGRAVITY_MIN_VERSION).toBe("2.9.1")
    expect(ANTIGRAVITY_VERSION_FALLBACK).toBe("2.34.0")
    expect(ANTIGRAVITY_HUB_PLATFORM).toBe("darwin/arm64")
    expect(ANTIGRAVITY_HUB_MANIFEST_URL).toBe(
      "https://antigravity-hub-auto-updater-974169037036.us-central1.run.app/manifest/latest-arm64-mac.yml",
    )
    expect(isSupportedAntigravityVersion(ANTIGRAVITY_VERSION_FALLBACK)).toBe(true)
    expect(isSupportedAntigravityVersion("2.9.1")).toBe(true)
    expect(isSupportedAntigravityVersion("2.9.0")).toBe(false)
    expect(isSupportedAntigravityVersion("2.0.6")).toBe(false)
    expect(isSupportedAntigravityVersion("1.19.4")).toBe(false)
    expect(isSupportedAntigravityVersion("invalid")).toBe(false)
    expect(compareAntigravityVersions("2.34.0", "2.9.1")).toBe(1)
  })

  it("parses valid Hub YAML manifests and rejects versions below the minimum floor", () => {
    const manifest = [
      "version: 2.34.0",
      "files:",
      "  - url: Antigravity-2.34.0-arm64-mac.zip",
      "releaseDate: '2026-11-20T00:00:00.000Z'",
    ].join("\n")

    expect(parseAntigravityHubManifestVersion(manifest)).toBe("2.34.0")
    expect(parseAntigravityHubManifestVersion("version: '2.35.1'\n")).toBe("2.35.1")
    expect(parseAntigravityHubManifestVersion("version: 2.0.6\n")).toBeNull()
    expect(parseAntigravityHubManifestVersion("files: []\n")).toBeNull()
  })
})
