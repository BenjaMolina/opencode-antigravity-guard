import { mkdtempSync, rmSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import type { Model } from "@earendil-works/pi-ai"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearDynamicCatalogEntries,
  getCatalogEntry,
  listCatalogEntries,
  resolveGenerationRoute,
  resolveGenerationSelection,
  toPiModelDescriptor,
} from "./catalog.ts"
import { ContextSerializationError, resolvePiSignatureSessionKey, serializeContext, serializeTextContext } from "./context.ts"
import { ANTIGRAVITY_MODEL_ENUM } from "./envelope.ts"
import { registerAntigravityProvider } from "./provider.ts"
import { ResponseSemantics } from "./response.ts"

const tempDirs: string[] = []
function makeTempHome(): string {
  const dir = mkdtempSync(join(os.tmpdir(), "pi-phase5-probes-"))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  clearDynamicCatalogEntries()
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe("Phase 5 (T5.2) Pi multimodal PDF, -sonar/-tiered catalog variants, and grounding citations", () => {
  it("registers -sonar and -tiered static catalog entries with verified wire routes and envelope placeholders", () => {
    const ids = listCatalogEntries().map((e) => e.publicId)
    expect(ids).toContain("antigravity-gemini-3.8-flash-tiered")
    expect(ids).toContain("antigravity-gemini-3.7-flash-tiered")
    expect(ids).toContain("antigravity-gemini-3.6-flash-tiered")
    expect(ids).toContain("antigravity-gemini-4-hydrogen-tiered")
    expect(ids).toContain("antigravity-gemini-4-hydrogen-sonar")
    expect(ids).toHaveLength(17)

    expect(resolveGenerationRoute(getCatalogEntry("antigravity-gemini-3.8-flash-tiered")!, "high")).toEqual({
      wireModel: "gemini-3.8-flash-tiered",
      thinking: { kind: "budget", budget: -1, includeThoughts: true },
    })
    expect(resolveGenerationRoute(getCatalogEntry("antigravity-gemini-3.7-flash-tiered")!, "medium")).toEqual({
      wireModel: "gemini-3.7-flash-tiered",
      thinking: { kind: "budget", budget: 4000, includeThoughts: true },
    })
    expect(resolveGenerationRoute(getCatalogEntry("antigravity-gemini-3.6-flash-tiered")!, "off")).toEqual({
      wireModel: "gemini-3.6-flash-tiered",
      thinking: { kind: "omit" },
    })
    expect(resolveGenerationRoute(getCatalogEntry("antigravity-gemini-4-hydrogen-tiered")!, "high")).toEqual({
      wireModel: "gemini-4-hydrogen-tiered-high",
      thinking: { kind: "budget", budget: -1, includeThoughts: true },
    })
    expect(resolveGenerationRoute(getCatalogEntry("antigravity-gemini-4-hydrogen-tiered")!, "xhigh")).toEqual({
      wireModel: "gemini-4-hydrogen-tiered-xhigh",
      thinking: { kind: "budget", budget: -1, includeThoughts: true },
    })
    expect(() => resolveGenerationRoute(getCatalogEntry("antigravity-gemini-4-hydrogen-tiered")!, "low")).toThrow(
      "Unsupported reasoning level",
    )

    expect(resolveGenerationRoute(getCatalogEntry("antigravity-gemini-4-hydrogen-sonar")!, "high")).toEqual({
      wireModel: "gemini-4-hydrogen-sonar",
      thinking: { kind: "budget", budget: -1, includeThoughts: true },
    })
    expect(ANTIGRAVITY_MODEL_ENUM["gemini-4-hydrogen-sonar"]).toBe("MODEL_PLACEHOLDER_M578")
  })

  it("serializes application/pdf multimodal inputs across image/document/file shapes in user and toolResult messages, while rejecting binary parts on text-only models", () => {
    const geminiModel = { id: "antigravity-gemini-4-carbon" } as Model<string>
    const gptOssModel = { id: "antigravity-gpt-oss-120b" } as Model<string>
    const pdfBase64 = Buffer.from("%PDF-1.7 sample pdf payload").toString("base64")

    const userSerialized = serializeTextContext({
      context: {
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Summarize these PDFs:" },
              { type: "image", mimeType: "application/pdf", data: `data:application/pdf;base64,${pdfBase64}` },
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
              } as never,
              { type: "file", mimeType: "application/pdf", data: pdfBase64 } as never,
            ],
            timestamp: 1,
          },
        ],
      },
      model: geminiModel,
      project: "proj-pdf",
      requestId: "req-pdf-1",
    })

    expect(userSerialized.request.contents[0]?.parts).toEqual([
      { text: "Summarize these PDFs:" },
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
    ])

    // Reject binary PDF/image on text-only GPT-OSS model
    expect(() =>
      serializeTextContext({
        context: {
          messages: [
            {
              role: "user",
              content: [{ type: "image", mimeType: "application/pdf", data: pdfBase64 }],
              timestamp: 1,
            },
          ],
        },
        model: gptOssModel,
        project: "proj-pdf",
        requestId: "req-pdf-gpt",
      }),
    ).toThrow(ContextSerializationError)

    // Tool result containing application/pdf
    const sig = Buffer.from("pdf-tool-result-signature-bytes-0123456789abcdef").toString("base64")
    const selection = resolveGenerationSelection(getCatalogEntry("antigravity-gemini-4-carbon")!, "high")
    const toolSerialized = serializeContext(
      {
        context: {
          tools: [
            {
              name: "read_pdf",
              description: "Read PDF",
              parameters: { type: "object", properties: { path: { type: "string" } } } as never,
            },
          ],
          messages: [
            { role: "user", content: "Open spec.pdf", timestamp: 1 },
            {
              role: "assistant",
              provider: "antigravity-guard",
              model: "antigravity-gemini-4-carbon",
              api: "antigravity-guard-sse",
              stopReason: "toolUse",
              usage: {} as never,
              timestamp: 2,
              content: [
                {
                  type: "toolCall",
                  id: "call-pdf-1",
                  name: "read_pdf",
                  arguments: { path: "spec.pdf" },
                  thoughtSignature: sig,
                },
              ],
            },
            {
              role: "toolResult",
              toolCallId: "call-pdf-1",
              toolName: "read_pdf",
              isError: false,
              timestamp: 3,
              content: [{ type: "document", mimeType: "application/pdf", data: pdfBase64 } as never],
            },
          ],
        },
        model: geminiModel,
        options: { reasoning: "high" },
        project: "proj-pdf",
        requestId: "req-pdf-tool",
      },
      selection,
    )

    expect(toolSerialized.request.contents[2]?.parts).toEqual([
      { functionResponse: { name: "read_pdf", response: { output: "[PDF content]" } } },
      { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
    ])
  })

  it("auto-injects native { googleSearch: {} } on -sonar text turns (without functionDeclarations) and formats groundingMetadata citations in ResponseSemantics", () => {
    const sonarModel = { id: "antigravity-gemini-4-hydrogen-sonar" } as Model<string>
    const textReq = serializeTextContext({
      context: { messages: [{ role: "user", content: "Latest TypeScript release?", timestamp: 1 }] },
      model: sonarModel,
      options: { reasoning: "high" },
      project: "proj-sonar",
      requestId: "req-sonar-1",
    })
    expect(textReq.request.tools).toEqual([{ googleSearch: {} }])

    // When functionDeclarations are present on -sonar, omit { googleSearch: {} } to respect Cloud Code constraint
    const sonarSelection = resolveGenerationSelection(getCatalogEntry("antigravity-gemini-4-hydrogen-sonar")!, "high")
    const toolReq = serializeContext(
      {
        context: {
          tools: [
            {
              name: "read_file",
              description: "Read file",
              parameters: { type: "object", properties: { p: { type: "string" } } } as never,
            },
          ],
          messages: [{ role: "user", content: "Read README", timestamp: 1 }],
        },
        model: sonarModel,
        options: { reasoning: "high" },
        project: "proj-sonar",
        requestId: "req-sonar-2",
      },
      sonarSelection,
    )
    expect(toolReq.request.tools).toEqual([
      {
        functionDeclarations: [
          {
            name: "read_file",
            description: "Read file",
            parametersJsonSchema: { properties: { p: { type: "string" } }, type: "object" },
          },
        ],
      },
    ])

    // ResponseSemantics accepts groundingMetadata and urlContextMetadata and emits citation footer
    const semantics = new ResponseSemantics()
    const chunkEvents = semantics.push(
      JSON.stringify({
        response: {
          candidates: [
            {
              content: { parts: [{ text: "TypeScript 5.8 is available." }] },
              groundingMetadata: {
                webSearchQueries: ["typescript latest release"],
                groundingChunks: [{ web: { title: "TypeScript Blog", uri: "https://devblogs.microsoft.com/typescript/" } }],
              },
              urlContextMetadata: {
                url_metadata: [
                  {
                    retrieved_url: "https://devblogs.microsoft.com/typescript/",
                    url_retrieval_status: "URL_RETRIEVAL_STATUS_SUCCESS",
                  },
                ],
              },
              finishReason: "STOP",
            },
          ],
        },
      }),
    )
    expect(chunkEvents).toEqual([
      { type: "text", text: "TypeScript 5.8 is available." },
      {
        type: "text",
        text: expect.stringContaining("### Sources\n- [TypeScript Blog](https://devblogs.microsoft.com/typescript/)"),
      },
    ])
    expect(semantics.finish()).toEqual({ type: "finish", reason: "stop" })
  })

  it("captures delayed signature arriving on final text chunk after unsigned intermediate text deltas (R4-2)", async () => {
    const homeDir = makeTempHome()
    const delayedSig = Buffer.from("delayed-trailing-text-signature-0123456789abcdef012345").toString("base64")
    const fetchMock = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          [
            `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ thought: true, text: "Deep reasoning" }] } }] } })}\n\n`,
            `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Part 1 " }] } }] } })}\n\n`,
            `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Part 2", thoughtSignature: delayedSig }] }, finishReason: "STOP" }] } })}\n\n`,
          ].join(""),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Done" }] }, finishReason: "STOP" }] } })}\n\n`,
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
      )

    const registerProvider = vi.fn()
    const runtime = registerAntigravityProvider(
      { registerProvider },
      { homeDir, cwd: homeDir, env: { PI_OFFLINE: "1" }, fetch: fetchMock },
    )
    try {
      const [, cfg] = registerProvider.mock.calls[0] ?? []
      const carbonModel = {
        ...toPiModelDescriptor(getCatalogEntry("antigravity-gemini-4-carbon")!),
        api: "antigravity-guard-sse",
        provider: "antigravity-guard",
      }
      const user1 = { role: "user" as const, content: "Test R4-2", timestamp: 1700099000 }
      const s1 = cfg.streamSimple(
        carbonModel,
        { messages: [user1] },
        { apiKey: '{"token":"t","projectId":"p"}', fetch: fetchMock, reasoning: "high" },
      )
      for await (const _e of s1) {
        // drain
      }
      const turn1 = await s1.result()

      const s2 = cfg.streamSimple(
        carbonModel,
        { messages: [user1, turn1, { role: "user", content: "Next", timestamp: 1700099001 }] },
        { apiKey: '{"token":"t","projectId":"p"}', fetch: fetchMock, reasoning: "high" },
      )
      for await (const _e of s2) {
        // drain
      }
      const sentBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
      expect(sentBody.request.contents[1]?.parts[0]).toEqual({
        thought: true,
        text: "Deep reasoning",
        thoughtSignature: delayedSig,
      })
    } finally {
      runtime.shutdown()
    }
  })

  it("isolates interleaved thinking blocks across unsigned text chunks for signed thoughts and toolCalls (R3-2)", async () => {
    const homeDir = makeTempHome()
    const secondSig = Buffer.from("interleaved-second-thought-signature-0123456789abcdef").toString("base64")
    const toolSig = Buffer.from("interleaved-toolcall-thought-signature-0123456789ab").toString("base64")
    const cand = (parts: unknown[], finishReason?: string) =>
      ({ response: { candidates: [{ content: { parts }, ...(finishReason ? { finishReason } : {}) }] } })
    const sse = (chunks: unknown[]) =>
      new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join(""), { status: 200, headers: { "Content-Type": "text/event-stream" } })
    const fetchMock = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(sse([
        cand([{ thought: true, text: "First unsigned thought" }]),
        cand([{ text: "Bridge text" }]),
        cand([{ thought: true, text: "Second signed thought", thoughtSignature: secondSig }]),
        cand([{ text: "Final answer" }], "STOP"),
      ]))
      .mockResolvedValueOnce(sse([cand([{ text: "OK" }], "STOP")]))
      .mockResolvedValueOnce(sse([
        cand([{ thought: true, text: "Early unsigned thought" }]),
        cand([{ text: "Preface text" }]),
        cand([{ thought: true, text: "Tool reasoning" }]),
        cand([{ functionCall: { name: "lookup", args: { q: "pi" } }, thoughtSignature: toolSig }], "STOP"),
      ]))
      .mockResolvedValueOnce(sse([
        cand([{ thought: true, text: "Solo pre-text thought" }]),
        cand([{ text: "Intervening text" }]),
        cand([{ functionCall: { name: "lookup", args: { q: "v2" } }, thoughtSignature: toolSig }], "STOP"),
      ]))

    const registerProvider = vi.fn()
    const runtime = registerAntigravityProvider({ registerProvider }, { homeDir, cwd: homeDir, env: { PI_OFFLINE: "1" }, fetch: fetchMock })
    try {
      const [, cfg] = registerProvider.mock.calls[0] ?? []
      const carbonModel = { ...toPiModelDescriptor(getCatalogEntry("antigravity-gemini-4-carbon")!), api: "antigravity-guard-sse", provider: "antigravity-guard" }
      const opts = { apiKey: '{"token":"t","projectId":"p"}', fetch: fetchMock, reasoning: "high" as const }
      const user1 = { role: "user" as const, content: "Test R3-2", timestamp: 1700099100 }
      const turn1 = await cfg.streamSimple(carbonModel, { messages: [user1] }, opts).result()
      const strippedTurn1 = {
        ...turn1,
        content: turn1.content.map((part: Record<string, unknown>) => (part.type === "thinking" ? { type: "thinking", thinking: part.thinking } : part)),
      }
      await cfg.streamSimple(carbonModel, { messages: [user1, strippedTurn1 as never, { role: "user", content: "Next", timestamp: 1700099101 }] }, opts).result()
      const sentBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))
      expect(sentBody.request.contents[1]?.parts).toEqual([
        { thought: true, text: "First unsigned thought" },
        { text: "Bridge text" },
        { thought: true, text: "Second signed thought", thoughtSignature: secondSig },
        { text: "Final answer" },
      ])

      const tools = [{ name: "lookup", description: "Lookup", parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] } }]
      const ctx3 = { tools, messages: [{ role: "user" as const, content: "Run lookup", timestamp: 1700099200 }] }
      await cfg.streamSimple(carbonModel, ctx3, opts).result()
      const key3 = resolvePiSignatureSessionKey({ context: ctx3, wireModel: "gemini-4-carbon-high", projectId: "p" })
      expect(runtime.getSignatureCache().getCachedSignature(key3, "Tool reasoning")).toBe(toolSig)
      expect(runtime.getSignatureCache().getCachedSignature(key3, "Early unsigned thought")).toBeUndefined()
      expect(runtime.getSignatureCache().getCachedSignature(key3, "Early unsigned thoughtTool reasoning")).toBeUndefined()

      const ctx4 = { tools, messages: [{ role: "user" as const, content: "Solo pre-text", timestamp: 1700099300 }] }
      await cfg.streamSimple(carbonModel, ctx4, opts).result()
      const key4 = resolvePiSignatureSessionKey({ context: ctx4, wireModel: "gemini-4-carbon-high", projectId: "p" })
      expect(runtime.getSignatureCache().getCachedSignature(key4, "Solo pre-text thought")).toBeUndefined()
    } finally {
      runtime.shutdown()
    }
  })
})
