import { describe, expect, it, vi } from "vitest"

import { defaultProjectId, resolveLoginProject } from "./project.ts"

const userInfoEndpoint = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json"
const origins = [
  "https://daily-cloudcode-pa.googleapis.com",
  "https://daily-cloudcode-pa.sandbox.googleapis.com",
  "https://cloudcode-pa.googleapis.com",
]
const loadEndpoints = origins.map((origin) => `${origin}/v1internal:loadCodeAssist`)
const listEndpoints = origins.map((origin) => `${origin}/v1internal:listCloudAICompanionProjects`)
const antigravityHeaders = {
  Authorization: "Bearer access-token",
  "Content-Type": "application/json",
  "User-Agent": "antigravity/cli/1.1.23 (aidev_client; os_type=linux; arch=amd64; cl=974125021; auth_method=consumer)",
}

function requestOptions(fetch: typeof globalThis.fetch, overrides: Record<string, unknown> = {}) {
  return { accessToken: "access-token", fetch, now: () => 1_000, platform: "win32", ...overrides }
}

describe("Pi credential project discovery", () => {
  it("creates the stable version-five fallback from an email or fixed seed", () => {
    expect(defaultProjectId("alice@example.com")).toBe("13c821e6-cafb-50d3-8763-52400fc585ad")
    expect(defaultProjectId("antigravity-default")).toBe("5cbbac7c-3afc-5af4-bd2d-c3fc22ff9d54")
  })

  it("reads user email first, then sends the exact fixed loadCodeAssist request headers and body", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: "alice@example.com" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cloudaicompanionProject: "managed-project" })))

    await expect(resolveLoginProject(requestOptions(fetch))).resolves.toEqual({ email: "alice@example.com", projectId: "managed-project" })
    expect(fetch).toHaveBeenNthCalledWith(1, userInfoEndpoint, expect.objectContaining({
      method: "GET",
      redirect: "error",
      headers: { Authorization: "Bearer access-token" },
    }))
    expect(fetch).toHaveBeenNthCalledWith(2, loadEndpoints[0], expect.objectContaining({
      method: "POST",
      redirect: "error",
      headers: antigravityHeaders,
      body: JSON.stringify({ metadata: { ideType: "ANTIGRAVITY" } }),
    }))
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain(expect.stringContaining("onboardUser"))
  })

  it.each([
    [{ cloudaicompanionProject: "direct-project" }, "direct-project"],
    [{ response: { cloudaicompanionProject: { id: "nested-project" } } }, "nested-project"],
    [{ projects: [{ cloudaicompanionProject: "list-project" }] }, "list-project"],
  ])("extracts projects recursively from supported direct, nested, and list payload shapes", async (payload, projectId) => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)))

    await expect(resolveLoginProject(requestOptions(fetch, { platform: "linux" }))).resolves.toEqual({ projectId })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("switches to ordered list discovery after the first successful load without a project", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: {} })))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }))
      .mockRejectedValueOnce(new Error("transport"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ projects: [{ cloudaicompanionProject: { id: "listed-project" } }] })))

    await expect(resolveLoginProject(requestOptions(fetch))).resolves.toEqual({ projectId: "listed-project" })
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([userInfoEndpoint, loadEndpoints[0], ...listEndpoints])
    for (const call of fetch.mock.calls.slice(2)) {
      expect(call[1]).toEqual(expect.objectContaining({ method: "POST", redirect: "error", headers: antigravityHeaders, body: "{}" }))
    }
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain(loadEndpoints[1])
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain(expect.stringContaining("onboardUser"))
  })

  it("continues fixed load endpoints after non-OK and transport failures before list discovery", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }))
      .mockRejectedValueOnce(new Error("transport"))
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response("denied", { status: 403 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: { cloudaicompanionProject: "final-project" } })))

    await expect(resolveLoginProject(requestOptions(fetch))).resolves.toEqual({ projectId: "final-project" })
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([userInfoEndpoint, ...loadEndpoints, ...listEndpoints])
  })

  it("does not cache or reuse discovery across access tokens", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cloudaicompanionProject: "first-project" })))
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cloudaicompanionProject: "second-project" })))
    await expect(resolveLoginProject(requestOptions(fetch, { accessToken: "first-access" }))).resolves.toEqual({ projectId: "first-project" })
    await expect(resolveLoginProject(requestOptions(fetch, { accessToken: "second-access" }))).resolves.toEqual({ projectId: "second-project" })
    expect(fetch).toHaveBeenNthCalledWith(2, loadEndpoints[0], expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer first-access" }) }))
    expect(fetch).toHaveBeenNthCalledWith(4, loadEndpoints[0], expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer second-access" }) }))
  })

  it.each([
    [],
    {},
    { cloudaicompanionProject: " " },
    { cloudaicompanionProject: {} },
    { cloudaicompanionProject: { id: "" } },
    { cloudaicompanionProject: { id: 1 } },
  ])("returns no project for malformed discovery payloads: %j", async (payload) => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response("{}"))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)))
    await expect(resolveLoginProject(requestOptions(fetch))).resolves.toEqual({})
  })

  it("returns no discovery values when user info and every fixed project read fail", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("CANARY"))

    await expect(resolveLoginProject(requestOptions(fetch))).resolves.toEqual({})
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it("redacts malformed, access-denied, and transport discovery failures", async () => {
    const canary = "CANARY-project-access-token"
    for (const response of [
      new Response("not-json"),
      new Response(canary, { status: 302, headers: { Location: "https://example.test" } }),
      new Response(canary, { status: 401 }),
      new Response(canary, { status: 403 }),
    ]) {
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response)
      await expect(resolveLoginProject(requestOptions(fetch))).resolves.toEqual({})
    }
    const transport = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error(canary))
    await expect(resolveLoginProject(requestOptions(transport))).resolves.toEqual({})
  })

  it("bounds oversized discovery bodies and cancels their readers", async () => {
    const cancel = vi.fn()
    const oversized = () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(64 * 1024 + 1))) },
      cancel,
    }))
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(oversized())
      .mockResolvedValueOnce(oversized())
      .mockResolvedValueOnce(oversized())
      .mockResolvedValueOnce(oversized())

    await expect(resolveLoginProject(requestOptions(fetch))).resolves.toEqual({})
    expect(cancel).toHaveBeenCalledTimes(4)
  })

  it("normalizes forged dependency errors from fetch and body reads", async () => {
    const canary = "CANARY-forged-project-error"
    const readerFailure = new Response("valid")
    vi.spyOn(readerFailure.body!, "getReader").mockImplementation(() => { throw new Error(canary) })
    const failures = [
      vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error(canary)),
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
        pull(controller) { controller.error(new Error(canary)) },
      }))),
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(readerFailure),
    ]

    for (const fetch of failures) await expect(resolveLoginProject(requestOptions(fetch))).resolves.toEqual({})
  })

  it("returns best-effort empty discovery when aborted before or during fetch and body reads", async () => {
    const before = new AbortController()
    before.abort()
    const noFetch = vi.fn<typeof globalThis.fetch>()
    await expect(resolveLoginProject(requestOptions(noFetch, { signal: before.signal }))).resolves.toEqual({})
    expect(noFetch).not.toHaveBeenCalled()

    const fetching = new AbortController()
    const duringFetch = resolveLoginProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockImplementation((_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
      })),
      { signal: fetching.signal },
    ))
    await Promise.resolve()
    fetching.abort()
    await expect(duringFetch).resolves.toEqual({})

    const reading = new AbortController()
    const duringBody = resolveLoginProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start() {} }))),
      { signal: reading.signal },
    ))
    reading.abort()
    await expect(duringBody).resolves.toEqual({})
  })

  it("honors an injected deadline without making discovery mandatory", async () => {
    const noFetch = vi.fn<typeof globalThis.fetch>()
    await expect(resolveLoginProject(requestOptions(noFetch, { deadlineMs: 1_000 }))).resolves.toEqual({})
    expect(noFetch).not.toHaveBeenCalled()

    const pendingFetch = resolveLoginProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockImplementation((_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })
      })),
      { deadlineMs: 1_001 },
    ))
    await expect(pendingFetch).resolves.toEqual({})
  })
})
