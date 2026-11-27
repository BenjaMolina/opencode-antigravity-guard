import { describe, expect, it } from "vitest"
import type { Context, Model } from "@earendil-works/pi-ai"

import {
  CLAUDE_CUSTOM_PARAMETERS_PROFILE,
  GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE,
  getCatalogEntry,
  resolveGenerationSelection,
} from "./catalog.ts"
import { serializeContext } from "./context.ts"
import { clearSessionTrajectoryMap } from "./envelope.ts"
import { prepareToolContext } from "./tool-context.ts"
import { normalizeToolDeclarations } from "./tool-schema.ts"

const gptOssModel = { id: "antigravity-gpt-oss-120b" } as Model<string>
const gptOssSelection = resolveGenerationSelection(getCatalogEntry("antigravity-gpt-oss-120b")!, "medium")
const argonModel = { id: "antigravity-gemini-4-argon" } as Model<string>
const argonSelection = resolveGenerationSelection(getCatalogEntry("antigravity-gemini-4-argon")!, "low")

describe("S1/S3 Pi 1.4.0+ codemode grammar constrainedSampling boundary probes", () => {
  const baseTool = {
    name: "codemode",
    description: "Run JavaScript that calls other tools.",
    parameters: {
      type: "object",
      properties: { code: { type: "string", description: "Raw JavaScript source." } },
      required: ["code"],
    },
  }

  it("accepts null-prototype grammar configs and prepareToolContext across Gemini, Claude, and GPT-OSS routes", () => {
    const nullProtoVariants = Object.assign(Object.create(null) as Record<string, unknown>, {
      openai_lark: "start: /.+/s",
      openai_regex: ".+",
    })
    const nullProtoCs = Object.assign(Object.create(null) as Record<string, unknown>, {
      type: "grammar",
      variants: nullProtoVariants,
    })
    const candidate = { ...baseTool, constrainedSampling: nullProtoCs }

    const geminiPrepared = prepareToolContext([candidate], undefined, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE)
    const claudePrepared = prepareToolContext([candidate], "auto", CLAUDE_CUSTOM_PARAMETERS_PROFILE)
    expect(geminiPrepared?.mode).toBe("AUTO")
    expect(claudePrepared?.declarations).toEqual(geminiPrepared?.declarations)
    expect(geminiPrepared?.declarations[0]).not.toHaveProperty("constrainedSampling")

    const transcript = {
      messages: [
        { role: "system", content: "Prompt", toolsAdded: [candidate], timestamp: 0 },
        { role: "user", content: "Run check", timestamp: 1795438000000 },
      ],
    } as unknown as Context

    clearSessionTrajectoryMap()
    const gptOssSerialized = serializeContext(
      { context: transcript, model: gptOssModel, options: { reasoning: "medium" }, project: "proj", requestId: "req-gptoss-codemode" },
      gptOssSelection,
    )
    expect(gptOssSerialized.request.toolConfig).toEqual({ functionCallingConfig: { mode: "AUTO" } })
    expect(gptOssSerialized.request.tools?.[0]?.functionDeclarations).toEqual([
      {
        name: "codemode",
        description: "Run JavaScript that calls other tools.",
        parameters: {
          type: "object",
          properties: { code: { type: "string", description: "Raw JavaScript source." } },
          required: ["code"],
        },
      },
    ])
  })

  it("rejects symbols, non-enumerable getters, and non-string variants with escaped paths without invoking getters", () => {
    let getterCalled = false
    const nonEnumGetterVariants: Record<string, unknown> = { openai_lark: "start: /.+/s" }
    Object.defineProperty(nonEnumGetterVariants, "hidden", {
      enumerable: false,
      get() {
        getterCalled = true
        return "trap"
      },
    })

    for (const constrainedSampling of [
      { type: "grammar", variants: nonEnumGetterVariants },
      { type: "grammar", variants: {}, [Symbol("s")]: true },
      { type: "grammar", variants: { openai_lark: "start: /.+/s", [Symbol("s")]: true } },
    ]) {
      expect(() => normalizeToolDeclarations([{ ...baseTool, constrainedSampling }])).toThrow(/PI_TOOL_SCHEMA_INVALID/)
    }
    expect(getterCalled).toBe(false)

    try {
      normalizeToolDeclarations([{ ...baseTool, constrainedSampling: { type: "grammar", variants: { "bad\nkey": 99 } } }])
      throw new Error("expected failure")
    } catch (error) {
      expect(String(error)).toContain('PI_TOOL_SCHEMA_INVALID: declaration codemode at $[0].constrainedSampling.variants["bad\\nkey"]')
      expect(String(error)).not.toContain("\n")
    }
  })

  it("preserves codemode grammar fallback across multi-turn tool replay and mid-transcript redefinition", () => {
    const sig = "A".repeat(64)
    const transcript = {
      messages: [
        {
          role: "system",
          content: "Harness",
          toolsAdded: [{ ...baseTool, constrainedSampling: { type: "grammar", variants: { openai_lark: "start: /.+/s" } } }],
          timestamp: 0,
        },
        { role: "user", content: "Inspect", timestamp: 1000 },
        {
          role: "assistant",
          provider: "antigravity-guard",
          model: "antigravity-gemini-4-argon",
          stopReason: "toolUse",
          content: [{ type: "toolCall", id: "call_1", name: "codemode", arguments: { code: "return 'ok'" }, thoughtSignature: sig }],
          timestamp: 2000,
        },
        {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "codemode",
          content: [{ type: "text", text: "Script completed\nOutput:\nok" }],
          isError: false,
          timestamp: 3000,
        },
        {
          role: "system",
          content: "",
          toolsRemoved: [{ name: "codemode" }],
          toolsAdded: [
            {
              ...baseTool,
              description: "Run JavaScript (updated catalog).",
              constrainedSampling: { type: "grammar", variants: { openai_lark: "start: /.+/s" } },
            },
          ],
          timestamp: 3500,
        },
        { role: "user", content: "Next step", timestamp: 4000 },
      ],
    } as unknown as Context

    clearSessionTrajectoryMap()
    const serialized = serializeContext(
      { context: transcript, model: argonModel, options: { reasoning: "low" }, project: "proj", requestId: "req-mt-codemode" },
      argonSelection,
    )
    expect(serialized.request.tools?.[0]?.functionDeclarations?.[0]?.description).toBe("Run JavaScript (updated catalog).")
    expect(serialized.request.contents).toHaveLength(3)
  })
})
