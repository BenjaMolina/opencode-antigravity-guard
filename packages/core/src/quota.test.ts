import { describe, expect, it, vi } from "vitest"
import {
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_ENDPOINT_FALLBACKS,
  ANTIGRAVITY_LOAD_ENDPOINTS,
  AccountManager,
  aggregateGeminiCliQuota,
  aggregateQuota,
  checkAccountsQuotaWithDeps,
  classifyQuotaGroup,
  createPoolQuotaRefreshCoordinator,
  fetchAvailableModels,
  fetchGeminiCliQuota,
} from "./index.ts"

describe("Phase 3 core quota engine & endpoint fallback constants (T3.1 / S1, S4)", () => {
  it("exports canonical daily -> autopush -> prod endpoint fallbacks and load endpoints", () => {
    expect(ANTIGRAVITY_ENDPOINT_FALLBACKS).toEqual([
      ANTIGRAVITY_ENDPOINTS.daily,
      ANTIGRAVITY_ENDPOINTS.autopush,
      ANTIGRAVITY_ENDPOINTS.production,
    ])
    expect(ANTIGRAVITY_LOAD_ENDPOINTS).toEqual([
      ANTIGRAVITY_ENDPOINTS.production,
      ANTIGRAVITY_ENDPOINTS.daily,
      ANTIGRAVITY_ENDPOINTS.autopush,
    ])
    expect(ANTIGRAVITY_DEFAULT_PROJECT_ID).toBe("rising-fact-p41fc")
  })

  it("classifies Claude, Gemini 3, and Gemini 4 quota groups and aggregates minimum remainingFraction with paired resetTime", () => {
    expect(classifyQuotaGroup("claude-sonnet-4-6")).toBe("claude")
    expect(classifyQuotaGroup("gemini-3-flash", "Gemini 3 Flash")).toBe("gemini-flash")
    expect(classifyQuotaGroup("gemini-4-carbon-high", "Gemini 4 Carbon High")).toBe("gemini-pro")
    expect(classifyQuotaGroup("gemini-2.5-pro", "Gemini 2.5 Pro")).toBeNull()

    const summary = aggregateQuota({
      "claude-sonnet-4-6": {
        displayName: "Claude Sonnet 4.6",
        quotaInfo: { remainingFraction: 0.85, resetTime: "2026-11-26T00:00:00Z" },
      },
      "gemini-4-argon-high": {
        displayName: "Gemini 4 Argon High",
        quotaInfo: { remainingFraction: 0.6, resetTime: "2026-11-26T01:00:00Z" },
      },
      "gemini-3.1-pro-high": {
        displayName: "Gemini 3.1 Pro High",
        quotaInfo: { remainingFraction: 0.25, resetTime: "2026-11-26T02:00:00Z" },
      },
      "gemini-3-flash-high": {
        displayName: "Gemini 3 Flash High",
        quotaInfo: { remainingFraction: -0.5, resetTime: "2026-11-26T03:00:00Z" },
      },
      "gemini-2.5-flash": {
        displayName: "Gemini 2.5 Flash",
        quotaInfo: { remainingFraction: 0.1, resetTime: "2026-11-26T04:00:00Z" },
      },
    })

    expect(summary.modelCount).toBe(4)
    expect(summary.groups.claude).toEqual({
      remainingFraction: 0.85,
      resetTime: "2026-11-26T00:00:00Z",
      modelCount: 1,
    })
    expect(summary.groups["gemini-pro"]).toEqual({
      remainingFraction: 0.25,
      resetTime: "2026-11-26T02:00:00Z",
      modelCount: 2,
    })
    expect(summary.groups["gemini-flash"]).toEqual({
      remainingFraction: 0,
      resetTime: "2026-11-26T03:00:00Z",
      modelCount: 1,
    })
  })

  it("fetches Antigravity available models and Gemini CLI user quota with custom fetch, User-Agent, and error/abort handling", async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = String(input)
      if (url.endsWith("/v1internal:fetchAvailableModels")) {
        expect(init?.method).toBe("POST")
        expect((init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok-1")
        expect((init?.headers as Record<string, string>)["User-Agent"]).toBe("antigravity/hub/2.34.0")
        expect(JSON.parse(String(init?.body))).toEqual({ project: "proj-1" })
        return new Response(
          JSON.stringify({
            models: {
              "gemini-4-carbon-high": {
                displayName: "Gemini 4 Carbon High",
                quotaInfo: { remainingFraction: 0.2, resetTime: "2026-11-26T05:00:00Z" },
              },
            },
          }),
          { status: 200 },
        )
      }
      if (url.endsWith("/v1internal:retrieveUserQuota")) {
        return new Response(
          JSON.stringify({
            buckets: [
              { modelId: "gemini-3-pro", remainingFraction: 0.7, resetTime: "2026-11-26T06:00:00Z" },
              { modelId: "gemini-2.5-pro", remainingFraction: 0.4, resetTime: "2026-11-26T07:00:00Z" },
              { modelId: "gemini-2.0-flash", remainingFraction: 0.9 },
            ],
          }),
          { status: 200 },
        )
      }
      return new Response("unexpected", { status: 404 })
    })

    const available = await fetchAvailableModels("tok-1", "proj-1", {
      fetch: fetchMock,
      userAgent: "antigravity/hub/2.34.0",
    })
    expect(available.models?.["gemini-4-carbon-high"]?.quotaInfo?.remainingFraction).toBe(0.2)

    const cliRaw = await fetchGeminiCliQuota("tok-1", "proj-1", { fetch: fetchMock })
    const cliSummary = aggregateGeminiCliQuota(cliRaw)
    expect(cliSummary.models).toEqual([
      { modelId: "gemini-2.5-pro", remainingFraction: 0.4, resetTime: "2026-11-26T07:00:00Z" },
      { modelId: "gemini-3-pro", remainingFraction: 0.7, resetTime: "2026-11-26T06:00:00Z" },
    ])

    const failFetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response("upstream quota unavailable", { status: 503 }),
    )
    await expect(
      fetchAvailableModels("tok-1", "", { fetch: failFetch }),
    ).rejects.toThrow("fetchAvailableModels 503 at https://cloudcode-pa.googleapis.com: upstream quota unavailable")
    await expect(fetchGeminiCliQuota("tok-1", "", { fetch: failFetch })).resolves.toEqual({
      buckets: [],
    })
  })

  it("checks account quotas via DI callbacks and coordinates single/pool refreshes with cooldown gating", async () => {
    const manager = new AccountManager(
      { type: "oauth", refresh: "rt-1|p-1", access: "acc-1", expires: Date.now() + 60_000 },
      {
        version: 4,
        accounts: [
          { email: "a1@x.com", refreshToken: "rt-1", projectId: "p-1", addedAt: 1, lastUsed: 1 },
          { email: "a2@x.com", refreshToken: "rt-2", projectId: "p-2", addedAt: 2, lastUsed: 2 },
        ],
        activeIndex: 0,
      },
    )

    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) => {
      if (String(input).endsWith("/v1internal:fetchAvailableModels")) {
        return new Response(
          JSON.stringify({
            models: {
              "claude-sonnet-4-6": {
                quotaInfo: { remainingFraction: 0.15, resetTime: "2026-11-26T08:00:00Z" },
              },
            },
          }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ buckets: [] }), { status: 200 })
    })

    let nowMs = 1_000_000
    const coordinator = createPoolQuotaRefreshCoordinator({
      cooldownMs: 60_000,
      now: () => nowMs,
    })

    const runCheck = (accounts: ReturnType<AccountManager["getAccountsForQuotaCheck"]>) =>
      checkAccountsQuotaWithDeps(accounts, {
        fetch: fetchMock,
        getUserAgent: () => "antigravity/hub/2.34.0",
        refreshAuth: async (auth, acc) => ({
          ...auth,
          refresh: `${acc.refreshToken}-rot|${acc.projectId ?? ""}|mp-new`,
          access: `fresh-${acc.refreshToken}`,
          expires: nowMs + 3_600_000,
        }),
        resolveProjectContext: async (auth, acc) => ({
          auth,
          effectiveProjectId: acc.projectId ?? ANTIGRAVITY_DEFAULT_PROJECT_ID,
        }),
      })

    const directResults = await runCheck(manager.getAccountsForQuotaCheck())
    expect(directResults).toHaveLength(2)
    expect(directResults[0]?.status).toBe("ok")
    expect(directResults[0]?.updatedAccount).toMatchObject({
      refreshToken: "rt-1-rot",
      projectId: "p-1",
      managedProjectId: "mp-new",
    })

    fetchMock.mockClear()
    await coordinator.triggerForAll(manager, runCheck)
    expect(fetchMock).toHaveBeenCalledTimes(4) // 2 accounts * 2 endpoints
    expect(manager.getAccounts()[0]?.cachedQuota?.claude?.remainingFraction).toBe(0.15)

    // Within 60s cooldown -> skipped
    fetchMock.mockClear()
    nowMs += 30_000
    await coordinator.triggerForAll(manager, runCheck)
    expect(fetchMock).not.toHaveBeenCalled()

    // Single-account active refresh bypasses pool cooldown
    const firstAccount = manager.getAccounts()[0]!
    const singleOk = await coordinator.refreshSingle(firstAccount, manager, runCheck)
    expect(singleOk).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("isolates per-account token refresh failures, handles null JSON payloads safely, and propagates caller AbortSignal", async () => {
    const nullJsonFetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response("null", { status: 200 }),
    )
    await expect(
      fetchAvailableModels("tok-1", "proj-1", {
        endpoint: "https://cloudcode-pa.googleapis.com///",
        fetch: nullJsonFetch,
      }),
    ).resolves.toEqual({})
    expect(String(nullJsonFetch.mock.calls[0]?.[0])).toBe(
      "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
    )

    const partialResults = await checkAccountsQuotaWithDeps(
      [
        { email: "broken@x.com", refreshToken: "rt-bad", addedAt: 1, lastUsed: 1, enabled: false },
        { email: "healthy@x.com", refreshToken: "rt-ok", projectId: "p-ok", addedAt: 2, lastUsed: 2 },
      ],
      {
        fetch: nullJsonFetch,
        refreshAuth: async (_auth, acc) =>
          acc.refreshToken === "rt-bad"
            ? undefined
            : { type: "oauth", refresh: "rt-ok|p-ok", access: "ok-tok", expires: Date.now() + 60_000 },
        resolveProjectContext: async (auth) => ({ auth, effectiveProjectId: "p-ok" }),
      },
    )
    expect(partialResults[0]).toMatchObject({
      status: "error",
      disabled: true,
      error: "Token refresh failed",
    })
    expect(partialResults[1]).toMatchObject({
      status: "ok",
      disabled: false,
      quota: { groups: {}, modelCount: 0, error: "Failed to fetch Antigravity quota" },
    })

    const abortCtrl = new AbortController()
    abortCtrl.abort(new Error("cancelled by caller"))
    await expect(
      fetchAvailableModels("tok-1", "proj-1", {
        fetch: nullJsonFetch,
        signal: abortCtrl.signal,
      }),
    ).rejects.toThrow("cancelled by caller")
  })
})
