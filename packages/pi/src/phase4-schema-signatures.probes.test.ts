import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Context, Model } from "@earendil-works/pi-ai"
import { SKIP_THOUGHT_SIGNATURE } from "@benjamolina/antigravity-guard-core"
import { afterEach, describe, expect, it, vi } from "vitest"

import { getCatalogEntry, resolveGenerationSelection } from "./catalog.ts"
import { serializeContext } from "./context.ts"
import { registerAntigravityProvider } from "./provider.ts"
import {
  normalizeCustomToolSchema,
  normalizeToolDeclarations,
  toGeminiSchema,
} from "./tool-schema.ts"

describe("Phase 4 probes: permissive tool schemas, SignatureCache, and sentinel recovery", () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function makeTempHome(): string {
    const dir = mkdtempSync(join(tmpdir(), "pi-phase4-probe-"))
    tempDirs.push(dir)
    return dir
  }

  it("cleans complex schemas for Claude/GPT-OSS ($ref hints, const->enum, anyOf/allOf, constraints, nullable arrays, empty _placeholder) without mutating frozen declarations", () => {
    const declarations = normalizeToolDeclarations([
      {
        name: "complex_tool",
        description: "Exercise permissive schema cleaning",
        parameters: {
          type: "object",
          additionalProperties: false,
          allOf: [
            {
              properties: {
                mode: { type: "string", const: "strict" },
              },
              required: ["mode"],
            },
          ],
          properties: {
            query: {
              type: "string",
              minLength: 2,
              maxLength: 100,
              pattern: "^[a-z]+$",
            },
            target: {
              anyOf: [
                { type: "string", description: "Path target" },
                { type: "number", minimum: 0 },
              ],
            },
            note: {
              type: ["string", "null"],
              description: "Optional note",
            },
          },
          required: ["query", "note"],
        },
      },
      {
        name: "ping_empty",
        description: "Tool with empty object schema",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ])

    expect(Object.isFrozen(declarations[0]?.parameters)).toBe(true)

    const claudeEntry = getCatalogEntry("antigravity-claude-sonnet-4.6")!
    const selection = resolveGenerationSelection(claudeEntry, "high")
    const serialized = serializeContext(
      {
        context: {
          tools: [
            {
              name: declarations[0]!.name,
              description: declarations[0]!.description,
              parameters: declarations[0]!.parameters,
            },
            {
              name: declarations[1]!.name,
              description: declarations[1]!.description,
              parameters: declarations[1]!.parameters,
            },
          ],
          messages: [{ role: "user", content: "run tool", timestamp: 1000 }],
        } as unknown as Context,
        model: { id: "antigravity-claude-sonnet-4.6" } as Model<string>,
        options: { reasoning: "high" },
        project: "proj-1",
        requestId: "agent-11111111-1111-4111-8111-111111111111",
      },
      selection,
    )

    const fnDecls = serialized.request.tools?.[0]?.functionDeclarations ?? []
    expect(fnDecls).toHaveLength(2)

    const cleanedComplex = fnDecls[0]?.parameters as Record<string, any>
    expect(cleanedComplex.type).toBe("object")
    expect(cleanedComplex.additionalProperties).toBeUndefined()
    expect(cleanedComplex.allOf).toBeUndefined()
    expect(cleanedComplex.description).toContain("No extra properties allowed")
    expect(cleanedComplex.properties.mode).toEqual({
      type: "string",
      enum: ["strict"],
    })
    expect(cleanedComplex.properties.query.type).toBe("string")
    expect(cleanedComplex.properties.query.minLength).toBeUndefined()
    expect(cleanedComplex.properties.query.description).toContain("minLength: 2")
    expect(cleanedComplex.properties.query.description).toContain("maxLength: 100")
    expect(cleanedComplex.properties.target.anyOf).toBeUndefined()
    expect(cleanedComplex.properties.target.description).toContain("Accepts: string | number")
    expect(cleanedComplex.properties.note.type).toBe("string")
    expect(cleanedComplex.properties.note.description).toContain("nullable")
    // Nullable root property should be removed from required, while mode + query remain required
    expect(cleanedComplex.required).toEqual(expect.arrayContaining(["query", "mode"]))
    expect(cleanedComplex.required).not.toContain("note")

    const cleanedEmpty = fnDecls[1]?.parameters as Record<string, any>
    expect(cleanedEmpty).toEqual({
      type: "object",
      properties: {
        _placeholder: {
          type: "boolean",
          description: "Placeholder. Always pass true.",
        },
      },
      required: ["_placeholder"],
    })

    // Direct normalizeCustomToolSchema converts $ref into description hints and toGeminiSchema uppercases types
    const refCleaned = normalizeCustomToolSchema({
      type: "object",
      properties: {
        node: { $ref: "#/$defs/TreeNode", description: "Child node" },
      },
    }) as Record<string, any>
    expect(refCleaned.properties.node).toEqual({
      type: "object",
      description: "Child node (See: TreeNode)",
      properties: {
        _placeholder: {
          type: "boolean",
          description: "Placeholder. Always pass true.",
        },
      },
      required: ["_placeholder"],
    })

    expect(
      toGeminiSchema({
        type: "object",
        properties: { count: { type: "integer" } },
        additionalProperties: false,
      }),
    ).toEqual({
      type: "OBJECT",
      properties: { count: { type: "INTEGER" } },
    })
  })

  it("captures streamed thinking signatures, persists them to antigravity-signature-cache.json on shutdown, and restores unsigned Gemini 4 tool turns across runtime restarts and project switches", async () => {
    const homeDir = makeTempHome()
    const validSig = Buffer.from("real-cryptographic-gemini4-thought-signature-bytes-123456").toString("base64")

    const turn1Sse = [
      `data: ${JSON.stringify({
        response: {
          candidates: [
            {
              content: {
                parts: [
                  { thought: true, text: "Step 1: inspect " },
                  { thought: true, text: "workspace config", thoughtSignature: validSig },
                  { functionCall: { name: "read_file", args: { path: "package.json" } }, thoughtSignature: validSig },
                ],
              },
              finishReason: "STOP",
            },
          ],
        },
      })}\n\n`,
    ].join("")

    const fetch1 = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(turn1Sse, { headers: { "Content-Type": "text/event-stream" } }),
    )

    const registerProvider1 = vi.fn()
    const runtime1 = registerAntigravityProvider(
      { registerProvider: registerProvider1 },
      { homeDir, env: { PI_OFFLINE: "1" }, fetch: fetch1 },
    )
    await runtime1.refreshSession()

    const [, config1] = registerProvider1.mock.calls[0] ?? []
    const carbonModel = {
      ...config1.models.find((m: { id: string }) => m.id === "antigravity-gemini-4-carbon"),
      api: config1.api,
      provider: "antigravity-guard",
    }

    const userTurn1 = { role: "user" as const, content: "Inspect package.json", timestamp: 1700000001000 }
    const stream1 = config1.streamSimple(
      carbonModel,
      {
        tools: [
          {
            name: "read_file",
            description: "Read file",
            parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
          },
        ],
        messages: [userTurn1],
      },
      { apiKey: '{"token":"tok-acct-1","projectId":"proj-acct-1"}', fetch: fetch1, reasoning: "high" },
    )
    for await (const _event of stream1) {
      // consume stream
    }

    runtime1.shutdown()

    const cacheFile = join(homeDir, ".pi", "agent", "antigravity-signature-cache.json")
    expect(existsSync(cacheFile)).toBe(true)
    const persistedJson = JSON.parse(readFileSync(cacheFile, "utf8")) as { version: string; entries: Record<string, unknown> }
    expect(persistedJson.version).toBe("1.0")
    expect(Object.keys(persistedJson.entries).length).toBeGreaterThan(0)

    // Simulate process restart + account rotation to proj-acct-2 + reasoning change high->low
    // with signatures stripped from persisted history!
    const turn2Sse = [
      `data: ${JSON.stringify({
        response: {
          candidates: [{ content: { parts: [{ text: "Done reading package.json" }] }, finishReason: "STOP" }],
        },
      })}\n\n`,
    ].join("")
    const fetch2 = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(turn2Sse, { headers: { "Content-Type": "text/event-stream" } }),
    )
    const registerProvider2 = vi.fn()
    const runtime2 = registerAntigravityProvider(
      { registerProvider: registerProvider2 },
      { homeDir, env: { PI_OFFLINE: "1" }, fetch: fetch2 },
    )
    await runtime2.refreshSession()

    const [, config2] = registerProvider2.mock.calls[0] ?? []
    const stream2 = config2.streamSimple(
      carbonModel,
      {
        tools: [
          {
            name: "read_file",
            description: "Read file",
            parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
          },
        ],
        messages: [
          userTurn1,
          {
            role: "assistant",
            provider: "antigravity-guard",
            model: "antigravity-gemini-4-carbon",
            api: config2.api,
            stopReason: "toolUse",
            timestamp: 1700000002000,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            content: [
              // Notice: thinkingSignature and toolCall thoughtSignature were both stripped!
              { type: "thinking", thinking: "Step 1: inspect workspace config" },
              { type: "toolCall", id: "call-1", name: "read_file", arguments: { path: "package.json" } },
            ],
          },
          {
            role: "toolResult",
            toolCallId: "call-1",
            toolName: "read_file",
            content: [{ type: "text", text: '{"name":"demo"}' }],
            isError: false,
            timestamp: 1700000003000,
          },
        ],
      },
      { apiKey: '{"token":"tok-acct-2","projectId":"proj-acct-2"}', fetch: fetch2, reasoning: "low" },
    )
    const events2 = []
    for await (const event of stream2) events2.push(event)
    runtime2.shutdown()

    expect(events2.at(-1)?.type).toBe("done")
    const sentBody2 = JSON.parse(String(fetch2.mock.calls[0]?.[1]?.body))
    expect(sentBody2.request.contents[1]).toEqual({
      role: "model",
      parts: [
        { thought: true, text: "Step 1: inspect workspace config", thoughtSignature: validSig },
        { functionCall: { name: "read_file", args: { path: "package.json" } }, thoughtSignature: validSig },
      ],
    })
    expect(sentBody2.request.contents[2]).toEqual({
      role: "user",
      parts: [
        { functionResponse: { name: "read_file", response: { output: '{"name":"demo"}' } } },
      ],
    })
  })

  it("injects skip_thought_signature_validator on ONLY the first parallel Gemini 3/4 functionCall on cold cache, partitions Claude cache by project with sentinel fallback, and keeps malformed/foreign calls safe", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () =>
      new Response(
        'data: {"response":{"candidates":[{"content":{"parts":[{"text":"ok"}]},"finishReason":"STOP"}]}}\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    )

    const registerProvider = vi.fn()
    // Un-scoped runtime: must stay hermetic (no disk cache) while enabling sentinel fallback
    const runtime = registerAntigravityProvider({ registerProvider }, { fetch })
    expect(runtime.getSignatureCache().getDiskCache()).toBeNull()

    const [, config] = registerProvider.mock.calls[0] ?? []
    const flashModel = {
      ...config.models.find((m: { id: string }) => m.id === "antigravity-gemini-3.8-flash"),
      api: config.api,
      provider: "antigravity-guard",
    }

    // 1. Cold-cache parallel unsigned tool calls on same-model Gemini 3.8 Flash
    const parallelStream = config.streamSimple(
      flashModel,
      {
        tools: [
          {
            name: "read_file",
            description: "Read file",
            parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
          },
        ],
        messages: [
          { role: "user", content: "Read both files", timestamp: 1700000010000 },
          {
            role: "assistant",
            provider: "antigravity-guard",
            model: "antigravity-gemini-3.8-flash",
            api: config.api,
            stopReason: "toolUse",
            timestamp: 1700000011000,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            content: [
              { type: "toolCall", id: "call-a", name: "read_file", arguments: { path: "a.ts" } },
              { type: "toolCall", id: "call-b", name: "read_file", arguments: { path: "b.ts" } },
            ],
          },
          {
            role: "toolResult",
            toolCallId: "call-a",
            toolName: "read_file",
            content: [{ type: "text", text: "A" }],
            isError: false,
            timestamp: 1700000012000,
          },
          {
            role: "toolResult",
            toolCallId: "call-b",
            toolName: "read_file",
            content: [{ type: "text", text: "B" }],
            isError: false,
            timestamp: 1700000013000,
          },
        ],
      },
      { apiKey: '{"token":"tok","projectId":"proj-1"}', fetch, reasoning: "high" },
    )
    for await (const _e of parallelStream) {
      // consume
    }

    const parallelSent = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))
    expect(parallelSent.request.contents[1]).toEqual({
      role: "model",
      parts: [
        {
          functionCall: { name: "read_file", args: { path: "a.ts" } },
          thoughtSignature: SKIP_THOUGHT_SIGNATURE,
        },
        // Second parallel functionCall MUST NOT carry thoughtSignature
        {
          functionCall: { name: "read_file", args: { path: "b.ts" } },
        },
      ],
    })
    expect(parallelSent.request.contents[2]).toEqual({
      role: "user",
      parts: [
        { functionResponse: { name: "read_file", response: { output: "A" } } },
        { functionResponse: { name: "read_file", response: { output: "B" } } },
      ],
    })

    // 2. Malformed explicit signature ("not base64") is NOT masked by sentinel and degrades to observation
    const malformedStream = config.streamSimple(
      flashModel,
      {
        tools: [
          {
            name: "read_file",
            description: "Read file",
            parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
          },
        ],
        messages: [
          { role: "user", content: "Read bad", timestamp: 1700000020000 },
          {
            role: "assistant",
            provider: "antigravity-guard",
            model: "antigravity-gemini-3.8-flash",
            api: config.api,
            stopReason: "toolUse",
            timestamp: 1700000021000,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            content: [
              {
                type: "toolCall",
                id: "call-bad",
                name: "read_file",
                arguments: { path: "bad.ts" },
                thoughtSignature: "not base64",
              },
            ],
          },
          {
            role: "toolResult",
            toolCallId: "call-bad",
            toolName: "read_file",
            content: [{ type: "text", text: "BAD" }],
            isError: false,
            timestamp: 1700000022000,
          },
        ],
      },
      { apiKey: '{"token":"tok","projectId":"proj-1"}', fetch, reasoning: "high" },
    )
    for await (const _e of malformedStream) {
      // consume
    }

    const malformedSent = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))
    expect(malformedSent.request.contents).toEqual([
      {
        role: "user",
        parts: [
          { text: "Read bad" },
          { text: '[Observation from `read_file` ({"path":"bad.ts"}):\nBAD]' },
        ],
      },
    ])

    // 3. Claude cold-cache unsigned thinking block gets sentinel, and Claude cached signature does NOT leak across projects
    const claudeModel = {
      ...config.models.find((m: { id: string }) => m.id === "antigravity-claude-sonnet-4.6"),
      api: config.api,
      provider: "antigravity-guard",
    }
    const claudeSig = Buffer.from("claude-project-a-real-signature-bytes-12345678").toString("base64")
    fetch.mockResolvedValueOnce(
      new Response(
        `data: ${JSON.stringify({
          response: {
            candidates: [
              {
                content: {
                  parts: [
                    { thought: true, text: "Claude reasoning for proj A", thoughtSignature: claudeSig },
                    { text: "Initial reply" },
                  ],
                },
                finishReason: "STOP",
              },
            ],
          },
        })}\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    )

    const claudeUser1 = { role: "user" as const, content: "Analyze repo", timestamp: 1700000030000 }
    const claudeTurn1 = config.streamSimple(
      claudeModel,
      { messages: [claudeUser1] },
      { apiKey: '{"token":"tok","projectId":"claude-proj-a"}', fetch, reasoning: "high" },
    )
    for await (const _e of claudeTurn1) {
      // consume
    }

    // Replay same conversation on DIFFERENT project ("claude-proj-b") with stripped signature -> must NOT reuse claude-proj-a's signature, falls back to sentinel!
    const claudeTurn2CrossProj = config.streamSimple(
      claudeModel,
      {
        messages: [
          claudeUser1,
          {
            role: "assistant",
            provider: "antigravity-guard",
            model: "antigravity-claude-sonnet-4.6",
            api: config.api,
            stopReason: "stop",
            timestamp: 1700000031000,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            content: [
              { type: "thinking", thinking: "Claude reasoning for proj A" },
              { type: "text", text: "Initial reply" },
            ],
          },
          { role: "user", content: "Continue", timestamp: 1700000032000 },
        ],
      },
      { apiKey: '{"token":"tok","projectId":"claude-proj-b"}', fetch, reasoning: "high" },
    )
    for await (const _e of claudeTurn2CrossProj) {
      // consume
    }

    const claudeCrossSent = JSON.parse(String(fetch.mock.calls[3]?.[1]?.body))
    expect(claudeCrossSent.request.contents[1]?.parts[0]).toEqual({
      thought: true,
      text: "Claude reasoning for proj A",
      thoughtSignature: SKIP_THOUGHT_SIGNATURE,
    })

    // Replay on SAME project ("claude-proj-a") -> restores exact claudeSig!
    const claudeTurn2SameProj = config.streamSimple(
      claudeModel,
      {
        messages: [
          claudeUser1,
          {
            role: "assistant",
            provider: "antigravity-guard",
            model: "antigravity-claude-sonnet-4.6",
            api: config.api,
            stopReason: "stop",
            timestamp: 1700000031000,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            content: [
              { type: "thinking", thinking: "Claude reasoning for proj A" },
              { type: "text", text: "Initial reply" },
            ],
          },
          { role: "user", content: "Continue", timestamp: 1700000032000 },
        ],
      },
      { apiKey: '{"token":"tok","projectId":"claude-proj-a"}', fetch, reasoning: "high" },
    )
    for await (const _e of claudeTurn2SameProj) {
      // consume
    }

    const claudeSameSent = JSON.parse(String(fetch.mock.calls[4]?.[1]?.body))
    expect(claudeSameSent.request.contents[1]?.parts[0]).toEqual({
      thought: true,
      text: "Claude reasoning for proj A",
      thoughtSignature: claudeSig,
    })

    runtime.shutdown()
  })

  it("shares ~/.config/opencode/antigravity-signature-cache.json via cascade when OpenCode dir exists and honors signature_cache.enabled=false", async () => {
    const homeDir = makeTempHome()
    const opencodeDir = join(homeDir, ".config", "opencode")
    mkdirSync(opencodeDir, { recursive: true })

    // 1. When signature_cache.enabled = false in shared antigravity.json, no disk file is created
    writeFileSync(
      join(opencodeDir, "antigravity.json"),
      JSON.stringify({ signature_cache: { enabled: false } }),
      "utf8",
    )

    const sig = Buffer.from("shared-cascade-signature-bytes-1234567890").toString("base64")
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () =>
      new Response(
        `data: ${JSON.stringify({
          response: {
            candidates: [
              {
                content: {
                  parts: [
                    { thought: true, text: "Shared cascade thought", thoughtSignature: sig },
                    { text: "Done" },
                  ],
                },
                finishReason: "STOP",
              },
            ],
          },
        })}\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    )

    const registerDisabled = vi.fn()
    const disabledRuntime = registerAntigravityProvider(
      { registerProvider: registerDisabled },
      { homeDir, env: { PI_OFFLINE: "1" }, fetch },
    )
    expect(disabledRuntime.getSignatureCache().getDiskCache()).toBeNull()
    const [, disabledConfig] = registerDisabled.mock.calls[0] ?? []
    const argonModel = {
      ...disabledConfig.models.find((m: { id: string }) => m.id === "antigravity-gemini-4-argon"),
      api: disabledConfig.api,
      provider: "antigravity-guard",
    }
    const s1 = disabledConfig.streamSimple(
      argonModel,
      { messages: [{ role: "user", content: "Hi", timestamp: 1700000090000 }] },
      { apiKey: '{"token":"tok","projectId":"proj"}', fetch, reasoning: "low" },
    )
    for await (const _e of s1) {
      // consume
    }
    disabledRuntime.shutdown()
    expect(existsSync(join(opencodeDir, "antigravity-signature-cache.json"))).toBe(false)

    // 2. Enable signature_cache -> persists directly into ~/.config/opencode/antigravity-signature-cache.json without overwriting existing OpenCode entries
    writeFileSync(
      join(opencodeDir, "antigravity.json"),
      JSON.stringify({ signature_cache: { enabled: true } }),
      "utf8",
    )
    writeFileSync(
      join(opencodeDir, "antigravity-signature-cache.json"),
      JSON.stringify({
        version: "1.0",
        entries: {
          "opencode-existing-hash": {
            value: sig,
            timestamp: Date.now(),
          },
        },
      }),
      "utf8",
    )

    const registerEnabled = vi.fn()
    const enabledRuntime = registerAntigravityProvider(
      { registerProvider: registerEnabled },
      { homeDir, env: { PI_OFFLINE: "1" }, fetch },
    )
    const [, enabledConfig] = registerEnabled.mock.calls[0] ?? []
    const s2 = enabledConfig.streamSimple(
      argonModel,
      { messages: [{ role: "user", content: "Hi", timestamp: 1700000090000 }] },
      { apiKey: '{"token":"tok","projectId":"proj"}', fetch, reasoning: "low" },
    )
    for await (const _e of s2) {
      // consume
    }
    enabledRuntime.shutdown()

    const mergedCache = JSON.parse(
      readFileSync(join(opencodeDir, "antigravity-signature-cache.json"), "utf8"),
    ) as { version: string; entries: Record<string, unknown> }
    expect(mergedCache.version).toBe("1.0")
    expect(mergedCache.entries["opencode-existing-hash"]).toBeDefined()
    expect(Object.keys(mergedCache.entries).length).toBe(2)
  })

  it("restores cached signature on antigravity-gemini-3.1-pro across reasoning tier switch high (gemini-pro-agent) <-> low (gemini-3.1-pro-low) (S5 / B1)", async () => {
    const homeDir = makeTempHome()
    const validSig = Buffer.from("real-gemini-31-pro-agent-signature-bytes-0123456789abcdef").toString("base64")

    const turn1Sse = `data: ${JSON.stringify({
      response: {
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: "Analyzing architecture " },
                { thought: true, text: "at high tier", thoughtSignature: validSig },
                { functionCall: { name: "read_file", args: { path: "README.md" } }, thoughtSignature: validSig },
              ],
            },
            finishReason: "STOP",
          },
        ],
      },
    })}\n\n`

    const fetch1 = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(turn1Sse, { headers: { "Content-Type": "text/event-stream" } }),
    )
    const reg1 = vi.fn()
    const runtime1 = registerAntigravityProvider(
      { registerProvider: reg1 },
      { homeDir, env: { PI_OFFLINE: "1" }, fetch: fetch1 },
    )
    await runtime1.refreshSession()
    const [, cfg1] = reg1.mock.calls[0]!
    const proModel = {
      ...cfg1.models.find((m: { id: string }) => m.id === "antigravity-gemini-3.1-pro"),
      api: cfg1.api,
      provider: "antigravity-guard",
    }
    const user1 = { role: "user" as const, content: "Check README", timestamp: 1700001000000 }
    const s1 = cfg1.streamSimple(
      proModel,
      {
        tools: [{ name: "read_file", description: "Read", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }],
        messages: [user1],
      },
      { apiKey: '{"token":"t1","projectId":"proj-1"}', fetch: fetch1, reasoning: "high" },
    )
    for await (const _e of s1) {
      // consume
    }
    runtime1.shutdown()

    const fetch2 = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(
        'data: {"response":{"candidates":[{"content":{"parts":[{"text":"Done"}]},"finishReason":"STOP"}]}}\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    )
    const reg2 = vi.fn()
    const runtime2 = registerAntigravityProvider(
      { registerProvider: reg2 },
      { homeDir, env: { PI_OFFLINE: "1" }, fetch: fetch2 },
    )
    await runtime2.refreshSession()
    const [, cfg2] = reg2.mock.calls[0]!
    const s2 = cfg2.streamSimple(
      proModel,
      {
        tools: [{ name: "read_file", description: "Read", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }],
        messages: [
          user1,
          {
            role: "assistant",
            provider: "antigravity-guard",
            model: "antigravity-gemini-3.1-pro",
            api: cfg2.api,
            stopReason: "toolUse",
            timestamp: 1700001001000,
            usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
            content: [
              { type: "thinking", thinking: "Analyzing architecture at high tier" },
              { type: "toolCall", id: "call-1", name: "read_file", arguments: { path: "README.md" } },
            ],
          },
          {
            role: "toolResult",
            toolCallId: "call-1",
            toolName: "read_file",
            content: [{ type: "text", text: "readme" }],
            isError: false,
            timestamp: 1700001002000,
          },
        ],
      },
      { apiKey: '{"token":"t2","projectId":"proj-2"}', fetch: fetch2, reasoning: "low" },
    )
    for await (const _e of s2) {
      // consume
    }
    runtime2.shutdown()

    const body2 = JSON.parse(String(fetch2.mock.calls[0]?.[1]?.body))
    expect(body2.request.contents[1]).toEqual({
      role: "model",
      parts: [
        { thought: true, text: "Analyzing architecture at high tier", thoughtSignature: validSig },
        { functionCall: { name: "read_file", args: { path: "README.md" } }, thoughtSignature: validSig },
      ],
    })
  })

  it("partitions Claude signatures across live account/project rotation when AssistantMessage retains Turn 1 thinkingSignature (S1, S5 / B2)", async () => {
    const claudeSigA = Buffer.from("claude-proj-a-cryptographic-signature-bytes-0123456789").toString("base64")
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          `data: ${JSON.stringify({
            response: {
              candidates: [
                {
                  content: {
                    parts: [
                      { thought: true, text: "Claude live thought on project A", thoughtSignature: claudeSigA },
                      { text: "Turn 1 answer" },
                    ],
                  },
                  finishReason: "STOP",
                },
              ],
            },
          })}\n\n`,
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      )
      .mockImplementation(async () =>
        new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"Next"}]},"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      )

    const reg = vi.fn()
    const runtime = registerAntigravityProvider({ registerProvider: reg }, { fetch })
    const [, cfg] = reg.mock.calls[0]!
    const opusModel = {
      ...cfg.models.find((m: { id: string }) => m.id === "antigravity-claude-opus-4.6-thinking"),
      api: cfg.api,
      provider: "antigravity-guard",
    }

    const user1 = { role: "user" as const, content: "Start task", timestamp: 1700002000000 }
    const s1 = cfg.streamSimple(
      opusModel,
      { messages: [user1] },
      { apiKey: '{"token":"tok-a","projectId":"claude-proj-a"}', fetch, reasoning: "high" },
    )
    for await (const _e of s1) {
      // consume
    }
    const liveAssistantTurn1 = await s1.result()

    const s2B = cfg.streamSimple(
      opusModel,
      {
        messages: [
          user1,
          liveAssistantTurn1,
          { role: "user", content: "Continue on rotated account", timestamp: 1700002001000 },
        ],
      },
      { apiKey: '{"token":"tok-b","projectId":"claude-proj-b"}', fetch, reasoning: "high" },
    )
    for await (const _e of s2B) {
      // consume
    }
    const sentToB = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))
    expect(sentToB.request.contents[1]?.parts[0]).toEqual({
      thought: true,
      text: "Claude live thought on project A",
      thoughtSignature: SKIP_THOUGHT_SIGNATURE,
    })

    const s2A = cfg.streamSimple(
      opusModel,
      {
        messages: [
          user1,
          liveAssistantTurn1,
          { role: "user", content: "Continue on original account", timestamp: 1700002001000 },
        ],
      },
      { apiKey: '{"token":"tok-a","projectId":"claude-proj-a"}', fetch, reasoning: "high" },
    )
    for await (const _e of s2A) {
      // consume
    }
    const sentToA = JSON.parse(String(fetch.mock.calls[2]?.[1]?.body))
    expect(sentToA.request.contents[1]?.parts[0]).toEqual({
      thought: true,
      text: "Claude live thought on project A",
      thoughtSignature: claudeSigA,
    })
    runtime.shutdown()
  })

  it("captures thinking signature when thoughtSignature arrives on trailing text part after unsigned thinking deltas (S1, S5 / B3)", async () => {
    const trailingSig = Buffer.from("gemini4-trailing-text-part-thought-signature-0123456789").toString("base64")
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          [
            `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ thought: true, text: "Step A: " }, { thought: true, text: "derive answer" }] } }] } })}\n\n`,
            `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "42", thoughtSignature: trailingSig }] }, finishReason: "STOP" }] } })}\n\n`,
          ].join(""),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"Next"}]},"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      )

    const reg = vi.fn()
    const runtime = registerAntigravityProvider({ registerProvider: reg }, { fetch })
    const [, cfg] = reg.mock.calls[0]!
    const carbonModel = {
      ...cfg.models.find((m: { id: string }) => m.id === "antigravity-gemini-4-carbon"),
      api: cfg.api,
      provider: "antigravity-guard",
    }
    const user1 = { role: "user" as const, content: "Compute 6*7", timestamp: 1700003000000 }
    const s1 = cfg.streamSimple(
      carbonModel,
      { messages: [user1] },
      { apiKey: '{"token":"t","projectId":"p"}', fetch, reasoning: "high" },
    )
    for await (const _e of s1) {
      // consume
    }
    const turn1Result = await s1.result()

    const s2 = cfg.streamSimple(
      carbonModel,
      {
        messages: [
          user1,
          turn1Result,
          { role: "user", content: "Follow up", timestamp: 1700003001000 },
        ],
      },
      { apiKey: '{"token":"t","projectId":"p"}', fetch, reasoning: "high" },
    )
    for await (const _e of s2) {
      // consume
    }
    const sent2 = JSON.parse(String(fetch.mock.calls[1]?.[1]?.body))
    expect(sent2.request.contents[1]?.parts[0]).toEqual({
      thought: true,
      text: "Step A: derive answer",
      thoughtSignature: trailingSig,
    })
    runtime.shutdown()
  })

  it("honors signature_cache.memory_ttl_seconds across initial load and refreshSession(cwd) with injectable options.now (S5 / B4)", async () => {
    const homeDir = makeTempHome()
    const piDir = join(homeDir, ".pi", "agent")
    mkdirSync(piDir, { recursive: true })
    writeFileSync(
      join(piDir, "antigravity.json"),
      JSON.stringify({ signature_cache: { enabled: false, memory_ttl_seconds: 60 } }),
      "utf8",
    )

    let currentNow = 1_000_000
    const sig = Buffer.from("ttl-test-gemini4-thought-signature-bytes-0123456789abcd").toString("base64")
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(
          `data: ${JSON.stringify({
            response: {
              candidates: [
                {
                  content: {
                    parts: [
                      { thought: true, text: "Short TTL thought", thoughtSignature: sig },
                      { functionCall: { name: "read_file", args: { path: "x.ts" } }, thoughtSignature: sig },
                    ],
                  },
                  finishReason: "STOP",
                },
              ],
            },
          })}\n\n`,
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      )
      .mockImplementation(async () =>
        new Response(
          'data: {"response":{"candidates":[{"content":{"parts":[{"text":"ok"}]},"finishReason":"STOP"}]}}\n\n',
          { headers: { "Content-Type": "text/event-stream" } },
        ),
      )

    const reg = vi.fn()
    const runtime = registerAntigravityProvider(
      { registerProvider: reg },
      { homeDir, env: { PI_OFFLINE: "1" }, fetch, now: () => currentNow },
    )
    const [, cfg] = reg.mock.calls[0]!
    const argonModel = {
      ...cfg.models.find((m: { id: string }) => m.id === "antigravity-gemini-4-argon"),
      api: cfg.api,
      provider: "antigravity-guard",
    }
    const tools = [{ name: "read_file", description: "Read", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }]
    const user1 = { role: "user" as const, content: "Read x.ts", timestamp: 1700004000000 }

    const s1 = cfg.streamSimple(argonModel, { tools, messages: [user1] }, { apiKey: '{"token":"t","projectId":"p"}', fetch, reasoning: "low" })
    for await (const _e of s1) {
      // consume
    }

    const strippedHistory = [
      user1,
      {
        role: "assistant",
        provider: "antigravity-guard",
        model: "antigravity-gemini-4-argon",
        api: cfg.api,
        stopReason: "toolUse",
        timestamp: 1700004001000,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        content: [
          { type: "thinking", thinking: "Short TTL thought" },
          { type: "toolCall", id: "c1", name: "read_file", arguments: { path: "x.ts" } },
        ],
      },
      { role: "toolResult", toolCallId: "c1", toolName: "read_file", content: [{ type: "text", text: "ok" }], isError: false, timestamp: 1700004002000 },
    ]

    currentNow += 30_000
    const s2 = cfg.streamSimple(argonModel, { tools, messages: strippedHistory }, { apiKey: '{"token":"t","projectId":"p"}', fetch, reasoning: "low" })
    for await (const _e of s2) {
      // consume
    }
    expect(JSON.parse(String(fetch.mock.calls[1]?.[1]?.body)).request.contents[1]?.parts[1]?.thoughtSignature).toBe(sig)

    currentNow += 40_000
    const s3 = cfg.streamSimple(argonModel, { tools, messages: strippedHistory }, { apiKey: '{"token":"t","projectId":"p"}', fetch, reasoning: "low" })
    for await (const _e of s3) {
      // consume
    }
    expect(JSON.parse(String(fetch.mock.calls[2]?.[1]?.body)).request.contents[1]?.parts[1]?.thoughtSignature).toBe(SKIP_THOUGHT_SIGNATURE)

    // R3-5: Also verify refreshSession(cwd) dynamically updates memory_ttl_seconds from disk
    writeFileSync(
      join(piDir, "antigravity.json"),
      JSON.stringify({ signature_cache: { enabled: false, memory_ttl_seconds: 120 } }),
      "utf8",
    )
    await runtime.refreshSession(homeDir)
    expect(runtime.getConfig().signature_cache.memory_ttl_seconds).toBe(120)
    runtime.getSignatureCache().cacheSignature("pi:gemini-4-argon:default:reload", "Reloaded thought", sig)
    currentNow += 90_000
    expect(runtime.getSignatureCache().getCachedSignature("pi:gemini-4-argon:default:reload", "Reloaded thought")).toBe(sig)
    currentNow += 35_000
    expect(runtime.getSignatureCache().getCachedSignature("pi:gemini-4-argon:default:reload", "Reloaded thought")).toBeUndefined()

    runtime.shutdown()
  })

  it("preserves cache file byte-identity on rejected preflight (S1, S5)", async () => {
    const homeDir = makeTempHome()
    const sig1 = Buffer.from("multi-block-thought-1-signature-bytes-0123456789abcdef").toString("base64")
    const sig2 = Buffer.from("toolcall-carried-thought-2-signature-bytes-0123456789ab").toString("base64")

    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(
      new Response(
        `data: ${JSON.stringify({
          response: {
            candidates: [
              {
                content: {
                  parts: [
                    { thought: true, text: "First thought", thoughtSignature: sig1 },
                    { text: "Intermediate note" },
                    { thought: true, text: "Second thought without direct sig" },
                    { functionCall: { name: "read_file", args: { path: "a.ts" } }, thoughtSignature: sig2 },
                  ],
                },
                finishReason: "STOP",
              },
            ],
          },
        })}\n\n`,
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    )

    const reg = vi.fn()
    const runtime = registerAntigravityProvider(
      { registerProvider: reg },
      { homeDir, env: { PI_OFFLINE: "1" }, fetch },
    )
    await runtime.refreshSession()
    const [, cfg] = reg.mock.calls[0]!
    const flashModel = {
      ...cfg.models.find((m: { id: string }) => m.id === "antigravity-gemini-3.8-flash"),
      api: cfg.api,
      provider: "antigravity-guard",
    }

    const s1 = cfg.streamSimple(
      flashModel,
      {
        tools: [{ name: "read_file", description: "Read", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }],
        messages: [{ role: "user", content: "Go", timestamp: 1700005000000 }],
      },
      { apiKey: '{"token":"t","projectId":"p"}', fetch, reasoning: "high" },
    )
    for await (const _e of s1) {
      // consume
    }
    runtime.shutdown()

    const cachePath = join(homeDir, ".pi", "agent", "antigravity-signature-cache.json")
    const hashBefore = createHash("sha256").update(readFileSync(cachePath)).digest("hex")

    const runtime2 = registerAntigravityProvider(
      { registerProvider: reg },
      { homeDir, env: { PI_OFFLINE: "1" }, fetch },
    )
    const [, cfg2] = reg.mock.calls[1]!
    const badStream = cfg2.streamSimple(
      flashModel,
      {
        tools: [{ name: "bad_tool", description: "Bad", parameters: { type: "object", properties: { x: { $ref: "https://evil.example/schema" } } } }],
        messages: [{ role: "user", content: "Fail", timestamp: 1700005001000 }],
      },
      { apiKey: '{"token":"t","projectId":"p"}', fetch, reasoning: "high" },
    )
    const badEvents = []
    for await (const ev of badStream) badEvents.push(ev)
    expect(badEvents.at(-1)?.type).toBe("error")
    runtime2.shutdown()
    expect(createHash("sha256").update(readFileSync(cachePath)).digest("hex")).toBe(hashBefore)
  })

  it("restores multi-thought Gemini tool signatures from the immediately preceding thought, preserves secondary pre-signed calls, and honors standalone allowSentinelFallback (R3-1, R3-2, R3-3, R4-1)", () => {
    const sig1 = Buffer.from("multi-thought-early-sig-1-bytes-0123456789abcdef").toString("base64")
    const sig2 = Buffer.from("multi-thought-preceding-sig-2-bytes-0123456789ab").toString("base64")
    const flashSelection = resolveGenerationSelection(getCatalogEntry("antigravity-gemini-3.8-flash")!, "high")
    const claudeSelection = resolveGenerationSelection(getCatalogEntry("antigravity-claude-sonnet-4.6")!, "high")
    const tools = [{ name: "read_file", description: "Read", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }]
    const flashModel = { id: "antigravity-gemini-3.8-flash" } as Model<string>
    const userMsg = { role: "user" as const, content: "Go", timestamp: 1 }
    const resMsg = (id: string, text: string, ts: number) => ({ role: "toolResult" as const, toolCallId: id, toolName: "read_file", content: [{ type: "text", text }], isError: false, timestamp: ts })
    const assistantTurn = (content: unknown[]) => ({ role: "assistant" as const, provider: "antigravity-guard", model: "antigravity-gemini-3.8-flash", stopReason: "toolUse" as const, timestamp: 10, content })
    const serializeFlash = (messages: unknown[], extra: Record<string, unknown>) =>
      serializeContext({ context: { tools, messages } as unknown as Context, model: flashModel, options: { reasoning: "high" }, project: "proj", requestId: "agent-fix", ...extra }, flashSelection)

    const mockCache = { getCachedSignature: (_s: string, text: string) => (text === "First thought" ? sig1 : text === "Second thought" ? sig2 : undefined) }
    const multiThought = serializeFlash([
      userMsg,
      assistantTurn([
        { type: "thinking", thinking: "First thought", thinkingSignature: sig1 },
        { type: "thinking", thinking: "Second thought" },
        { type: "toolCall", id: "c1", name: "read_file", arguments: { path: "a.ts" } },
        { type: "thinking", thinking: "Step 2 thought", thinkingSignature: sig1 },
        { type: "toolCall", id: "c2", name: "read_file", arguments: { path: "b.ts" }, thoughtSignature: sig1 },
      ]),
      resMsg("c1", "A", 11),
      resMsg("c2", "B", 12),
    ], { signatureCache: mockCache })
    expect(multiThought.request.contents[1]?.parts).toEqual([
      { thought: true, text: "First thought", thoughtSignature: sig1 },
      { thought: true, text: "Second thought", thoughtSignature: sig2 },
      { functionCall: { name: "read_file", args: { path: "a.ts" } }, thoughtSignature: sig2 },
      { thought: true, text: "Step 2 thought", thoughtSignature: sig1 },
      { functionCall: { name: "read_file", args: { path: "b.ts" } }, thoughtSignature: sig1 },
    ])

    const coldNoSentinel = serializeFlash([
      userMsg,
      assistantTurn([
        { type: "thinking", thinking: "First thought", thinkingSignature: sig1 },
        { type: "thinking", thinking: "Second thought" },
        { type: "toolCall", id: "c1", name: "read_file", arguments: { path: "a.ts" } },
      ]),
      resMsg("c1", "A", 11),
    ], { signatureCache: { getCachedSignature: () => undefined }, allowSentinelFallback: false })
    expect(coldNoSentinel.request.contents[1]?.parts).toEqual([
      { thought: true, text: "First thought", thoughtSignature: sig1 },
      { thought: true, text: "Second thought" },
    ])
    expect(coldNoSentinel.request.contents[2]?.parts).toEqual([{ text: '[Observation from `read_file` ({"path":"a.ts"}):\nA]' }])

    const standaloneSentinel = serializeFlash(
      [userMsg, assistantTurn([{ type: "toolCall", id: "c1", name: "read_file", arguments: { path: "a.ts" } }]), resMsg("c1", "A", 11)],
      { allowSentinelFallback: true },
    )
    expect((standaloneSentinel.request.contents[1]?.parts[0] as { thoughtSignature?: string })?.thoughtSignature).toBe(SKIP_THOUGHT_SIGNATURE)

    const standaloneClaude = serializeContext({
      context: {
        messages: [
          userMsg,
          { role: "assistant", provider: "antigravity-guard", model: "antigravity-claude-sonnet-4.6", stopReason: "stop", timestamp: 2, content: [{ type: "thinking", thinking: "Unsigned Claude thought" }, { type: "text", text: "Hello" }] },
          { role: "user", content: "Next", timestamp: 3 },
        ],
      } as unknown as Context,
      model: { id: "antigravity-claude-sonnet-4.6" } as Model<string>,
      options: { reasoning: "high" },
      project: "proj",
      requestId: "agent-claude-standalone",
      allowSentinelFallback: true,
    }, claudeSelection)
    expect((standaloneClaude.request.contents[1]?.parts[0] as { thoughtSignature?: string })?.thoughtSignature).toBe(SKIP_THOUGHT_SIGNATURE)

    const rejectedSentinel = serializeFlash(
      [userMsg, assistantTurn([{ type: "toolCall", id: "c1", name: "read_file", arguments: { path: "a.ts" }, thoughtSignature: SKIP_THOUGHT_SIGNATURE }]), resMsg("c1", "A", 11)],
      { signatureCache: { getCachedSignature: () => undefined }, allowSentinelFallback: false },
    )
    expect(rejectedSentinel.request.contents).toEqual([{ role: "user", parts: [{ text: "Go" }, { text: '[Observation from `read_file` ({"path":"a.ts"}):\nA]' }] }])
  })
})
