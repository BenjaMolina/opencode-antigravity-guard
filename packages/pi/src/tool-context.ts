import { canonicalJson, ToolPreflightError } from "./tool-contract.ts"
import { CLAUDE_CUSTOM_PARAMETERS_PROFILE, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE, type ToolSchemaProfile } from "./catalog.ts"
import { normalizeToolDeclarations, type ToolDeclaration } from "./tool-schema.ts"

export interface PreparedToolContext {
  readonly declarations: readonly ToolDeclaration[]
  readonly mode: "AUTO" | "NONE"
}

export function hasToolContext(context: unknown): boolean {
  if (!isRecord(context)) return false
  const tools = value(context, "tools")
  if (Array.isArray(tools) && tools.length > 0) return true
  const messages = value(context, "messages")
  return Array.isArray(messages) && messages.some((message: unknown) => {
    if (!isRecord(message)) return false
    if (value(message, "role") === "toolResult") return true
    const content = value(message, "content")
    return Array.isArray(content) && content.some((part: unknown) => isRecord(part) && value(part, "type") === "toolCall")
  })
}

export function prepareToolContext(tools: unknown, choice: unknown, schemaProfile: unknown): PreparedToolContext | undefined {
  if (schemaProfile !== GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE && schemaProfile !== CLAUDE_CUSTOM_PARAMETERS_PROFILE) throw new ToolPreflightError("PI_TOOL_SCHEMA_PROFILE_UNSUPPORTED", "tools", "$")
  const declarations = normalizeToolDeclarations(tools ?? [])
  if (!declarations.length) {
    if (choice === "auto") throw new ToolPreflightError("PI_TOOL_CHOICE_WITHOUT_DECLARATIONS", "tools", "$")
    if (choice !== undefined && choice !== "none") unsupportedChoice()
    return undefined
  }
  if (choice !== undefined && choice !== "auto" && choice !== "none") unsupportedChoice()
  return { declarations, mode: choice === "none" ? "NONE" : "AUTO" }
}

type WirePart = object
type WireContent = { role: "user" | "model", parts: WirePart[] }
type PendingCall = { id: string, name: string, args: object }
export type ToolReplayMode = "none" | "signed-function-response" | "unsigned-observation"

export interface ToolReplayDiagnostics {
  readonly replayMode: ToolReplayMode
  readonly recoveryCount: number
  readonly userMessageCount: number
  readonly assistantMessageCount: number
  readonly toolResultMessageCount: number
  readonly assistantToolCallBlockCount: number
  readonly declaredToolCount: number
}

export interface ToolReplayPolicy {
  readonly requireSignedToolCalls: boolean
  readonly isSameModel: (message: Record<string, unknown>) => boolean
  readonly toolCallSignature: (part: Record<string, unknown>, message: Record<string, unknown>) => string | undefined
}

