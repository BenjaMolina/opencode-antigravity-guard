import { mkdtempSync, rmSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { describe, expect, it, vi } from "vitest"

import extension from "./extension.ts"

describe("Phase 1 S2 Pi runtime propagation and header integrity probes", () => {
  it("propagates session_start Hub version to both oauth.login and streamSimple, preserves valid version across < 2.9.1/failed refreshes, and prevents lowercase user-agent/accept concatenation", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-guard-p1-probe-"))
    try {
      let hubYaml = "version: 2.41.0\n"
      let hubStatus = 200
      const wireHeaders: Array<{ url: string; ua: string | null; accept: string | null }> = []

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const u = String(url)
        const req = new Request(u, init)
        wireHeaders.push({
          url: u,
          ua: req.headers.get("user-agent"),
          accept: req.headers.get("accept"),
        })
        if (u.includes("latest-arm64-mac.yml")) return new Response(hubYaml, { status: hubStatus })
        if (u.includes("oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "acc", refresh_token: "ref", expires_in: 3600 }))
        }
        if (u.includes("userinfo")) return new Response(JSON.stringify({ email: "dev@example.com" }))
        if (u.includes("loadCodeAssist")) return new Response(JSON.stringify({ cloudaicompanionProject: "proj-1" }))
        return new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        )
      })

      const registerProvider = vi.fn()
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      const ret = extension(
        {
          registerProvider: registerProvider as unknown as ExtensionAPI["registerProvider"],
          on: (event, handler) => {
            if (event === "session_start") onSessionStart = handler
          },
        },
        { fetch: fetchMock, homeDir: scratch, cwd: scratch, env: { PI_OFFLINE: "0" } },
      )

      expect(ret).toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()

      const [, providerCfg] = registerProvider.mock.calls[0] ?? []
      await onSessionStart?.({}, { cwd: scratch })
      let authUrl = ""
      await providerCfg.oauth.login({
        onSelect: async () => "manual",
        onAuth: ({ url }: { url: string }) => { authUrl = url },
        onPrompt: async () =>
          `http://localhost:51121/oauth-callback?code=c1&state=${new URL(authUrl).searchParams.get("state")}`,
        onDeviceCode: () => undefined,
      })
      const loginUA = wireHeaders.find((entry) => entry.url.includes("loadCodeAssist"))?.ua
      expect(loginUA).toMatch(/^antigravity\/hub\/2\.41\.0 (darwin|win32)\/(x64|arm64)$/)

      hubYaml = "version: 2.0.6\n"
      await onSessionStart?.({}, { cwd: scratch })
      hubStatus = 500
      await onSessionStart?.({}, { cwd: scratch })

      wireHeaders.length = 0
      const stream = providerCfg.streamSimple(
        { ...providerCfg.models[0], api: providerCfg.api, provider: "antigravity-guard" },
        { messages: [{ role: "user", content: "Ping" }] },
        {
          apiKey: '{"token":"tok","projectId":"proj-1"}',
          fetch: fetchMock,
          headers: { "user-agent": "spoofed/1.0", accept: "application/json" },
        },
      )
      for await (const _event of stream) {
        // drain
      }
      const streamReq = wireHeaders.find((entry) => entry.url.includes("streamGenerateContent"))
      expect(streamReq?.ua).toMatch(/^antigravity\/hub\/2\.41\.0 (darwin|win32)\/(x64|arm64)$/)
      expect(streamReq?.accept).toBe("text/event-stream")
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
