import { describe, expect, it } from "vitest"

import { ToolPreflightError } from "./tool-contract.ts"
import { prepareToolContext, replayToolHistory } from "./tool-context.ts"

const declaration = { name: "read_file", description: "Read one file", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }

describe("Pi tool request preparation", () => {
  it("retains declaration order and maps omitted, auto, and none choices", () => {
    expect(prepareToolContext([declaration, { ...declaration, name: "list_files" }], undefined, "gemini-parameters-json-schema")?.mode).toBe("AUTO")
    expect(prepareToolContext([declaration], "auto", "gemini-parameters-json-schema")?.mode).toBe("AUTO")
    expect(prepareToolContext([declaration], "none", "gemini-parameters-json-schema")?.mode).toBe("NONE")
  })

  it.each(["required", "read_file", { type: "tool", name: "read_file" }])("rejects forced or named choice %j", (choice) => {
    expect(() => prepareToolContext([declaration], choice, "gemini-parameters-json-schema")).toThrow(ToolPreflightError)
  })

  it("rejects auto without declarations and preserves no-op none", () => {
    expect(() => prepareToolContext([], "auto", "gemini-parameters-json-schema")).toThrow("PI_TOOL_CHOICE_WITHOUT_DECLARATIONS")
    expect(prepareToolContext([], "none", "gemini-parameters-json-schema")).toBeUndefined()
  })
})

describe("Pi tool schema profile", () => {
  it("rejects missing and forged profiles before reading a declaration getter", () => {
    const hostile = Object.create(null, { length: { value: 1 }, 0: { get: () => { throw new Error("CANARY") } } })
    expect(() => prepareToolContext(hostile, undefined, undefined)).toThrow("PI_TOOL_SCHEMA_PROFILE_UNSUPPORTED")
    expect(() => prepareToolContext(hostile, undefined, "forged-profile")).toThrow("PI_TOOL_SCHEMA_PROFILE_UNSUPPORTED")
  })
})

