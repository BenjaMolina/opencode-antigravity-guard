export type ResponseSemantic = TextSemantic | FinishSemantic | UsageSemantic

export interface TextSemantic {
  type: "text"
  text: string
}

export interface FinishSemantic {
  type: "finish"
  reason: "stop" | "length"
}

export interface UsageSemantic {
  type: "usage"
  input: number
  output: number
  cacheRead: number
  cacheWrite: 0
  total: number
}

export class ResponseSemanticError extends Error {}

export class ResponseSemantics {
  private finished = false
  private text = false
  private done = false
  private usage = { prompt: 0, cacheRead: 0, output: 0 }

  push(record: string): ResponseSemantic[] {
    if (this.done) throw new ResponseSemanticError("Response data arrived after [DONE].")
    if (record === "[DONE]") {
      if (!this.finished) throw new ResponseSemanticError("[DONE] arrived before a finish reason.")
      this.done = true
      return []
    }
    if (this.finished) throw new ResponseSemanticError("Response data arrived after a finish reason.")
    const value = parse(record)
    if (hasError(value)) throw new ResponseSemanticError("Antigravity returned an error response.")
    const response = field(value, "response")
    if (hasError(response) || field(response, "promptFeedback") !== undefined) throw new ResponseSemanticError("Antigravity returned an invalid response.")
    validateMetadata(response)
    const events: ResponseSemantic[] = []
    const candidates = field(response, "candidates")
    if (candidates !== undefined) candidate(candidates, events, this)
    const usage = field(response, "usageMetadata")
    if (usage !== undefined) events.push(this.updateUsage(usage))
    return events
  }

  finish(): void {
    if (!this.finished) throw new ResponseSemanticError("Response ended without a finish reason.")
    if (!this.text) throw new ResponseSemanticError("Response ended without text.")
  }

  addText(text: string): void { this.text = this.text || text.length > 0 }
  addFinish(): void { this.finished = true }

  private updateUsage(value: unknown): UsageSemantic {
    const prompt = count(value, "promptTokenCount", this.usage.prompt)
    const cacheRead = count(value, "cachedContentTokenCount", this.usage.cacheRead)
    const output = count(value, "candidatesTokenCount", this.usage.output) + count(value, "thoughtsTokenCount", 0)
    const reported = field(value, "totalTokenCount")
    if (cacheRead > prompt || (reported !== undefined && reported !== prompt + output)) throw new ResponseSemanticError("Antigravity returned invalid usage.")
    this.usage = { prompt, cacheRead, output }
    return { type: "usage", input: prompt - cacheRead, output, cacheRead, cacheWrite: 0, total: prompt + output }
  }
}

function candidate(value: unknown, events: ResponseSemantic[], semantics: ResponseSemantics): void {
  if (!Array.isArray(value) || value.length !== 1) throw new ResponseSemanticError("Antigravity returned invalid candidates.")
  const candidate = value[0]
  if (candidate === undefined) return
  const index = field(candidate, "index")
  if (index !== undefined && index !== 0) throw new ResponseSemanticError("Antigravity returned invalid candidates.")
  const content = field(candidate, "content")
  if (content !== undefined) {
    const parts = field(content, "parts")
    if (!Array.isArray(parts)) throw new ResponseSemanticError("Antigravity returned invalid content.")
    for (const part of parts) {
      const text = field(part, "text")
      if (typeof text !== "string" || Object.keys(part).some((name) => name !== "text" && name !== "thoughtSignature")) throw new ResponseSemanticError("Antigravity returned unsupported content.")
      semantics.addText(text)
      events.push({ type: "text", text })
    }
  }
  const finishReason = field(candidate, "finishReason")
  if (finishReason !== undefined) {
    if (finishReason !== "STOP" && finishReason !== "MAX_TOKENS") throw new ResponseSemanticError("Antigravity returned an unsupported finish reason.")
    semantics.addFinish()
    events.push({ type: "finish", reason: finishReason === "STOP" ? "stop" : "length" })
  }
}

function validateMetadata(value: unknown): void {
  for (const name of ["responseId", "modelVersion"]) {
    const metadata = field(value, name)
    if (metadata !== undefined && (typeof metadata !== "string" || !metadata)) throw new ResponseSemanticError("Antigravity returned invalid metadata.")
  }
}

function count(value: unknown, name: string, fallback: number): number {
  const valueAtName = field(value, name)
  if (valueAtName === undefined) return fallback
  if (typeof valueAtName !== "number" || !Number.isSafeInteger(valueAtName) || valueAtName < 0) throw new ResponseSemanticError("Antigravity returned invalid usage.")
  return valueAtName
}

function parse(record: string): unknown {
  try { return JSON.parse(record) as unknown } catch { throw new ResponseSemanticError("Antigravity returned invalid JSON.") }
}

function hasError(value: unknown): boolean { return field(value, "error") !== undefined }

function field(value: unknown, name: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ResponseSemanticError("Antigravity returned an invalid response.")
  const descriptor = Object.getOwnPropertyDescriptor(value, name)
  return descriptor && "value" in descriptor ? descriptor.value : undefined
}
