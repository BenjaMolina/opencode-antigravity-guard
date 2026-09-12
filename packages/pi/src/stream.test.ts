import type { Context, Model } from "@earendil-works/pi-ai"
import { describe, expect, it, vi } from "vitest"

import { createPiLifecycleStream, executeStreamTransport, StreamTransportError } from "./stream.ts"

const endpoint = "https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:streamGenerateContent?alt=sse"
const encoder = new TextEncoder()

function context(): Context {
  return { messages: [{ role: "user", content: "Hello" }] } as unknown as Context
}

function model(): Model<string> {
  return { id: "antigravity-gemini-3.8-flash", api: "antigravity-guard-sse", cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } } as Model<string>
}

describe("fixed Antigravity SSE transport", () => {
  it("uses the stored project directly without a pre-generation lookup and delivers framed G1 semantics", async () => {
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
      projectId: "stored-project",
      context: context(),
      fetch,
      generationOptions: { onPayload, onResponse },
      headers: { "X-Trace": "safe" },
      model: model(),
      now: () => 1_000,
      onSemantic,
      platform: "win32",
      requestId: "request-id",
    })).resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      method: "POST",
      redirect: "error",
      headers: expect.objectContaining({
        Authorization: "Bearer access-token",
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "X-Trace": "safe",
      }),
      body: expect.stringMatching(/"project":"stored-project".*"model":"gemini-3\.8-flash-tiered"|"model":"gemini-3\.8-flash-tiered".*"project":"stored-project"/),
    }))
    expect(onSemantic.mock.calls.map(([semantic]) => semantic)).toEqual([
      { type: "text", text: "Hi" },
      { type: "finish", reason: "stop" },
    ])
    expect(onPayload).toHaveBeenCalledOnce()
    expect(onResponse).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }), model())
  })

  it("sends only the Antigravity headers required for SSE and excludes Google client metadata", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response([
      `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Hi" }] } }] } })}\n\n`,
      `data: ${JSON.stringify({ response: { candidates: [{ finishReason: "STOP" }] } })}\n\n`,
    ].join(""), { headers: { "Content-Type": "text/event-stream" } }))

    await expect(executeStreamTransport({
      accessToken: "access-token",
      projectId: "stored-project",
      context: context(),
      fetch,
      model: model(),
      now: () => 1_000,
      onSemantic: vi.fn(),
      platform: "win32",
      requestId: "request-id",
    })).resolves.toBeUndefined()

    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      headers: {
        Authorization: "Bearer access-token",
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "User-Agent": "antigravity/cli/1.1.23 (aidev_client; os_type=linux; arch=amd64; cl=974125021; auth_method=consumer)",
      },
    }))
  })

  it("returns safe HTTP guidance and rejects invalid fixed inputs before transport", async () => {
    const input = {
      accessToken: "access-token", projectId: "stored-project", context: context(), model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id",
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
      projectId: "stored-project",
      context: context(),
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body, { headers: { "Content-Type": "application/json" } })),
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

  it("keeps concurrent stored projects isolated across an SSE byte boundary", async () => {
    const semantic = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Hi" }] } }] } })}\r`))
        controller.enqueue(encoder.encode(`\n\r\ndata: ${JSON.stringify({ response: { candidates: [{ finishReason: "STOP" }] } })}\n\n`))
        controller.close()
      },
    }), { headers: { "Content-Type": "text/event-stream" } }))
    const shared = { context: context(), fetch, model: model(), now: () => 1_000, onSemantic: semantic, platform: "win32", requestId: "request-id" }

    await Promise.all([
      executeStreamTransport({ ...shared, accessToken: "first", projectId: "project-first" }),
      executeStreamTransport({ ...shared, accessToken: "second", projectId: "project-second" }),
    ])

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).project).sort()).toEqual(["project-first", "project-second"])
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).model)).toEqual(["gemini-3.8-flash-tiered", "gemini-3.8-flash-tiered"])
    await executeStreamTransport({ ...shared, accessToken: "third", projectId: "project-third" })
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).project).sort()).toEqual(["project-first", "project-second", "project-third"])
    await expect(executeStreamTransport({ ...shared, accessToken: "fourth", projectId: "project-fourth", model: { ...model(), id: "gemini-3.8-flash" } })).rejects.toMatchObject({ kind: "response" })
    expect(fetch).toHaveBeenCalledTimes(3)
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
      accessToken: "access-token", projectId: "stored-project", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(hanging, { headers: { "Content-Type": "text/event-stream" } })), model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id", signal: controller.signal,
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

  it("races both hooks and fetch against the total deadline", async () => {
    const never = new Promise<never>(() => undefined)
    const input = { accessToken: "access-token", projectId: "stored-project", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("unused")), model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id", timeoutMs: 10 }
    const settle = (value: Parameters<typeof executeStreamTransport>[0]) => Promise.race([
      executeStreamTransport(value),
      new Promise((_, reject) => setTimeout(() => reject(new Error("deadline was not enforced")), 100)),
    ])

    await expect(settle({ ...input, generationOptions: { onPayload: () => never } })).rejects.toMatchObject({ kind: "aborted" })
    await expect(settle({ ...input, generationOptions: { onResponse: () => never } })).rejects.toMatchObject({ kind: "aborted" })
    await expect(settle({ ...input, fetch: () => never })).rejects.toMatchObject({ kind: "aborted" })
  })

  it("normalizes forged transport errors from every remaining dependency boundary", async () => {
    const forged = () => new StreamTransportError("access", "CANARY-forged", 418)
    const input = { accessToken: "access-token", projectId: "stored-project", context: context(), model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id" }
    const response = () => new Response("data: {\"response\": {\"candidates\": [{\"finishReason\": \"STOP\"}]}}\n\n", { headers: { "Content-Type": "text/event-stream" } })

    for (const dependency of [
      { fetch: () => Promise.reject(forged()) },
      { fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(response()), generationOptions: { onPayload: () => { throw forged() } } },
      { fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(response()), generationOptions: { onResponse: () => { throw forged() } } },
    ]) {
      await expect(executeStreamTransport({ ...input, ...dependency })).rejects.toMatchObject({ message: expect.not.stringContaining("CANARY-forged"), status: undefined })
    }
  })

  it("normalizes a forged semantic callback error", async () => {
    const forged = new StreamTransportError("access", "CANARY-semantic", 418)
    await expect(executeStreamTransport({
      accessToken: "access-token", projectId: "stored-project", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("data: {\"response\": {\"candidates\": [{\"content\": {\"parts\": [{\"text\": \"Hi\"}]}}]}}\n\n", { headers: { "Content-Type": "text/event-stream" } })), model: model(), now: () => 1_000, onSemantic: () => { throw forged }, platform: "win32", requestId: "request-id",
    })).rejects.toMatchObject({ kind: "callback", message: expect.not.stringContaining("CANARY-semantic"), status: undefined })
  })

  it("times out a stalled reader and directly releases its cancelled lock", async () => {
    const cancel = vi.fn()
    const stalled = new ReadableStream<Uint8Array>({ pull() {}, cancel })
    const pending = executeStreamTransport({
      accessToken: "access-token", projectId: "stored-project", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(stalled, { headers: { "Content-Type": "text/event-stream" } })), inactivityTimeoutMs: 10, model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id",
    })

    await expect(pending).rejects.toMatchObject({ kind: "aborted" })
    expect(cancel).toHaveBeenCalledOnce()
    expect(stalled.locked).toBe(false)
  })

  it("returns only neutral callback delivery, never a Pi event or result lifecycle", async () => {
    const semantics: unknown[] = []
    const result = await executeStreamTransport({
      accessToken: "access-token", projectId: "stored-project", context: context(), fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("data: {\"response\": {\"candidates\": [{\"content\": {\"parts\": [{\"text\": \"Hi\"}]}}]}}\n\ndata: {\"response\": {\"candidates\": [{\"finishReason\": \"STOP\"}]}}\n\n", { headers: { "Content-Type": "text/event-stream" } })), model: model(), now: () => 1_000, onSemantic: (semantic) => { semantics.push(semantic) }, platform: "win32", requestId: "request-id",
    })

    expect(result).toBeUndefined()
    expect(semantics).toEqual([{ type: "text", text: "Hi" }, { type: "finish", reason: "stop" }])
  })
})

