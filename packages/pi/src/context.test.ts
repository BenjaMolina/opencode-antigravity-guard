import type { Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai"
import { describe, expect, it } from "vitest"

import { ContextSerializationError, serializeContext, serializeTextContext } from "./context.ts"
import { createEnabledToolCapability, listCatalogEntries, resolveGenerationSelection } from "./catalog.ts"

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
      project: "project", model: "gemini-3.8-flash-low", requestType: "agent", userAgent: "antigravity", requestId: "agent-id",
      request: { systemInstruction: { parts: [{ text: " system " }] }, contents: [
        { role: "user", parts: [{ text: "first" }, { text: "  " }] }, { role: "model", parts: [{ text: "answer" }] },
      ], generationConfig: { temperature: 0.5, maxOutputTokens: 12, thinkingConfig: { thinkingBudget: 0, includeThoughts: false } } },
    })
    expect(context).toEqual(before)
  })

  it.each([
    [{ tools: [{}], messages: [{ role: "user", content: "x", timestamp: 0 }] }, undefined],
    [{ messages: [{ role: "toolResult", content: [], timestamp: 0 }] }, undefined],
    [{ messages: [{ role: "user", content: [{ type: "image" }], timestamp: 0 }] }, undefined],
    [{ messages: [{ role: "user", content: [{ type: "thinking", thinking: "x" }], timestamp: 0 }] }, undefined],
    [{ messages: [assistant([{ type: "toolCall", id: "call", name: "tool", arguments: {} }])] }, undefined],
    [{ messages: [{ role: "user", content: [{ type: "unknown", value: "x" }], timestamp: 0 }] }, undefined],
    [{ messages: [{ role: "developer", content: "x", timestamp: 0 }] }, undefined],
    [{ messages: [] }, undefined],
    [{ messages: [{ role: "user", content: "x", timestamp: 0 }] }, { reasoning: "xhigh" as never }],
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

  it.each(["low", "medium", "high"] as const)("maps %s reasoning to the matching visible native thinking level", (reasoning) => {
    const budget = reasoning === "low" ? 1000 : reasoning === "medium" ? 4000 : -1
    expect(request({ messages: [{ role: "user", content: "x", timestamp: 0 }] }, { reasoning }).request.generationConfig.thinkingConfig).toEqual({
      thinkingBudget: budget,
      includeThoughts: true,
    })
  })

  it("uses invisible low thinking by default and for Pi's runtime off encoding", () => {
    const context = { messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context
    expect(request(context).request.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0, includeThoughts: false })
    expect(request(context, { reasoning: "off" as never }).request.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0, includeThoughts: false })
  })

      it("fails closed for a direct minimal reasoning request", () => {
        const context = { messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context
        expect(() => request(context, { reasoning: "minimal" as never })).toThrow(ContextSerializationError)
      })

      it("rejects thinking budgets while preserving signed same-model thought and text parts", () => {
        const context = { messages: [
          { role: "user", content: "x", timestamp: 0 },
          { role: "assistant", content: [
            { type: "thinking", thinking: "plan", thinkingSignature: "c2ln" },
            { type: "text", text: "answer", textSignature: "c2ln" },
          ], provider: "antigravity-guard", model: "antigravity-gemini-3.8-flash", api: "antigravity-guard-sse", usage: {}, stopReason: "stop", timestamp: 0 },
        ] } as Context
        expect(() => request(context, { thinkingBudgets: { low: 32 } })).toThrow(ContextSerializationError)
        expect(request(context).request.contents[1]?.parts).toEqual([
          { thought: true, text: "plan", thoughtSignature: "c2ln" },
          { text: "answer", thoughtSignature: "c2ln" },
        ])
      })

      it("strips malformed or cross-model signatures without moving content between source parts", () => {
        const context = { messages: [
          { role: "user", content: "x", timestamp: 0 },
          { role: "assistant", content: [
            { type: "thinking", thinking: "cross thought", thinkingSignature: "c2ln" },
            { type: "text", text: "cross text", textSignature: "c2ln" },
          ], provider: "antigravity-guard", model: "other-model", api: "antigravity-guard-sse", usage: {}, stopReason: "stop", timestamp: 0 },
          { role: "assistant", content: [{ type: "text", text: "invalid", textSignature: "not base64" }], provider: "antigravity-guard", model: "antigravity-gemini-3.8-flash", api: "antigravity-guard-sse", usage: {}, stopReason: "stop", timestamp: 0 },
        ] } as Context

        expect(request(context).request.contents.slice(1)).toEqual([
          { role: "model", parts: [{ text: "cross thought" }, { text: "cross text" }] },
          { role: "model", parts: [{ text: "invalid" }] },
        ])
      })

      it("serializes literal evidence-admitted Gemini routes and omits off config only where proven", () => {
      const context = { messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context
      const serialize = (id: string, options?: SimpleStreamOptions) => serializeTextContext({
        context,
        model: { ...model, id },
        options,
        project: "project",
        requestId: "agent-id",
      })
      expect(serialize("antigravity-gemini-3.7-flash")).toMatchObject({
        model: "gemini-3.7-flash-low",
        request: { generationConfig: { thinkingConfig: { thinkingBudget: 0, includeThoughts: false } } },
      })
      expect(serialize("antigravity-gemini-3.7-flash", { reasoning: "medium" })).toMatchObject({
        model: "gemini-3.7-flash-medium",
        request: { generationConfig: { thinkingConfig: { thinkingBudget: 4000, includeThoughts: true } } },
      })
      expect(serialize("antigravity-gemini-3.6-flash").request.generationConfig).not.toHaveProperty("thinkingConfig")
      expect(serialize("antigravity-gemini-3.6-flash", { reasoning: "high" })).toMatchObject({
        model: "gemini-3.6-flash-high",
        request: { generationConfig: { thinkingConfig: { thinkingBudget: -1, includeThoughts: true } } },
      })
      expect(serialize("antigravity-gemini-3.1-pro")).toMatchObject({ model: "gemini-3.1-pro-low" })
      expect(serialize("antigravity-gemini-3.1-pro").request.generationConfig).not.toHaveProperty("thinkingConfig")
      expect(serialize("antigravity-gemini-3.1-pro", { reasoning: "high" })).toMatchObject({
        model: "gemini-pro-agent",
        request: { generationConfig: { maxOutputTokens: 11025, thinkingConfig: { thinkingBudget: 10001, includeThoughts: true } } },
      })
      expect(() => serialize("antigravity-gemini-3.1-pro", { reasoning: "medium" })).toThrow(ContextSerializationError)
      expect(() => serialize("antigravity-gemini-3.1-pro", { reasoning: "high", maxTokens: 10001 })).toThrow(ContextSerializationError)
    })

    it.each([
      "antigravity-gemini-3.7-flash",
      "antigravity-gemini-3.6-flash",
      "antigravity-gemini-3.1-pro",
    ])("preserves same-model signatures for %s", (id) => {
      const signed = { messages: [
        { role: "user", content: "x", timestamp: 0 },
        { role: "assistant", content: [{ type: "thinking", thinking: "plan", thinkingSignature: "c2ln" }, { type: "text", text: "answer", textSignature: "c2ln" }], provider: "antigravity-guard", model: id, api: "antigravity-guard-sse", usage: {}, stopReason: "stop", timestamp: 0 },
      ] } as Context
      const serialize = (context: Context) => serializeTextContext({ context, model: { ...model, id }, project: "project", requestId: "agent-id" })
      expect(serialize(signed).request.contents[1]?.parts).toEqual([
        { thought: true, text: "plan", thoughtSignature: "c2ln" },
        { text: "answer", thoughtSignature: "c2ln" },
      ])
      for (const unsupported of [
        { messages: [{ role: "toolResult", content: [], timestamp: 0 }] },
        { messages: [{ role: "user", content: [{ type: "image" }], timestamp: 0 }] },
      ]) expect(() => serialize(unsupported as Context)).toThrow(ContextSerializationError)
    })

    it.each([
      "antigravity-claude-sonnet-4.6",
      "antigravity-claude-opus-4.6-thinking",
      "antigravity-gpt-oss-120b",
    ])("strips historical signatures and rejects tools before serializing %s", (id) => {
      const signed = { messages: [
        { role: "user", content: "x", timestamp: 0 },
        { role: "assistant", content: [{ type: "thinking", thinking: "plan", thinkingSignature: "c2ln" }, { type: "text", text: "answer", textSignature: "c2ln" }], provider: "antigravity-guard", model: id, api: "antigravity-guard-sse", usage: {}, stopReason: "stop", timestamp: 0 },
      ] } as Context
      const serialize = (context: Context) => serializeTextContext({ context, model: { ...model, id }, project: "project", requestId: "agent-id" })
      expect(serialize(signed).request.contents[1]?.parts).toEqual([{ text: "plan" }, { text: "answer" }])
      for (const unsupported of [
        { tools: [{}], messages: [{ role: "user", content: "x", timestamp: 0 }] },
        { messages: [{ role: "toolResult", content: [], timestamp: 0 }] },
        { messages: [{ role: "user", content: [{ type: "image" }], timestamp: 0 }] },
      ]) expect(() => serialize(unsupported as Context)).toThrow(ContextSerializationError)
    })

    it("serializes Claude high as its literal integer budget and rejects an equal explicit output limit", () => {
      const context = { messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context
      const serialize = (id: string, options?: SimpleStreamOptions) => serializeTextContext({
        context,
        model: { ...model, id },
        options,
        project: "project",
        requestId: "agent-id",
      })
      for (const id of ["antigravity-claude-sonnet-4.6", "antigravity-claude-opus-4.6-thinking"]) {
        expect(serialize(id, { reasoning: "high" })).toMatchObject({
          model: id === "antigravity-claude-sonnet-4.6" ? "claude-sonnet-4-6" : "claude-opus-4-6-thinking",
          request: { generationConfig: { maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 1024, includeThoughts: true } } },
        })
        expect(() => serialize(id, { reasoning: "high", maxTokens: 1024 })).toThrow(ContextSerializationError)
      }
    })

    it("uses Claude off and explicit reserves without replaying signatures or accepting tools", () => {
      const signed = { messages: [
        { role: "user", content: "x", timestamp: 0 },
        { role: "assistant", content: [
          { type: "thinking", thinking: "plan", thinkingSignature: "c2ln" },
          { type: "text", text: "answer", textSignature: "c2ln" },
        ], provider: "antigravity-guard", model: "antigravity-claude-sonnet-4.6", api: "antigravity-guard-sse", usage: {}, stopReason: "stop", timestamp: 0 },
      ] } as Context
      const serialize = (context: Context, id = "antigravity-claude-sonnet-4.6", options?: SimpleStreamOptions) => serializeTextContext({
        context,
        model: { ...model, id },
        options,
        project: "project",
        requestId: "agent-id",
      })
      const before = structuredClone(signed)
      expect(serialize(signed).request).toMatchObject({
        contents: [
          { role: "user", parts: [{ text: "x" }] },
          { role: "model", parts: [{ text: "plan" }, { text: "answer" }] },
        ],
        generationConfig: { maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0, includeThoughts: false } },
      })
      expect(signed).toEqual(before)
      expect(serialize(signed, "antigravity-claude-opus-4.6-thinking", { reasoning: "high", maxTokens: 1025 }).request.generationConfig.maxOutputTokens).toBe(1025)
      for (const maxTokens of [1000, 1024]) expect(() => serialize(signed, "antigravity-claude-opus-4.6-thinking", { reasoning: "high", maxTokens })).toThrow(ContextSerializationError)
      expect(() => serialize({ tools: [{}], messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context)).toThrow(ContextSerializationError)
    })

    it("serializes literal GPT-OSS routes with safe output limits and strip-only replay", () => {
          const signed = { messages: [
            { role: "user", content: "x", timestamp: 0 },
            { role: "assistant", content: [
              { type: "thinking", thinking: "plan", thinkingSignature: "c2ln" },
              { type: "text", text: "answer", textSignature: "c2ln" },
            ], provider: "antigravity-guard", model: "antigravity-gpt-oss-120b", api: "antigravity-guard-sse", usage: {}, stopReason: "stop", timestamp: 0 },
          ] } as Context
          const serialize = (options?: SimpleStreamOptions) => serializeTextContext({
            context: signed, model: { ...model, id: "antigravity-gpt-oss-120b" }, options, project: "project", requestId: "agent-id",
          })
          expect(serialize().request).toMatchObject({
            contents: [
              { role: "user", parts: [{ text: "x" }] },
              { role: "model", parts: [{ text: "plan" }, { text: "answer" }] },
            ],
            generationConfig: { maxOutputTokens: 4096 },
          })
          expect(serialize().request.generationConfig).not.toHaveProperty("thinkingConfig")
          expect(serialize({ reasoning: "medium" }).request).toMatchObject({
            generationConfig: { maxOutputTokens: 9216, thinkingConfig: { thinkingBudget: 8192, includeThoughts: true } },
          })
          expect(() => serialize({ reasoning: "medium", maxTokens: 8192 })).toThrow(ContextSerializationError)
          expect(serialize({ reasoning: "medium", maxTokens: 8193 }).request.generationConfig.maxOutputTokens).toBe(8193)
          for (const reasoning of ["minimal", "low", "high"] as const) expect(() => serialize({ reasoning })).toThrow(ContextSerializationError)
        })

        it("rejects tools, tool history, and images for every registered model before request serialization", () => {
          const catalog = listCatalogEntries()
          expect(catalog).toHaveLength(7)
          const unsupportedContexts = [
            { tools: [{}], messages: [{ role: "user", content: "x", timestamp: 0 }] },
            { messages: [{ role: "toolResult", content: [], timestamp: 0 }] },
            { messages: [{ role: "user", content: [{ type: "image" }], timestamp: 0 }] },
          ]
          for (const entry of catalog) {
            for (const context of unsupportedContexts) {
              expect(() => serializeTextContext({
                context: context as Context,
                model: { ...model, id: entry.publicId },
                project: "project",
                requestId: "agent-id",
              })).toThrow(ContextSerializationError)
            }
          }
        })

        it("serializes Gemini declarations as parametersJsonSchema in normalized schema order", () => {
      const context = { tools: [{ name: "read_file", description: "Read one file", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }], messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context
      const selection = resolveGenerationSelection(listCatalogEntries()[0]!, "off")
      const enabled = createEnabledToolCapability({ record: "fixture", revision: "1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", wireModel: "gemini-3.8-flash-low" }, "gemini-parameters-json-schema")
      const diagnostics: unknown[] = []
      const request = serializeContext({ context, model, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled }, (diagnostic) => diagnostics.push(diagnostic))
      const withoutDiagnostics = serializeContext({ context, model, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled })
      expect(JSON.stringify(request)).toBe(JSON.stringify(withoutDiagnostics))
      expect(JSON.stringify(serializeContext({ context: { messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context, model, project: "project", requestId: "agent-id" }))).toBe(JSON.stringify(serializeTextContext({ context: { messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context, model, project: "project", requestId: "agent-id" })))
      expect(JSON.stringify(request.request)).toBe(JSON.stringify({ contents: [{ role: "user", parts: [{ text: "x" }] }], tools: [{ functionDeclarations: [{ name: "read_file", description: "Read one file", parametersJsonSchema: { properties: { path: { type: "string" } }, required: ["path"], type: "object" } }] }], generationConfig: { temperature: 1, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0, includeThoughts: false } } }))
      expect(diagnostics).toEqual([{
        replayMode: "none",
        recoveryCount: 0,
        userMessageCount: 1,
        assistantMessageCount: 0,
        toolResultMessageCount: 0,
        assistantToolCallBlockCount: 0,
        declaredToolCount: 1,
      }])
      const declaration = request.request.tools?.[0]?.functionDeclarations[0]
      expect(declaration).not.toHaveProperty("parameters")
      expect(JSON.stringify(declaration?.parametersJsonSchema)).toBe(JSON.stringify({ properties: { path: { type: "string" } }, required: ["path"], type: "object" }))
      expect(serializeContext({ context, model, options: { toolChoice: "auto" } as SimpleStreamOptions, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled }).request.toolConfig).toBeUndefined()
      expect(serializeContext({ context, model, options: { toolChoice: "none" } as SimpleStreamOptions, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled }).request.toolConfig).toEqual({ functionCallingConfig: { mode: "NONE" } })
    })

    it("serializes ask_user_choice only as a complete parametersJsonSchema", () => {
          const selection = resolveGenerationSelection(listCatalogEntries()[0]!, "off")
          const enabled = createEnabledToolCapability({ record: "fixture", revision: "1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", wireModel: "gemini-3.8-flash-low" }, "gemini-parameters-json-schema")
          const context = { tools: [{ name: "ask_user_choice", description: "Ask", parameters: { type: "object", additionalProperties: false, properties: { options: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", additionalProperties: false, properties: { label: { type: "string" } } } } } } }], messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context
          const declaration = serializeContext({ context, model, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled }).request.tools?.[0]?.functionDeclarations[0]
          expect(declaration).toEqual({ name: "ask_user_choice", description: "Ask", parametersJsonSchema: { additionalProperties: false, properties: { options: { items: { additionalProperties: false, properties: { label: { type: "string" } }, type: "object" }, maxItems: 4, minItems: 1, type: "array" } }, type: "object" } })
          expect(declaration).not.toHaveProperty("parameters")
        })

        it("bridges an unsigned terminal orphan call into its fixed synthetic observation", () => {
      const selection = resolveGenerationSelection(listCatalogEntries()[0]!, "off")
      const enabled = createEnabledToolCapability({ record: "fixture", revision: "1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", wireModel: "gemini-3.8-flash-low" }, "gemini-parameters-json-schema")
      const context = { messages: [{ ...assistant([{ type: "toolCall", id: "call-1", name: "read_file", arguments: {} }]), stopReason: "toolUse" }] } as Context
      expect(serializeContext({ context, model, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled }).request.contents).toEqual([{
        role: "user",
        parts: [{ text: "[Observation from `read_file`:\nTool execution did not complete or its result was not recorded. Treat the call as failed; do not assume it had no side effects and do not retry it automatically.]" }],
        }])
    })

    it("rejects enabled tool-result history until Unit D replay is implemented", () => {
      const selection = resolveGenerationSelection(listCatalogEntries()[0]!, "off")
      const enabled = createEnabledToolCapability({ record: "fixture", revision: "1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", wireModel: "gemini-3.8-flash-low" }, "gemini-parameters-json-schema")
      const context = { messages: [{ role: "toolResult", toolCallId: "call-1", toolName: "read_file", content: [], isError: false, timestamp: 0 }] } as Context
      expect(() => serializeContext({ context, model, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled })).toThrow("PI_TOOL_RESULT_FOREIGN")
    })

    it("uses defaults, accepts repeated text, and bounds serialized text", () => {
    expect(request({ messages: [{ role: "user", content: "same", timestamp: 0 }, { role: "user", content: "same", timestamp: 0 }] })).toMatchObject({
      model: "gemini-3.8-flash-low", request: { generationConfig: { temperature: 1, maxOutputTokens: 4096 } },
    })
    expect(request({ messages: [{ role: "user", content: "é".repeat(4 * 1024 * 1024), timestamp: 0 }] }).request.contents[0]?.parts).toEqual([{ text: "é".repeat(4 * 1024 * 1024) }])
    expect(() => request({ messages: [{ role: "user", content: "é".repeat(4 * 1024 * 1024 + 1), timestamp: 0 }] })).toThrow(ContextSerializationError)
    expect(() => request({ messages: [{ role: "user", content: "x".repeat(8 * 1024 * 1024 + 1), timestamp: 0 }] })).toThrow(ContextSerializationError)
    expect(() => serializeTextContext({ context: { messages: [{ role: "user", content: "x", timestamp: 0 }] }, model: { ...model, id: "other" }, project: "p", requestId: "r" })).toThrow(ContextSerializationError)
  })

  it("bridges unsigned assistant calls and matching results through the enabled request-local replay", () => {
    const selection = resolveGenerationSelection(listCatalogEntries()[0]!, "off")
    const enabled = createEnabledToolCapability({ record: "fixture", revision: "1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", wireModel: "gemini-3.8-flash-low" }, "gemini-parameters-json-schema")
    const context = { messages: [{ ...assistant([{ type: "text", text: "calling" }, { type: "toolCall", id: "call-1", name: "read_file", arguments: {} }]), stopReason: "toolUse" }, { role: "toolResult", toolCallId: "call-1", toolName: "read_file", content: [{ type: "text", text: "done" }], isError: false, timestamp: 0 }] } as Context
    expect(JSON.stringify(serializeContext({ context, model, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled }).request.contents)).toBe(JSON.stringify([
      { role: "model", parts: [{ text: "calling" }] },
      { role: "user", parts: [{ text: "[Observation from `read_file`:\ndone]" }] },
    ]))
  })


  it("skips empty unsigned text only within assistant tool-call replay groups", () => {
        const selection = resolveGenerationSelection(listCatalogEntries()[0]!, "off")
        const enabled = createEnabledToolCapability({ record: "fixture", revision: "1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", wireModel: "gemini-3.8-flash-low" }, "gemini-parameters-json-schema")
        const serialize = (content: unknown[]) => serializeContext({
          context: { messages: [
            { ...assistant(content), provider: "antigravity-guard", model: "antigravity-gemini-3.8-flash", stopReason: "toolUse" },
            { role: "toolResult", toolCallId: "call-1", toolName: "read_file", content: [{ type: "text", text: "done" }], isError: false, timestamp: 0 },
          ] } as Context,
          model,
          project: "project",
          requestId: "agent-id",
        }, { ...selection, tools: enabled }).request.contents

        expect(serialize([
          { type: "text", text: "" },
          { type: "toolCall", id: "call-1", name: "read_file", arguments: {}, thoughtSignature: "c2ln" },
          { type: "text", text: "  " },
        ])).toEqual([
          { role: "model", parts: [{ functionCall: { name: "read_file", args: {} }, thoughtSignature: "c2ln" }] },
          { role: "user", parts: [{ functionResponse: { name: "read_file", response: { output: "done" } } }] },
        ])
        expect(serialize([
          { type: "text", text: "", textSignature: "c2ln" },
          { type: "text", text: "before" },
          { type: "toolCall", id: "call-1", name: "read_file", arguments: {} },
          { type: "text", text: "after" },
        ])).toEqual([
          { role: "model", parts: [{ text: "", thoughtSignature: "c2ln" }, { text: "before" }, { text: "after" }] },
          { role: "user", parts: [{ text: "[Observation from `read_file`:\ndone]" }] },
        ])

        expect(() => serializeTextContext({ context: { messages: [{ role: "user", content: [{ type: "text", text: "" }], timestamp: 0 }] } as Context, model, project: "project", requestId: "agent-id" })).toThrow(ContextSerializationError)
        expect(() => serializeTextContext({ context: { messages: [assistant([{ type: "text", text: "" }])] } as Context, model, project: "project", requestId: "agent-id" })).toThrow(ContextSerializationError)
      })

      it("preserves assistant text and thinking around a replayed call", () => {
    const selection = resolveGenerationSelection(listCatalogEntries()[0]!, "off")
    const enabled = createEnabledToolCapability({ record: "fixture", revision: "1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", wireModel: "gemini-3.8-flash-low" }, "gemini-parameters-json-schema")
    const call = { ...assistant([{ type: "thinking", thinking: "plan", thinkingSignature: "c2ln" }, { type: "toolCall", id: "call-1", name: "read_file", arguments: {} }, { type: "text", text: "after" }]), provider: "antigravity-guard", model: "antigravity-gemini-3.8-flash", stopReason: "toolUse" }
    const context = { messages: [call, { role: "toolResult", toolCallId: "call-1", toolName: "read_file", content: [], isError: false, timestamp: 0 }] } as Context
    expect(serializeContext({ context, model, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled }).request.contents[0]?.parts).toEqual([
      { thought: true, text: "plan", thoughtSignature: "c2ln" }, { text: "after" },
    ])
  })

  it.each([
    ["same-provider valid", "antigravity-guard", "c2ln", { functionCall: { name: "read_file", args: {} }, thoughtSignature: "c2ln" }],
    ["foreign-provider", "other", "c2ln", { text: "[Observation from `read_file`:\n]" }],
    ["invalid", "antigravity-guard", "not base64", { text: "[Observation from `read_file`:\n]" }],
  ])("replays %s tool calls only for valid same-model signatures", (_case, provider, signature, expected) => {
    const selection = resolveGenerationSelection(listCatalogEntries()[0]!, "off")
    const enabled = createEnabledToolCapability({ record: "fixture", revision: "1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", wireModel: "gemini-3.8-flash-low" }, "gemini-parameters-json-schema")
    const context = { messages: [{ ...assistant([{ type: "toolCall", id: "call-1", name: "read_file", arguments: {}, thoughtSignature: signature }]), provider, model: "antigravity-gemini-3.8-flash", stopReason: "toolUse" }, { role: "toolResult", toolCallId: "call-1", toolName: "read_file", content: [], isError: false, timestamp: 0 }] } as Context
    expect(serializeContext({ context, model, project: "project", requestId: "agent-id" }, { ...selection, tools: enabled }).request.contents[0]?.parts[0]).toEqual(expected)
  })


  it("rejects a forged enabled selection before reading tool declarations", () => {
    const selection = resolveGenerationSelection(listCatalogEntries()[0]!, "off")
    const forged = { ...selection, tools: { ...selection.tools, state: "enabled", schemaProfile: "forged-profile" } } as never
    const context = { tools: [Object.create(null, { name: { get: () => { throw new Error("CANARY") } } })], messages: [{ role: "user", content: "x", timestamp: 0 }] } as Context
    expect(() => serializeContext({ context, model, project: "project", requestId: "agent-id" }, forged)).toThrow("PI_TOOL_SCHEMA_PROFILE_UNSUPPORTED")
  })

})
