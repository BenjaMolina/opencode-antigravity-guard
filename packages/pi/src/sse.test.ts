import { describe, expect, it } from "vitest"

import { SseFrameError, SseFramer } from "./sse.ts"

const encode = (text: string) => new TextEncoder().encode(text)

function frame(bytes: Uint8Array, split: number): string[] {
  const parser = new SseFramer()
  const records = [...parser.push(bytes.slice(0, split)), ...parser.push(bytes.slice(split)), ...parser.finish()]
  return records
}

describe("SSE byte framing", () => {
  it("preserves Unicode, multiline and duplicate data through every byte split", () => {
    const fixture = encode("\ufeff: ignored\r\nid: 1\r\nretry: 3\r\ndata: hé\r\ndata: \u{1f680}\r\n\rdata:same\r\rdata: same\n\n")
    for (let split = 0; split <= fixture.length; split++) expect(frame(fixture, split)).toEqual(["hé\n🚀", "same", "same"])
  })

  it("fails closed for invalid UTF-8, incomplete records, and oversized records", () => {
    expect(() => new SseFramer().push(new Uint8Array([0xc3, 0x28]))).toThrow(SseFrameError)
    const unfinished = new SseFramer(); unfinished.push(encode("data: x\n"))
    expect(() => unfinished.finish()).toThrow(SseFrameError)
    expect(() => new SseFramer().push(encode(`data: ${"x".repeat(1024 * 1024)}\n\n`))).toThrow(SseFrameError)
  })

  it("counts raw CRLF bytes and rejects an unterminated oversized line", () => {
    const value = "x".repeat(1024 * 1024 - 9)
    const parser = new SseFramer()
    expect(parser.push(encode(`data:${value}\r`))).toEqual([])
    expect(parser.push(encode("\n\r\n"))).toEqual([value])
    for (const delimiter of ["\n", "\r"]) expect(frame(encode(`data:x${delimiter}${delimiter}`), 6)).toEqual(["x"])
    expect(() => new SseFramer().push(encode(`data:${"x".repeat(1024 * 1024)}`))).toThrow(SseFrameError)
  })
})
