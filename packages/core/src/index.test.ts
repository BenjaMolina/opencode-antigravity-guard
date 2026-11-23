import { describe, expect, it } from "vitest"

import {
  ANTIGRAVITY_HUB_MANIFEST_URL,
  ANTIGRAVITY_MIN_VERSION,
  ANTIGRAVITY_VERSION_FALLBACK,
  CORE_PACKAGE_NAME,
  buildAntigravityHubHeaders,
  formatAntigravityHubUserAgent,
  isSupportedAntigravityVersion,
  parseAntigravityHubManifestVersion,
} from "./index.ts"

describe("core package surface", () => {
  it("exports its stable package identity and Hub helpers", () => {
    expect(CORE_PACKAGE_NAME).toBe("@benjamolina/antigravity-guard-core")
    expect(ANTIGRAVITY_VERSION_FALLBACK).toBe("2.34.0")
    expect(ANTIGRAVITY_MIN_VERSION).toBe("2.9.1")
    expect(ANTIGRAVITY_HUB_MANIFEST_URL).toContain("antigravity-hub-auto-updater")
    expect(formatAntigravityHubUserAgent()).toBe("antigravity/hub/2.34.0 darwin/arm64")
    expect(buildAntigravityHubHeaders()).toEqual({ "User-Agent": "antigravity/hub/2.34.0 darwin/arm64" })
    expect(isSupportedAntigravityVersion("2.34.0")).toBe(true)
    expect(parseAntigravityHubManifestVersion("version: 2.34.0\n")).toBe("2.34.0")
  })
})