describe("Pi tool history replay", () => {
  const call = (id: string, name = "read_file", argumentsValue: object = { path: id }, thoughtSignature?: string) => ({ type: "toolCall", id, name, arguments: argumentsValue, ...(thoughtSignature ? { thoughtSignature } : {}) })
  const result = (id: string, text: string[], isError = false) => ({ role: "toolResult", toolCallId: id, toolName: "read_file", content: text.map((value) => ({ type: "text", text: value })), isError, timestamp: 0 })
  const assistant = (content: unknown[], stopReason = "toolUse") => ({ role: "assistant", content, stopReason, timestamp: 0 })
  const sameModelAssistant = (content: unknown[], stopReason = "toolUse") => ({ ...assistant(content, stopReason), provider: "antigravity-guard", model: "antigravity-gemini-3.8-flash" })
  const part = (value: Record<string, unknown>) => ({ text: String(value.text ?? value.thinking ?? "") })
  const signedReplay = {
    requireSignedToolCalls: true,
    isSameModel: (message: Record<string, unknown>) => message.provider === "antigravity-guard" && message.model === "antigravity-gemini-3.8-flash",
    toolCallSignature: (value: Record<string, unknown>) => value.thoughtSignature === "c2ln" ? "c2ln" : undefined,
  }

  it("replays reverse-completed same-name calls in source order with stable result encoding", () => {
    const replayed = replayToolHistory([assistant([call("one"), call("two")]), result("two", ["second"]), result("one", ["first", "again"])] , part)
    expect(JSON.stringify(replayed)).toBe(JSON.stringify([
      { role: "model", parts: [{ functionCall: { name: "read_file", args: { path: "one" } } }, { functionCall: { name: "read_file", args: { path: "two" } } }] },
      { role: "user", parts: [{ functionResponse: { name: "read_file", response: { output: "first\n\nagain" } } }, { functionResponse: { name: "read_file", response: { output: "second" } } }] },
    ]))
  })

  it.each([
    [result("one", [], false), { output: "" }],
    [result("one", ["failed", "again"], true), { error: "failed\n\nagain" }],
  ])("encodes successful output and errors without repairing them", (toolResult, response) => {
    expect(replayToolHistory([assistant([call("one")]), toolResult], part)[1]).toEqual({ role: "user", parts: [{ functionResponse: { name: "read_file", response } }] })
  })

  it.each(["resume", "fork", "compaction", "model-handoff"])("reconstructs %s deterministically without shared state", async () => {
    const history = [{ role: "user", content: "before", timestamp: 0 }, assistant([call("one")]), result("one", ["done"])]
    const before = structuredClone(history)
    const serializations = await Promise.all(Array.from({ length: 3 }, () => Promise.resolve(JSON.stringify(replayToolHistory(history, part)))))
    expect(serializations).toEqual([serializations[0], serializations[0], serializations[0]])
    expect(history).toEqual(before)
  })

  it("omits Pi-local IDs from Gemini function call and response wire parts", () => {
    const replayed = replayToolHistory([assistant([call("pi-gemini-call-1")]), result("pi-gemini-call-1", ["done"])], part)
    expect(replayed).toEqual([
      { role: "model", parts: [{ functionCall: { name: "read_file", args: { path: "pi-gemini-call-1" } } }] },
      { role: "user", parts: [{ functionResponse: { name: "read_file", response: { output: "done" } } }] },
    ])
  })

  it("synthesizes missing parallel results with the fixed error response in source order", () => {
    const missing = {
      error: {
        code: "PI_TOOL_RESULT_MISSING",
        message: "Tool execution did not complete or its result was not recorded. Treat the call as failed; do not assume it had no side effects and do not retry it automatically.",
      },
    }
    const recoveryCounts: unknown[] = []
    expect(replayToolHistory([assistant([call("one"), call("two")])], part, (diagnostics) => recoveryCounts.push(diagnostics))[1]).toEqual({
      role: "user",
      parts: [
        { functionResponse: { name: "read_file", response: missing } },
        { functionResponse: { name: "read_file", response: missing } },
      ],
    })
    expect(recoveryCounts).toEqual([{ replayMode: "none", recoveryCount: 2, userMessageCount: 0, assistantMessageCount: 1, toolResultMessageCount: 0, assistantToolCallBlockCount: 2, declaredToolCount: 0 }])
    expect(replayToolHistory([assistant([call("one"), call("two")]), result("two", ["complete"])], part)[1]).toEqual({
      role: "user",
      parts: [
        { functionResponse: { name: "read_file", response: missing } },
        { functionResponse: { name: "read_file", response: { output: "complete" } } },
      ],
    })
  })

  it("reconstructs real results instead of cached recovery and rejects separated results", async () => {
    const orphan = [assistant([call("one")])]
    const recovered = JSON.stringify(replayToolHistory(orphan, part))
    const completed = JSON.stringify(replayToolHistory([...orphan, result("one", ["recorded"])], part))
    expect(recovered).not.toBe(completed)
    expect(completed).toContain('"output":"recorded"')
    expect(() => replayToolHistory([...orphan, { role: "user", content: "unrelated", timestamp: 0 }, result("one", ["late"])], part)).toThrow("PI_TOOL_RESULT_SEPARATED")
    const before = structuredClone(orphan)
    const serializations = await Promise.all(Array.from({ length: 3 }, () => Promise.resolve(JSON.stringify(replayToolHistory(orphan, part)))))
    expect(serializations).toEqual([recovered, recovered, recovered])
    expect(orphan).toEqual(before)
  })

  it("bridges unsigned calls into observations while preserving surrounding turns", () => {
    const replayed = replayToolHistory([
      { role: "user", content: "before", timestamp: 0 },
      sameModelAssistant([{ type: "text", text: "calling" }, call("one", "read_file", {}), { type: "text", text: "after call" }]),
      result("one", ["done"]),
      { role: "user", content: "after", timestamp: 0 },
      assistant([{ type: "text", text: "final" }], "stop"),
    ], part, undefined, signedReplay)
    expect(replayed).toEqual([
      { role: "user", parts: [{ text: "before" }] },
      { role: "model", parts: [{ text: "calling" }, { text: "after call" }] },
      { role: "user", parts: [{ text: "[Observation from `read_file`:\ndone]" }, { text: "after" }] },
      { role: "model", parts: [{ text: "final" }] },
    ])
  })

  it("retains signed groups as ID-free Gemini function calls and responses", () => {
    const replayed = replayToolHistory([
      sameModelAssistant([call("one", "read_file", { path: "one" }, "c2ln"), call("two", "read_file", { path: "two" })]),
      result("two", ["second"]),
      result("one", ["first"]),
    ], part, undefined, signedReplay)
    expect(replayed).toEqual([
      { role: "model", parts: [
        { functionCall: { name: "read_file", args: { path: "one" } }, thoughtSignature: "c2ln" },
        { functionCall: { name: "read_file", args: { path: "two" } } },
      ] },
      { role: "user", parts: [
        { functionResponse: { name: "read_file", response: { output: "first" } } },
        { functionResponse: { name: "read_file", response: { output: "second" } } },
      ] },
    ])
  })

  it.each([
    [{ ...sameModelAssistant([call("one", "read_file", {}, "invalid")]) }, "invalid signature"],
    [{ ...sameModelAssistant([call("one", "read_file", {}, "c2ln")]), provider: "foreign" }, "foreign model"],
  ])("bridges a %s group only after validating its calls and results", (assistantMessage, _case) => {
    expect(replayToolHistory([assistantMessage, result("one", ["done"])], part, undefined, signedReplay)).toEqual([
      { role: "user", parts: [{ text: "[Observation from `read_file`:\ndone]" }] },
    ])
  })

  it("uses observation data for errors and synthetic missing results", () => {
    const recoveries: unknown[] = []
    const replayed = replayToolHistory([
      sameModelAssistant([call("one", "read_file", {}), call("two", "read_file", { path: "two" })]),
      result("one", ["failed"], true),
    ], part, (diagnostics) => recoveries.push(diagnostics), signedReplay)
    expect(replayed).toEqual([
      { role: "user", parts: [
        { text: "[Observation from `read_file`:\nfailed]" },
        { text: "[Observation from `read_file` ({\"path\":\"two\"}):\nTool execution did not complete or its result was not recorded. Treat the call as failed; do not assume it had no side effects and do not retry it automatically.]" },
      ] },
    ])
    expect(recoveries).toEqual([{ replayMode: "unsigned-observation", recoveryCount: 1, userMessageCount: 0, assistantMessageCount: 1, toolResultMessageCount: 1, assistantToolCallBlockCount: 2, declaredToolCount: 0 }])
  })

  it("reports only allowlisted request-local replay diagnostics", () => {
    const secret = "CANARY-tool-name-id-args-result-signature"
    const diagnostics: unknown[] = []
    const capture = (diagnostic: unknown) => diagnostics.push(diagnostic)
    replayToolHistory([{ role: "user", content: "first request", timestamp: 0 }], part, capture, signedReplay)
    replayToolHistory([sameModelAssistant([call(secret, secret, { secret }, "c2ln")]), { ...result(secret, [secret]), toolName: secret }], part, capture, signedReplay)
    replayToolHistory([{ ...sameModelAssistant([call(secret, secret, { secret }, "invalid")]), provider: "foreign" }, { ...result(secret, [secret]), toolName: secret }], part, capture, signedReplay)

    expect(diagnostics).toEqual([
      { replayMode: "none", recoveryCount: 0, userMessageCount: 1, assistantMessageCount: 0, toolResultMessageCount: 0, assistantToolCallBlockCount: 0, declaredToolCount: 0 },
      { replayMode: "signed-function-response", recoveryCount: 0, userMessageCount: 0, assistantMessageCount: 1, toolResultMessageCount: 1, assistantToolCallBlockCount: 1, declaredToolCount: 0 },
      { replayMode: "unsigned-observation", recoveryCount: 0, userMessageCount: 0, assistantMessageCount: 1, toolResultMessageCount: 1, assistantToolCallBlockCount: 1, declaredToolCount: 0 },
    ])
    expect(JSON.stringify(diagnostics)).not.toContain(secret)
  })

  it("does not fabricate a result for an assistant call without a terminal tool-use stop", () => {
    expect(() => replayToolHistory([assistant([call("one")], "stop")], part)).toThrow("PI_TOOL_CALL_INVALID")
  })

  it.each([
    [assistant([call("one"), call("one")]), "PI_TOOL_CALL_DUPLICATE"],
    [assistant([call("one")], "stop"), "PI_TOOL_CALL_INVALID"],
    [assistant([call("one")]), { ...result("one", ["x"]), toolName: "other" }, "PI_TOOL_RESULT_NAME_MISMATCH"],
    [assistant([call("one")]), result("one", ["x"]), result("one", ["again"]), "PI_TOOL_RESULT_DUPLICATE"],
    [{ role: "toolResult", toolCallId: "one", toolName: "read_file", content: [], isError: false, timestamp: 0 }, "PI_TOOL_RESULT_FOREIGN"],
    [assistant([call("one")]), { ...result("one", ["x"]), content: [{ type: "text", text: "x" }, { type: "audio" }] }, "PI_TOOL_RESULT_MEDIA_UNSUPPORTED"],
    [assistant([call("one")]), { ...result("one", ["x"]), addedToolNames: ["later"] }, "PI_TOOL_CALL_INVALID"],
  ])("rejects invalid replay history", (...values) => {
    const code = values.at(-1) as string
    expect(() => replayToolHistory(values.slice(0, -1) as never[], part)).toThrow(code)
  })

  it("replays tool results containing images as inlineData wire parts", () => {
    const history = [
      assistant([call("one")]),
      { ...result("one", ["text content"]), content: [{ type: "text", text: "text content" }, { type: "image", data: "aW1hZ2U=", mimeType: "image/png" }] },
    ]
    const replayed = replayToolHistory(history as never[], part)
    expect(replayed).toHaveLength(2)
    expect(replayed[1]).toEqual({
      role: "user",
      parts: [
        { functionResponse: { name: "read_file", response: { output: "text content" } } },
        { inlineData: { mimeType: "image/png", data: "aW1hZ2U=" } },
      ],
    })
  })

  it("preserves matching sanitized IDs on functionCall and functionResponse when includeToolCallId is enabled", () => {
    const history = [
      assistant([call("call 123#test", "read_file", { path: "hello.txt" })]),
      result("call 123#test", ["file content"]),
    ]
    const replayed = replayToolHistory(history as never[], part, undefined, {
      requireSignedToolCalls: false,
      isSameModel: () => true,
      toolCallSignature: () => undefined,
      includeToolCallId: true,
    })
    expect(replayed).toHaveLength(2)
    expect(replayed[0]).toEqual({
      role: "model",
      parts: [
        { functionCall: { id: "call_123_test", name: "read_file", args: { path: "hello.txt" } } },
      ],
    })
    expect(replayed[1]).toEqual({
      role: "user",
      parts: [
        { functionResponse: { id: "call_123_test", name: "read_file", response: { output: "file content" } } },
      ],
    })
  })

  it("includes sanitized IDs in synthetic missing results when includeToolCallId is enabled", () => {
    const orphan = [assistant([call("call_orphan", "read_file", { path: "foo" })])]
    const replayed = replayToolHistory(orphan, part, undefined, {
      requireSignedToolCalls: false,
      isSameModel: () => true,
      toolCallSignature: () => undefined,
      includeToolCallId: true,
    })
    expect(replayed).toHaveLength(2)
    expect(replayed[0]).toEqual({
      role: "model",
      parts: [
        { functionCall: { id: "call_orphan", name: "read_file", args: { path: "foo" } } },
      ],
    })
    expect(replayed[1]).toEqual({
      role: "user",
      parts: [
        {
          functionResponse: {
            id: "call_orphan",
            name: "read_file",
            response: {
              error: {
                code: "PI_TOOL_RESULT_MISSING",
                message: "Tool execution did not complete or its result was not recorded. Treat the call as failed; do not assume it had no side effects and do not retry it automatically.",
              },
            },
          },
        },
      ],
    })
  })
})
