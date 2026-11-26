import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

import { resolvePiAuthJsonPath } from "./accounts.ts"
import { clearDynamicCatalogEntries, getCatalogEntry } from "./catalog.ts"
import { registerAntigravityProvider } from "./provider.ts"

const tempDirs: string[] = []
function makeTempHome(): string {
  const dir = mkdtempSync(join(os.tmpdir(), "pi-phase5-search-disc-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  clearDynamicCatalogEntries()
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("Phase 5 (T5.3) Pi google_search Guard tool and dynamic model discovery", () => {
  it("registers the google_search tool in Pi and executes grounded search via shared account pool with endpoint failover", async () => {
    const homeDir = makeTempHome()
    const opencodeDir = join(homeDir, ".config", "opencode")
    mkdirSync(opencodeDir, { recursive: true })
    writeFileSync(
      join(opencodeDir, "antigravity-accounts.json"),
      JSON.stringify({
        version: 4,
        activeIndex: 0,
        accounts: [
          {
            email: "searcher@example.com",
            refreshToken: "rt-search-1",
            projectId: "proj-search-1",
            addedAt: 1_000,
            lastUsed: 1_000,
          },
        ],
      }),
      "utf8",
    )

    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input)
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({ access_token: "at-search-live", expires_in: 3600, token_type: "Bearer" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
      if (url.includes("daily-cloudcode-pa.sandbox.googleapis.com/v1internal:generateContent")) {
        return new Response("daily overloaded", { status: 503, statusText: "Service Unavailable" })
      }
      if (url.includes("autopush-cloudcode-pa.sandbox.googleapis.com/v1internal:generateContent")) {
        return new Response(
          JSON.stringify({
            response: {
              candidates: [
                {
                  content: { parts: [{ text: "Vitest 3.2 is current." }] },
                  groundingMetadata: {
                    webSearchQueries: ["vitest latest"],
                    groundingChunks: [{ web: { title: "Vitest Docs", uri: "https://vitest.dev" } }],
                  },
                },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
      return new Response("unexpected", { status: 500 })
    })

    const registerProvider = vi.fn()
    const registerTool = vi.fn()
    const runtime = registerAntigravityProvider(
      { registerProvider, registerTool } as never,
      { homeDir, cwd: homeDir, env: { PI_OFFLINE: "1" }, fetch: fetchMock },
    )

    try {
      expect(registerTool).toHaveBeenCalledOnce()
      const registeredTool = registerTool.mock.calls[0]?.[0]
      expect(registeredTool.name).toBe("google_search")

      const toolResult = await registeredTool.execute(
        "call-gs-1",
        { query: "What is the latest Vitest version?", urls: ["https://vitest.dev"], thinking: true },
        new AbortController().signal,
        undefined,
        { cwd: homeDir },
      )
      const text = toolResult.content[0]?.text ?? ""
      expect(text).toContain("## Search Results")
      expect(text).toContain("Vitest 3.2 is current.")
      expect(text).toContain("[Vitest Docs](https://vitest.dev)")
    } finally {
      runtime.shutdown()
    }
  })

  it("supports opt-in dynamic model discovery via ProviderConfig.refreshModels and registers discovered models for streaming", async () => {
    const homeDir = makeTempHome()
    const piDir = join(homeDir, ".pi", "agent")
    mkdirSync(piDir, { recursive: true })
    writeFileSync(
      join(piDir, "antigravity.json"),
      JSON.stringify({ model_discovery: { enabled: true, antigravity: true } }),
      "utf8",
    )

    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input)
      if (url.includes(":fetchAvailableModels")) {
        return new Response(
          JSON.stringify({
            models: {
              "gemini-4-krypton-preview": {
                displayName: "Gemini 4 Krypton Preview",
                modelName: "gemini-4-krypton-preview",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )
      }
      if (url.includes(":streamGenerateContent")) {
        return new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"Hello from Krypton"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        )
      }
      return new Response("unexpected", { status: 500 })
    })

    const registerProvider = vi.fn()
    const runtime = registerAntigravityProvider(
      { registerProvider },
      { homeDir, cwd: homeDir, env: {}, fetch: fetchMock },
    )

    try {
      const [, providerConfig] = registerProvider.mock.calls[0] ?? []
      expect(typeof providerConfig.refreshModels).toBe("function")

      const refreshed = await providerConfig.refreshModels({
        allowNetwork: true,
        credential: {
          type: "oauth",
          access: '{"token":"disc-token","projectId":"disc-proj"}',
          refresh: "rt",
          expires: Date.now() + 60_000,
        },
        publish: async () => true,
        signal: new AbortController().signal,
      })

      const discovered = refreshed.find((m: { id: string }) => m.id === "antigravity-gemini-4-krypton-preview")
      expect(discovered).toBeDefined()
      expect(discovered.name).toBe("Gemini 4 Krypton Preview (Antigravity)")
      expect(getCatalogEntry("antigravity-gemini-4-krypton-preview")).toBeDefined()

      // Discovered model can immediately stream through streamSimple
      const stream = providerConfig.streamSimple(
        { ...discovered, api: "antigravity-guard-sse", provider: "antigravity-guard" },
        { messages: [{ role: "user", content: "Ping Krypton", timestamp: 1 }] },
        { apiKey: '{"token":"disc-token","projectId":"disc-proj"}', fetch: fetchMock },
      )
      for await (const _event of stream) {
        // drain
      }
      const result = await stream.result()
      expect(result.stopReason).toBe("stop")
      expect(result.content).toEqual([{ type: "text", text: "Hello from Krypton" }])
    } finally {
      runtime.shutdown()
    }
  })

  it("B1 (S5): refreshModels discovers models on cold shared-pool accounts, seeded placeholder credentials, pre-session_start refreshes, and expired OAuth credentials without mutating antigravity-accounts.json", async () => {
    const homeDir = makeTempHome()
    const ocDir = join(homeDir, ".config", "opencode")
    mkdirSync(ocDir, { recursive: true })
    const accountsPath = join(ocDir, "antigravity-accounts.json")
    writeFileSync(
      accountsPath,
      JSON.stringify(
        {
          version: 4,
          activeIndex: 0,
          accounts: [
            {
              email: "pool@example.com",
              refreshToken: "rt-pool",
              projectId: "proj-pool",
              addedAt: 1000,
              lastUsed: 1000,
            },
          ],
        },
        null,
        2,
      ),
      "utf8",
    )
    writeFileSync(
      join(ocDir, "antigravity.json"),
      JSON.stringify({ model_discovery: { enabled: true, antigravity: true }, proactive_token_refresh: false }),
      "utf8",
    )
    const beforeBytes = readFileSync(accountsPath, "utf8")

    const registerProvider = vi.fn()
    const runtime = registerAntigravityProvider(
      { registerProvider },
      {
        homeDir,
        cwd: homeDir,
        env: {},
        fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes("oauth2.googleapis.com/token")) {
            return new Response(
              JSON.stringify({ access_token: "at-fresh", expires_in: 3600, token_type: "Bearer" }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            )
          }
          if (url.includes(":fetchAvailableModels")) {
            const auth = (init?.headers as Record<string, string>)?.Authorization
            if (auth !== "Bearer at-fresh") {
              return new Response("Unauthorized", { status: 401 })
            }
            return new Response(
              JSON.stringify({ models: { "gemini-4-xenon-preview": { displayName: "Gemini 4 Xenon" } } }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            )
          }
          return new Response("version: 2.34.0\n", { status: 200 })
        }) as typeof fetch,
      },
    )

    try {
      const [, providerCfg] = registerProvider.mock.calls[0] ?? []
      // Case 1: Pre-session_start refresh with no credential passed (cold pool on disk)
      const preSessionModels = await providerCfg.refreshModels({
        allowNetwork: true,
        publish: async () => true,
        signal: new AbortController().signal,
      })
      expect(preSessionModels.some((m: { id: string }) => m.id === "antigravity-gemini-4-xenon-preview")).toBe(true)

      // Case 2: Post-session_start refresh with seeded auth.json placeholder credential
      clearDynamicCatalogEntries()
      await runtime.refreshSession(homeDir)
      const authJsonPath = resolvePiAuthJsonPath({ homeDir, cwd: homeDir, env: {} })
      const seededCred = JSON.parse(readFileSync(authJsonPath, "utf8"))["antigravity-guard"]
      const fromSeeded = await providerCfg.refreshModels({
        allowNetwork: true,
        credential: seededCred,
        publish: async () => true,
        signal: new AbortController().signal,
      })
      expect(fromSeeded.some((m: { id: string }) => m.id === "antigravity-gemini-4-xenon-preview")).toBe(true)

      // Case 3: Expired OAuth credential in refreshCtx.credential
      clearDynamicCatalogEntries()
      const fromExpired = await providerCfg.refreshModels({
        allowNetwork: true,
        credential: {
          type: "oauth",
          access: "expired-tok",
          refresh: "rt-exp",
          expires: Date.now() - 60_000,
          projectId: "proj-exp",
        },
        publish: async () => true,
        signal: new AbortController().signal,
      })
      expect(fromExpired.some((m: { id: string }) => m.id === "antigravity-gemini-4-xenon-preview")).toBe(true)
      expect(readFileSync(accountsPath, "utf8")).toBe(beforeBytes)
    } finally {
      runtime.shutdown()
    }
  })

  it("B2 (S3, S4, S5): google_search enforces Strict Quota Guard and disabled pool state without falling through to seeded auth.json", async () => {
    const homeDir = makeTempHome()
    const ocDir = join(homeDir, ".config", "opencode")
    mkdirSync(ocDir, { recursive: true })
    writeFileSync(
      join(ocDir, "antigravity-accounts.json"),
      JSON.stringify({
        version: 4,
        activeIndex: 0,
        accounts: [
          {
            email: "locked@example.com",
            refreshToken: "rt-locked",
            projectId: "proj-locked",
            addedAt: 1000,
            lastUsed: 1000,
            cachedQuota: {
              "gemini-flash": {
                remainingFraction: 0.05,
                resetTime: new Date(Date.now() + 3_600_000).toISOString(),
                modelCount: 2,
              },
            },
            cachedQuotaUpdatedAt: Date.now(),
          },
        ],
      }),
      "utf8",
    )
    writeFileSync(
      join(ocDir, "antigravity.json"),
      JSON.stringify({ soft_quota_threshold_percent: 70, max_rate_limit_wait_seconds: 5 }),
      "utf8",
    )

    let searchHitNetwork = false
    let searchTool: any
    const runtime = registerAntigravityProvider(
      { registerProvider: vi.fn(), registerTool: ((tool: unknown) => { searchTool = tool }) as never },
      {
        homeDir,
        cwd: homeDir,
        env: { PI_OFFLINE: "1" },
        fetch: (async (input: RequestInfo | URL) => {
          if (String(input).includes(":generateContent")) searchHitNetwork = true
          return new Response(JSON.stringify({ access_token: "at-locked", expires_in: 3600 }), { status: 200 })
        }) as typeof fetch,
      },
    )

    try {
      const result = await searchTool.execute(
        "call-quota-1",
        { query: "blocked query" },
        new AbortController().signal,
        undefined,
        { cwd: homeDir },
      )
      expect(searchHitNetwork).toBe(false)
      expect(String(result.content[0]?.text)).toMatch(/quota|error|unavailable/i)
    } finally {
      runtime.shutdown()
    }
  })

  it("B3 (S3, S5): google_search marks HTTP 429 rate limits, rotates to healthy pool accounts, and invalidates stale HTTP 401 tokens", async () => {
    const homeDir = makeTempHome()
    const ocDir = join(homeDir, ".config", "opencode")
    mkdirSync(ocDir, { recursive: true })
    writeFileSync(
      join(ocDir, "antigravity-accounts.json"),
      JSON.stringify({
        version: 4,
        activeIndex: 0,
        accounts: [
          { email: "acc1@example.com", refreshToken: "rt-1", projectId: "proj-1", addedAt: 1000, lastUsed: 2000 },
          { email: "acc2@example.com", refreshToken: "rt-2", projectId: "proj-2", addedAt: 1000, lastUsed: 1000 },
        ],
      }),
      "utf8",
    )

    let rt2TokenIssues = 0
    let acc2FirstCallFailed401 = false
    let searchTool: any
    const runtime = registerAntigravityProvider(
      { registerProvider: vi.fn(), registerTool: ((tool: unknown) => { searchTool = tool }) as never },
      {
        homeDir,
        cwd: homeDir,
        env: { PI_OFFLINE: "1" },
        fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = String(input)
          if (url.includes("oauth2.googleapis.com/token")) {
            if (String(init?.body ?? "").includes("rt-1")) {
              return new Response(JSON.stringify({ access_token: "at-1", expires_in: 3600, token_type: "Bearer" }), {
                status: 200,
              })
            }
            rt2TokenIssues += 1
            return new Response(
              JSON.stringify({ access_token: `at-2-${rt2TokenIssues}`, expires_in: 3600, token_type: "Bearer" }),
              { status: 200 },
            )
          }
          const auth = (init?.headers as Record<string, string>)?.Authorization
          if (auth === "Bearer at-1") {
            return new Response(
              JSON.stringify({ error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exhausted" } }),
              { status: 429, headers: { "Retry-After": "120" } },
            )
          }
          if (auth === "Bearer at-2-1" && !acc2FirstCallFailed401) {
            acc2FirstCallFailed401 = true
            return new Response("Unauthorized", { status: 401 })
          }
          return new Response(
            JSON.stringify({
              response: { candidates: [{ content: { parts: [{ text: "Rotated & refreshed search result" }] } }] },
            }),
            { status: 200 },
          )
        }) as typeof fetch,
      },
    )

    try {
      const result1 = await searchTool.execute(
        "call-rot-1",
        { query: "rotate on 429" },
        new AbortController().signal,
        undefined,
        { cwd: homeDir },
      )
      const acc1 = runtime.getAccountPool().getManager()?.getAccounts()[0]
      expect(Object.keys(acc1?.rateLimitResetTimes ?? {}).length).toBeGreaterThan(0)
      if (!String(result1.content[0]?.text).includes("Rotated & refreshed search result")) {
        const result2 = await searchTool.execute(
          "call-rot-2",
          { query: "retry after 401 invalidation" },
          new AbortController().signal,
          undefined,
          { cwd: homeDir },
        )
        expect(String(result2.content[0]?.text)).toContain("Rotated & refreshed search result")
      } else {
        expect(String(result1.content[0]?.text)).toContain("Rotated & refreshed search result")
      }
      expect(rt2TokenIssues).toBeGreaterThanOrEqual(2)
    } finally {
      runtime.shutdown()
    }
  })

  it("B1–B3 edge cases (S1, S3, S4, S5): covers soft-quota wait-and-retry via sleep + refreshQuotasLive in google_search", async () => {
    const homeDir = makeTempHome()
    const ocDir = join(homeDir, ".config", "opencode")
    mkdirSync(ocDir, { recursive: true })
    let clock = 1_700_000_000_000
    writeFileSync(
      join(ocDir, "antigravity.json"),
      JSON.stringify({ soft_quota_threshold_percent: 70, max_rate_limit_wait_seconds: 10, proactive_token_refresh: false }),
      "utf8",
    )
    writeFileSync(
      join(ocDir, "antigravity-accounts.json"),
      JSON.stringify({
        version: 4,
        activeIndex: 0,
        accounts: [
          {
            email: "soft@example.com",
            refreshToken: "rt-soft",
            projectId: "proj-soft",
            addedAt: 1000,
            lastUsed: 1000,
            cachedQuota: {
              "gemini-flash": {
                remainingFraction: 0.1,
                resetTime: new Date(clock + 2_000).toISOString(),
                modelCount: 2,
              },
            },
            cachedQuotaUpdatedAt: clock,
          },
        ],
      }),
      "utf8",
    )

    const sleeps: number[] = []
    let searchTool: any
    const rt = registerAntigravityProvider(
      { registerProvider: vi.fn(), registerTool: ((t: unknown) => { searchTool = t }) as never },
      {
        homeDir,
        cwd: homeDir,
        env: {},
        now: () => clock,
        sleep: async (ms) => {
          sleeps.push(ms)
          clock += ms + 10
        },
        fetch: (async (input: RequestInfo | URL) => {
          const url = String(input)
          if (url.includes("oauth2.googleapis.com/token")) {
            return new Response(
              JSON.stringify({ access_token: "at-soft", expires_in: 3600, token_type: "Bearer" }),
              { status: 200 },
            )
          }
          if (url.includes(":fetchAvailableModels")) {
            return new Response(
              JSON.stringify({ models: { "gemini-3.8-flash": { quotaInfo: { remainingFraction: 1.0 } } } }),
              { status: 200 },
            )
          }
          if (url.includes(":retrieveUserQuota")) {
            return new Response(JSON.stringify({ buckets: [] }), { status: 200 })
          }
          return new Response(
            JSON.stringify({
              response: { candidates: [{ content: { parts: [{ text: "Recovered after quota wait" }] } }] },
            }),
            { status: 200 },
          )
        }) as typeof fetch,
      },
    )

    try {
      const res = await searchTool.execute(
        "c-wait",
        { query: "quota wait" },
        new AbortController().signal,
        undefined,
        { cwd: homeDir },
      )
      expect(sleeps).toEqual([2_000])
      expect(String(res.content[0]?.text)).toContain("Recovered after quota wait")
    } finally {
      rt.shutdown()
    }
  })
})
