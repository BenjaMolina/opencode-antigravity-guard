import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import { generateFingerprint, loadSharedGuardConfig } from "@benjamolina/antigravity-guard-core"
import { createPiAccountPool } from "./accounts.ts"
import extension from "./extension.ts"

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex")
}

describe("Phase 2 Pi multi-account pool & commands regression probes (S3)", () => {
  it("B1: seeded auth.json placeholder never skips OAuth refresh after subsequent loadOrRefresh calls", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p2-probe-b1-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const opencodeDir = join(home, ".config", "opencode")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(opencodeDir, { recursive: true })
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      writeFileSync(
        join(piAgentDir, "auth.json"),
        JSON.stringify({ "github-copilot": { type: "oauth", refresh: "gh-r", access: "gh-a", expires: 9999999999999 } }),
        "utf8",
      )
      writeFileSync(
        join(opencodeDir, "antigravity-accounts.json"),
        JSON.stringify({
          version: 4,
          accounts: [{ email: "healthy@example.com", refreshToken: "ref-h", projectId: "proj-h", addedAt: 1, lastUsed: 1 }],
          activeIndex: 0,
        }),
        "utf8",
      )
      writeFileSync(join(opencodeDir, "antigravity.json"), JSON.stringify({ proactive_token_refresh: false }), "utf8")

      let refreshCalls = 0
      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const u = String(url)
        if (u.includes("oauth2.googleapis.com/token")) {
          refreshCalls += 1
          return new Response(JSON.stringify({ access_token: "acc-real", expires_in: 3600 }), { status: 200 })
        }
        const auth = new Request(u, init).headers.get("authorization")
        if (auth !== "Bearer acc-real") return new Response("unauthorized", { status: 401 })
        return new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        )
      })

      let providerCfg: any
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      const commands = new Map<string, any>()
      extension(
        {
          registerProvider: (_id: string, cfg: unknown) => { providerCfg = cfg },
          registerCommand: (name: string, spec: unknown) => { commands.set(name, spec) },
          sendMessage: () => {},
          on: (ev: string, fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => { if (ev === "session_start") onSessionStart = fn },
        } as never,
        { homeDir: home, cwd, env: { PI_OFFLINE: "1" }, fetch: fetchMock },
      )

      await onSessionStart?.({}, { cwd })
      await commands.get("antigravity-accounts").handler("", { cwd })

      const events = []
      for await (const ev of providerCfg.streamSimple(
        { ...providerCfg.models[0], api: providerCfg.api, provider: "antigravity-guard" },
        { messages: [{ role: "user", content: "Ping" }] },
        { apiKey: '{"token":"placeholder","projectId":"proj-h"}', fetch: fetchMock },
      )) {
        events.push(ev.type)
      }

      expect(refreshCalls).toBe(1)
      expect(events).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("B2: invalid_grant eviction and /antigravity-accounts remove <n> do not resurrect accounts from auth.json while preserving sibling providers", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p2-probe-b2-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      const authPath = join(piAgentDir, "auth.json")
      const poolPath = join(piAgentDir, "antigravity-accounts.json")
      writeFileSync(
        authPath,
        JSON.stringify({
          "github-copilot": { type: "oauth", refresh: "gh-r", access: "gh-a", expires: 9999999999999 },
          "antigravity-guard": { type: "oauth", refresh: "revoked-ref", access: "", expires: 0, email: "revoked@x.com", projectId: "p0" },
        }),
        "utf8",
      )
      writeFileSync(
        poolPath,
        JSON.stringify({
          version: 4,
          accounts: [
            { email: "revoked@x.com", refreshToken: "revoked-ref", projectId: "p0", addedAt: 1, lastUsed: 1 },
            { email: "keep@x.com", refreshToken: "keep-ref", projectId: "p1", addedAt: 2, lastUsed: 2 },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const u = String(url)
        if (u.includes("oauth2.googleapis.com/token")) {
          if (String(init?.body ?? "").includes("revoked-ref")) {
            return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
          }
          return new Response(JSON.stringify({ access_token: "acc-keep", expires_in: 3600 }), { status: 200 })
        }
        return new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        )
      })

      let providerCfg: any
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      const commands = new Map<string, any>()
      extension(
        {
          registerProvider: (_id: string, cfg: unknown) => { providerCfg = cfg },
          registerCommand: (name: string, spec: unknown) => { commands.set(name, spec) },
          sendMessage: () => {},
          on: (ev: string, fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => { if (ev === "session_start") onSessionStart = fn },
        } as never,
        { homeDir: home, cwd, env: { PI_OFFLINE: "1" }, fetch: fetchMock },
      )

      await onSessionStart?.({}, { cwd })
      for await (const _ev of providerCfg.streamSimple(
        { ...providerCfg.models[0], api: providerCfg.api, provider: "antigravity-guard" },
        { messages: [{ role: "user", content: "Hi" }] },
        { apiKey: '{"token":"p","projectId":"p0"}', fetch: fetchMock },
      )) {}

      // Reload via command: revoked-ref must NOT resurrect
      await commands.get("antigravity-accounts").handler("", { cwd })
      expect(JSON.parse(readFileSync(poolPath, "utf8")).accounts.map((a: any) => a.refreshToken)).toEqual(["keep-ref"])

      // Remove remaining account #1 and reload: must stay empty while preserving github-copilot in auth.json
      await commands.get("antigravity-accounts").handler("remove 1", { cwd })
      await commands.get("antigravity-accounts").handler("", { cwd })
      expect(JSON.parse(readFileSync(poolPath, "utf8")).accounts).toEqual([])
      expect(JSON.parse(readFileSync(authPath, "utf8"))["github-copilot"]).toBeDefined()
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("B2 (proactive refresh after reload): background invalid_grant after /antigravity-accounts remove <n> evicts from live manager without resurrecting deleted accounts", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p2-probe-b2-bg-"))
    try {
      const now = Date.now()
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      const authPath = join(piAgentDir, "auth.json")
      const poolPath = join(piAgentDir, "antigravity-accounts.json")
      writeFileSync(
        authPath,
        JSON.stringify({
          "github-copilot": { type: "oauth", refresh: "gh-r", access: "gh-a", expires: now + 9_999_999 },
          "antigravity-guard": {
            type: "oauth",
            refresh: "bg-revoked",
            access: "expiring-soon",
            expires: now + 5 * 60_000,
            email: "bg@x.com",
            projectId: "p0",
          },
        }),
        "utf8",
      )
      writeFileSync(
        poolPath,
        JSON.stringify({
          version: 4,
          accounts: [
            { email: "bg@x.com", refreshToken: "bg-revoked", projectId: "p0", addedAt: 1, lastUsed: 1, enabled: true },
            { email: "deleted@x.com", refreshToken: "deleted-ref", projectId: "p1", addedAt: 2, lastUsed: 2, enabled: true },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )
      writeFileSync(join(piAgentDir, "antigravity.json"), JSON.stringify({ proactive_token_refresh: true }), "utf8")

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const u = String(url)
        if (u.includes("latest-arm64-mac.yml")) return new Response("version: 2.9.1\n", { status: 200 })
        if (u.includes("oauth2.googleapis.com/token")) {
          if (String(init?.body ?? "").includes("bg-revoked")) {
            return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
          }
          return new Response(JSON.stringify({ access_token: "acc-ok", expires_in: 3600 }), { status: 200 })
        }
        return new Response("ok", { status: 200 })
      })

      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      let onShutdown: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      const commands = new Map<string, any>()
      extension(
        {
          registerProvider: () => {},
          registerCommand: (name: string, spec: unknown) => { commands.set(name, spec) },
          sendMessage: () => {},
          on: (ev: string, fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => {
            if (ev === "session_start") onSessionStart = fn
            if (ev === "session_shutdown") onShutdown = fn
          },
        } as never,
        { homeDir: home, cwd, env: {}, fetch: fetchMock },
      )

      await onSessionStart?.({}, { cwd })
      await commands.get("antigravity-accounts").handler("remove 2", { cwd })
      await new Promise((resolve) => setTimeout(resolve, 5_400))
      await onShutdown?.({}, { cwd })

      await commands.get("antigravity-accounts").handler("", { cwd })
      await onShutdown?.({}, { cwd })

      expect(JSON.parse(readFileSync(poolPath, "utf8")).accounts).toEqual([])
      const finalAuth = JSON.parse(readFileSync(authPath, "utf8"))
      expect(finalAuth["antigravity-guard"]).toBeUndefined()
      expect(finalAuth["github-copilot"]).toBeDefined()
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }, 15_000)

  it("B3: /antigravity-accounts and /antigravity-quota reject malformed/unknown args with warnings and keep disk files byte-identical", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p2-probe-b3-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      const authPath = join(piAgentDir, "auth.json")
      const poolPath = join(piAgentDir, "antigravity-accounts.json")
      const fp = generateFingerprint()
      writeFileSync(
        authPath,
        JSON.stringify({ "antigravity-guard": { type: "oauth", refresh: "r1", access: "a1", expires: Date.now() + 3_600_000 } }),
        "utf8",
      )
      writeFileSync(
        poolPath,
        JSON.stringify({
          version: 4,
          accounts: [
            { email: "1st@example.com", refreshToken: "r1", projectId: "p1", addedAt: 1, lastUsed: 1, enabled: true, fingerprint: fp },
            { email: "2nd@example.com", refreshToken: "r2", projectId: "p2", addedAt: 2, lastUsed: 2, enabled: true, fingerprint: fp },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )

      const commands = new Map<string, any>()
      extension(
        {
          registerProvider: () => {},
          registerCommand: (name: string, spec: unknown) => { commands.set(name, spec) },
          sendMessage: () => {},
          on: () => {},
        } as never,
        { homeDir: home, cwd, env: { PI_OFFLINE: "1" } },
      )

      for (const bad of ["enable", "disable", "remove", "remove 0", "remove -1", "remove abc", "remove 1.5", "remove 2fast@gmail.com", "remove 1 2", "delete 1"]) {
        const beforePool = sha256(poolPath)
        const beforeAuth = sha256(authPath)
        const warnings: string[] = []
        await commands.get("antigravity-accounts").handler(bad, {
          cwd,
          ui: { notify: (msg: string, level: string) => { if (level === "warning" || level === "error") warnings.push(msg) } },
        })
        expect(warnings.length, `expected warning for '${bad}'`).toBeGreaterThan(0)
        expect(sha256(poolPath), `pool mutated on '${bad}'`).toBe(beforePool)
        expect(sha256(authPath), `auth mutated on '${bad}'`).toBe(beforeAuth)
      }

      const quotaWarnings: string[] = []
      await commands.get("antigravity-quota").handler("--unexpected", {
        cwd,
        ui: { notify: (msg: string, level: string) => { if (level === "warning" || level === "error") quotaWarnings.push(msg) } },
      })
      expect(quotaWarnings.length).toBeGreaterThan(0)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("B4 & B6: Pi hybrid strategy skips rate-limited Gemini accounts, survives mid-request invalid_grant index shifts, and re-enables quarantined accounts on re-login", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p2-probe-b46-"))
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
            { email: "revoked@x.com", refreshToken: "r0", projectId: "p0", addedAt: 1, lastUsed: 1 },
            { email: "busy@x.com", refreshToken: "r1", projectId: "p1", addedAt: 2, lastUsed: 2 },
            { email: "auth401@x.com", refreshToken: "r2", projectId: "p2", addedAt: 3, lastUsed: 3 },
            { email: "healthy@x.com", refreshToken: "r3", projectId: "p3", addedAt: 4, lastUsed: 4, enabled: false, verificationRequired: true },
          ],
          activeIndex: 0,
          activeIndexByFamily: { claude: 0, gemini: 2 },
        }),
        "utf8",
      )
      writeFileSync(
        join(opencodeDir, "antigravity.json"),
        JSON.stringify({ account_selection_strategy: "hybrid", proactive_token_refresh: false }),
        "utf8",
      )

      let mode: "relogin-and-shift" | "all-429" = "relogin-and-shift"
      const streamCalls: string[] = []
      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const u = String(url)
        if (u.includes("oauth2.googleapis.com/token")) {
          const body = String(init?.body ?? "")
          if (body.includes("code=c1")) {
            return new Response(JSON.stringify({ access_token: "tok-r3-new", refresh_token: "r3-new", expires_in: 3600 }), { status: 200 })
          }
          if (body.includes("r0")) return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
          if (body.includes("r1")) return new Response(JSON.stringify({ access_token: "tok-r1", expires_in: 3600 }), { status: 200 })
          if (body.includes("r2")) return new Response(JSON.stringify({ access_token: "tok-r2", expires_in: 3600 }), { status: 200 })
          return new Response(JSON.stringify({ access_token: "tok-r3-new", expires_in: 3600 }), { status: 200 })
        }
        if (u.includes("userinfo")) return new Response(JSON.stringify({ email: "healthy@x.com" }), { status: 200 })
        if (u.includes("loadCodeAssist")) return new Response(JSON.stringify({ cloudaicompanionProject: "p3" }), { status: 200 })

        const auth = new Request(u, init).headers.get("authorization") ?? ""
        streamCalls.push(auth)
        if (mode === "all-429") {
          return new Response(JSON.stringify({ error: { message: "Quota exhausted" } }), { status: 429 })
        }
        if (auth === "Bearer tok-r2") return new Response("unauth", { status: 401 })
        if (auth === "Bearer tok-r1") return new Response(JSON.stringify({ error: { message: "Overloaded" } }), { status: 503 })
        return new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"WIN"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        )
      })

      let providerCfg: any
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      extension(
        {
          registerProvider: (_id: string, cfg: unknown) => { providerCfg = cfg },
          on: (ev: string, fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => { if (ev === "session_start") onSessionStart = fn },
        } as never,
        { homeDir: home, cwd, env: { PI_OFFLINE: "1" }, fetch: fetchMock, sleep: async () => undefined },
      )
      await onSessionStart?.({}, { cwd })

      // Re-login quarantined healthy@x.com -> must clear quarantine, enable account, and rotate r3 -> r3-new cleanly
      let authUrl = ""
      await providerCfg.oauth.login({
        onSelect: async () => "manual",
        onAuth: ({ url }: { url: string }) => { authUrl = url },
        onPrompt: async () => `http://localhost:51121/oauth-callback?code=c1&state=${new URL(authUrl).searchParams.get("state")}`,
        onDeviceCode: () => {},
      })

      const events = []
      for await (const ev of providerCfg.streamSimple(
        { ...providerCfg.models[0], api: providerCfg.api, provider: "antigravity-guard" },
        { messages: [{ role: "user", content: "Shift test" }] },
        { apiKey: '{"token":"p","projectId":"p0"}', fetch: fetchMock },
      )) {
        events.push(ev.type)
      }
      expect(events).toEqual(["start", "text_start", "text_delta", "text_end", "done"])

      // Now force all remaining accounts to hit 429 and confirm hybrid skips them during active cooldown
      mode = "all-429"
      for await (const _ev of providerCfg.streamSimple(
        { ...providerCfg.models[0], api: providerCfg.api, provider: "antigravity-guard" },
        { messages: [{ role: "user", content: "Exhaust all" }] },
        { apiKey: '{"token":"p","projectId":"p0"}', fetch: fetchMock },
      )) {}
      streamCalls.length = 0
      for await (const _ev of providerCfg.streamSimple(
        { ...providerCfg.models[0], api: providerCfg.api, provider: "antigravity-guard" },
        { messages: [{ role: "user", content: "During cooldown" }] },
        { apiKey: '{"token":"p","projectId":"p0"}', fetch: fetchMock },
      )) {}
      expect(streamCalls).toEqual([])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }, 60_000)

  it("B2 (mid-refresh reload + token rotation): /antigravity-accounts remove 2 during in-flight refresh syncs rotated token to auth.json and never resurrects old token on restart", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p2-probe-b2-mid-rot-"))
    try {
      const now = Date.now()
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      const authPath = join(piAgentDir, "auth.json")
      const poolPath = join(piAgentDir, "antigravity-accounts.json")
      writeFileSync(
        authPath,
        JSON.stringify({
          "github-copilot": { type: "oauth", refresh: "gh-r", access: "gh-a", expires: now + 9_999_999 },
          "antigravity-guard": {
            type: "oauth",
            refresh: "r1",
            access: "expiring-soon",
            expires: now + 5 * 60_000,
            email: "alice@x.com",
            projectId: "p1",
          },
        }),
        "utf8",
      )
      writeFileSync(
        poolPath,
        JSON.stringify({
          version: 4,
          accounts: [
            { email: "alice@x.com", refreshToken: "r1", projectId: "p1", addedAt: 1, lastUsed: 100, enabled: true },
            { email: "bob@x.com", refreshToken: "r2", projectId: "p2", addedAt: 2, lastUsed: 200, enabled: true },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )
      writeFileSync(join(piAgentDir, "antigravity.json"), JSON.stringify({ proactive_token_refresh: true }), "utf8")

      let markStarted!: () => void
      let releaseRefresh!: () => void
      const refreshStarted = new Promise<void>((r) => { markStarted = r })
      const refreshGate = new Promise<void>((r) => { releaseRefresh = r })

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url) => {
        const u = String(url)
        if (u.includes("latest-arm64-mac.yml")) return new Response("version: 2.9.1\n", { status: 200 })
        if (u.includes("oauth2.googleapis.com/token")) {
          markStarted()
          await refreshGate
          return new Response(
            JSON.stringify({ access_token: "fresh-alice", refresh_token: "r1-rotated", expires_in: 3600 }),
            { status: 200 },
          )
        }
        return new Response("ok", { status: 200 })
      })

      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      let onShutdown: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      const commands = new Map<string, any>()
      extension(
        {
          registerProvider: () => {},
          registerCommand: (name: string, spec: unknown) => { commands.set(name, spec) },
          sendMessage: () => {},
          on: (ev: string, fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => {
            if (ev === "session_start") onSessionStart = fn
            if (ev === "session_shutdown") onShutdown = fn
          },
        } as never,
        { homeDir: home, cwd, env: {}, fetch: fetchMock },
      )

      await onSessionStart?.({}, { cwd })
      await refreshStarted
      await commands.get("antigravity-accounts").handler("remove 2", { cwd })
      releaseRefresh()
      await new Promise((r) => setTimeout(r, 250))
      await onShutdown?.({}, { cwd })

      const savedPool = JSON.parse(readFileSync(poolPath, "utf8"))
      const savedAuth = JSON.parse(readFileSync(authPath, "utf8"))
      expect(savedPool.accounts.map((a: any) => a.refreshToken)).toEqual(["r1-rotated"])
      expect(savedAuth["github-copilot"]).toBeDefined()
      expect(savedAuth["antigravity-guard"].refresh).toBe("r1-rotated")

      const cfg = loadSharedGuardConfig({ homeDir: home, cwd, env: {} })
      const restartedPool = createPiAccountPool({
        homeDir: home,
        cwd,
        env: { PI_OFFLINE: "1" },
        fetch: fetchMock,
        getVersion: () => "2.9.1",
        getConfig: () => cfg,
      })
      const reloadedMgr = await restartedPool.loadOrRefresh(cwd)
      expect(reloadedMgr.getAccounts().map((a) => a.parts.refreshToken)).toEqual(["r1-rotated"])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }, 15_000)

  it("B2 (mid-batch reload across multiple accounts): removing account #1 or #3 during batch iteration 1 updates live manager for remaining accounts and skips deleted accounts", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p2-probe-b2-batch-"))
    try {
      const now = Date.now()
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      const authPath = join(piAgentDir, "auth.json")
      const poolPath = join(piAgentDir, "antigravity-accounts.json")
      writeFileSync(
        authPath,
        JSON.stringify({
          "github-copilot": { type: "oauth", refresh: "gh-r", access: "gh-a", expires: now + 9_999_999 },
          "antigravity-guard": {
            type: "oauth",
            refresh: "r1",
            access: "exp1",
            expires: now + 5 * 60_000,
            email: "alice@x.com",
            projectId: "p1",
          },
        }),
        "utf8",
      )
      writeFileSync(
        poolPath,
        JSON.stringify({
          version: 4,
          accounts: [
            { email: "alice@x.com", refreshToken: "r1", projectId: "p1", addedAt: 1, lastUsed: 100, enabled: true },
            { email: "bob@x.com", refreshToken: "r2", projectId: "p2", addedAt: 2, lastUsed: 200, enabled: true },
            { email: "carol@x.com", refreshToken: "r3", projectId: "p3", addedAt: 3, lastUsed: 300, enabled: true },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )
      writeFileSync(join(piAgentDir, "antigravity.json"), JSON.stringify({ proactive_token_refresh: true }), "utf8")

      let markFirstStarted!: () => void
      let releaseFirst!: () => void
      const firstStarted = new Promise<void>((r) => { markFirstStarted = r })
      const firstGate = new Promise<void>((r) => { releaseFirst = r })
      const oauthBodies: string[] = []

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const u = String(url)
        if (u.includes("oauth2.googleapis.com/token")) {
          const body = String(init?.body ?? "")
          oauthBodies.push(body)
          if (body.includes("r1")) {
            markFirstStarted()
            await firstGate
            return new Response(JSON.stringify({ access_token: "fresh-1", refresh_token: "r1-rot", expires_in: 3600 }), { status: 200 })
          }
          if (body.includes("r2")) {
            return new Response(JSON.stringify({ access_token: "fresh-2", refresh_token: "r2-rot", expires_in: 3600 }), { status: 200 })
          }
          return new Response(JSON.stringify({ access_token: "fresh-3", refresh_token: "r3-rot", expires_in: 3600 }), { status: 200 })
        }
        return new Response("ok", { status: 200 })
      })

      const cfg = loadSharedGuardConfig({ homeDir: home, cwd, env: {} })
      const pool = createPiAccountPool({
        homeDir: home,
        cwd,
        env: {},
        fetch: fetchMock,
        getVersion: () => "2.9.1",
        getConfig: () => cfg,
      })

      const m1 = await pool.loadOrRefresh(cwd)
      for (const acc of m1.getAccounts()) {
        acc.access = "expiring"
        acc.expires = now + 5 * 60_000
      }

      await firstStarted
      // Remove #3 (carol, queued later in batch) and #1 (alice, in-flight), keeping only #2 (bob -> now index 0)
      await pool.removeAccountByIndex(2, cwd)
      await pool.removeAccountByIndex(0, cwd)
      releaseFirst()
      await new Promise((r) => setTimeout(r, 300))
      pool.stopBackgroundRefresh()

      expect(oauthBodies.some((b) => b.includes("r3"))).toBe(false)
      const liveAccounts = pool.getManager()!.getAccounts()
      expect(liveAccounts.map((a) => a.parts.refreshToken)).toEqual(["r2-rot"])
      expect(liveAccounts[0]?.access).toBe("fresh-2")
      expect(JSON.parse(readFileSync(poolPath, "utf8")).accounts.map((a: any) => a.refreshToken)).toEqual(["r2-rot"])
      const savedAuth = JSON.parse(readFileSync(authPath, "utf8"))
      expect(savedAuth["github-copilot"]).toBeDefined()
      expect(savedAuth["antigravity-guard"].refresh).toBe("r2-rot")
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  }, 15_000)

  it("R1-1 / R3-2 / R4-1: external OpenCode eviction or refresh-token rotation never resurrects evicted accounts or clobbers rotated tokens from auth.json", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p2-probe-r11-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const opencodeDir = join(home, ".config", "opencode")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(opencodeDir, { recursive: true })
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })
      const poolPath = join(opencodeDir, "antigravity-accounts.json")
      const authPath = join(piAgentDir, "auth.json")
      writeFileSync(poolPath, JSON.stringify({ version: 4, accounts: [{ email: "shared@x.com", refreshToken: "r-initial", projectId: "p1", addedAt: 1, lastUsed: 1 }], activeIndex: 0 }), "utf8")
      writeFileSync(join(opencodeDir, "antigravity.json"), JSON.stringify({ proactive_token_refresh: false }), "utf8")

      const cfg = loadSharedGuardConfig({ homeDir: home, cwd, env: { PI_OFFLINE: "1" } })
      const makePool = () => createPiAccountPool({ homeDir: home, cwd, env: { PI_OFFLINE: "1" }, getVersion: () => "2.9.1", getConfig: () => cfg })
      await makePool().loadOrRefresh(cwd)

      // External OpenCode rotates refresh token while auth.json holds stale r-initial with unexpired access
      writeFileSync(authPath, JSON.stringify({ "antigravity-guard": { type: "oauth", refresh: "r-initial", access: "stale-access", expires: Date.now() + 3_600_000, email: "shared@x.com", projectId: "p1" } }), "utf8")
      writeFileSync(poolPath, JSON.stringify({ version: 4, accounts: [{ email: "shared@x.com", refreshToken: "r-rotated-by-opencode", projectId: "p1", addedAt: 1, lastUsed: 20 }], activeIndex: 0 }), "utf8")

      const pool2 = makePool()
      const mgrAfterRotate = await pool2.loadOrRefresh(cwd)
      expect(mgrAfterRotate.getAccounts().map((a) => a.parts.refreshToken)).toEqual(["r-rotated-by-opencode"])
      expect(JSON.parse(readFileSync(authPath, "utf8"))["antigravity-guard"].refresh).toBe("r-rotated-by-opencode")

      // External OpenCode evicts the last account -> Pi must NOT resurrect it
      writeFileSync(poolPath, JSON.stringify({ version: 4, accounts: [], activeIndex: 0 }), "utf8")
      const mgrAfterEvict = await pool2.loadOrRefresh(cwd)
      expect(mgrAfterEvict.getAccounts()).toEqual([])
      expect(JSON.parse(readFileSync(poolPath, "utf8")).accounts).toEqual([])
      expect(JSON.parse(readFileSync(authPath, "utf8"))["antigravity-guard"]).toBeUndefined()
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("R3-1 / R4-2: cancelling AbortSignal during acquireCredentials OAuth refresh aborts cleanly without cooling down expired accounts", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-p2-probe-r31-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })
      writeFileSync(join(piAgentDir, "antigravity-accounts.json"), JSON.stringify({ version: 4, accounts: [{ email: "a1@x.com", refreshToken: "r1", projectId: "p1", addedAt: 1, lastUsed: 1 }, { email: "a2@x.com", refreshToken: "r2", projectId: "p2", addedAt: 2, lastUsed: 2 }], activeIndex: 0 }), "utf8")
      writeFileSync(join(piAgentDir, "antigravity.json"), JSON.stringify({ proactive_token_refresh: false }), "utf8")

      let oauthCalls = 0
      const abortCtrl = new AbortController()
      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
        if (String(url).includes("oauth2.googleapis.com/token")) {
          oauthCalls += 1
          abortCtrl.abort()
          init?.signal?.throwIfAborted()
        }
        return new Response("ok", { status: 200 })
      })

      let providerCfg: any
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      extension({ registerProvider: (_id: string, cfg: unknown) => { providerCfg = cfg }, on: (ev: string, fn: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => { if (ev === "session_start") onSessionStart = fn } } as never, { homeDir: home, cwd, env: { PI_OFFLINE: "1" }, fetch: fetchMock })
      await onSessionStart?.({}, { cwd })

      const events: any[] = []
      for await (const ev of providerCfg.streamSimple({ ...providerCfg.models[0], api: providerCfg.api, provider: "antigravity-guard" }, { messages: [{ role: "user", content: "Abort during refresh" }] }, { apiKey: '{"token":"p","projectId":"p1"}', fetch: fetchMock, signal: abortCtrl.signal })) {
        events.push(ev)
      }
      expect(oauthCalls).toBe(1)
      expect(events.at(-1)).toMatchObject({ type: "error", reason: "aborted" })

      const okFetch = vi.fn<typeof globalThis.fetch>(async (url) =>
        String(url).includes("oauth2.googleapis.com/token")
          ? new Response(JSON.stringify({ access_token: "acc-ok", expires_in: 3600 }), { status: 200 })
          : new Response('data: {"response":{"candidates":[{"content":{"parts":[{"text":"RECOVERED"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n', { headers: { "Content-Type": "text/event-stream" } }),
      )
      const followUpTypes: string[] = []
      for await (const ev of providerCfg.streamSimple({ ...providerCfg.models[0], api: providerCfg.api, provider: "antigravity-guard" }, { messages: [{ role: "user", content: "Follow up" }] }, { apiKey: '{"token":"p","projectId":"p1"}', fetch: okFetch })) {
        followUpTypes.push(ev.type)
      }
      expect(followUpTypes).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
