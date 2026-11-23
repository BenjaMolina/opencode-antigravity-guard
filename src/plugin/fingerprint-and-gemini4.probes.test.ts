import { describe, expect, it } from "vitest"
import {
  ANTIGRAVITY_HUB_MANIFEST_URL,
  ANTIGRAVITY_HUB_PLATFORM,
  ANTIGRAVITY_MIN_VERSION,
  ANTIGRAVITY_VERSION_FALLBACK,
  buildAntigravityHeaders,
  formatAntigravityHubUserAgent,
  parseAntigravityHubManifestVersion,
} from "@benjamolina/antigravity-guard-core"
import { AccountManager } from "./accounts.ts"
import { isAgySdkSupportedRequest, isAntigravityOnlyGenerativeLanguageRequest } from "./api-key.ts"
import { OPENCODE_MODEL_DEFINITIONS } from "./config/models.ts"
import { updateFingerprintVersion, type Fingerprint } from "./fingerprint.ts"
import { __testExports as quotaTestExports } from "./quota.ts"
import { prepareAntigravityRequest } from "./request.ts"
import {
  resolveModelForHeaderStyle,
  resolveModelWithTier,
  resolveModelWithVariant,
} from "./transform/model-resolver.ts"

function makeFixtureFingerprint(userAgent: string): Fingerprint {
  return {
    deviceId: "device-fixed-001",
    sessionToken: "session-fixed-001",
    userAgent,
    apiClient: "google-cloud-sdk vscode/1.96.0",
    clientMetadata: {
      ideType: "ANTIGRAVITY",
      platform: "WINDOWS",
      pluginType: "GEMINI",
    },
    createdAt: 1700000000,
  }
}

describe("S1/S2 Hub manifest, version floor, and fingerprint migration probes", () => {
  it("enforces >= 2.9.1 floor in core Hub manifest parser while preserving legacy headers", () => {
    expect(ANTIGRAVITY_VERSION_FALLBACK).toBe("2.34.0")
    expect(ANTIGRAVITY_MIN_VERSION).toBe("2.9.1")
    expect(ANTIGRAVITY_HUB_PLATFORM).toBe("darwin/arm64")
    expect(ANTIGRAVITY_HUB_MANIFEST_URL).toContain("/manifest/latest-arm64-mac.yml")
    expect(parseAntigravityHubManifestVersion("version: 2.9.0\n")).toBeNull()
    expect(parseAntigravityHubManifestVersion("version: 2.0.6\n")).toBeNull()
    expect(parseAntigravityHubManifestVersion("version: 1.19.4\n")).toBeNull()
    expect(parseAntigravityHubManifestVersion("version: 2.9.1\n")).toBe("2.9.1")
    expect(parseAntigravityHubManifestVersion("version: '2.34.0'\r\n")).toBe("2.34.0")
    expect(formatAntigravityHubUserAgent()).toBe("antigravity/hub/2.34.0 darwin/arm64")
    expect(buildAntigravityHeaders({ version: "1.19.4", platform: "win32" })).toEqual({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/1.19.4 Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36",
      "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
      "Client-Metadata": '{"ideType":"ANTIGRAVITY","platform":"WINDOWS","pluginType":"GEMINI"}',
    })
  })

  it("rejects < 2.9.1 and malformed versions in updateFingerprintVersion without mutating fingerprint", () => {
    const fp = makeFixtureFingerprint("antigravity/hub/2.34.0 win32/x64")
    const snapshot = structuredClone(fp)

    for (const rejected of ["2.0.6", "1.19.4", "2.9.0", "", "   ", "not-a-semver", "v2.34.0"]) {
      expect(updateFingerprintVersion(fp, rejected)).toBe(false)
      expect(fp).toEqual(snapshot)
    }
  })

  it("migrates bare and parenthesized antigravity/cli/1.1.23 User-Agents in direct and restore flows", () => {
    const cliFull = makeFixtureFingerprint(
      "antigravity/cli/1.1.23 (aidev_client; os_type=linux; arch=amd64; cl=974125021; auth_method=consumer)",
    )
    expect(updateFingerprintVersion(cliFull, "2.34.0")).toBe(true)
    expect(cliFull.userAgent).toBe("antigravity/hub/2.34.0 darwin/arm64")
    expect(cliFull.deviceId).toBe("device-fixed-001")

    const cliSingleParen = makeFixtureFingerprint("antigravity/cli/1.1.23 (aidev_client)")
    expect(updateFingerprintVersion(cliSingleParen, "2.34.0")).toBe(true)
    expect(cliSingleParen.userAgent).toBe("antigravity/hub/2.34.0 darwin/arm64")

    const manager = new AccountManager(undefined, {
      version: 4,
      activeIndex: 0,
      accounts: [
        {
          refreshToken: "rt-1",
          projectId: "proj-1",
          addedAt: 1,
          lastUsed: 0,
          fingerprint: makeFixtureFingerprint("antigravity/hub/2.34.0 darwin/arm64"),
          fingerprintHistory: [
            {
              fingerprint: makeFixtureFingerprint(
                "antigravity/cli/1.1.23 (aidev_client; os_type=linux; arch=amd64; cl=974125021; auth_method=consumer)",
              ),
              timestamp: 10,
              reason: "initial",
            },
          ],
        },
      ],
    })
    const restored = manager.restoreAccountFingerprint(0, 0)
    expect(restored?.userAgent).toBe("antigravity/hub/2.34.0 darwin/arm64")
    expect(restored?.deviceId).toBe("device-fixed-001")
  })
})

