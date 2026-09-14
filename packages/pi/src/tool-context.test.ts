import { describe, expect, it } from "vitest"

import { ToolPreflightError } from "./tool-contract.ts"
import { prepareToolContext, replayToolHistory } from "./tool-context.ts"

const declaration = { name: "read_file", description: "Read one file", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }

describe("Pi tool request preparation", () => {
  it("retains declaration order and maps omitted, auto, and none choices", () => {
    expect(prepareToolContext([declaration, { ...declaration, name: "list_files" }], undefined)?.mode).toBe("AUTO")
    expect(prepareToolContext([declaration], "auto")?.mode).toBe("AUTO")
    expect(prepareToolContext([declaration], "none")?.mode).toBe("NONE")
  })

  it.each(["required", "read_file", { type: "tool", name: "read_file" }])("rejects forced or named choice %j", (choice) => {
    expect(() => prepareToolContext([declaration], choice)).toThrow(ToolPreflightError)
  })

  it("rejects auto without declarations and preserves no-op none", () => {
    expect(() => prepareToolContext([], "auto")).toThrow("PI_TOOL_CHOICE_WITHOUT_DECLARATIONS")
    expect(prepareToolContext([], "none")).toBeUndefined()
  })
})

describe("Pi tool history replay", () => {
  const call = (id: string, name = "read_file") => ({ type: "toolCall", id, name, arguments: { path: id } })
  const result = (id: string, text: string[], isError = false) => ({ role: "toolResult", toolCallId: id, toolName: "read_file", content: text.map((value) => ({ type: "text", text: value })), isError, timestamp: 0 })
  const assistant = (content: unknown[], stopReason = "toolUse") => ({ role: "assistant", content, stopReason, timestamp: 0 })
  const part = (value: Record<string, unknown>) => ({ text: String(value.text ?? value.thinking ?? "") })

  it("replays reverse-completed same-name calls in source order with stable result encoding", () => {
    const replayed = replayToolHistory([assistant([call("one"), call("two")]), result("two", ["second"]), result("one", ["first", "again"])] , part)
    expect(JSON.stringify(replayed)).toBe(JSON.stringify([
      { role: "model", parts: [{ functionCall: { name: "read_file", args: { path: "one" }, id: "one" } }, { functionCall: { name: "read_file", args: { path: "two" }, id: "two" } }] },
      { role: "user", parts: [{ functionResponse: { name: "read_file", id: "one", response: { result: "first\n\nagain" } } }, { functionResponse: { name: "read_file", id: "two", response: { result: "second" } } }] },
    ]))
  })

  it.each([
    [result("one", [], false), { result: "" }],
    [result("one", ["failed", "again"], true), { error: "failed\n\nagain" }],
  ])("encodes empty and error results without repairing them", (toolResult, response) => {
    expect(replayToolHistory([assistant([call("one")]), toolResult], part)[1]).toEqual({ role: "user", parts: [{ functionResponse: { name: "read_file", id: "one", response } }] })
  })

  it.each(["resume", "fork", "compaction", "model-handoff"])("reconstructs %s deterministically without shared state", async () => {
    const history = [{ role: "user", content: "before", timestamp: 0 }, assistant([call("one")]), result("one", ["done"])]
    const before = structuredClone(history)
    const serializations = await Promise.all(Array.from({ length: 3 }, () => Promise.resolve(JSON.stringify(replayToolHistory(history, part)))))
    expect(serializations).toEqual([serializations[0], serializations[0], serializations[0]])
    expect(history).toEqual(before)
  })

  it("synthesizes missing parallel results with the fixed error response in source order", () => {
    const missing = {
      error: {
        code: "PI_TOOL_RESULT_MISSING",
        message: "Tool execution did not complete or its result was not recorded. Treat the call as failed; do not assume it had no side effects and do not retry it automatically.",
      },
    }
    const recoveryCounts: number[] = []
    expect(replayToolHistory([assistant([call("one"), call("two")])], part, (count) => recoveryCounts.push(count))[1]).toEqual({
      role: "user",
      parts: [
        { functionResponse: { name: "read_file", id: "one", response: missing } },
        { functionResponse: { name: "read_file", id: "two", response: missing } },
      ],
    })
    expect(recoveryCounts).toEqual([2])
    expect(replayToolHistory([assistant([call("one"), call("two")]), result("two", ["complete"])], part)[1]).toEqual({
      role: "user",
      parts: [
        { functionResponse: { name: "read_file", id: "one", response: missing } },
        { functionResponse: { name: "read_file", id: "two", response: { result: "complete" } } },
      ],
    })
  })

  it("reconstructs real results instead of cached recovery and rejects separated results", async () => {
    const orphan = [assistant([call("one")])]
    const recovered = JSON.stringify(replayToolHistory(orphan, part))
    const completed = JSON.stringify(replayToolHistory([...orphan, result("one", ["recorded"])], part))
    expect(recovered).not.toBe(completed)
    expect(completed).toContain('"result":"recorded"')
    expect(() => replayToolHistory([...orphan, { role: "user", content: "unrelated", timestamp: 0 }, result("one", ["late"])], part)).toThrow("PI_TOOL_RESULT_SEPARATED")
    const before = structuredClone(orphan)
    const serializations = await Promise.all(Array.from({ length: 3 }, () => Promise.resolve(JSON.stringify(replayToolHistory(orphan, part)))))
    expect(serializations).toEqual([recovered, recovered, recovered])
    expect(orphan).toEqual(before)
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
    [assistant([call("one")]), { ...result("one", ["x"]), content: [{ type: "text", text: "x" }, { type: "image" }] }, "PI_TOOL_RESULT_MEDIA_UNSUPPORTED"],
    [assistant([call("one")]), { ...result("one", ["x"]), addedToolNames: ["later"] }, "PI_TOOL_CALL_INVALID"],
  ])("rejects invalid replay history", (...values) => {
    const code = values.at(-1) as string
    expect(() => replayToolHistory(values.slice(0, -1) as never[], part)).toThrow(code)
  })
})
