import { describe, expect, it } from "vitest"

import {
  buildAntigravityHeaders,
  buildAntigravityHubHeaders,
  formatAntigravityHubUserAgent,
} from "./headers.ts"

describe("buildAntigravityHeaders", () => {
  it("builds the legacy Windows header set from explicit inputs", () => {
    expect(buildAntigravityHeaders({ version: "1.19.4", platform: "win32" })).toEqual({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/1.19.4 Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36",
      "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
      "Client-Metadata": '{"ideType":"ANTIGRAVITY","platform":"WINDOWS","pluginType":"GEMINI"}',
    })
  })

  it("maps non-Windows platforms to the legacy macOS metadata", () => {
    const headers = buildAntigravityHeaders({ version: "2.0.0", platform: "darwin" })

    expect(headers["User-Agent"]).toContain("Antigravity/2.0.0")
    expect(headers["Client-Metadata"]).toBe(
      '{"ideType":"ANTIGRAVITY","platform":"MACOS","pluginType":"GEMINI"}',
    )
  })
})

describe("Antigravity Hub User-Agent and headers", () => {
  it("builds the minimal Hub User-Agent header using fallback defaults", () => {
    expect(formatAntigravityHubUserAgent()).toBe("antigravity/hub/2.34.0 darwin/arm64")
    expect(buildAntigravityHubHeaders()).toEqual({
      "User-Agent": "antigravity/hub/2.34.0 darwin/arm64",
    })
  })

  it("allows explicit version and platform overrides", () => {
    expect(
      formatAntigravityHubUserAgent({ version: "2.35.0", platform: "win32/x64" }),
    ).toBe("antigravity/hub/2.35.0 win32/x64")
  })
})
