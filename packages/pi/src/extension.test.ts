import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import extension from "./extension.ts"

describe("Pi extension factory", () => {
  it("synchronously registers the provider through Pi's extension factory", () => {
    const registerProvider = vi.fn()

    const result = extension({ registerProvider })

    expect(result).toBeUndefined()
    expect(registerProvider).toHaveBeenCalledOnce()
    expect(registerProvider.mock.calls[0]?.[0]).toBe("antigravity-guard")
  })

  it("refreshes Hub version and loads shared antigravity.json on session_start, propagating live Hub User-Agent to stream requests", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-guard-ext-p1-"))
    try {
      const opencodeDir = join(scratch, ".config", "opencode")
      mkdirSync(opencodeDir, { recursive: true })
      writeFileSync(
        join(opencodeDir, "antigravity.json"),
        JSON.stringify({ soft_quota_threshold_percent: 95, request_jitter_max_ms: 0 }),
        "utf8",
      )

      const registerProvider = vi.fn()
      const handlers = new Map<string, (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void>()
      const on = vi.fn((event: string, handler: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => {
        handlers.set(event, handler)
      })
      const hubFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response("version: 2.39.0\n", { status: 200 }),
      )

      extension({ registerProvider, on } as never, {
        fetch: hubFetch,
        homeDir: scratch,
        env: {},
      })

      expect(on).toHaveBeenCalledWith("session_start", expect.any(Function))
      await handlers.get("session_start")?.({}, { cwd: scratch })

      const [, config] = registerProvider.mock.calls[0] ?? []
      const streamFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
        new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      )

      const stream = config.streamSimple(
        { ...config.models[0], api: config.api, provider: "antigravity-guard" },
        { messages: [{ role: "user", content: "Ping" }] },
        { apiKey: '{"token":"tok","projectId":"proj"}', fetch: streamFetch },
      )
      for await (const _event of stream) {
        // drain
      }

      const sentHeaders = streamFetch.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined
      expect(sentHeaders?.["User-Agent"]).toMatch(/^antigravity\/hub\/2\.39\.0 (darwin|win32)\/(x64|arm64)$/)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("skips network Hub manifest fetch when PI_OFFLINE=1 while loading local antigravity.json", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-guard-ext-offline-"))
    try {
      const piAgentDir = join(scratch, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      writeFileSync(
        join(piAgentDir, "antigravity.json"),
        JSON.stringify({ soft_quota_threshold_percent: 88 }),
        "utf8",
      )

      const registerProvider = vi.fn()
      let startHandler: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      const on = vi.fn((_event: string, handler: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => {
        startHandler = handler
      })
      const hubFetch = vi.fn<typeof globalThis.fetch>()

      extension({ registerProvider, on } as never, {
        fetch: hubFetch,
        homeDir: scratch,
        env: { PI_OFFLINE: "1" },
      })

      await startHandler?.({}, { cwd: scratch })
      expect(hubFetch).not.toHaveBeenCalled()
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
