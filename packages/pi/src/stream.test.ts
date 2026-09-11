import type { Context, Model } from "@earendil-works/pi-ai"
import { describe, expect, it, vi } from "vitest"

import { executeStreamTransport, StreamTransportError } from "./stream.ts"

const endpoint = "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:streamGenerateContent?alt=sse"
const encoder = new TextEncoder()

function context(): Context {
  return { messages: [{ role: "user", content: "Hello" }] } as unknown as Context
}

function model(): Model<string> {
  return { id: "antigravity-gemini-3.8-flash", api: "antigravity-guard-sse" } as Model<string>
}

describe("fixed Antigravity SSE transport", () => {
  it("resolves a project and delivers framed G1 semantics through the neutral callback", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Hi" }] } }] } })}\n\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: { candidates: [{ finishReason: "STOP" }] } })}\n\n`))
        controller.close()
      },
    }), { headers: { "Content-Type": "text/event-stream; charset=utf-8" } }))
    const onSemantic = vi.fn()
    const onPayload = vi.fn((payload: unknown) => payload)
    const onResponse = vi.fn()

    await expect(executeStreamTransport({
      accessToken: "access-token",
      context: context(),
      fetch,
      generationOptions: { onPayload, onResponse },
      headers: { "X-Trace": "safe" },
      loadProject: vi.fn().mockResolvedValue("project-id"),
      model: model(),
      now: () => 1_000,
      onSemantic,
      platform: "win32",
      requestId: "request-id",
    })).resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      method: "POST",
      redirect: "error",
      headers: expect.objectContaining({
        Authorization: "Bearer access-token",
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "X-Trace": "safe",
      }),
    }))
    expect(onSemantic.mock.calls.map(([semantic]) => semantic)).toEqual([
      { type: "text", text: "Hi" },
      { type: "finish", reason: "stop" },
    ])
    expect(onPayload).toHaveBeenCalledOnce()
    expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }), model())
  })

  it("returns safe HTTP guidance and rejects invalid fixed inputs before transport", async () => {
    const input = {
      accessToken: "access-token", context: context(), loadProject: vi.fn().mockResolvedValue("project-id"), model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id",
    }
    for (const [status, kind] of [[401, "access"], [403, "access"], [404, "model"], [429, "quota"]] as const) {
      await expect(executeStreamTransport({ ...input, fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("CANARY", { status })) }))
        .rejects.toMatchObject({ kind, status })
    }
    await expect(executeStreamTransport({ ...input, fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("RESOURCE_EXHAUSTED", { status: 400 })) }))
      .rejects.toMatchObject({ kind: "quota", status: 400 })
    const fetch = vi.fn<typeof globalThis.fetch>()
    await expect(executeStreamTransport({ ...input, fetch, headers: { Authorization: "CANARY" } })).rejects.toBeInstanceOf(StreamTransportError)
    await expect(executeStreamTransport({ ...input, fetch, model: { ...model(), api: "wrong" } })).rejects.toMatchObject({ kind: "response" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("bounds non-SSE bodies and redacts hook failures", async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode("CANARY".padEnd(64 * 1024 + 1, "x"))) }, cancel })
    const input = {
      accessToken: "access-token",
      context: context(),
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body, { headers: { "Content-Type": "application/json" } })),
      loadProject: vi.fn().mockResolvedValue("project-id"),
      model: model(),
      now: () => 1_000,
      onSemantic: vi.fn(),
      platform: "win32",
      requestId: "request-id",
    }
    await expect(executeStreamTransport(input)).rejects.toMatchObject({ kind: "response", message: expect.not.stringContaining("CANARY") })
    expect(cancel).toHaveBeenCalledOnce()
    await expect(executeStreamTransport({ ...input, generationOptions: { onPayload: () => { throw new Error("CANARY") } } })).rejects.toMatchObject({ kind: "callback", message: expect.not.stringContaining("CANARY") })
    await expect(executeStreamTransport({ ...input, generationOptions: { onResponse: () => { throw new Error("CANARY") } } })).rejects.toMatchObject({ kind: "callback", message: expect.not.stringContaining("CANARY") })
  })

  it("uses a fresh project lookup for concurrent wire-model requests across an SSE byte boundary", async () => {
    const project = vi.fn(({ accessToken }: { accessToken: string }) => Promise.resolve(`project-${accessToken}`))
    const semantic = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Hi" }] } }] } })}\r`))
        controller.enqueue(encoder.encode(`\n\r\ndata: ${JSON.stringify({ response: { candidates: [{ finishReason: "STOP" }] } })}\n\n`))
        controller.close()
      },
    }), { headers: { "Content-Type": "text/event-stream" } }))
    const shared = { context: context(), fetch, loadProject: project, model: model(), now: () => 1_000, onSemantic: semantic, platform: "win32", requestId: "request-id" }

    await Promise.all([
      executeStreamTransport({ ...shared, accessToken: "first" }),
      executeStreamTransport({ ...shared, accessToken: "second" }),
    ])

    expect(project).toHaveBeenCalledTimes(2)
    expect(project.mock.calls.map(([value]) => value.accessToken).sort()).toEqual(["first", "second"])
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).model)).toEqual(["gemini-3.8-flash", "gemini-3.8-flash"])
    await executeStreamTransport({ ...shared, accessToken: "third" })
    expect(project.mock.calls.map(([value]) => value.accessToken).sort()).toEqual(["first", "second", "third"])
    await expect(executeStreamTransport({ ...shared, accessToken: "fourth", model: { ...model(), id: "gemini-3.8-flash" } })).rejects.toMatchObject({ kind: "response" })
    expect(project).toHaveBeenCalledTimes(3)
  })

  it("cancels an in-flight reader and safely normalizes late read and callback failures", async () => {
    const cancel = vi.fn()
    const controller = new AbortController()
    let reading!: () => void
    let reads = 0
    const readerStarted = new Promise<void>((resolve) => { reading = resolve })
    const hanging = new ReadableStream<Uint8Array>({
      pull(streamController) {
        if (reads++ === 0) streamController.enqueue(encoder.encode(": ready\n\n"))
        else reading()
      },
      cancel,
    })
    const input = {
      accessToken: "access-token", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(hanging, { headers: { "Content-Type": "text/event-stream" } })), loadProject: vi.fn().mockResolvedValue("project-id"), model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id", signal: controller.signal,
    }
    const pending = executeStreamTransport(input)
    while (!input.fetch.mock.calls.length) await Promise.resolve()
    await readerStarted
    controller.abort()
    await expect(pending).rejects.toMatchObject({ kind: "aborted" })
    expect(cancel).toHaveBeenCalledOnce()

    const lateFailure = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error("CANARY-read")) } })
    await expect(executeStreamTransport({ ...input, signal: undefined, fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(lateFailure, { headers: { "Content-Type": "text/event-stream" } })) }))
      .rejects.toMatchObject({ kind: "transport", message: expect.not.stringContaining("CANARY") })
  })

  it("races project lookup and both hooks against the total deadline", async () => {
    const never = new Promise<never>(() => undefined)
    const input = { accessToken: "access-token", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("unused")), model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id", timeoutMs: 10 }
    const settle = (value: Parameters<typeof executeStreamTransport>[0]) => Promise.race([
      executeStreamTransport(value),
      new Promise((_, reject) => setTimeout(() => reject(new Error("deadline was not enforced")), 100)),
    ])

    await expect(settle({ ...input, loadProject: () => never })).rejects.toMatchObject({ kind: "aborted" })
    await expect(settle({ ...input, loadProject: vi.fn().mockResolvedValue("project-id"), generationOptions: { onPayload: () => never } })).rejects.toMatchObject({ kind: "aborted" })
    await expect(settle({ ...input, loadProject: vi.fn().mockResolvedValue("project-id"), generationOptions: { onResponse: () => never } })).rejects.toMatchObject({ kind: "aborted" })
    await expect(settle({ ...input, loadProject: vi.fn().mockResolvedValue("project-id"), fetch: () => never })).rejects.toMatchObject({ kind: "aborted" })
  })

  it("normalizes forged transport errors from every dependency boundary", async () => {
    const forged = () => new StreamTransportError("access", "CANARY-forged", 418)
    const input = { accessToken: "access-token", context: context(), model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id" }
    const response = () => new Response("data: {\"response\": {\"candidates\": [{\"finishReason\": \"STOP\"}]}}\n\n", { headers: { "Content-Type": "text/event-stream" } })

    for (const dependency of [
      { loadProject: () => Promise.reject(forged()), fetch: vi.fn<typeof globalThis.fetch>() },
      { loadProject: vi.fn().mockResolvedValue("project-id"), fetch: () => Promise.reject(forged()) },
      { loadProject: vi.fn().mockResolvedValue("project-id"), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(response()), generationOptions: { onPayload: () => { throw forged() } } },
      { loadProject: vi.fn().mockResolvedValue("project-id"), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(response()), generationOptions: { onResponse: () => { throw forged() } } },
    ]) {
      await expect(executeStreamTransport({ ...input, ...dependency })).rejects.toMatchObject({ message: expect.not.stringContaining("CANARY-forged"), status: undefined })
    }
  })

  it("normalizes a forged semantic callback error", async () => {
    const forged = new StreamTransportError("access", "CANARY-semantic", 418)
    await expect(executeStreamTransport({
      accessToken: "access-token", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("data: {\"response\": {\"candidates\": [{\"content\": {\"parts\": [{\"text\": \"Hi\"}]}}]}}\n\n", { headers: { "Content-Type": "text/event-stream" } })), loadProject: vi.fn().mockResolvedValue("project-id"), model: model(), now: () => 1_000, onSemantic: () => { throw forged }, platform: "win32", requestId: "request-id",
    })).rejects.toMatchObject({ kind: "callback", message: expect.not.stringContaining("CANARY-semantic"), status: undefined })
  })

  it("times out a stalled reader and directly releases its cancelled lock", async () => {
    const cancel = vi.fn()
    const stalled = new ReadableStream<Uint8Array>({ pull() {}, cancel })
    const pending = executeStreamTransport({
      accessToken: "access-token", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(stalled, { headers: { "Content-Type": "text/event-stream" } })), inactivityTimeoutMs: 10, loadProject: vi.fn().mockResolvedValue("project-id"), model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id",
    })

    await expect(pending).rejects.toMatchObject({ kind: "aborted" })
    expect(cancel).toHaveBeenCalledOnce()
    expect(stalled.locked).toBe(false)
  })

  it("returns only neutral callback delivery, never a Pi event or result lifecycle", async () => {
    const semantics: unknown[] = []
    const result = await executeStreamTransport({
      accessToken: "access-token", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("data: {\"response\": {\"candidates\": [{\"content\": {\"parts\": [{\"text\": \"Hi\"}]}}]}}\n\ndata: {\"response\": {\"candidates\": [{\"finishReason\": \"STOP\"}]}}\n\n", { headers: { "Content-Type": "text/event-stream" } })), loadProject: vi.fn().mockResolvedValue("project-id"), model: model(), now: () => 1_000, onSemantic: (semantic) => { semantics.push(semantic) }, platform: "win32", requestId: "request-id",
    })

    expect(result).toBeUndefined()
    expect(semantics).toEqual([{ type: "text", text: "Hi" }, { type: "finish", reason: "stop" }])
  })
})
