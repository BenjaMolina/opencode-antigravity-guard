import { canonicalJson } from "./tool-contract.ts"
import type { JsonObject } from "./tool-contract.ts"

export type ResponseSemantic = TextSemantic | ThinkingSemantic | ToolCallSemantic | FinishSemantic | UsageSemantic

export interface TextSemantic {
  type: "text"
  text: string
  signature?: string
}
export interface ThinkingSemantic {
  type: "thinking"
  thinking: string
  signature?: string
}
export interface ToolCallSemantic {
  type: "toolCall"
  callIndex: number
  id: string
  name: string
  arguments: JsonObject
  argumentsJson: string
  signature?: string
}
export interface FinishSemantic {
  type: "finish"
  reason: "stop" | "length" | "toolUse"
}
export interface UsageSemantic {
  type: "usage"
  input: number
  output: number
  cacheRead: number
  cacheWrite: 0
  reasoning: number
  total: number
}
export type ToolResponsePolicy =
  | { kind: "reject" }
  | {
      kind: "accept"
      declaredNames: ReadonlySet<string>
    }

export class ResponseSemanticError extends Error {}

export class ResponseSemantics {
  private finished = false
  private done = false
  private content = false
  private calls = 0
  private readonly ids = new Set<string>()
  private pendingFinish: FinishSemantic["reason"] | undefined
  private usage = { prompt: 0, cacheRead: 0, output: 0, reasoning: 0 }

  constructor(readonly policy: ToolResponsePolicy = { kind: "reject" }) {}

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

  finish(): FinishSemantic {
    if (!this.finished) throw new ResponseSemanticError("Response ended without a finish reason.")
    if (!this.content) throw new ResponseSemanticError("Response ended without content.")
    return { type: "finish", reason: this.pendingFinish! }
  }

  private updateUsage(value: unknown): UsageSemantic {
    const prompt = count(value, "promptTokenCount", this.usage.prompt)
    const cacheRead = count(value, "cachedContentTokenCount", this.usage.cacheRead)
    const candidates = count(value, "candidatesTokenCount", this.usage.output - this.usage.reasoning)
    const reasoning = count(value, "thoughtsTokenCount", this.usage.reasoning)
    const output = candidates + reasoning
    const reported = field(value, "totalTokenCount")
    if (cacheRead > prompt || (reported !== undefined && reported !== prompt + output)) throw new ResponseSemanticError("Antigravity returned invalid usage.")
    this.usage = { prompt, cacheRead, output, reasoning }
    return { type: "usage", input: prompt - cacheRead, output, cacheRead, cacheWrite: 0, reasoning, total: prompt + output }
  }

  addContent(text: string): void { this.content = this.content || text.length > 0 }
  addCall(): void { this.content = true; this.calls++ }
  setFinish(reason: FinishSemantic["reason"]): void { this.finished = true; this.pendingFinish = reason }
  hasId(id: string): boolean { return this.ids.has(id) }
  addId(id: string): void { this.ids.add(id) }
  callIndex(): number { return this.calls }
}

function candidate(value: unknown, events: ResponseSemantic[], semantics: ResponseSemantics): void {
  if (!Array.isArray(value) || value.length !== 1) throw new ResponseSemanticError("Antigravity returned invalid candidates.")
  const item = value[0]
  if (item === undefined) return
  const index = field(item, "index")
  if (index !== undefined && index !== 0) throw new ResponseSemanticError("Antigravity returned invalid candidates.")
  const content = field(item, "content")
  const local: ResponseSemantic[] = []
  const ids: string[] = []
  let callCount = 0
  if (content !== undefined) {
    const parts = field(content, "parts")
    if (!Array.isArray(parts)) throw new ResponseSemanticError("Antigravity returned invalid content.")
    const explicitIds = new Set<string>()
    for (const part of parts) {
      const call = field(part, "functionCall")
      if (call !== undefined) {
        const id = field(call, "id")
        if (typeof id === "string") explicitIds.add(id)
      }
    }
    for (const part of parts) {
      if (field(part, "functionCall") !== undefined) {
        const call = toolCall(part, semantics, ids, explicitIds, callCount++)
        ids.push(call.id)
        local.push(call)
      } else {
        const text = field(part, "text")
        const thought = field(part, "thought")
        if (typeof text !== "string" || (thought !== undefined && typeof thought !== "boolean") || keys(part, ["text", "thought", "thoughtSignature"])) throw new ResponseSemanticError("Antigravity returned unsupported content.")
        const signature = validThoughtSignature(field(part, "thoughtSignature"))
        local.push(thought === true ? { type: "thinking", thinking: text, ...(signature ? { signature } : {}) } : { type: "text", text, ...(signature ? { signature } : {}) })
      }
    }
  }
  const finishReason = field(item, "finishReason")
  if (finishReason !== undefined) {
    const hasCalls = semantics.callIndex() + callCount > 0
    const reason = hasCalls ? "toolUse" : finishReason === "STOP" ? "stop" : finishReason === "MAX_TOKENS" ? "length" : undefined
    if (!reason) throw new ResponseSemanticError("Antigravity returned an unsupported finish reason.")
    semantics.setFinish(reason)
  }
  for (const id of ids) semantics.addId(id)
  for (const event of local) {
    if (event.type === "text") semantics.addContent(event.text)
    else if (event.type === "thinking") semantics.addContent(event.thinking)
    else semantics.addCall()
    events.push(event)
  }
}

