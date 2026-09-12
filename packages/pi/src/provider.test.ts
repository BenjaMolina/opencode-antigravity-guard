import { describe, expect, it, vi } from "vitest"

import { registerAntigravityProvider } from "./provider.ts"

describe("Antigravity Guard provider registration", () => {
  it("registers exactly the synchronous text-only provider and bridges OAuth plus streaming", () => {
    const registerProvider = vi.fn()
    const pi = { registerProvider }

    registerAntigravityProvider(pi)

    expect(registerProvider).toHaveBeenCalledOnce()
    const [name, config] = registerProvider.mock.calls[0] ?? []
    expect(name).toBe("antigravity-guard")
    expect(config).toMatchObject({
      name: "Antigravity Guard",
      api: "antigravity-guard-sse",
      models: [{
        id: "antigravity-gemini-3.8-flash",
        name: "Gemini 3.8 Flash (Antigravity, text only)",
        reasoning: false,
        input: ["text"],
        contextWindow: 1_048_576,
        maxTokens: 65_536,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      }],
    })
    expect(config.oauth).toMatchObject({ name: "Antigravity Guard", isSubscription: true })
    expect(typeof config.oauth.login).toBe("function")
    expect(typeof config.oauth.refreshToken).toBe("function")
    expect(typeof config.oauth.getApiKey).toBe("function")
    expect(typeof config.streamSimple).toBe("function")
  })

  it("completes offline login, refresh, project resolution, and streamed text through registered boundaries", async () => {
    const registerProvider = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "login-access", refresh_token: "refresh-token", expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cloudaicompanionProject: "login-project" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "refreshed-access", expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cloudaicompanionProject: "stream-project" })))
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
        { id: "antigravity-gemini-3.8-flash", api: "antigravity-guard-sse", provider: "antigravity-guard", cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
        { messages: [{ role: "user", content: "Hello" }] },
        { apiKey: refreshed.access, fetch },
      )
      const events = []
      for await (const event of stream) events.push(event)

      expect(credentials).toMatchObject({ access: "login-access", refresh: "refresh-token" })
      expect(refreshed).toMatchObject({ access: "refreshed-access", refresh: "refresh-token" })
      expect(events.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
      expect(fetch.mock.calls).toHaveLength(5)
      expect(JSON.parse(String(fetch.mock.calls[4]?.[1]?.body))).toMatchObject({ project: "stream-project", model: "gemini-3.8-flash" })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("runs the registered stream through offline project and wire-model transport", async () => {
    const registerProvider = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ cloudaicompanionProject: "project-id" })))
      .mockResolvedValueOnce(new Response(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Hi" }] } }] } })}\n\ndata: ${JSON.stringify({ response: { candidates: [{ finishReason: "STOP" }] } })}\n\n`, { headers: { "Content-Type": "text/event-stream" } }))
    registerAntigravityProvider({ registerProvider })
    const [, config] = registerProvider.mock.calls[0] ?? []
    const stream = config.streamSimple(
      { id: "antigravity-gemini-3.8-flash", api: "antigravity-guard-sse", provider: "antigravity-guard", cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } },
      { messages: [{ role: "user", content: "Hello" }] },
      { apiKey: "access-token", fetch },
    )

    const events = []
    for await (const event of stream) events.push(event)

    expect(events.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body)).model).toBe("gemini-3.8-flash")
  })
})
