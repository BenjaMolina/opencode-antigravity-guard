import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import extension from "./extension.ts"

describe("Phase 2 Pi shared multi-account pool, hybrid rotation, and commands", () => {
  it("shares ~/.config/opencode/antigravity-accounts.json, seeds ~/.pi/agent/auth.json non-destructively, rotates accounts, evicts invalid_grant, and quarantines 403 validation_required", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-guard-p2-pool-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const opencodeDir = join(home, ".config", "opencode")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(opencodeDir, { recursive: true })
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      // Existing sibling provider in ~/.pi/agent/auth.json must survive untouched
      const authJsonPath = join(piAgentDir, "auth.json")
      writeFileSync(
        authJsonPath,
        JSON.stringify({ "github-copilot": { type: "oauth", refresh: "gh-ref", access: "gh-acc", expires: 9999999999999 } }),
        "utf8",
      )

      // Shared OpenCode pool with 3 accounts (Account 0 has revoked refresh token, Account 1 hits 403 validation_required, Account 2 succeeds)
      const accountsPath = join(opencodeDir, "antigravity-accounts.json")
      writeFileSync(
        accountsPath,
        JSON.stringify({
          version: 4,
          accounts: [
            { email: "revoked@example.com", refreshToken: "ref-revoked", projectId: "proj-0", addedAt: 1, lastUsed: 1 },
            { email: "verify@example.com", refreshToken: "ref-verify", projectId: "proj-1", addedAt: 2, lastUsed: 2 },
            { email: "healthy@example.com", refreshToken: "ref-healthy", projectId: "proj-2", addedAt: 3, lastUsed: 3 },
          ],
          activeIndex: 0,
        }),
        "utf8",
      )
      writeFileSync(
        join(opencodeDir, "antigravity.json"),
        JSON.stringify({ account_selection_strategy: "sticky", proactive_token_refresh: false }),
        "utf8",
      )

      const fetchMock = vi.fn<typeof globalThis.fetch>(async (url, init) => {
        const u = String(url)
        if (u.includes("latest-arm64-mac.yml")) {
          return new Response("version: 2.41.0\n", { status: 200 })
        }
        if (u.includes("oauth2.googleapis.com/token")) {
          const body = String(init?.body ?? "")
          if (body.includes("ref-revoked")) {
            return new Response(JSON.stringify({ error: "invalid_grant", error_description: "Token has been revoked" }), {
              status: 400,
            })
          }
          if (body.includes("ref-verify")) {
            return new Response(JSON.stringify({ access_token: "acc-verify", expires_in: 3600 }), { status: 200 })
          }
          return new Response(JSON.stringify({ access_token: "acc-healthy", expires_in: 3600 }), { status: 200 })
        }
        const authHeader = new Request(u, init).headers.get("authorization")
        if (authHeader === "Bearer acc-verify") {
          return new Response(
            JSON.stringify({
              error: {
                message: "Account validation_required",
                details: [{ verify_url: "https://accounts.google.com/signin/continue?plt=xyz" }],
              },
            }),
            { status: 403 },
          )
        }
        return new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"ROTATED_OK"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        )
      })

      const registerProvider = vi.fn()
      const commands = new Map<string, { description: string; handler: (args: string, ctx: unknown) => Promise<void> }>()
      const sentMessages: Array<{ customType: string; content: string }> = []
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined

      extension(
        {
          registerProvider,
          registerCommand: (name: string, spec: { description: string; handler: (args: string, ctx: unknown) => Promise<void> }) => {
            commands.set(name, spec)
          },
          sendMessage: (msg: { customType: string; content: string }) => {
            sentMessages.push(msg)
          },
          on: (event: string, handler: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => {
            if (event === "session_start") onSessionStart = handler
          },
        } as never,
        { homeDir: home, cwd, env: {}, fetch: fetchMock },
      )

      expect(commands.has("antigravity-accounts")).toBe(true)
      expect(commands.has("antigravity-quota")).toBe(true)

      await onSessionStart?.({}, { cwd })

      // ~/.pi/agent/auth.json was seeded non-destructively while keeping github-copilot
      expect(existsSync(authJsonPath)).toBe(true)
      const seededAuth = JSON.parse(readFileSync(authJsonPath, "utf8")) as Record<string, unknown>
      expect(seededAuth["github-copilot"]).toBeDefined()
      expect(seededAuth["antigravity-guard"]).toMatchObject({ type: "oauth" })

      const [, providerCfg] = registerProvider.mock.calls[0] ?? []
      const events = []
      for await (const ev of providerCfg.streamSimple(
        { ...providerCfg.models[0], api: providerCfg.api, provider: "antigravity-guard" },
        { messages: [{ role: "user", content: "Test pool rotation" }] },
        { apiKey: '{"token":"placeholder","projectId":"proj-0"}', fetch: fetchMock },
      )) {
        events.push(ev)
      }

      expect(events.map((e) => e.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])

      // Disk pool reflects: revoked@example.com evicted via replace, verify@example.com quarantined, healthy@example.com active
      const persistedPool = JSON.parse(readFileSync(accountsPath, "utf8")) as {
        accounts: Array<{ email?: string; enabled?: boolean; verificationRequired?: boolean; verificationUrl?: string }>
      }
      expect(persistedPool.accounts.map((a) => a.email)).toEqual(["verify@example.com", "healthy@example.com"])
      expect(persistedPool.accounts[0]?.verificationRequired).toBe(true)
      expect(persistedPool.accounts[0]?.enabled).toBe(false)
      expect(persistedPool.accounts[0]?.verificationUrl).toBe("https://accounts.google.com/signin/continue?plt=xyz")
      expect(persistedPool.accounts[1]?.enabled).toBe(true)

      // Execute /antigravity-accounts and /antigravity-quota commands
      const notifications: string[] = []
      await commands.get("antigravity-accounts")?.handler("", {
        cwd,
        hasUI: false,
        ui: { notify: (msg: string) => notifications.push(msg) },
      })
      expect(sentMessages.some((m) => m.customType === "antigravity-accounts" && m.content.includes("healthy@example.com"))).toBe(true)

      await commands.get("antigravity-quota")?.handler("", {
        cwd,
        hasUI: false,
        ui: { notify: (msg: string) => notifications.push(msg) },
      })
      expect(sentMessages.some((m) => m.customType === "antigravity-quota")).toBe(true)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("imports standalone ~/.pi/agent/auth.json credentials into ~/.pi/agent/antigravity-accounts.json when OpenCode is absent", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "pi-guard-p2-standalone-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const piAgentDir = join(home, ".pi", "agent")
      mkdirSync(piAgentDir, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      writeFileSync(
        join(piAgentDir, "auth.json"),
        JSON.stringify({
          "antigravity-guard": {
            type: "oauth",
            refresh: "standalone-ref",
            access: "standalone-acc",
            expires: Date.now() + 3_600_000,
            projectId: "standalone-proj",
            email: "solo@example.com",
          },
        }),
        "utf8",
      )

      const registerProvider = vi.fn()
      let onSessionStart: ((event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) | undefined
      extension(
        {
          registerProvider,
          on: (event: string, handler: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void) => {
            if (event === "session_start") onSessionStart = handler
          },
        } as never,
        { homeDir: home, cwd, env: { PI_OFFLINE: "1" } },
      )

      await onSessionStart?.({}, { cwd })

      const standalonePoolPath = join(piAgentDir, "antigravity-accounts.json")
      expect(existsSync(standalonePoolPath)).toBe(true)
      const pool = JSON.parse(readFileSync(standalonePoolPath, "utf8")) as {
        accounts: Array<{ email?: string; refreshToken: string; projectId?: string }>
      }
      expect(pool.accounts).toHaveLength(1)
      expect(pool.accounts[0]).toMatchObject({
        email: "solo@example.com",
        refreshToken: "standalone-ref",
        projectId: "standalone-proj",
      })
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
