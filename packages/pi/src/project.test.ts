import { describe, expect, it, vi } from "vitest"

import { ProjectHttpError, loadCodeAssistProject } from "./project.ts"

const endpoint = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist"

function requestOptions(fetch: typeof globalThis.fetch, overrides: Record<string, unknown> = {}) {
  return { accessToken: "access-token", fetch, now: () => 1_000, platform: "win32", ...overrides }
}

describe("Pi loadCodeAssist project resolution", () => {
  it("posts fixed Windows metadata and headers before accepting a string project", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ cloudaicompanionProject: "managed-project" })),
    )

    await expect(loadCodeAssistProject(requestOptions(fetch))).resolves.toBe("managed-project")
    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
        "User-Agent": "google-api-nodejs-client/9.15.1",
        "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
        "Client-Metadata": "{\"ideType\":\"ANTIGRAVITY\",\"platform\":\"WINDOWS\",\"pluginType\":\"GEMINI\"}",
      },
      body: JSON.stringify({ metadata: { ideType: "ANTIGRAVITY", platform: "WINDOWS", pluginType: "GEMINI" } }),
    }))
  })

  it("accepts an object ID and maps every non-Windows platform to macOS", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(JSON.stringify({ cloudaicompanionProject: { id: "object-project" } })),
    )
    await expect(loadCodeAssistProject(requestOptions(fetch, { platform: "linux" }))).resolves.toBe("object-project")
    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      headers: expect.objectContaining({
        "Client-Metadata": "{\"ideType\":\"ANTIGRAVITY\",\"platform\":\"MACOS\",\"pluginType\":\"GEMINI\"}",
      }),
      body: JSON.stringify({ metadata: { ideType: "ANTIGRAVITY", platform: "MACOS", pluginType: "GEMINI" } }),
    }))
  })

  it("does not cache or reuse a project across access tokens", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ cloudaicompanionProject: "first-project" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ cloudaicompanionProject: "second-project" })))
    await expect(loadCodeAssistProject(requestOptions(fetch, { accessToken: "first-access" }))).resolves.toBe("first-project")
    await expect(loadCodeAssistProject(requestOptions(fetch, { accessToken: "second-access" }))).resolves.toBe("second-project")
    expect(fetch).toHaveBeenNthCalledWith(1, endpoint, expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer first-access" }) }))
    expect(fetch).toHaveBeenNthCalledWith(2, endpoint, expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer second-access" }) }))
  })

  it.each([
    [],
    {},
    { cloudaicompanionProject: " " },
    { cloudaicompanionProject: {} },
    { cloudaicompanionProject: { id: "" } },
    { cloudaicompanionProject: { id: 1 } },
  ])("rejects malformed project payloads: %j", async (payload) => {
    await expect(loadCodeAssistProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify(payload))),
    ))).rejects.toMatchObject({ kind: "response", message: "Antigravity did not return a usable project. Check your Antigravity setup and access." })
  })

  it("returns bounded, redacted and actionable upstream failures", async () => {
    const canary = "CANARY-project-access-token"
    for (const response of [
      new Response("not-json"),
      new Response(canary, { status: 302, headers: { Location: "https://example.test" } }),
      new Response(`${canary}${"x".repeat(64 * 1024)}`, { status: 500 }),
    ]) {
      await expect(loadCodeAssistProject(requestOptions(vi.fn<typeof globalThis.fetch>().mockResolvedValue(response))))
        .rejects.not.toThrow(canary)
    }
    await expect(loadCodeAssistProject(requestOptions(vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(canary, { status: 401 })))))
      .rejects.toMatchObject({ kind: "access", status: 401, message: "Authentication expired. Run /login antigravity-guard." })
    await expect(loadCodeAssistProject(requestOptions(vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(canary, { status: 403 })))))
      .rejects.toMatchObject({ kind: "access", status: 403, message: "Project access was denied. Check your Antigravity access." })
  })

  it("redacts transport failures from fetch and body reads", async () => {
    const canary = "CANARY-transport-project-token"
    await expect(loadCodeAssistProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error(canary)),
    ))).rejects.toMatchObject({ kind: "transport", message: "Project resolution request failed." })
    await expect(loadCodeAssistProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
        pull(controller) { controller.error(new Error(canary)) },
      }))),
    ))).rejects.toMatchObject({ kind: "transport", message: "Project resolution request failed." })
  })

  it("preserves resolver-generated response-limit errors", async () => {
    await expect(loadCodeAssistProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("x".repeat(64 * 1024 + 1))),
    ))).rejects.toMatchObject({ kind: "response", message: "Project resolution response was too large." })
  })

  it("normalizes forged resolver errors from dependencies", async () => {
    const canary = "CANARY-forged-project-error"
    const readerFailure = new Response("valid")
    vi.spyOn(readerFailure.body!, "getReader").mockImplementation(() => { throw new Error(canary) })
    const failures = [
      vi.fn<typeof globalThis.fetch>().mockRejectedValue(new ProjectHttpError("access", canary, 418)),
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({
        pull(controller) { controller.error(new ProjectHttpError("response", canary)) },
      }))),
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(readerFailure),
    ]

    for (const fetch of failures) {
      await expect(loadCodeAssistProject(requestOptions(fetch)))
        .rejects.toMatchObject({ kind: "transport", message: "Project resolution request failed." })
    }
  })

  it("settles safely when aborted before or during fetch and body reads", async () => {
    const before = new AbortController()
    before.abort()
    const noFetch = vi.fn<typeof globalThis.fetch>()
    await expect(loadCodeAssistProject(requestOptions(noFetch, { signal: before.signal }))).rejects.toMatchObject({ kind: "aborted" })
    expect(noFetch).not.toHaveBeenCalled()

    const fetching = new AbortController()
    const duringFetch = loadCodeAssistProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockImplementation(() => new Promise<Response>(() => {})),
      { signal: fetching.signal },
    ))
    fetching.abort()
    await expect(duringFetch).rejects.toMatchObject({ kind: "aborted", message: "Project resolution was cancelled." })

    const reading = new AbortController()
    const duringBody = loadCodeAssistProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start() {} }))),
      { signal: reading.signal },
    ))
    reading.abort()
    await expect(duringBody).rejects.toMatchObject({ kind: "aborted", message: "Project resolution was cancelled." })
  })

  it("honors the injected deadline during fetch and body reads", async () => {
    const pendingFetch = loadCodeAssistProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockImplementation(() => new Promise<Response>(() => {})),
      { deadlineMs: 1_001 },
    ))
    await expect(pendingFetch).rejects.toMatchObject({ kind: "aborted", message: "Project resolution was cancelled." })

    const pendingBody = loadCodeAssistProject(requestOptions(
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream<Uint8Array>({ start() {} }))),
      { deadlineMs: 1_001 },
    ))
    await expect(pendingBody).rejects.toMatchObject({ kind: "aborted", message: "Project resolution was cancelled." })
  })
})
