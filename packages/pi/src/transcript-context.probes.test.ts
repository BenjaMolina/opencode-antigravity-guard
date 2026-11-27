import { describe, expect, it } from "vitest"
import type { Context, Model } from "@earendil-works/pi-ai"

import { getCatalogEntry, resolveGenerationSelection } from "./catalog.ts"
import { ContextSerializationError, sanitizeAntigravitySystemPrompt, serializeContext, serializeTextContext } from "./context.ts"
import { clearSessionTrajectoryMap } from "./envelope.ts"
import { hasToolContext } from "./tool-context.ts"
import { normalizeToolDeclarations } from "./tool-schema.ts"

const argonModel = { id: "antigravity-gemini-4-argon" } as Model<string>
const argonSelection = resolveGenerationSelection(getCatalogEntry("antigravity-gemini-4-argon")!, "low")
const claudeModel = { id: "antigravity-claude-sonnet-4.6" } as Model<string>
const claudeSelection = resolveGenerationSelection(getCatalogEntry("antigravity-claude-sonnet-4.6")!, "high")

describe("S4 Pi 1.4.0+ TranscriptContext and constrainedSampling regression probes", () => {
  it("applies same-message toolsRemoved before toolsAdded during tool redefinition without mutating frozen input", () => {
    const oldTool = {
      name: "search",
      description: "Old search",
      parameters: { type: "object", properties: { q: { type: "string" } } },
    }
    const newTool = {
      name: "search",
      description: "Updated search",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      constrainedSampling: { type: "json_schema" as const, strict: "prefer" as const },
    }
    const transcript = Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: "system", content: "", toolsAdded: Object.freeze([Object.freeze(oldTool)]), timestamp: 0 }),
        Object.freeze({ role: "user", content: "Find callers", timestamp: 1795434999000 }),
        Object.freeze({
          role: "system",
          content: "",
          toolsRemoved: Object.freeze([Object.freeze({ name: "search" })]),
          toolsAdded: Object.freeze([Object.freeze(newTool)]),
          timestamp: 1795434999100,
        }),
      ]),
    }) as unknown as Context

    expect(hasToolContext(transcript)).toBe(true)
    clearSessionTrajectoryMap()
    const serialized = serializeContext(
      { context: transcript, model: argonModel, options: { reasoning: "low" }, project: "proj", requestId: "req-redef" },
      argonSelection,
    )
    expect(serialized.request.tools?.[0]?.functionDeclarations).toEqual([
      {
        name: "search",
        description: "Updated search",
        parametersJsonSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
    ])
  })

  it("sanitizes CRLF Pi 1.4.0 <docs> sections without nested <reference_paths> and isolates __proto__ section keys", () => {
    const crlfPrompt = [
      "You are an expert coding assistant operating inside pi, a coding agent harness.",
      "<docs>",
      "Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):",
      "- Main documentation: C:\\pi\\README.md",
      "- Additional docs: C:\\pi\\docs",
      "- Examples: C:\\pi\\examples (extensions, custom tools, SDK)",
      "- When reading pi docs or examples, resolve docs/... under Additional docs and examples/... under Examples, not the current working directory",
      "- When asked about: extensions (docs/extensions.md)",
      "- When working on pi topics, read the docs and examples, and follow .md cross-references before implementing",
      "- Always read pi .md files completely and follow links to related docs (e.g., tui.md for TUI API details)",
      "</docs>",
    ].join("\r\n")

    const sanitized = sanitizeAntigravitySystemPrompt(crlfPrompt)
    expect(sanitized).not.toContain("Pi documentation")
    expect(sanitized).not.toContain("When reading pi docs or examples")
    expect(sanitized.match(/<reference_paths>/g)).toHaveLength(1)
    expect(sanitized.match(/<\/reference_paths>/g)).toHaveLength(1)

    const protoSections = JSON.parse('{"__proto__":"<proto>safe</proto>","toString":null}') as Record<string, string | null>
    const res = serializeTextContext({
      context: {
        messages: [
          { role: "system", content: "Base", sections: protoSections, timestamp: 0 },
          { role: "user", content: "Ping", timestamp: 1 },
        ],
      } as unknown as Context,
      model: argonModel,
      options: { reasoning: "low" },
      project: "proj",
      requestId: "req-proto",
    })
    expect(res.request.systemInstruction?.parts[0]?.text).toBe("Base\n\n<proto>safe</proto>")
  })

  it("rejects hostile getters and prototypes in constrainedSampling and TranscriptContext without executing getters", () => {
    let getterExecuted = false
    const baseTool = {
      name: "probe_tool",
      description: "Probe tool",
      parameters: { type: "object", properties: { q: { type: "string" } } },
    }

    const nestedGetterCs: Record<string, unknown> = { type: "json_schema" }
    Object.defineProperty(nestedGetterCs, "strict", {
      enumerable: true,
      get() {
        getterExecuted = true
        return "prefer"
      },
    })
    expect(() => normalizeToolDeclarations([{ ...baseTool, constrainedSampling: nestedGetterCs }])).toThrow(/PI_TOOL_SCHEMA_INVALID/)

    const protoCs = Object.create({
      get type() {
        getterExecuted = true
        return "json_schema"
      },
      strict: "prefer",
    })
    expect(() => normalizeToolDeclarations([{ ...baseTool, constrainedSampling: protoCs }])).toThrow(/PI_TOOL_SCHEMA_INVALID/)

    const getterGrammarVariants: Record<string, unknown> = {}
    Object.defineProperty(getterGrammarVariants, "openai_lark", {
      enumerable: true,
      get() {
        getterExecuted = true
        return "start: /.+/s"
      },
    })
    expect(() =>
      normalizeToolDeclarations([{ ...baseTool, constrainedSampling: { type: "grammar", variants: getterGrammarVariants } }]),
    ).toThrow(/PI_TOOL_SCHEMA_INVALID/)

    const hostileSystemMsg: Record<string, unknown> = { role: "system", content: "" }
    Object.defineProperty(hostileSystemMsg, "sections", {
      enumerable: true,
      get() {
        getterExecuted = true
        return { rules: "bad" }
      },
    })
    const hostileTranscript = { messages: [hostileSystemMsg, { role: "user", content: "hi", timestamp: 1 }] }
    expect(hasToolContext(hostileTranscript)).toBe(false)
    expect(() =>
      serializeContext({
        context: hostileTranscript as unknown as Context,
        model: argonModel,
        project: "proj",
        requestId: "req-hostile",
      }),
    ).toThrow(ContextSerializationError)
    expect(getterExecuted).toBe(false)
  })

  it("serializes Pi 1.4.0+ codemode grammar constrainedSampling tools via standard JSON-schema fallback on Gemini and Claude", () => {
    const codemodeTool = Object.freeze({
      name: "codemode",
      description: "Run JavaScript that calls other tools.",
      parameters: Object.freeze({
        type: "object",
        properties: Object.freeze({
          code: Object.freeze({ type: "string", description: "Raw JavaScript source." }),
        }),
        required: Object.freeze(["code"]),
      }),
      constrainedSampling: Object.freeze({
        type: "grammar" as const,
        variants: Object.freeze({ openai_lark: "start: /.+/s" }),
      }),
    })
    const readTool = Object.freeze({
      name: "read",
      description: "Read file contents",
      parameters: Object.freeze({
        type: "object",
        properties: Object.freeze({ path: Object.freeze({ type: "string" }) }),
        required: Object.freeze(["path"]),
      }),
      constrainedSampling: Object.freeze({ type: "json_schema" as const, strict: "prefer" as const }),
    })
    const transcript = Object.freeze({
      messages: Object.freeze([
        Object.freeze({
          role: "system",
          content: "System prompt",
          toolsAdded: Object.freeze([codemodeTool, readTool]),
          timestamp: 0,
        }),
        Object.freeze({ role: "user", content: "Inspect package.json", timestamp: 1795435000000 }),
      ]),
    }) as unknown as Context

    clearSessionTrajectoryMap()
    const geminiSerialized = serializeContext(
      { context: transcript, model: argonModel, options: { reasoning: "low" }, project: "proj", requestId: "req-codemode-gemini" },
      argonSelection,
    )
    expect(geminiSerialized.request.tools?.[0]?.functionDeclarations).toEqual([
      {
        name: "codemode",
        description: "Run JavaScript that calls other tools.",
        parametersJsonSchema: {
          type: "object",
          properties: { code: { type: "string", description: "Raw JavaScript source." } },
          required: ["code"],
        },
      },
      {
        name: "read",
        description: "Read file contents",
        parametersJsonSchema: {
          type: "object",
          properties: { path: { type: "string" } },
          required: ["path"],
        },
      },
    ])

    clearSessionTrajectoryMap()
    const claudeSerialized = serializeContext(
      { context: transcript, model: claudeModel, options: { reasoning: "high" }, project: "proj", requestId: "req-codemode-claude" },
      claudeSelection,
    )
    expect(claudeSerialized.request.tools?.[0]?.functionDeclarations?.[0]).toEqual({
      name: "codemode",
      description: "Run JavaScript that calls other tools.",
      parameters: {
        type: "object",
        properties: { code: { type: "string", description: "Raw JavaScript source." } },
        required: ["code"],
      },
    })
  })
})