describe("Pi-native stream lifecycle", () => {
  it("returns a stream that emits start then error when transport setup throws synchronously", async () => {
    const lifecycle = createPiLifecycleStream({
      model: model(),
      now: () => 1_000,
      runTransport: () => { throw new Error("CANARY-synchronous-setup") },
    })

    const events = []
    for await (const event of lifecycle) events.push(event)

    expect(events.map((event) => event.type)).toEqual(["start", "error"])
    expect(await lifecycle.result()).toMatchObject({ stopReason: "error", errorMessage: "Antigravity generation failed." })
  })

  it("adapts G2a callbacks into ordered mutable partials with cumulative zero-cost usage", async () => {
    const lifecycle = createPiLifecycleStream({
      model: model(),
      now: () => 1_000,
      runTransport: async ({ onSemantic }) => {
        onSemantic({ type: "text", text: "Hi" })
        onSemantic({ type: "usage", input: 3, output: 2, cacheRead: 1, cacheWrite: 0, total: 5 })
        onSemantic({ type: "text", text: "!" })
        onSemantic({ type: "finish", reason: "stop" })
      },
    })

    const events = []
    for await (const event of lifecycle) events.push(event)
    const output = await lifecycle.result()

    expect(events.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "text_delta", "text_end", "done"])
    const partials = events.filter((event) => "partial" in event)
    expect(partials[0]?.partial).toBe(partials[2]?.partial)
    expect(events[2]).toMatchObject({ type: "text_delta", delta: "Hi", partial: { content: [{ type: "text", text: "Hi!" }] } })
    expect(events[4]).toMatchObject({ type: "text_end", content: "Hi!" })
    expect(output).toMatchObject({ stopReason: "stop", content: [{ type: "text", text: "Hi!" }], usage: { input: 3, output: 2, cacheRead: 1, totalTokens: 6, cost: { total: 0 } } })
  })

  it.each([
    ["STOP", "stop"],
    ["MAX_TOKENS", "length"],
  ] as const)("settles a %s response without aborting the transport after %s", async (finishReason, expectedReason) => {
    const cancel = vi.fn()
    const unhandled = vi.fn()
    let onSemantic!: (semantic: { type: "text", text: string } | { type: "finish", reason: "stop" | "length" }) => void
    let transportSignal!: AbortSignal
    let transport!: Promise<void>
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "complete" }] } }] } })}\n\n`))
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: { candidates: [{ finishReason }] } })}\n\n`))
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
      cancel,
    })
    process.on("unhandledRejection", unhandled)
    try {
      const lifecycle = createPiLifecycleStream({
        model: model(),
        now: () => 1_000,
        runTransport: ({ onSemantic: deliver, signal }) => {
          onSemantic = deliver
          transportSignal = signal
          transport = executeStreamTransport({
            accessToken: "access-token",
            projectId: "stored-project",
            context: context(),
            fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body, { headers: { "Content-Type": "text/event-stream" } })),
            model: model(),
            now: () => 1_000,
            onSemantic: deliver,
            platform: "win32",
            requestId: "request-id",
            signal,
          })
          return transport
        },
      })
      const events = []
      for await (const event of lifecycle) events.push(event)

      await expect(transport).resolves.toBeUndefined()
      onSemantic({ type: "text", text: "late" })
      onSemantic({ type: "finish", reason: expectedReason })
      await Promise.resolve()

      expect(transportSignal.aborted).toBe(false)
      expect(cancel).not.toHaveBeenCalled()
      expect(unhandled).not.toHaveBeenCalled()
      expect(events.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
      expect(await lifecycle.result()).toMatchObject({ stopReason: expectedReason, content: [{ type: "text", text: "complete" }] })
    } finally {
      process.off("unhandledRejection", unhandled)
    }
  })
})