describe("S3 OpenCode Gemini 4, xhigh, 3.5-flash-lite, and gpt-oss-120b-medium probes", () => {
  it("resolves Gemini 4 wire IDs, clamps xhigh on Argon/Carbon, and preserves special Hydrogen/3.5-lite/gpt-oss IDs", () => {
    expect(resolveModelWithVariant("antigravity-gemini-4-argon", { thinkingLevel: "xhigh" })).toMatchObject({
      actualModel: "gemini-4-argon-high",
      thinkingLevel: "high",
    })
    expect(resolveModelWithVariant("antigravity-gemini-4-neon", { thinkingLevel: "xhigh" })).toMatchObject({
      actualModel: "gemini-4-neon-xhigh",
      thinkingLevel: "xhigh",
    })
    expect(resolveModelForHeaderStyle("gemini-4-hydrogen-tiered-xhigh", "antigravity")).toMatchObject({
      actualModel: "gemini-4-hydrogen-tiered-xhigh",
      thinkingLevel: "xhigh",
    })
    expect(resolveModelWithTier("gemini-4-hydrogen-sonar")).toMatchObject({
      actualModel: "gemini-4-hydrogen-sonar",
      thinkingLevel: "high",
    })
    expect(resolveModelWithTier("antigravity-gemini-3.5-flash-lite").actualModel).toBe("gemini-3.5-flash-lite")
    expect(resolveModelWithTier("gpt-oss-120b-medium", { cli_first: true })).toMatchObject({
      actualModel: "gpt-oss-120b-medium",
      quotaPreference: "antigravity",
      isThinkingModel: false,
    })
    expect(OPENCODE_MODEL_DEFINITIONS["antigravity-gemini-4-carbon"]?.limit.output).toBe(262144)
    expect(OPENCODE_MODEL_DEFINITIONS["antigravity-gemini-4-neon"]?.limit.output).toBe(262144)
    expect(OPENCODE_MODEL_DEFINITIONS["antigravity-gemini-4-hydrogen"]?.limit.output).toBe(262144)
    expect(quotaTestExports.classifyQuotaGroup("gemini-4-neon-xhigh")).toBe("gemini-pro")
    expect(quotaTestExports.classifyQuotaGroup("gemini-3.5-flash-lite")).toBe("gemini-flash")
    expect(
      isAgySdkSupportedRequest("https://generativelanguage.googleapis.com/v1beta/models/gemini-4-argon:generateContent"),
    ).toBe(false)
    expect(
      isAntigravityOnlyGenerativeLanguageRequest(
        "https://generativelanguage.googleapis.com/v1beta/models/gpt-oss-120b-medium:generateContent",
      ),
    ).toBe(true)

    const prepared = prepareAntigravityRequest(
      "https://generativelanguage.googleapis.com/v1beta/models/antigravity-gemini-4-argon:streamGenerateContent",
      {
        method: "POST",
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "ping" }] }],
          providerOptions: { google: { thinkingLevel: "xhigh" } },
        }),
      },
      "token",
      "proj-1",
      undefined,
      "antigravity",
    )
    const wire = JSON.parse(String(prepared.init.body))
    expect(wire.model).toBe("gemini-4-argon-high")
    expect(wire.request.generationConfig.thinkingConfig.thinkingLevel).toBe("high")
  })
})
