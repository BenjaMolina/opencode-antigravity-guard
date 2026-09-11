import { describe, it, expect } from "vitest"

import {
  ANTIGRAVITY_OAUTH_CLIENT,
  GEMINI_CLI_HEADERS as CORE_GEMINI_CLI_HEADERS,
} from "@benjamolina/antigravity-guard-core"
import {
  ANTIGRAVITY_SCOPES,
  GEMINI_CLI_HEADERS,
  getAntigravityHeaders,
  getRandomizedHeaders,
  type HeaderSet,
} from "./constants.ts"

describe("root compatibility wrappers", () => {
  it("keeps root OAuth scopes and Gemini CLI headers mutable", () => {
    const scope = "temporary-root-scope"
    const userAgent = GEMINI_CLI_HEADERS["User-Agent"]

    ANTIGRAVITY_SCOPES.push(scope)
    GEMINI_CLI_HEADERS["User-Agent"] = "temporary-root-agent"

    expect(ANTIGRAVITY_SCOPES.at(-1)).toBe(scope)
    expect(GEMINI_CLI_HEADERS["User-Agent"]).toBe("temporary-root-agent")
    expect(ANTIGRAVITY_OAUTH_CLIENT.scopes).not.toContain(scope)
    expect(CORE_GEMINI_CLI_HEADERS["User-Agent"]).toBe(userAgent)

    ANTIGRAVITY_SCOPES.pop()
    GEMINI_CLI_HEADERS["User-Agent"] = userAgent
  })

  it("returns independent mutable header objects", () => {
    const first = getAntigravityHeaders()
    const second = getAntigravityHeaders()

    first["User-Agent"] = "temporary-root-agent"

    expect(first["User-Agent"]).toBe("temporary-root-agent")
    expect(second["User-Agent"]).toContain("Antigravity/1.19.4")
    expect(second).not.toBe(first)
  })
})

describe("GEMINI_CLI_HEADERS", () => {
  it("matches Code Assist headers from opencode-gemini-auth", () => {
    expect(GEMINI_CLI_HEADERS).toEqual({
      "User-Agent": "google-api-nodejs-client/9.15.1",
      "X-Goog-Api-Client": "gl-node/22.17.0",
      "Client-Metadata": "ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI",
    })
  })
})

describe("getAntigravityHeaders", () => {
  it("preserves the deterministic legacy header values", () => {
    const headers = getAntigravityHeaders()

    expect(headers["User-Agent"]).toContain("Antigravity/1.19.4")
    expect(headers["X-Goog-Api-Client"]).toBe("google-cloud-sdk vscode_cloudshelleditor/0.1")
    expect(headers["Client-Metadata"]).toBe(
      `{"ideType":"ANTIGRAVITY","platform":"${process.platform === "win32" ? "WINDOWS" : "MACOS"}","pluginType":"GEMINI"}`,
    )
  })
})

describe("getRandomizedHeaders", () => {
  describe("gemini-cli style", () => {
    it("returns static Code Assist headers", () => {
      const headers = getRandomizedHeaders("gemini-cli", "gemini-2.5-pro")
      expect(headers).toEqual({
        "User-Agent": "google-api-nodejs-client/9.15.1",
        "X-Goog-Api-Client": "gl-node/22.17.0",
        "Client-Metadata": "ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI",
      })
    })

    it("ignores requested model and keeps static User-Agent", () => {
      const headers = getRandomizedHeaders("gemini-cli", "gemini-3-pro-preview")
      expect(headers["User-Agent"]).toBe("google-api-nodejs-client/9.15.1")
    })
  })

  describe("antigravity style", () => {
    it("returns all three headers", () => {
      const headers = getRandomizedHeaders("antigravity")
      expect(headers["User-Agent"]).toBeDefined()
      expect(headers["X-Goog-Api-Client"]).toBeDefined()
      expect(headers["Client-Metadata"]).toBeDefined()
    })

    it("returns User-Agent in antigravity format", () => {
      const headers = getRandomizedHeaders("antigravity")
      expect(headers["User-Agent"]).toMatch(/^antigravity\//)
    })

    it("aligns Client-Metadata platform with User-Agent platform", () => {
      for (let i = 0; i < 50; i++) {
        const headers = getRandomizedHeaders("antigravity")
        const ua = headers["User-Agent"]!
        const metadata = JSON.parse(headers["Client-Metadata"]!)
        if (ua.includes("windows/")) {
          expect(metadata.platform).toBe("WINDOWS")
        } else {
          expect(metadata.platform).toBe("MACOS")
        }
      }
    })

    it("never produces a linux User-Agent", () => {
      for (let i = 0; i < 50; i++) {
        const headers = getRandomizedHeaders("antigravity")
        expect(headers["User-Agent"]).not.toMatch(/linux\//)
      }
    })
  })
})

describe("HeaderSet type", () => {
  it("allows omitting X-Goog-Api-Client and Client-Metadata", () => {
    const headers: HeaderSet = {
      "User-Agent": "test",
    }
    expect(headers["User-Agent"]).toBe("test")
    expect(headers["X-Goog-Api-Client"]).toBeUndefined()
    expect(headers["Client-Metadata"]).toBeUndefined()
  })

  it("allows including all three headers", () => {
    const headers: HeaderSet = {
      "User-Agent": "test",
      "X-Goog-Api-Client": "test-client",
      "Client-Metadata": "test-metadata",
    }
    expect(headers["User-Agent"]).toBe("test")
    expect(headers["X-Goog-Api-Client"]).toBe("test-client")
    expect(headers["Client-Metadata"]).toBe("test-metadata")
  })
})