function toolCall(part: unknown, semantics: ResponseSemantics, ids: readonly string[], explicitIds: ReadonlySet<string>, offset: number): ToolCallSemantic {
  if (semantics.policy.kind !== "accept" || keys(part, ["functionCall", "thoughtSignature"])) throw new ResponseSemanticError("Antigravity returned unsupported content.")
  const call = field(part, "functionCall")
  if (keys(call, ["id", "name", "args"])) throw new ResponseSemanticError("Antigravity returned unsupported content.")
  const suppliedId = field(call, "id")
  const id = suppliedId === undefined ? localCallId(semantics, ids, explicitIds, offset) : suppliedId
  const name = field(call, "name")
  const args = field(call, "args")
  if (typeof id !== "string" || !id.trim() || typeof name !== "string" || !semantics.policy.declaredNames.has(name) || semantics.hasId(id) || ids.includes(id)) throw new ResponseSemanticError("Antigravity returned invalid function call.")
  let argumentsValue: JsonObject
  try {
    const canonical = canonicalJson(args, name, "$")
    if (Array.isArray(canonical) || canonical === null) throw new Error()
    argumentsValue = canonical as JsonObject
  } catch { throw new ResponseSemanticError("Antigravity returned invalid function call.") }
  const argumentsJson = JSON.stringify(argumentsValue)
  if (new TextEncoder().encode(argumentsJson).byteLength > 1024 * 1024 || depth(argumentsValue) > 64) throw new ResponseSemanticError("Antigravity returned invalid function call.")
  const signature = validThoughtSignature(field(part, "thoughtSignature"))
  return { type: "toolCall", callIndex: semantics.callIndex() + offset, id, name, arguments: argumentsValue, argumentsJson, ...(signature ? { signature } : {}) }
}

function localCallId(semantics: ResponseSemantics, ids: readonly string[], explicitIds: ReadonlySet<string>, offset: number): string {
  let suffix = semantics.callIndex() + offset + 1
  let id = `pi-gemini-call-${suffix}`
  while (semantics.hasId(id) || ids.includes(id) || explicitIds.has(id)) {
    suffix++
    id = `pi-gemini-call-${suffix}`
  }
  return id
}

function depth(value: JsonObject | readonly unknown[], level = 0): number {
  let maximum = level
  for (const item of Object.values(value)) maximum = Math.max(maximum, depthValue(item, level + 1))
  return maximum
}
function depthValue(value: unknown, level: number): number { return value && typeof value === "object" ? depth(value as JsonObject | readonly unknown[], level) : level }
function keys(value: unknown, allowed: readonly string[]): boolean { return typeof value !== "object" || value === null || Array.isArray(value) || Object.keys(value).some((name) => !allowed.includes(name)) }
function validThoughtSignature(value: unknown): string | undefined { return typeof value === "string" && value && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined }
function validateMetadata(value: unknown): void { for (const name of ["responseId", "modelVersion"]) { const metadata = field(value, name); if (metadata !== undefined && (typeof metadata !== "string" || !metadata)) throw new ResponseSemanticError("Antigravity returned invalid metadata.") } }
function count(value: unknown, name: string, fallback: number): number { const item = field(value, name); if (item === undefined) return fallback; if (typeof item !== "number" || !Number.isSafeInteger(item) || item < 0) throw new ResponseSemanticError("Antigravity returned invalid usage."); return item }
function parse(record: string): unknown { try { return JSON.parse(record) as unknown } catch { throw new ResponseSemanticError("Antigravity returned invalid JSON.") } }
function hasError(value: unknown): boolean { return field(value, "error") !== undefined }
function field(value: unknown, name: string): unknown { if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ResponseSemanticError("Antigravity returned an invalid response."); const descriptor = Object.getOwnPropertyDescriptor(value, name); return descriptor && "value" in descriptor ? descriptor.value : undefined }
