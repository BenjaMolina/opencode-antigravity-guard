import * as os from "node:os"
import { describe, expect, it } from "vitest"
import { getAntigravityVersion } from "../constants.ts"
import { AccountManager } from "./accounts.ts"
import {
  collectCurrentFingerprint,
  generateFingerprint,
  updateFingerprintVersion,
  type Fingerprint,
} from "./fingerprint.ts"
import type { AccountStorageV4 } from "./storage.ts"

function makeFingerprint(userAgent: string): Fingerprint {
  return {
    deviceId: "11111111-2222-3333-4444-555555555555",
    sessionToken: "0123456789abcdef0123456789abcdef",
    userAgent,
    apiClient: "google-cloud-sdk vscode_cloudshelleditor/0.1",
    clientMetadata: {
      ideType: "ANTIGRAVITY",
      platform: "MACOS",
      pluginType: "GEMINI",
    },
    createdAt: 1000,
  }
}

describe("fingerprint Hub User-Agent generation and migration", () => {
  it("generateFingerprint emits Hub-family userAgent", () => {
    const version = getAntigravityVersion()
    const fp = generateFingerprint()
    expect(fp.userAgent).toMatch(
      new RegExp(`^antigravity/hub/${version.replace(/\./g, "\\.")} (darwin|win32)/(x64|arm64)$`),
    )
  })

  it("collectCurrentFingerprint emits Hub-family userAgent with current OS/arch", () => {
    const version = getAntigravityVersion()
    const fp = collectCurrentFingerprint()
    expect(fp.userAgent).toBe(`antigravity/hub/${version} ${os.platform()}/${os.arch()}`)
  })

  it("migrates older Hub userAgent while preserving os/arch", () => {
    const fp = makeFingerprint("antigravity/hub/2.20.0 win32/x64")
    const changed = updateFingerprintVersion(fp, "2.34.0")
    expect(changed).toBe(true)
    expect(fp.userAgent).toBe("antigravity/hub/2.34.0 win32/x64")
  })

  it("returns false when Hub userAgent already has the target version", () => {
    const fp = makeFingerprint("antigravity/hub/2.34.0 darwin/arm64")
    const changed = updateFingerprintVersion(fp, "2.34.0")
    expect(changed).toBe(false)
    expect(fp.userAgent).toBe("antigravity/hub/2.34.0 darwin/arm64")
  })

  it("migrates legacy antigravity/<ver> <os>/<arch> shapes to Hub userAgent", () => {
    const winFp = makeFingerprint("antigravity/1.19.4 win32/x64")
    expect(updateFingerprintVersion(winFp, "2.34.0")).toBe(true)
    expect(winFp.userAgent).toBe("antigravity/hub/2.34.0 win32/x64")

    const macFp = makeFingerprint("antigravity/2.0.6 darwin/arm64")
    expect(updateFingerprintVersion(macFp, "2.35.0")).toBe(true)
    expect(macFp.userAgent).toBe("antigravity/hub/2.35.0 darwin/arm64")

    const sameVerLegacyFp = makeFingerprint("antigravity/2.34.0 win32/x64")
    expect(updateFingerprintVersion(sameVerLegacyFp, "2.34.0")).toBe(true)
    expect(sameVerLegacyFp.userAgent).toBe("antigravity/hub/2.34.0 win32/x64")
  })

  it("migrates browser-style Antigravity/<ver> Electron userAgent to Hub darwin/arm64", () => {
    const fp = makeFingerprint(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/1.19.4 Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36",
    )
    expect(updateFingerprintVersion(fp, "2.34.0")).toBe(true)
    expect(fp.userAgent).toBe("antigravity/hub/2.34.0 darwin/arm64")
  })

  it("leaves unrelated userAgent strings untouched", () => {
    const fp = makeFingerprint("google-api-nodejs-client/9.15.1")
    expect(updateFingerprintVersion(fp, "2.34.0")).toBe(false)
    expect(fp.userAgent).toBe("google-api-nodejs-client/9.15.1")
  })

  it("AccountManager migrates persisted legacy and browser fingerprints on load", () => {
    const version = getAntigravityVersion()
    const stored: AccountStorageV4 = {
      version: 4,
      activeIndex: 0,
      accounts: [
        {
          refreshToken: "r1",
          projectId: "p1",
          addedAt: 1,
          lastUsed: 0,
          fingerprint: makeFingerprint("antigravity/1.19.4 win32/x64"),
        },
        {
          refreshToken: "r2",
          projectId: "p2",
          addedAt: 2,
          lastUsed: 0,
          fingerprint: makeFingerprint(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Antigravity/2.0.6 Electron/37.3.1",
          ),
        },
      ],
    }

    const manager = new AccountManager(undefined, stored)
    const accounts = manager.getAccountsSnapshot()
    expect(accounts[0]?.fingerprint?.userAgent).toBe(`antigravity/hub/${version} win32/x64`)
    expect(accounts[1]?.fingerprint?.userAgent).toBe(`antigravity/hub/${version} darwin/arm64`)
  })
})
