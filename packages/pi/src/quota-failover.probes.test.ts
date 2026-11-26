import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import extension from "./extension.ts"

describe("Phase 3 Pi Strict Quota Guard, live /antigravity-quota, and failover probes (S4)", () => {
  it("enforces Strict Quota Guard resetTime lock across accounts, actively refreshes near-threshold quota pre-selection, and blocks with reset countdown when all accounts exceed soft_quota_threshold_percent", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p3-quota-guard-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const opencodeDir = join(home, ".config", "opencode")
      mkdirSync(opencodeDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      let nowMs = Date.now()
      const futureResetIso = new Date(nowMs + 45 * 60_000).toISOString() // 45m in future (> max_rate_limit_wait_seconds=10s)
      const poolPath = join(opencodeDir, "antigravity-accounts.json")
      writeFileSync(
        poolPath,
        JSON.stringify({
          version: 4,
          accounts: [
            {
              email: "locked@example.com",
              refreshToken: "rt-locked",
              projectId: "proj-1",
              addedAt: 1,
              lastUsed: 100,
              // Over 70% threshold (85% used -> remainingFraction 0.15) with future resetTime
              cachedQuota: {
                "gemini-pro": { remainingFraction: 0.15, resetTime: futureResetIso, modelCount: 2 },
              },
              cachedQuotaUpdatedAt: nowMs - 60_000,
            },
            {
              email: "near@example.com",
              refreshToken: "rt-near",
              projectId: "proj-2",
              addedAt: 2,
              lastUsed: 50,
              // Near 70% threshold (65% used -> remainingFraction 0.35, within 10% warning margin) and >2m old -> triggers active pre-select refresh!
              cachedQuota: {
                "gemini-pro": { remainingFraction: 0.35, resetTime: futureResetIso, modelCount: 2 },
              },
              cachedQuotaUpdatedAt: nowMs - 3 * 60_000,
            },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )
      writeFileSync(
        join(opencodeDir, "antigravity.json"),
        JSON.stringify({
          proactive_token_refresh: false,
          account_selection_strategy: "sticky",
          soft_quota_threshold_percent: 70,
          max_rate_limit_wait_seconds: 10,
        }),
        "utf8",
      )

      let nearFraction = 0.55 // First check: healthy (45% used); Second check: exhausted (10% remaining -> 90% used)!
      let fetchModelsCalls = 0
      const streamAuthHeaders: string[] = []

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const u = String(url)
        if (u.includes("latest-arm64-mac.yml")) {
          return new Response("version: 2.38.0\n", { status: 200 })
        }
        if (u.includes("oauth2.googleapis.com/token")) {
          const body = String(init?.body ?? "")
          const tok = body.includes("rt-locked") ? "acc-locked" : "acc-near"
          return new Response(JSON.stringify({ access_token: tok, expires_in: 3_600 }), { status: 200 })
        }
        if (u.endsWith("/v1internal:fetchAvailableModels")) {
          fetchModelsCalls += 1
          const auth = new Request(u, init).headers.get("authorization")
          const fraction = auth === "Bearer acc-locked" ? 0.1 : nearFraction
          return new Response(
            JSON.stringify({
              models: {
                "gemini-4-carbon-high": {
                  displayName: "Gemini 4 Carbon High",
                  quotaInfo: { remainingFraction: fraction, resetTime: futureResetIso },
                },
              },
            }),
            { status: 200 },
          )
        }
        if (u.endsWith("/v1internal:retrieveUserQuota")) {
          return new Response(JSON.stringify({ buckets: [] }), { status: 200 })
        }
        streamAuthHeaders.push(new Request(u, init).headers.get("authorization") ?? "")
        return new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"NEAR_OK"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        )
      })

      let providerCfg: any
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      extension(
        {
          registerProvider: (_id: string, cfg: unknown) => {
            providerCfg = cfg
          },
          on: (ev: string, fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => {
            if (ev === "session_start") onSessionStart = fn
          },
        } as never,
        { homeDir: home, cwd, env: {}, fetch: fetchMock, now: () => nowMs, sleep: async () => undefined },
      )

      await onSessionStart?.({}, { cwd })

      const carbonModel = {
        ...providerCfg.models.find((m: { id: string }) => m.id === "antigravity-gemini-4-carbon"),
        api: providerCfg.api,
        provider: "antigravity-guard",
      }

      // Turn 1: locked@example.com is skipped due to Strict Quota Guard (>70% used until futureResetIso);
      // near@example.com triggers pre-selection active quota refresh (fetchModelsCalls >= 1) and serves the stream!
      const turn1Events: any[] = []
      for await (const ev of providerCfg.streamSimple(
        carbonModel,
        { messages: [{ role: "user", content: "Turn 1" }] },
        { apiKey: '{"token":"shared-pool-pending-refresh","projectId":"proj-1"}', fetch: fetchMock },
      )) {
        turn1Events.push(ev)
      }
      expect(turn1Events.map((e) => e.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
      expect(fetchModelsCalls).toBeGreaterThanOrEqual(1)
      expect(streamAuthHeaders).toEqual(["Bearer acc-near"])

      // Advance clock past stale TTL so near@example.com refreshes again and now reports 90% used (remainingFraction 0.10)
      nearFraction = 0.1
      nowMs += 20 * 60_000
      streamAuthHeaders.length = 0

      const blockedStream = providerCfg.streamSimple(
        carbonModel,
        { messages: [{ role: "user", content: "Turn 2 blocked by soft quota" }] },
        { apiKey: '{"token":"shared-pool-pending-refresh","projectId":"proj-1"}', fetch: fetchMock },
      )
      const turn2Events: any[] = []
      for await (const ev of blockedStream) {
        turn2Events.push(ev)
      }
      expect(turn2Events.map((e) => e.type)).toEqual(["start", "error"])
      const finalMsg = await blockedStream.result()
      expect(finalMsg.errorMessage).toContain("Quota protection")
      expect(finalMsg.errorMessage).toContain("70%")
      expect(streamAuthHeaders).toEqual([])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("fetches live Antigravity & Gemini CLI quotas on /antigravity-quota when online, persists cachedQuota, and seeds auth.json when enabling a previously disabled pool", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p3-quota-cmd-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      const poolPath = join(piAgentDir, "antigravity-accounts.json")
      const authPath = join(piAgentDir, "auth.json")
      writeFileSync(
        poolPath,
        JSON.stringify({
          version: 4,
          accounts: [
            {
              email: "disabled@example.com",
              refreshToken: "rt-dis",
              projectId: "proj-dis",
              addedAt: 1,
              lastUsed: 1,
              enabled: false,
              verificationRequired: true,
            },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )
      writeFileSync(
        join(piAgentDir, "antigravity.json"),
        JSON.stringify({ proactive_token_refresh: false, soft_quota_threshold_percent: 75 }),
        "utf8",
      )

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url) => {
        const u = String(url)
        if (u.includes("latest-arm64-mac.yml")) {
          return new Response("version: 2.38.0\n", { status: 200 })
        }
        if (u.includes("oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "acc-live", expires_in: 3_600 }), { status: 200 })
        }
        if (u.endsWith("/v1internal:fetchAvailableModels")) {
          return new Response(
            JSON.stringify({
              models: {
                "claude-sonnet-4-6": {
                  quotaInfo: { remainingFraction: 0.6, resetTime: "2026-11-26T12:00:00Z" },
                },
                "gemini-4-argon-high": {
                  displayName: "Gemini 4 Argon High",
                  quotaInfo: { remainingFraction: 0.25, resetTime: "2026-11-26T14:00:00Z" },
                },
              },
            }),
            { status: 200 },
          )
        }
        if (u.endsWith("/v1internal:retrieveUserQuota")) {
          return new Response(
            JSON.stringify({
              buckets: [{ modelId: "gemini-3-pro", remainingFraction: 0.8, resetTime: "2026-11-26T15:00:00Z" }],
            }),
            { status: 200 },
          )
        }
        return new Response("unexpected", { status: 404 })
      })

      const reports: Array<{ customType: string; content: string }> = []
      const commands = new Map<string, any>()
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined

      extension(
        {
          registerProvider: () => {},
          registerCommand: (name: string, spec: unknown) => {
            commands.set(name, spec)
          },
          sendMessage: (msg: { customType: string; content: string }) => {
            reports.push(msg)
          },
          on: (ev: string, fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => {
            if (ev === "session_start") onSessionStart = fn
          },
        } as never,
        { homeDir: home, cwd, env: {}, fetch: fetchMock },
      )

      await onSessionStart?.({}, { cwd })

      // R3-3 check: enabling account #1 when all started disabled seeds auth.json so Pi recognizes the provider!
      await commands.get("antigravity-accounts").handler("enable 1", { cwd, ui: {} })
      const seededAuth = JSON.parse(readFileSync(authPath, "utf8"))
      expect(seededAuth["antigravity-guard"]).toMatchObject({
        type: "oauth",
        refresh: "rt-dis",
        poolSynced: true,
      })

      // Live /antigravity-quota check when online
      reports.length = 0
      await commands.get("antigravity-quota").handler("", { cwd, ui: {} })
      expect(reports).toHaveLength(1)
      expect(reports[0]?.content).toContain("40% used") // claude remaining 0.6 -> 40% used
      expect(reports[0]?.content).toContain("75% used") // gemini-pro remaining 0.25 -> 75% used
      expect(reports[0]?.content).toContain("gemini-3-pro") // Gemini CLI quota section/detail

      const persistedPool = JSON.parse(readFileSync(poolPath, "utf8"))
      expect(persistedPool.accounts[0].cachedQuota["gemini-pro"].remainingFraction).toBe(0.25)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("waits and retries within max_rate_limit_wait_seconds on short soft-quota/rate-limit windows and refreshes background quota after successful turns", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p3-wait-bg-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      let nowMs = Date.now()
      const shortResetIso = new Date(nowMs + 4_000).toISOString() // 4s <= max_rate_limit_wait_seconds=10s
      const poolPath = join(piAgentDir, "antigravity-accounts.json")
      writeFileSync(
        poolPath,
        JSON.stringify({
          version: 4,
          accounts: [
            {
              email: "wait@example.com",
              refreshToken: "rt-wait",
              projectId: "proj-wait",
              addedAt: 1,
              lastUsed: 1,
              cachedQuota: {
                claude: { remainingFraction: 0.05, resetTime: shortResetIso, modelCount: 1 },
              },
              cachedQuotaUpdatedAt: nowMs - 10_000,
            },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )
      writeFileSync(
        join(piAgentDir, "antigravity.json"),
        JSON.stringify({
          proactive_token_refresh: false,
          soft_quota_threshold_percent: 70,
          max_rate_limit_wait_seconds: 10,
          quota_refresh_interval_minutes: 5,
        }),
        "utf8",
      )

      let currentFraction = 0.05
      const sleepWaits: number[] = []
      let quotaFetchCount = 0

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url) => {
        const u = String(url)
        if (u.includes("latest-arm64-mac.yml")) {
          return new Response("version: 2.38.0\n", { status: 200 })
        }
        if (u.includes("oauth2.googleapis.com/token")) {
          return new Response(JSON.stringify({ access_token: "acc-wait", expires_in: 3_600 }), { status: 200 })
        }
        if (u.endsWith("/v1internal:fetchAvailableModels")) {
          quotaFetchCount += 1
          return new Response(
            JSON.stringify({
              models: {
                "claude-sonnet-4-6": {
                  quotaInfo: { remainingFraction: currentFraction, resetTime: "2026-11-26T18:00:00Z" },
                },
              },
            }),
            { status: 200 },
          )
        }
        if (u.endsWith("/v1internal:retrieveUserQuota")) {
          return new Response(JSON.stringify({ buckets: [] }), { status: 200 })
        }
        return new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"RECOVERED_OK"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        )
      })

      let providerCfg: any
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      extension(
        {
          registerProvider: (_id: string, cfg: unknown) => {
            providerCfg = cfg
          },
          on: (ev: string, fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => {
            if (ev === "session_start") onSessionStart = fn
          },
        } as never,
        {
          homeDir: home,
          cwd,
          env: {},
          fetch: fetchMock,
          now: () => nowMs,
          sleep: async (ms: number) => {
            sleepWaits.push(ms)
            nowMs += ms + 500
            currentFraction = 0.9 // After reset wait, quota is replenished!
          },
        },
      )

      await onSessionStart?.({}, { cwd })
      const claudeModel = {
        ...providerCfg.models.find((m: { id: string }) => m.id.includes("claude")),
        api: providerCfg.api,
        provider: "antigravity-guard",
      }

      const events: string[] = []
      for await (const ev of providerCfg.streamSimple(
        claudeModel,
        { messages: [{ role: "user", content: "Wait for short soft-quota reset" }] },
        { apiKey: '{"token":"shared-pool-pending-refresh","projectId":"proj-wait"}', fetch: fetchMock },
      )) {
        events.push(ev.type)
      }
      expect(events).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
      expect(sleepWaits.some((ms) => ms > 0 && ms <= 5_000)).toBe(true)

      // Advance clock 6m (> quota_refresh_interval_minutes=5m) with soft_quota_threshold_percent=100 (or fresh <2m? No, >5m triggers background refresh on recordSuccess when threshold=100!)
      writeFileSync(
        join(piAgentDir, "antigravity.json"),
        JSON.stringify({
          proactive_token_refresh: false,
          soft_quota_threshold_percent: 100,
          quota_refresh_interval_minutes: 5,
        }),
        "utf8",
      )
      await onSessionStart?.({}, { cwd })
      const beforeBgCount = quotaFetchCount
      nowMs += 6 * 60_000
      currentFraction = 0.72

      for await (const _ev of providerCfg.streamSimple(
        claudeModel,
        { messages: [{ role: "user", content: "Trigger background quota refresh" }] },
        { apiKey: '{"token":"shared-pool-pending-refresh","projectId":"proj-wait"}', fetch: fetchMock },
      )) {
        // drain
      }

      await vi.waitFor(() => {
        expect(quotaFetchCount).toBeGreaterThan(beforeBgCount)
        const updatedDisk = JSON.parse(readFileSync(poolPath, "utf8"))
        expect(updatedDisk.accounts[0].cachedQuota.claude.remainingFraction).toBe(0.72)
      })
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
