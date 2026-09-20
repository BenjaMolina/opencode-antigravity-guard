import { readFileSync } from "node:fs"

import { describe, expect, it, vi } from "vitest"

import { listCatalogEntries, resolveGenerationSelection } from "./catalog.ts"
import { parseProviderApiKey, registerAntigravityProvider } from "./provider.ts"

function providerModel() {
  return { id: "antigravity-gemini-3.8-flash", api: "antigravity-guard-sse", provider: "antigravity-guard", cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }
}

describe("Antigravity Guard provider registration", () => {
  it("registers exactly the synchronous text-only provider with the daily base URL and OAuth-stream bridges", () => {
    const registerProvider = vi.fn()
    const pi = { registerProvider }

    registerAntigravityProvider(pi)

    expect(registerProvider).toHaveBeenCalledOnce()
    const [name, config] = registerProvider.mock.calls[0] ?? []
    expect(name).toBe("antigravity-guard")
    expect(config).toMatchObject({
      name: "Antigravity Guard",
      baseUrl: "https://daily-cloudcode-pa.sandbox.googleapis.com",
      api: "antigravity-guard-sse",
    })
    expect(config.models).toHaveLength(7)
    expect(config.models.map((model: { id: string }) => model.id)).toEqual([
      "antigravity-gemini-3.8-flash",
      "antigravity-gemini-3.7-flash",
      "antigravity-gemini-3.6-flash",
      "antigravity-gemini-3.1-pro",
          "antigravity-claude-sonnet-4.6",
          "antigravity-claude-opus-4.6-thinking",
          "antigravity-gpt-oss-120b",
    ])
    expect(config.models[0]?.id).toBe("antigravity-gemini-3.8-flash")
    expect(config.models[0]?.thinkingLevelMap).toEqual({ minimal: null, low: "low", medium: "medium", high: "high" })
    expect(config.oauth).toMatchObject({ name: "Antigravity Guard", isSubscription: true })
    expect(typeof config.oauth.login).toBe("function")
    expect(typeof config.oauth.refreshToken).toBe("function")
    expect(typeof config.oauth.getApiKey).toBe("function")
    expect(typeof config.streamSimple).toBe("function")
  })

  it("documents the exact tool admission for every catalog row", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8")

    expect(readme).toContain("| Public ID | Exposed Pi levels | Tool state | Admission |")
    for (const entry of listCatalogEntries()) {
      const routes = Object.keys(entry.routes)
      const state = resolveGenerationSelection(entry, routes[0]).tools
      expect(state.state).toBe("enabled")
      const prefix = entry.publicId.replace("antigravity-", "")
      expect(readme).toContain(`| \`${entry.publicId}\` | ${routes.join(", ")} | Enabled (${routes.join(", ")}) | pi-json-tool-loop/${prefix}-off-v1 |`)
    }
    expect(readme).toContain("`AUTO`")
    expect(readme).toContain("`NONE`")
    expect(readme).toContain("`fixture-qualified` route remains disabled for ordinary tool use")
  })

  it("rejects tool-bearing contexts before fetch when model is unregistered", async () => {
    const registerProvider = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>()

    registerAntigravityProvider({ registerProvider })
    const [, config] = registerProvider.mock.calls[0] ?? []
    const disabledModel = { ...config.models[0], id: "unregistered-disabled-model" }
    const stream = config.streamSimple(
      disabledModel,
      {
        messages: [{ role: "user", content: "Hello" }],
        tools: [{ name: "read_file", description: "Read a file", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }],
      },
      { apiKey: '{"token":"stored-access","projectId":"stored-project"}', fetch },
    )
    const events = []
    for await (const event of stream) events.push(event)
    expect(events.map((event) => event.type)).toEqual(["start", "error"])
    expect(fetch).not.toHaveBeenCalled()
  })

  it("keeps every registered descriptor appropriately multimodal and zero-cost", () => {
    const registerProvider = vi.fn()

    registerAntigravityProvider({ registerProvider })

    const [, config] = registerProvider.mock.calls[0] ?? []
    for (const model of config.models) {
      const expectedInput = model.id.startsWith("antigravity-gemini-") || model.id.includes("claude") ? ["text", "image"] : ["text"]
      expect(model.input).toEqual(expectedInput)
      expect(model.cost).toEqual({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 })
    }
  })

  it("completes offline login, best-effort project persistence, refresh, and streamed text through registered boundaries", async () => {
    const registerProvider = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "login-access", refresh_token: "refresh-token", expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: "alice@example.com" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cloudaicompanionProject: "login-project" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "refreshed-access", expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Hello" }] } }] } })}\n\ndata: ${JSON.stringify({ response: { candidates: [{ finishReason: "STOP" }] } })}\n\n`, { headers: { "Content-Type": "text/event-stream" } }))
    let authorizationUrl = ""
    vi.stubGlobal("fetch", fetch)

    try {
      registerAntigravityProvider({ registerProvider })
      const [, config] = registerProvider.mock.calls[0] ?? []
      const credentials = await config.oauth.login({
        onSelect: async () => "manual",
        onAuth: ({ url }: { url: string }) => { authorizationUrl = url },
        onPrompt: async () => {
          const state = new URL(authorizationUrl).searchParams.get("state")
          return `http://localhost:51121/oauth-callback?code=login-code&state=${state}`
        },
      })
      const refreshed = await config.oauth.refreshToken(credentials, new AbortController().signal)
      const stream = config.streamSimple(
        providerModel(),
        { messages: [{ role: "user", content: "Hello" }] },
        { apiKey: config.oauth.getApiKey(refreshed), fetch },
      )
      const events = []
      for await (const event of stream) events.push(event)

      expect(credentials).toMatchObject({ access: "login-access", refresh: "refresh-token", projectId: "login-project", email: "alice@example.com" })
      expect(refreshed).toMatchObject({ access: "refreshed-access", refresh: "refresh-token", projectId: "login-project", email: "alice@example.com" })
      expect(events.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
      expect(fetch.mock.calls).toHaveLength(5)
      expect(JSON.parse(String(fetch.mock.calls[4]?.[1]?.body))).toMatchObject({ project: "login-project", model: "gemini-3.8-flash-low" })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("passes the parsed token and stored project directly to the exact wire-model stream", async () => {
    const registerProvider = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
      'data: {"response":{"candidates":[{"content":{"parts":[{"text":"Hi"}]}}]}}\n\ndata: {"response":{"candidates":[{"finishReason":"STOP"}]}}\n\n',
      { headers: { "Content-Type": "text/event-stream" } },
    ))
    registerAntigravityProvider({ registerProvider })
    const [, config] = registerProvider.mock.calls[0] ?? []
    const stream = config.streamSimple(
      providerModel(),
      { messages: [{ role: "user", content: "Hello" }] },
      { apiKey: '{"token":"stored-access","projectId":"stored-project"}', fetch },
    )

    const events = []
    for await (const event of stream) events.push(event)
    expect(events.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer stored-access" })
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({ project: "stored-project", model: "gemini-3.8-flash-low" })
  })

  it("parses exactly the credential token and project at the provider boundary", () => {
    expect(parseProviderApiKey('{"token":"access","projectId":"saved-project"}')).toEqual({ token: "access", projectId: "saved-project" })
    for (const value of ["", "access", "{}", '{"token":"","projectId":"project"}', '{"token":"access"}', '{"token":"access","projectId":"project","extra":true}']) {
      expect(() => parseProviderApiKey(value)).toThrow("Antigravity credentials are invalid. Run /login antigravity-guard.")
    }
  })

  it("rejects malformed credentials before any stream network request", async () => {
    const registerProvider = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>()
    registerAntigravityProvider({ registerProvider })
    const [, config] = registerProvider.mock.calls[0] ?? []
    const stream = config.streamSimple(
      providerModel(),
      { messages: [{ role: "user", content: "Hello" }] },
      { apiKey: "access", fetch },
    )

    const events = []
    for await (const event of stream) events.push(event)
    expect(events.map((event) => event.type)).toEqual(["start", "error"])
    expect(fetch).not.toHaveBeenCalled()
  })
})
