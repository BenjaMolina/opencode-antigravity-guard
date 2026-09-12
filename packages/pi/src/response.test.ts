import { describe, expect, it } from "vitest"

import { ResponseSemanticError, ResponseSemantics } from "./response.ts"

function record(response: unknown): string {
  return JSON.stringify({ response })
}

describe("ResponseSemantics", () => {
  it("maps a candidate text delta and cumulative usage", () => {
    const semantics = new ResponseSemantics()

    expect(semantics.push(record({
      candidates: [{ content: { parts: [{ text: "Hello" }] } }],
      usageMetadata: { promptTokenCount: 7, cachedContentTokenCount: 2, candidatesTokenCount: 3 },
    }))).toEqual([
      { type: "text", text: "Hello" },
      { type: "usage", input: 5, output: 3, cacheRead: 2, cacheWrite: 0, reasoning: 0, total: 10 },
    ])
  })

  it("emits visible thought and text semantics with their valid source signatures and reasoning usage", () => {
      const semantics = new ResponseSemantics()

      expect(semantics.push(record({
        candidates: [{ content: { parts: [
          { thought: true, text: "plan", thoughtSignature: "c2ln" },
          { text: "answer", thoughtSignature: "dGV4dA==" },
        ] } }],
        usageMetadata: { promptTokenCount: 7, cachedContentTokenCount: 2, candidatesTokenCount: 3, thoughtsTokenCount: 4, totalTokenCount: 14 },
      }))).toEqual([
        { type: "thinking", thinking: "plan", signature: "c2ln" },
        { type: "text", text: "answer", signature: "dGV4dA==" },
        { type: "usage", input: 5, output: 7, cacheRead: 2, cacheWrite: 0, reasoning: 4, total: 14 },
      ])
    })

    it("permits a thought-only successful completion and strips malformed signatures", () => {
      const semantics = new ResponseSemantics()
      expect(semantics.push(record({ candidates: [{ content: { parts: [{ thought: true, text: "plan", thoughtSignature: "not base64" }] } }] }))).toEqual([
        { type: "thinking", thinking: "plan" },
      ])
      expect(semantics.push(record({ candidates: [{ finishReason: "STOP" }] }))).toEqual([{ type: "finish", reason: "stop" }])
      expect(() => semantics.finish()).not.toThrow()
    })

    it("preserves repeated and whitespace deltas, maps MAX_TOKENS, and permits [DONE] after it", () => {
    const semantics = new ResponseSemantics()
    expect(semantics.push(record({ candidates: [{ content: { parts: [{ text: " " }, { text: "same" }] } }] }))).toEqual([
      { type: "text", text: " " },
      { type: "text", text: "same" },
    ])
    expect(semantics.push(record({ candidates: [{ content: { parts: [{ text: "same" }] }, finishReason: "MAX_TOKENS" }] }))).toEqual([
      { type: "text", text: "same" },
      { type: "finish", reason: "length" },
    ])
    expect(semantics.push("[DONE]")).toEqual([])
    expect(() => semantics.finish()).not.toThrow()
  })

  it("treats usage snapshots as cumulative and retains omitted counts", () => {
    const semantics = new ResponseSemantics()
    semantics.push(record({ usageMetadata: { promptTokenCount: 7, cachedContentTokenCount: 2, candidatesTokenCount: 3 } }))
    expect(semantics.push(record({ usageMetadata: { candidatesTokenCount: 4 } }))).toEqual([
      { type: "usage", input: 5, output: 4, cacheRead: 2, cacheWrite: 0, reasoning: 0, total: 11 },
    ])
  })

  it("permits metadata-only records but rejects a present empty candidate list", () => {
    const semantics = new ResponseSemantics()

    expect(semantics.push(record({ responseId: "response-1" }))).toEqual([])
    expect(() => semantics.push(record({ candidates: [] }))).toThrow(ResponseSemanticError)
  })

  it("rejects a present candidate list with more than one candidate", () => {
    const semantics = new ResponseSemantics()

    expect(() => semantics.push(record({ candidates: [{}, {}] }))).toThrow(ResponseSemanticError)
  })

  it("rejects Gemini 3.5-shaped HTTP-200 content without terminal metadata", () => {
    const semantics = new ResponseSemantics()
    expect(semantics.push(record({ candidates: [{ content: { parts: [{ text: "unverified" }] } }] }))).toEqual([{ type: "text", text: "unverified" }])
    expect(() => semantics.finish()).toThrow(ResponseSemanticError)
  })

  it("rejects malformed records, unsupported output, invalid usage, and incomplete completion", () => {
    const invalid = [
      "{", JSON.stringify({ error: { message: "nope" } }), record({ promptFeedback: {} }),
      record({ candidates: [{ index: 1 }] }), record({ candidates: [{ finishReason: "STOP" }], error: {} }), record({ candidates: [{ content: { parts: [{ thought: "true", text: "no" }] } }] }),
      record({ candidates: [{ content: { parts: [{ functionCall: {} }] } }] }), record({ candidates: [{ finishReason: "OTHER" }] }),
      record({ usageMetadata: { promptTokenCount: 1, cachedContentTokenCount: 2 } }), record({ usageMetadata: { promptTokenCount: 1, totalTokenCount: 2 } }), record({ responseId: 1 }),
    ]
    for (const value of invalid) expect(() => new ResponseSemantics().push(value)).toThrow(ResponseSemanticError)
    expect(() => new ResponseSemantics().push("[DONE]")).toThrow(ResponseSemanticError)
    const semantics = new ResponseSemantics()
    semantics.push(record({ candidates: [{ finishReason: "STOP" }] }))
    expect(() => semantics.finish()).toThrow(ResponseSemanticError)
    expect(() => semantics.push(record({ candidates: [{ content: { parts: [{ text: "late" }] } }] }))).toThrow(ResponseSemanticError)
  })
})
