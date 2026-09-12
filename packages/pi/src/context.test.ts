import type { Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai"
import { describe, expect, it } from "vitest"

import { ContextSerializationError, serializeTextContext } from "./context.ts"

const model = { id: "antigravity-gemini-3.8-flash" } as Model<string>
const request = (context: Context, options?: SimpleStreamOptions) => serializeTextContext({
  context, model, options, project: "project", requestId: "agent-id",
})

const assistant = (content: unknown) => ({ role: "assistant", content, api: "x", provider: "x", model: "x", usage: {}, stopReason: "stop", timestamp: 0 })

describe("Pi text context serialization", () => {
  it("maps immutable system and ordered text to the fixed wire envelope", () => {
    const context = { systemPrompt: " system ", messages: [{ role: "user", content: [
      { type: "text", text: "first" }, { type: "text", text: "  " },
    ], timestamp: 0 }, assistant([{ type: "text", text: "answer" }])] } as Context
    const before = structuredClone(context)
    expect(request(context, { temperature: 0.5, maxTokens: 12 })).toEqual({
      project: "project", model: "gemini-3.8-flash-tiered", requestType: "agent", userAgent: "antigravity", requestId: "agent-id",
      request: { systemInstruction: { parts: [{ text: " system " }] }, contents: [
        { role: "user", parts: [{ text: "first" }, { text: "  " }] }, { role: "model", parts: [{ text: "answer" }] },
      ], generationConfig: { temperature: 0.5, maxOutputTokens: 12, thinkingConfig: { thinkingLevel: "low", includeThoughts: false } } },
    })
    expect(context).toEqual(before)
  })

  it.each([
    [{ tools: [{}], messages: [{ role: "user", content: "x", timestamp: 0 }] }, undefined],
    [{ messages: [{ role: "toolResult", content: [], timestamp: 0 }] }, undefined],
    [{ messages: [{ role: "user", content: [{ type: "image" }], timestamp: 0 }] }, undefined],
    [{ messages: [assistant([{ type: "thinking", thinking: "x" }])] }, undefined],
    [{ messages: [assistant([{ type: "toolCall", id: "call", name: "tool", arguments: {} }])] }, undefined],
    [{ messages: [{ role: "user", content: [{ type: "unknown", value: "x" }], timestamp: 0 }] }, undefined],
    [{ messages: [{ role: "developer", content: "x", timestamp: 0 }] }, undefined],
    [{ messages: [] }, undefined],
    [{ messages: [{ role: "user", content: "x", timestamp: 0 }] }, { reasoning: "low" }],
    [{ messages: [{ role: "user", content: "x", timestamp: 0 }] }, { deferred: true }],
    [{ messages: [{ role: "user", content: "x", timestamp: 0 }] }, { temperature: 3 }],
    [{ messages: [{ role: "user", content: "x", timestamp: 0 }] }, { maxTokens: 0 }],
    [{ messages: [{ role: "user", content: "x", timestamp: 0 }] }, { headers: { authorization: "x" } }],
  ] as const)("rejects unsupported input before a request is built", (context, options) => {
    expect(() => request(context as unknown as Context, options)).toThrow(ContextSerializationError)
  })

  it("rejects malformed, sparse, and empty runtime values without exposing getters", () => {
    const valid = { messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context
    const sparse = [] as unknown[]; sparse[1] = { role: "user", content: "x", timestamp: 0 }
    const hostile = { get messages() { throw new Error("CANARY-getter") } }
    for (const [context, options] of [[{ messages: [{ role: "user", content: "", timestamp: 0 }] }, undefined], [{ messages: sparse }, undefined], [hostile, undefined], [valid, false]]) {
      expect(() => request(context as Context, options as SimpleStreamOptions)).toThrow(ContextSerializationError)
    }
  })

  it("rejects empty parts, malformed options, and prototype-shaped context without leaking getters", () => {
    const valid = { messages: [{ role: "user", content: "x", timestamp: 0 }] }
    const getter = Object.create(null, { messages: { get: () => { throw new Error("CANARY-getter") } } })
    const textGetter = Object.create(null, { type: { value: "text" }, text: { get: () => { throw new Error("CANARY-text") } } })
    for (const [context, options] of [[{ messages: [{ role: "user", content: [], timestamp: 0 }] }, undefined], [{ messages: [{ role: "user", content: [{ type: "text", text: "" }], timestamp: 0 }] }, undefined], [valid, null], [valid, { temperature: Number.NaN }], [valid, { maxTokens: 1.5 }], [{ messages: { 0: valid.messages[0], length: 1 } }, undefined], [{ messages: [{ role: "user", content: [textGetter], timestamp: 0 }] }, undefined], [Object.create({ messages: valid.messages }), undefined], [getter, undefined]]) {
      try { request(context as Context, options as SimpleStreamOptions) } catch (error) { expect(error).toBeInstanceOf(ContextSerializationError); expect(String(error)).not.toContain("CANARY") ; continue }
      throw new Error("expected ContextSerializationError")
    }
  })

  it("uses defaults, accepts repeated text, and bounds serialized text", () => {
    expect(request({ messages: [{ role: "user", content: "same", timestamp: 0 }, { role: "user", content: "same", timestamp: 0 }] })).toMatchObject({
      model: "gemini-3.8-flash-tiered", request: { generationConfig: { temperature: 1, maxOutputTokens: 4096 } },
    })
    expect(request({ messages: [{ role: "user", content: "é".repeat(4 * 1024 * 1024), timestamp: 0 }] }).request.contents[0]?.parts).toEqual([{ text: "é".repeat(4 * 1024 * 1024) }])
    expect(() => request({ messages: [{ role: "user", content: "é".repeat(4 * 1024 * 1024 + 1), timestamp: 0 }] })).toThrow(ContextSerializationError)
    expect(() => request({ messages: [{ role: "user", content: "x".repeat(8 * 1024 * 1024 + 1), timestamp: 0 }] })).toThrow(ContextSerializationError)
    expect(() => serializeTextContext({ context: { messages: [{ role: "user", content: "x", timestamp: 0 }] }, model: { ...model, id: "other" }, project: "p", requestId: "r" })).toThrow(ContextSerializationError)
  })
})