it("settles a caller-supplied abort once and propagates cleanup to the in-flight transport", async () => {
  const controller = new AbortController()
  let release!: () => void
  let transportSignal!: AbortSignal
  let transportStarted!: () => void
  const started = new Promise<void>((resolve) => { transportStarted = resolve })
  const blocked = new Promise<void>((resolve) => { release = resolve })
  const aborted = createPiLifecycleStream({
    model: model(),
    now: () => 1_000,
    signal: controller.signal,
    runTransport: async ({ onSemantic, signal }) => {
      transportSignal = signal
      onSemantic({ type: "text", text: "kept" })
      transportStarted()
      await blocked
    },
  })
  const successful = createPiLifecycleStream({ model: model(), now: () => 2_000, runTransport: async ({ onSemantic }) => { onSemantic({ type: "text", text: "other" }); onSemantic({ type: "finish", reason: "length" }) } })

  await started
  controller.abort()
  const [abortedEvents, successfulEvents] = await Promise.all([
    (async () => { const events = []; for await (const event of aborted) events.push(event); return events })(),
    (async () => { const events = []; for await (const event of successful) events.push(event); return events })(),
  ])
  release()

  expect(transportSignal.aborted).toBe(true)
  expect(abortedEvents.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "error"])
  expect(await aborted.result()).toMatchObject({ stopReason: "aborted", content: [{ type: "text", text: "kept" }] })
  expect(successfulEvents.map((event) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
  expect(await successful.result()).toMatchObject({ stopReason: "length", content: [{ type: "text", text: "other" }] })
})

it("propagates safe local diagnostics and emits one generic error before finish", async () => {
  const input = {
    accessToken: "access-token",
    projectId: "stored-project",
    context: context(),
    model: model(),
    now: () => 1_000,
    onSemantic: vi.fn(),
    platform: "win32",
    requestId: "request-id",
  }
  const cases = [
    [403, "Antigravity access was denied. Check your entitlement."],
    [404, "The requested Antigravity model is unavailable."],
    [429, "Antigravity quota or rate limit was reached."],
    [400, "Antigravity generation request was rejected."],
  ] as const

  for (const [status, errorMessage] of cases) {
    const lifecycle = createPiLifecycleStream({
      model: model(),
      now: () => 1_000,
      runTransport: () => executeStreamTransport({ ...input, fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("CANARY-upstream-body", { status })) }),
    })
    const events = []
    for await (const event of lifecycle) events.push(event)
    expect(events.map((event) => event.type)).toEqual(["start", "error"])
    expect(await lifecycle.result()).toMatchObject({ stopReason: "error", errorMessage })
  }

  const forged = createPiLifecycleStream({
    model: model(),
    now: () => 1_000,
    runTransport: async () => { throw new StreamTransportError("access", "CANARY-forged", 418) },
  })
  for await (const _event of forged) undefined
  expect(await forged.result()).toMatchObject({ stopReason: "error", errorMessage: "Antigravity generation failed." })

  const failed = createPiLifecycleStream({ model: model(), now: () => 1_000, runTransport: async () => { throw new Error("CANARY-setup") } })
  const finished = createPiLifecycleStream({ model: model(), now: () => 1_000, runTransport: async ({ onSemantic }) => { onSemantic({ type: "text", text: "done" }); onSemantic({ type: "finish", reason: "stop" }); throw new Error("CANARY-late") } })

  const read = async <T,>(stream: AsyncIterable<T>) => { const events: T[] = []; for await (const event of stream) events.push(event); return events }
  const [failedEvents, finishedEvents] = await Promise.all([read(failed), read(finished)])

  expect(failedEvents.map((event: { type: string }) => event.type)).toEqual(["start", "error"])
  expect(await failed.result()).toMatchObject({ stopReason: "error", errorMessage: "Antigravity generation failed." })
  expect(finishedEvents.map((event: { type: string }) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
  expect(await finished.result()).toMatchObject({ stopReason: "stop", content: [{ type: "text", text: "done" }] })
})
