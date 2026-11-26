import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import { DEFAULT_SHARED_GUARD_CONFIG } from "@benjamolina/antigravity-guard-core"
import { createPiAccountPool } from "./accounts.ts"
import extension from "./extension.ts"

describe("Phase 3 Pi rate-limit backoff & transient capacity parity probes (S3, S4)", () => {
  it("B2a: transient 503/529/MODEL_CAPACITY_EXHAUSTED after endpoint failover does not write a 60s rateLimitResetTimes lock to shared antigravity-accounts.json or stall the next turn", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p3-b2a-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const opencodeDir = join(home, ".config", "opencode")
      mkdirSync(opencodeDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      const poolPath = join(opencodeDir, "antigravity-accounts.json")
      writeFileSync(
        poolPath,
        JSON.stringify({
          version: 4,
          accounts: [
            {
              email: "solo@example.com",
              refreshToken: "rt-solo",
              projectId: "proj-solo",
              addedAt: 1,
              lastUsed: 1,
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
          soft_quota_threshold_percent: 100,
          max_rate_limit_wait_seconds: 300,
        }),
        "utf8",
      )

      let nowMs = 1_700_000_000_000
      let upstreamHealthy = false
      const sleepCalls: number[] = []

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url) => {
        const u = String(url)
        if (u.includes("latest-arm64-mac.yml")) {
          return new Response("version: 2.38.0\n", { status: 200 })
        }
        if (u.includes("oauth2.googleapis.com/token")) {
          return new Response(
            JSON.stringify({ access_token: "acc-solo", expires_in: 3_600 }),
            { status: 200 },
          )
        }
        if (!upstreamHealthy) {
          return new Response("Service Unavailable", { status: 503 })
        }
        return new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"RECOVERED_IMMEDIATELY"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        )
      })

      let providerCfg: any
      let onSessionStart:
        | ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void)
        | undefined
      extension(
        {
          registerProvider: (_id: string, cfg: unknown) => {
            providerCfg = cfg
          },
          on: (
            ev: string,
            fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void,
          ) => {
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
            sleepCalls.push(ms)
          },
        },
      )

      await onSessionStart?.({}, { cwd })
      const model = {
        ...providerCfg.models.find(
          (m: { id: string }) => m.id === "antigravity-gemini-4-carbon",
        ),
        api: providerCfg.api,
        provider: "antigravity-guard",
      }

      // Turn 1: transient 503 across daily -> autopush -> prod
      const turn1 = providerCfg.streamSimple(
        model,
        { messages: [{ role: "user", content: "Turn 1 during 503 spike" }] },
        {
          apiKey: '{"token":"shared-pool-pending-refresh","projectId":"proj-solo"}',
          fetch: fetchMock,
        },
      )
      for await (const _ev of turn1) {
        // drain
      }
      expect((await turn1.result()).stopReason).toBe("error")

      const persistedAfter503 = JSON.parse(readFileSync(poolPath, "utf8"))
      expect(persistedAfter503.accounts[0]?.rateLimitResetTimes ?? {}).toEqual({})

      // Turn 2 (1s later): upstream recovered; must NOT sleep ~59s waiting on a phantom rate-limit lock
      nowMs += 1_000
      upstreamHealthy = true
      sleepCalls.length = 0

      const turn2Events: string[] = []
      for await (const ev of providerCfg.streamSimple(
        model,
        { messages: [{ role: "user", content: "Turn 2 after 503 recovery" }] },
        {
          apiKey: '{"token":"shared-pool-pending-refresh","projectId":"proj-solo"}',
          fetch: fetchMock,
        },
      )) {
        turn2Events.push(ev.type)
      }
      expect(turn2Events).toEqual([
        "start",
        "text_start",
        "text_delta",
        "text_end",
        "done",
      ])
      expect(sleepCalls.filter((ms) => ms >= 10_000)).toEqual([])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("B2b: preserves progressive QUOTA_EXHAUSTED [60s, 5m, 30m, 2h] and 30s RATE_LIMIT_EXCEEDED backoffs when RetryInfo and Retry-After headers are absent", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p3-b2b-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piDir = join(home, ".pi", "agent")
      mkdirSync(piDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })
      writeFileSync(
        join(piDir, "antigravity-accounts.json"),
        JSON.stringify({
          version: 4,
          accounts: [
            { email: "q@example.com", refreshToken: "rt-q", projectId: "p-q", addedAt: 1, lastUsed: 1 },
            { email: "r@example.com", refreshToken: "rt-r", projectId: "p-r", addedAt: 2, lastUsed: 2 },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )

      let nowMs = 1_700_000_000_000
      const pool = createPiAccountPool({
        homeDir: home,
        cwd,
        env: { PI_OFFLINE: "1" },
        now: () => nowMs,
        getVersion: () => "2.38.0",
        getConfig: () => ({
          ...DEFAULT_SHARED_GUARD_CONFIG,
          proactive_token_refresh: false,
        }),
      })

      const manager = await pool.loadOrRefresh(cwd)
      const quotaAcc = manager.getAccounts()[0]!

      const observedQuotaLocks: number[] = []
      for (let i = 0; i < 4; i += 1) {
        nowMs += 3_000
        await pool.recordHttpFailure({
          account: quotaAcc,
          modelId: "antigravity-claude-sonnet-4-6",
          status: 429,
          body: JSON.stringify({
            error: {
              code: 429,
              message: "Quota exhausted for model",
              details: [
                {
                  "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                  reason: "QUOTA_EXHAUSTED",
                },
              ],
            },
          }),
          headers: {},
        })
        observedQuotaLocks.push(
          manager.getAccounts()[0]!.rateLimitResetTimes.claude! - nowMs,
        )
      }
      expect(observedQuotaLocks).toEqual([60_000, 300_000, 1_800_000, 7_200_000])

      const rpmAcc = manager.getAccounts()[1]!
      await pool.recordHttpFailure({
        account: rpmAcc,
        modelId: "antigravity-claude-sonnet-4-6",
        status: 429,
        body: JSON.stringify({
          error: {
            code: 429,
            message: "Rate limit exceeded per minute",
            details: [
              {
                "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                reason: "RATE_LIMIT_EXCEEDED",
              },
            ],
          },
        }),
        headers: {},
      })
      expect(manager.getAccounts()[1]!.rateLimitResetTimes.claude! - nowMs).toBe(
        30_000,
      )
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("keeps antigravity-accounts.json byte-for-byte identical after rejected /antigravity-quota and /antigravity-accounts commands", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p3-cmd-hash-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piDir = join(home, ".pi", "agent")
      mkdirSync(piDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      const poolPath = join(piDir, "antigravity-accounts.json")
      writeFileSync(
        poolPath,
        JSON.stringify(
          {
            version: 4,
            accounts: [
              { email: "h@example.com", refreshToken: "rt-h", projectId: "p-h", addedAt: 1, lastUsed: 1 },
            ],
            activeIndex: 0,
          },
          null,
          2,
        ),
        "utf8",
      )
      const shaBefore = createHash("sha256").update(readFileSync(poolPath)).digest("hex")

      const commands = new Map<string, any>()
      extension(
        {
          registerProvider: () => {},
          registerCommand: (name: string, spec: unknown) => {
            commands.set(name, spec)
          },
        } as never,
        { homeDir: home, cwd, env: { PI_OFFLINE: "1" } },
      )

      for (const badQuotaArg of ["--json", "1", "extra"]) {
        await commands.get("antigravity-quota").handler(badQuotaArg, { cwd, ui: {} })
      }
      for (const badAccArg of ["bad", "enable", "enable 0", "enable -1", "enable 1.5", "remove 0", "remove abc"]) {
        await commands.get("antigravity-accounts").handler(badAccArg, { cwd, ui: {} })
      }

      const shaAfter = createHash("sha256").update(readFileSync(poolPath)).digest("hex")
      expect(shaAfter).toBe(shaBefore)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("R3-1/R4-1: waits on shortest recovery window for mixed soft-quota/rate-limit/cooldown pools and avoids false 429 quota message on cooldown-only pools", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p3-mixed-pool-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piDir = join(home, ".pi", "agent")
      mkdirSync(piDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })
      const nowMs = 1_700_000_000_000
      const longSoftIso = new Date(nowMs + 45 * 60_000).toISOString()
      writeFileSync(
        join(piDir, "antigravity-accounts.json"),
        JSON.stringify({
          version: 4,
          accounts: [
            { email: "soft@x.com", refreshToken: "rt-s", projectId: "p1", addedAt: 1, lastUsed: 1, cachedQuota: { "gemini-pro": { remainingFraction: 0.1, resetTime: longSoftIso, modelCount: 1 } }, cachedQuotaUpdatedAt: nowMs - 10_000 },
            { email: "rl@x.com", refreshToken: "rt-r", projectId: "p2", addedAt: 2, lastUsed: 2, rateLimitResetTimes: { "gemini-antigravity": nowMs + 4_000 } },
            { email: "dis@x.com", refreshToken: "rt-d", projectId: "p3", addedAt: 3, lastUsed: 3, enabled: false, rateLimitResetTimes: { "gemini-antigravity": nowMs + 1_000 } },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )
      const pool = createPiAccountPool({
        homeDir: home, cwd, env: {}, now: () => nowMs, getVersion: () => "2.38.0",
        getConfig: () => ({ ...DEFAULT_SHARED_GUARD_CONFIG, proactive_token_refresh: false, soft_quota_threshold_percent: 70, max_rate_limit_wait_seconds: 10 }),
      })
      await pool.loadOrRefresh(cwd)
      const ask = () => pool.resolvePoolUnavailableOutcome({ modelId: "antigravity-gemini-4-carbon", fetch: globalThis.fetch, signal: new AbortController().signal })

      expect(await ask()).toEqual({ action: "wait-and-retry", waitMs: 4_000, kind: "rate-limit" })

      const mgr = pool.getManager()!
      mgr.updateQuotaCache("rt-s", { "gemini-pro": { remainingFraction: 0.1, resetTime: new Date(nowMs + 3_000).toISOString(), modelCount: 1 } })
      mgr.markRateLimited(mgr.getAccounts()[1]!, 120_000, "gemini", "antigravity", "antigravity-gemini-4-carbon")
      expect(await ask()).toEqual({ action: "wait-and-retry", waitMs: 3_000, kind: "soft-quota" })

      mgr.setAccountEnabled(0, false)
      delete mgr.getAccounts()[1]!.rateLimitResetTimes["gemini-antigravity"]
      delete mgr.getAccounts()[1]!.rateLimitResetTimes["gemini-antigravity:antigravity-gemini-4-carbon"]
      mgr.markAccountCoolingDown(mgr.getAccounts()[1]!, 60_000, "project-error")
      const cooldownRes = await ask()
      expect(cooldownRes).toMatchObject({ action: "error", error: { status: 503 } })
      if (cooldownRes.action === "error") expect(cooldownRes.error.message).not.toContain("rate-limited")
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
