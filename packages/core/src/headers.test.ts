import { describe, expect, it } from "vitest"

import { buildAntigravityHeaders } from "./headers.ts"

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