export function replayToolHistory(messages: unknown[], serializePart: (part: Record<string, unknown>, message: Record<string, unknown>) => WirePart, onDiagnostics?: (diagnostics: ToolReplayDiagnostics) => void, policy?: ToolReplayPolicy, declaredToolCount = 0): WireContent[] {
  const output: WireContent[] = []
  const calls = new Set<string>()
  const results = new Set<string>()
  const recoveryCount = { value: 0 }
  const shape = {
    userMessageCount: 0,
    assistantMessageCount: 0,
    toolResultMessageCount: 0,
    assistantToolCallBlockCount: 0,
    declaredToolCount: safeCount(declaredToolCount),
  }
  let replayMode: ToolReplayMode = "none"
  let pending: { calls: PendingCall[], results: Map<string, WirePart>, observations: boolean, extraParts?: WirePart[] } | undefined
  const appendTurn = (role: WireContent["role"], parts: WirePart[]) => {
    if (!parts.length) return
    const last = output.at(-1)
    if (last?.role === role) last.parts.push(...parts)
    else output.push({ role, parts })
  }
  const finalize = () => {
    if (!pending) return
    const turnParts: WirePart[] = pending.calls.map((call) => {
      const actual = pending!.results.get(call.id)
      if (actual) return actual
      recoveryCount.value += 1
      return pending!.observations ? observation(call, missingResultText()) : missingResult(call)
    })
    if (pending.extraParts?.length) {
      turnParts.push(...pending.extraParts)
    }
    appendTurn("user", turnParts)
    pending = undefined
  }
  for (const message of messages) {
    const current = record(message)
    if (value(current, "role") === "toolResult") {
      shape.toolResultMessageCount += 1
      const id = nonempty(value(current, "toolCallId"), "PI_TOOL_RESULT_FOREIGN")
      if (results.has(id)) history("PI_TOOL_RESULT_DUPLICATE")
      if (!pending) history(calls.has(id) ? "PI_TOOL_RESULT_SEPARATED" : "PI_TOOL_RESULT_FOREIGN")
      const call = pending.calls.find((item) => item.id === id)
      if (!call) history(calls.has(id) ? "PI_TOOL_RESULT_SEPARATED" : "PI_TOOL_RESULT_FOREIGN")
      if (value(current, "toolName") !== call.name) history("PI_TOOL_RESULT_NAME_MISMATCH")
      if (value(current, "addedToolNames") !== undefined && dense(value(current, "addedToolNames")).length) history("PI_TOOL_CALL_INVALID")
      const textParts: string[] = []
      const imageParts: WirePart[] = []
      for (const item of dense(value(current, "content"))) {
        const part = record(item)
        if (value(part, "type") === "text" && typeof value(part, "text") === "string") {
          textParts.push(value(part, "text") as string)
        } else if (value(part, "type") === "image") {
          const rawData = value(part, "data") ?? (isRecord(value(part, "source")) ? value(record(value(part, "source")), "data") : undefined)
          if (typeof rawData === "string" && rawData) {
            const rawMime = value(part, "mimeType") ?? (isRecord(value(part, "source")) ? value(record(value(part, "source")), "media_type") : undefined)
            const mimeType = typeof rawMime === "string" && rawMime ? rawMime : "image/jpeg"
            imageParts.push({ inlineData: { mimeType, data: rawData } })
          }
        } else {
          history("PI_TOOL_RESULT_MEDIA_UNSUPPORTED")
        }
      }
      const text = textParts.join("\n\n")
      const outputText = text || (imageParts.length > 0 ? "[Image content]" : "")
      const response = value(current, "isError") === true ? { error: outputText } : { output: outputText }
      pending.results.set(id, pending.observations ? observation(call, outputText) : { functionResponse: { name: call.name, response } })
      if (imageParts.length > 0) {
        if (!pending.extraParts) pending.extraParts = []
        pending.extraParts.push(...imageParts)
      }
      results.add(id)
      continue
    }
    finalize()
    const role = value(current, "role")
    if (role !== "user" && role !== "assistant") history("PI_TOOL_CALL_INVALID")
    if (role === "user") shape.userMessageCount += 1
    else shape.assistantMessageCount += 1
    const rawContent = value(current, "content")
    if (typeof rawContent === "string") {
      if (!rawContent) history("PI_TOOL_CALL_INVALID")
      appendTurn(role === "assistant" ? "model" : "user", [{ text: rawContent }])
      continue
    }
    const content = dense(rawContent)
    const hasCalls = role === "assistant" && content.some((part) => value(record(part), "type") === "toolCall")
    if (!hasCalls) {
      appendTurn(role === "assistant" ? "model" : "user", content.map((part) => serializePart(record(part), current)))
      continue
    }
    if (value(current, "stopReason") !== "toolUse") history("PI_TOOL_CALL_INVALID")
    const group: PendingCall[] = []
    const parts: Array<WirePart | { call: PendingCall, signature: string | undefined, signaturePresent: boolean }> = content.flatMap((item) => {
      const part = record(item)
      if (value(part, "type") !== "toolCall") {
        if (isEmptyUnsignedText(part)) return []
        return [serializePart(part, current)]
      }
      shape.assistantToolCallBlockCount += 1
      const id = nonempty(value(part, "id"), "PI_TOOL_CALL_INVALID")
      const name = nonempty(value(part, "name"), "PI_TOOL_CALL_INVALID")
      if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(name) || calls.has(id)) history(calls.has(id) ? "PI_TOOL_CALL_DUPLICATE" : "PI_TOOL_CALL_INVALID")
      const args = canonicalJson(value(part, "arguments"), name, "$.arguments")
      if (typeof args !== "object" || Array.isArray(args) || args === null) history("PI_TOOL_CALL_INVALID")
      calls.add(id)
      const call = { id, name, args }
      group.push(call)
      return [{ call, signature: policy?.toolCallSignature(part, current), signaturePresent: value(part, "thoughtSignature") !== undefined }]
    })
    const toolParts = parts.filter((part): part is { call: PendingCall, signature: string | undefined, signaturePresent: boolean } => "call" in part)
    const callsAreSigned = policy?.requireSignedToolCalls === true && policy.isSameModel(current) && Boolean(toolParts[0]?.signature) && toolParts.every((part) => !part.signaturePresent || Boolean(part.signature))
    const observations = policy?.requireSignedToolCalls === true && !callsAreSigned
    if (observations) replayMode = "unsigned-observation"
    else if (replayMode === "none" && callsAreSigned) replayMode = "signed-function-response"
    appendTurn("model", parts.flatMap((part) => {
      if (!("call" in part)) return [part]
      if (observations) return []
      return [{ functionCall: { name: part.call.name, args: part.call.args }, ...(part.signature ? { thoughtSignature: part.signature } : {}) }]
    }))
    pending = { calls: group, results: new Map(), observations }
  }
  finalize()
  onDiagnostics?.({ replayMode, recoveryCount: recoveryCount.value, ...shape })
  return output
}

function observation(call: PendingCall, text: string): WirePart {
  const args = JSON.stringify(call.args)
  const label = args === "{}" ? `\`${call.name}\`` : `\`${call.name}\` (${args})`
  return { text: `[Observation from ${label}:\n${text}]` }
}

function missingResultText(): string {
  return "Tool execution did not complete or its result was not recorded. Treat the call as failed; do not assume it had no side effects and do not retry it automatically."
}

function missingResult(call: PendingCall): WirePart {
  return {
    functionResponse: {
      name: call.name,
      response: {
        error: {
          code: "PI_TOOL_RESULT_MISSING",
          message: missingResultText(),
        },
      },
    },
  }
}

function history(code: string): never {
  throw new ToolPreflightError(code, "history", "$")
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) history("PI_TOOL_CALL_INVALID")
  return value
}

function dense(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || Object.keys(value).length !== value.length) history("PI_TOOL_CALL_INVALID")
  return value
}

function isEmptyUnsignedText(part: Record<string, unknown>): boolean {
  const text = value(part, "text")
  return value(part, "type") === "text" && typeof text === "string" && !text.trim() && value(part, "textSignature") === undefined
}

function nonempty(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) history(code)
  return value
}

function safeCount(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function unsupportedChoice(): never {
  throw new ToolPreflightError("PI_TOOL_CHOICE_UNSUPPORTED", "tools", "$")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function value(record: Record<string, unknown>, name: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, name)
  return descriptor && "value" in descriptor ? descriptor.value : undefined
}
