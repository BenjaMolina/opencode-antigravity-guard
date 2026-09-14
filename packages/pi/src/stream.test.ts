import type { Context, Model } from "@earendil-works/pi-ai"
import { describe, expect, it, vi } from "vitest"

import { createEnabledToolCapability, getCatalogEntry, resolveGenerationSelection } from "./catalog.ts"
import type { ResponseSemantic } from "./response.ts"
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

  it("maps admitted streamed function calls through transport with the matching response policy", async () => {
      const entry = getCatalogEntry(model().id)!
      const base = resolveGenerationSelection(entry, undefined)
      const selection = { ...base, tools: createEnabledToolCapability({ record: "test", revision: "1", publicModelId: entry.publicId, reasoning: base.level, wireModel: base.route.wireModel }) }
      const semantics: unknown[] = []
      await executeStreamTransport({
        accessToken: "access-token", projectId: "stored-project",
        context: { tools: [{ name: "read_file", description: "Read a file", parameters: { type: "object", properties: { path: { type: "string" } } } }], messages: [{ role: "user", content: "Hello", timestamp: 0 }] } as unknown as Context,
        fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ functionCall: { id: "call-1", name: "read_file", args: {} } }] }, finishReason: "OTHER" }] } })}\n\n`, { headers: { "Content-Type": "text/event-stream" } })),
        model: model(), now: () => 1_000, onSemantic: (semantic) => { semantics.push(semantic) }, platform: "win32", requestId: "request-id", selection,
      })
      expect(semantics).toEqual([
        { type: "toolDiagnostics", details: { publicModelId: entry.publicId, reasoning: base.level, capabilityState: "enabled", preflight: "accepted", replayMode: "none", recoveryCount: 0, userMessageCount: 1, assistantMessageCount: 0, toolResultMessageCount: 0, assistantToolCallBlockCount: 0, declaredToolCount: 1 } },
        { type: "toolCall", callIndex: 0, id: "call-1", name: "read_file", arguments: {}, argumentsJson: "{}" },
        { type: "finish", reason: "toolUse" },
      ])
    })

    it("rejects function calls when explicit NONE disables an otherwise admitted declaration", async () => {
        const entry = getCatalogEntry(model().id)!
        const base = resolveGenerationSelection(entry, undefined)
        const selection = { ...base, tools: createEnabledToolCapability({ record: "test", revision: "1", publicModelId: entry.publicId, reasoning: base.level, wireModel: base.route.wireModel }) }
        await expect(executeStreamTransport({
          accessToken: "access-token", projectId: "stored-project",
          context: { tools: [{ name: "read_file", description: "Read a file", parameters: { type: "object", properties: { path: { type: "string" } } } }], messages: [{ role: "user", content: "Hello", timestamp: 0 }] } as unknown as Context,
          generationOptions: { toolChoice: "none" },
          fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ functionCall: { id: "call-1", name: "read_file", args: {} } }] }, finishReason: "OTHER" }] } })}\n\n`, { headers: { "Content-Type": "text/event-stream" } })),
          model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id", selection,
        })).rejects.toMatchObject({ kind: "response" })
      })

      it("propagates enabled capability state and request-local recovery count into lifecycle diagnostics", async () => {
    const entry = getCatalogEntry(model().id)!
    const selection = resolveGenerationSelection(entry, undefined)
    const enabled = { ...selection, tools: createEnabledToolCapability({ record: "test", revision: "1", publicModelId: entry.publicId, reasoning: selection.level, wireModel: selection.route.wireModel }) }
    const lifecycle = createPiLifecycleStream({
      model: model(),
      now: () => 1_000,
      runTransport: ({ onSemantic, signal }) => executeStreamTransport({
        accessToken: "access-token", projectId: "stored-project",
        context: { messages: [{ role: "assistant", content: [{ type: "toolCall", id: "call-1", name: "read_file", arguments: {} }], stopReason: "toolUse", timestamp: 0 }] } as unknown as Context,
        fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(`data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "done" }] }, finishReason: "STOP" }] } })}\n\n`, { headers: { "Content-Type": "text/event-stream" } })),
        model: model(), now: () => 1_000, onSemantic, platform: "win32", requestId: "request-id", selection: enabled, signal,
      }),
    })
    for await (const _event of lifecycle) undefined
    expect(await lifecycle.result()).toMatchObject({
      stopReason: "stop",
      diagnostics: [{ type: "antigravity-guard.tools", details: { publicModelId: entry.publicId, reasoning: selection.level, capabilityState: "enabled", preflight: "accepted", replayMode: "unsigned-observation", recoveryCount: 1, userMessageCount: 0, assistantMessageCount: 1, toolResultMessageCount: 0, assistantToolCallBlockCount: 1, declaredToolCount: 0, terminal: "stop" } }],
    })
  })

  it("serializes an omission-policy Gemini request through the fixed Antigravity transport", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
      `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Hi" }] } }] } })}\n\ndata: ${JSON.stringify({ response: { candidates: [{ finishReason: "STOP" }] } })}\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    ))
    await executeStreamTransport({
      accessToken: "access-token", projectId: "stored-project", context: context(), fetch,
      model: { ...model(), id: "antigravity-gemini-3.6-flash" }, now: () => 1_000,
      onSemantic: vi.fn(), platform: "win32", requestId: "request-id",
    })
    const payload = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    expect(payload).toMatchObject({ model: "gemini-3.6-flash-low" })
    expect(payload.request.generationConfig).not.toHaveProperty("thinkingConfig")
  })

  it("streams a Claude thought/text fixture through the fixed Antigravity endpoint", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
      `data: ${JSON.stringify({ response: { modelVersion: "claude-sonnet-4-6", candidates: [{ content: { parts: [{ thought: true, text: "plan", thoughtSignature: "c2ln" }, { text: "answer", thoughtSignature: "dGV4dA==" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 7, cachedContentTokenCount: 2, candidatesTokenCount: 3, thoughtsTokenCount: 4, totalTokenCount: 14 } } })}\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    ))
    const onSemantic = vi.fn()
    await executeStreamTransport({
      accessToken: "access-token", projectId: "stored-project", context: context(), fetch,
      generationOptions: { reasoning: "high" },
      model: { ...model(), id: "antigravity-claude-sonnet-4.6" }, now: () => 1_000,
      onSemantic, platform: "win32", requestId: "request-id",
    })
    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      body: expect.stringMatching(/"model":"claude-sonnet-4-6"/),
    }))
    expect(onSemantic.mock.calls.map(([semantic]) => semantic)).toEqual([
      { type: "thinking", thinking: "plan", signature: "c2ln" },
      { type: "text", text: "answer", signature: "dGV4dA==" },
      { type: "usage", input: 5, output: 7, cacheRead: 2, cacheWrite: 0, reasoning: 4, total: 14 },
      { type: "finish", reason: "stop" },
    ])
  })

  it("streams GPT-OSS through the fixed endpoint with literal routing and terminal lifecycle", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
      `data: ${JSON.stringify({ response: { modelVersion: "gpt-oss-120b-medium", candidates: [{ content: { parts: [{ thought: true, text: "plan", thoughtSignature: "c2ln" }, { text: "answer", thoughtSignature: "dGV4dA==" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 7, cachedContentTokenCount: 2, candidatesTokenCount: 3, thoughtsTokenCount: 4, totalTokenCount: 14 } } })}\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    ))
    const onSemantic = vi.fn()
    await executeStreamTransport({
      accessToken: "access-token", projectId: "stored-project", context: context(), fetch,
      generationOptions: { reasoning: "medium" }, model: { ...model(), id: "antigravity-gpt-oss-120b" },
      now: () => 1_000, onSemantic, platform: "win32", requestId: "request-id",
    })
    expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({
      body: expect.stringMatching(/"model":"gpt-oss-120b-medium"/),
    }))
    expect(onSemantic.mock.calls.map(([semantic]) => semantic)).toEqual([
      { type: "thinking", thinking: "plan", signature: "c2ln" },
      { type: "text", text: "answer", signature: "dGV4dA==" },
      { type: "usage", input: 5, output: 7, cacheRead: 2, cacheWrite: 0, reasoning: 4, total: 14 },
      { type: "finish", reason: "stop" },
    ])
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

  it("preserves safe schema preflight diagnostics before fetch", async () => {
    const entry = getCatalogEntry(model().id)!
    const selection = resolveGenerationSelection(entry, undefined)
    const enabled = { ...selection, tools: createEnabledToolCapability({ record: "test", revision: "1", publicModelId: entry.publicId, reasoning: selection.level, wireModel: selection.route.wireModel }) }
    const fetch = vi.fn<typeof globalThis.fetch>()
    await expect(executeStreamTransport({
      accessToken: "access-token", projectId: "stored-project",
      context: { tools: [{ name: "read_file", description: "Read a file", parameters: { type: "string" } }], messages: [{ role: "user", content: "Hello", timestamp: 0 }] } as unknown as Context,
      fetch, model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id", selection: enabled,
    })).rejects.toMatchObject({
      kind: "preflight",
      details: { publicModelId: entry.publicId, reasoning: selection.level, capabilityState: "enabled", preflightCategory: "schema", preflightPath: "$.type" },
    })
    expect(fetch).not.toHaveBeenCalled()

    const lifecycle = createPiLifecycleStream({
      model: model(),
      now: () => 1_000,
      runTransport: ({ onSemantic, signal }) => executeStreamTransport({
        accessToken: "access-token", projectId: "stored-project",
        context: { tools: [{ name: "read_file", description: "Read a file", parameters: { type: "string" } }], messages: [{ role: "user", content: "Hello", timestamp: 0 }] } as unknown as Context,
        fetch, model: model(), now: () => 1_000, onSemantic, platform: "win32", requestId: "request-id", selection: enabled, signal,
      }),
    })
    for await (const _event of lifecycle) undefined
    expect(await lifecycle.result()).toMatchObject({
      stopReason: "error",
      diagnostics: [{ type: "antigravity-guard.tools", details: { publicModelId: entry.publicId, reasoning: selection.level, capabilityState: "enabled", preflightCategory: "schema", preflightPath: "$.type", terminal: "error" } }],
    })
  })

  it("preserves allowlisted local transport failures in tool diagnostics", async () => {
    const entry = getCatalogEntry(model().id)!
    const selection = resolveGenerationSelection(entry, undefined)
    const enabled = { ...selection, tools: createEnabledToolCapability({ record: "test", revision: "1", publicModelId: entry.publicId, reasoning: selection.level, wireModel: selection.route.wireModel }) }
    const secret = "CANARY-upstream-body"
    const input = {
      accessToken: "access-token", projectId: "stored-project",
      context: { tools: [{ name: "read_file", description: "Read a file", parameters: { type: "object", properties: { path: { type: "string" } } } }], messages: [{ role: "user", content: "Hello", timestamp: 0 }] } as unknown as Context,
      model: model(), now: () => 1_000, platform: "win32", requestId: "request-id", selection: enabled,
    }
    const settle = async (runTransport: Parameters<typeof createPiLifecycleStream>[0]["runTransport"]) => {
      const lifecycle = createPiLifecycleStream({ model: model(), now: () => 1_000, runTransport })
      for await (const _event of lifecycle) undefined
      return lifecycle.result()
    }

    const response = await settle(({ onSemantic, signal }) => executeStreamTransport({ ...input, fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(secret, { status: 400 })), onSemantic, signal }))
    expect(response).toMatchObject({ stopReason: "error", diagnostics: [{ type: "antigravity-guard.tools", details: { failure: { kind: "response", status: 400 } } }] })
    expect(JSON.stringify(response)).not.toContain(secret)

    const transport = await settle(({ onSemantic, signal }) => executeStreamTransport({ ...input, fetch: vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error(secret)), onSemantic, signal }))
    expect(transport).toMatchObject({ stopReason: "error", diagnostics: [{ type: "antigravity-guard.tools", details: { failure: { kind: "transport" } } }] })
    expect(JSON.stringify(transport)).not.toContain(secret)

    const controller = new AbortController()
    const lifecycle = createPiLifecycleStream({
      model: model(), now: () => 1_000, signal: controller.signal,
      runTransport: ({ onSemantic, signal }) => executeStreamTransport({ ...input, fetch: () => new Promise<never>(() => undefined), onSemantic, signal }),
    })
    await Promise.resolve()
    controller.abort()
    for await (const _event of lifecycle) undefined
    const aborted = await lifecycle.result()
    expect(aborted).toMatchObject({ stopReason: "aborted", diagnostics: [{ type: "antigravity-guard.tools", details: { failure: { kind: "aborted" } } }] })
    expect(JSON.stringify(aborted)).not.toContain("status")
  })

  it("rejects declaration, call, and result tool contexts before fetch while retaining no-tool transport", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(
      `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] } })}\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    ))
    const input = { accessToken: "access-token", projectId: "stored-project", fetch, model: model(), now: () => 1_000, onSemantic: vi.fn(), platform: "win32", requestId: "request-id" }
    const contexts = [
      { tools: [{ name: "read_file" }], messages: [{ role: "user", content: "Hello" }] },
      { messages: [{ role: "assistant", content: [{ type: "toolCall", id: "call-1", name: "read_file", arguments: {} }] }] },
      { messages: [{ role: "toolResult", content: [], toolCallId: "call-1", toolName: "read_file" }] },
    ]
    for (const toolContext of contexts) {
      await expect(executeStreamTransport({ ...input, context: toolContext as Context })).rejects.toMatchObject({
        kind: "capability",
        message: expect.stringContaining("PI_TOOL_CAPABILITY_NOT_ENABLED"),
      })
    }
    expect(fetch).not.toHaveBeenCalled()

    await expect(executeStreamTransport({ ...input, context: context() })).resolves.toBeUndefined()
    expect(fetch).toHaveBeenCalledOnce()
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

  it("hands an already validated toolUse finish to the terminal lifecycle", async () => {
    const lifecycle = createPiLifecycleStream({
      model: model(),
      now: () => 1_000,
      runTransport: async ({ onSemantic }) => { onSemantic({ type: "finish", reason: "toolUse" }) },
    })
    const events = []
    for await (const event of lifecycle) events.push(event)
    expect(events.map((event) => event.type)).toEqual(["start", "done"])
    expect(await lifecycle.result()).toMatchObject({ stopReason: "toolUse" })
  })

  it("emits complete indexed tool-call lifecycles and scrubs calls after failure", async () => {
      const lifecycle = createPiLifecycleStream({
        model: model(),
        now: () => 1_000,
        runTransport: async ({ onSemantic }) => {
          onSemantic({ type: "thinking", thinking: "plan" })
          onSemantic({ type: "toolCall", callIndex: 0, id: "call-1", name: "read_file", arguments: {}, argumentsJson: "{}" })
          onSemantic({ type: "text", text: "after" })
          onSemantic({ type: "toolCall", callIndex: 1, id: "call-2", name: "read_file", arguments: { path: "README.md" }, argumentsJson: "{\"path\":\"README.md\"}" })
          onSemantic({ type: "finish", reason: "toolUse" })
        },
      })
      const events = []
      for await (const event of lifecycle) events.push(event)
      expect(events.map((event) => event.type)).toEqual([
        "start", "thinking_start", "thinking_delta", "thinking_end", "toolcall_start", "toolcall_delta", "toolcall_end", "text_start", "text_delta", "text_end", "toolcall_start", "toolcall_delta", "toolcall_end", "done",
      ])
      expect(events.filter((event) => event.type.startsWith("toolcall")).map((event) => "contentIndex" in event ? event.contentIndex : undefined)).toEqual([1, 1, 1, 3, 3, 3])
      const toolEnd = events.filter((event) => event.type === "toolcall_end")
      expect(toolEnd[0]?.toolCall).toBe((events.find((event) => event.type === "toolcall_start") as { partial: { content: unknown[] } }).partial.content[1])
      expect(await lifecycle.result()).toMatchObject({ stopReason: "toolUse", content: [{ type: "thinking" }, { type: "toolCall", id: "call-1", arguments: {} }, { type: "text" }, { type: "toolCall", id: "call-2" }], diagnostics: [{ type: "antigravity-guard.tools", details: { terminal: "toolUse" } }] })

      const failed = createPiLifecycleStream({
        model: model(), now: () => 1_000,
        runTransport: async ({ onSemantic }) => { onSemantic({ type: "toolCall", callIndex: 0, id: "call", name: "read_file", arguments: {}, argumentsJson: "{}" }); throw new Error("late") },
      })
      const failedEvents = []
      for await (const event of failed) failedEvents.push(event)
      expect(failedEvents.map((event) => event.type)).toEqual(["start", "toolcall_start", "toolcall_delta", "toolcall_end", "error"])
      expect(await failed.result()).toMatchObject({ stopReason: "error", content: [], diagnostics: [{ type: "antigravity-guard.tools", details: { terminal: "error" } }] })
    })

    it("scrubs an emitted call on abort and ignores late semantic callbacks", async () => {
      const controller = new AbortController()
      let onSemantic!: (semantic: ResponseSemantic) => void
      let release!: () => void
      const blocked = new Promise<void>((resolve) => { release = resolve })
      const lifecycle = createPiLifecycleStream({
        model: model(), now: () => 1_000, signal: controller.signal,
        runTransport: async (input) => { onSemantic = input.onSemantic; onSemantic({ type: "toolCall", callIndex: 0, id: "call", name: "read_file", arguments: {}, argumentsJson: "{}" }); await blocked },
      })
      await Promise.resolve()
      controller.abort()
      onSemantic({ type: "toolCall", callIndex: 1, id: "late", name: "read_file", arguments: {}, argumentsJson: "{}" })
      release()
      const events = []
      for await (const event of lifecycle) events.push(event)
      expect(events.map((event) => event.type)).toEqual(["start", "toolcall_start", "toolcall_delta", "toolcall_end", "error"])
      expect(await lifecycle.result()).toMatchObject({ stopReason: "aborted", content: [] })
    })

    it("adapts G2a callbacks into ordered mutable partials with cumulative zero-cost usage", async () => {
    const lifecycle = createPiLifecycleStream({
      model: model(),
      now: () => 1_000,
      runTransport: async ({ onSemantic }) => {
        onSemantic({ type: "text", text: "Hi" })
        onSemantic({ type: "usage", input: 3, output: 2, cacheRead: 1, cacheWrite: 0, reasoning: 0, total: 5 })
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

  it("emits ordered indexed thought and text lifecycle blocks, including thought-only completion", async () => {
        const lifecycle = createPiLifecycleStream({
          model: model(),
          now: () => 1_000,
          runTransport: async ({ onSemantic }) => {
            onSemantic({ type: "thinking", thinking: "plan", signature: "c2ln" })
            onSemantic({ type: "text", text: "answer", signature: "dGV4dA==" })
            onSemantic({ type: "thinking", thinking: "check", signature: "Y2hlY2s=" })
            onSemantic({ type: "usage", input: 3, output: 5, cacheRead: 1, cacheWrite: 0, reasoning: 2, total: 9 })
            onSemantic({ type: "finish", reason: "stop" })
          },
        })
        const events = []
        for await (const event of lifecycle) events.push(event)

        expect(events.map((event) => event.type)).toEqual([
          "start", "thinking_start", "thinking_delta", "thinking_end", "text_start", "text_delta", "text_end", "thinking_start", "thinking_delta", "thinking_end", "done",
        ])
        expect(events.filter((event) => event.type.endsWith("start") || event.type.endsWith("delta") || event.type.endsWith("end")).map((event) => "contentIndex" in event ? event.contentIndex : undefined)).toEqual([
          undefined, 0, 0, 0, 1, 1, 1, 2, 2, 2,
        ])
        expect(await lifecycle.result()).toMatchObject({
          stopReason: "stop",
          content: [
            { type: "thinking", thinking: "plan", thinkingSignature: "c2ln" },
            { type: "text", text: "answer", textSignature: "dGV4dA==" },
            { type: "thinking", thinking: "check", thinkingSignature: "Y2hlY2s=" },
          ],
          usage: { input: 3, output: 5, cacheRead: 1, reasoning: 2, totalTokens: 9 },
        })

        const thoughtOnly = createPiLifecycleStream({
          model: model(),
          now: () => 1_000,
          runTransport: async ({ onSemantic }) => {
            onSemantic({ type: "thinking", thinking: "only" })
            onSemantic({ type: "finish", reason: "stop" })
          },
        })
        const thoughtOnlyEvents = []
        for await (const event of thoughtOnly) thoughtOnlyEvents.push(event)
        expect(thoughtOnlyEvents.map((event) => event.type)).toEqual(["start", "thinking_start", "thinking_delta", "thinking_end", "done"])
        expect(await thoughtOnly.result()).toMatchObject({ stopReason: "stop", content: [{ type: "thinking", thinking: "only" }] })
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

  const forgedDiagnostic = createPiLifecycleStream({
    model: model(),
    now: () => 1_000,
    runTransport: async ({ onSemantic }) => {
      onSemantic({ type: "toolDiagnostics", details: { publicModelId: "safe-model", reasoning: "off", capabilityState: "enabled", preflight: "accepted", replayMode: "none", recoveryCount: 0, userMessageCount: 0, assistantMessageCount: 0, toolResultMessageCount: 0, assistantToolCallBlockCount: 0, declaredToolCount: 0 } })
      throw new StreamTransportError("access", "CANARY-forged-diagnostics", 418)
    },
  })
  for await (const _event of forgedDiagnostic) undefined
  expect(await forgedDiagnostic.result()).toMatchObject({
    stopReason: "error",
    errorMessage: "Antigravity generation failed.",
    diagnostics: [{ type: "antigravity-guard.tools", details: { publicModelId: "safe-model", terminal: "error" } }],
  })
  expect(JSON.stringify(await forgedDiagnostic.result())).not.toContain("failure")

  const failed = createPiLifecycleStream({ model: model(), now: () => 1_000, runTransport: async () => { throw new Error("CANARY-setup") } })
  const finished = createPiLifecycleStream({ model: model(), now: () => 1_000, runTransport: async ({ onSemantic }) => { onSemantic({ type: "text", text: "done" }); onSemantic({ type: "finish", reason: "stop" }); throw new Error("CANARY-late") } })

  const read = async <T,>(stream: AsyncIterable<T>) => { const events: T[] = []; for await (const event of stream) events.push(event); return events }
  const [failedEvents, finishedEvents] = await Promise.all([read(failed), read(finished)])

  expect(failedEvents.map((event: { type: string }) => event.type)).toEqual(["start", "error"])
  expect(await failed.result()).toMatchObject({ stopReason: "error", errorMessage: "Antigravity generation failed." })
  expect(finishedEvents.map((event: { type: string }) => event.type)).toEqual(["start", "text_start", "text_delta", "text_end", "done"])
  expect(await finished.result()).toMatchObject({ stopReason: "stop", content: [{ type: "text", text: "done" }] })
})
