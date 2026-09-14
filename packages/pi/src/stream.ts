import { calculateCost, createAssistantMessageEventStream } from "@earendil-works/pi-ai"
import type { AssistantMessage, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai"
import { ANTIGRAVITY_ENDPOINTS } from "@benjamolina/antigravity-guard-core"

import { getCatalogEntry, resolveGenerationSelection, type GenerationSelection } from "./catalog.ts"
import { ContextSerializationError, serializeContext, type GenerationRequest } from "./context.ts"
import { ToolPreflightError } from "./tool-contract.ts"
import { hasToolContext } from "./tool-context.ts"
import type { ResponseSemantic, ToolResponsePolicy } from "./response.ts"
import { ResponseSemanticError, ResponseSemantics } from "./response.ts"
import { SseFrameError, SseFramer } from "./sse.ts"

const TOTAL_TIMEOUT_MS = 120_000
const INACTIVITY_TIMEOUT_MS = 30_000
const MAX_ERROR_BYTES = 64 * 1024
const ANTIGRAVITY_USER_AGENT = "antigravity/cli/1.1.23 (aidev_client; os_type=linux; arch=amd64; cl=974125021; auth_method=consumer)"
const ENDPOINT = `${ANTIGRAVITY_ENDPOINTS.daily}/v1internal:streamGenerateContent?alt=sse`
const API = "antigravity-guard-sse"
const PROTECTED_HEADERS = new Set(["authorization", "host", "content-type", "content-length"])
const LOCAL_ERRORS = new WeakSet<StreamTransportError>()

type StreamErrorKind = "aborted" | "access" | "capability" | "model" | "quota" | "preflight" | "response" | "transport" | "callback"

export interface ToolStreamDiagnostics {
  readonly publicModelId: string
  readonly reasoning: string
  readonly capabilityState: string
  readonly preflight?: "accepted" | string
  readonly preflightCategory?: string
  readonly preflightPath?: string
  readonly recoveryCount?: number
}

type ToolDiagnosticSemantic = { type: "toolDiagnostics", details: ToolStreamDiagnostics }
type StreamSemantic = ResponseSemantic | ToolDiagnosticSemantic

export class StreamTransportError extends Error {
  constructor(readonly kind: StreamErrorKind, message: string, readonly status?: number, readonly details?: ToolStreamDiagnostics) { super(message) }
}

export interface StreamTransportInput {
  accessToken: string
  context: Context
  fetch: typeof globalThis.fetch
  generationOptions?: SimpleStreamOptions
  headers?: Record<string, string>
  inactivityTimeoutMs?: number
  model: Model<string>
  projectId: string
  now: () => number
  onSemantic: (semantic: StreamSemantic) => void | Promise<void>
  platform: string
  requestId: string
  selection?: GenerationSelection
  signal?: AbortSignal
  timeoutMs?: number
}

export interface PiStreamLifecycleInput {
  model: Model<string>
  now: () => number
  signal?: AbortSignal
  runTransport: (input: { onSemantic: (semantic: StreamSemantic) => void, signal: AbortSignal }) => Promise<void>
}

export function createPiLifecycleStream(input: PiStreamLifecycleInput) {
  const stream = createAssistantMessageEventStream()
  const controller = new AbortController()
  const signal = input.signal ? AbortSignal.any([input.signal, controller.signal]) : controller.signal
  const output: AssistantMessage = {
    role: "assistant",
    content: [],
    api: input.model.api,
    provider: input.model.provider,
    model: input.model.id,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "pending",
    timestamp: input.now(),
  }
  let complete = false
  let sawToolCall = false
  let toolDiagnostics: ToolStreamDiagnostics | undefined
  let textStarted = false
      let currentBlock: { type: "text", text: string, textSignature?: string } | { type: "thinking", thinking: string, thinkingSignature?: string } | undefined
  const closeBlock = () => {
    if (!currentBlock) return
    const contentIndex = output.content.length - 1
    if (currentBlock.type === "text") stream.push({ type: "text_end", contentIndex, content: currentBlock.text, partial: output })
    else stream.push({ type: "thinking_end", contentIndex, content: currentBlock.thinking, partial: output })
    currentBlock = undefined
  }
  let removeAbort: () => void = () => {}

  const finalize = (reason: "stop" | "length" | "toolUse" | "error" | "aborted", errorMessage?: string, details?: ToolStreamDiagnostics) => {
    if (complete) return
    complete = true
    removeAbort()
    if (reason === "error" || reason === "aborted") {
      controller.abort()
      for (let index = output.content.length - 1; index >= 0; index--) {
        if (output.content[index]?.type === "toolCall") output.content.splice(index, 1)
      }
    }
    output.stopReason = reason
    const diagnostic = details ?? toolDiagnostics
    if (sawToolCall || diagnostic) output.diagnostics = [{ type: "antigravity-guard.tools", timestamp: input.now(), details: { ...diagnostic, terminal: reason } }]
    if (reason === "stop" || reason === "length" || reason === "toolUse") {
      closeBlock()
      stream.push({ type: "done", reason, message: output })
    } else {
      output.errorMessage = errorMessage ?? "Antigravity generation failed."
      stream.push({ type: "error", reason, error: output })
    }
    stream.end(output)
  }

  const onSemantic = (semantic: StreamSemantic) => {
    if (complete) return
    if (semantic.type === "toolDiagnostics") {
      toolDiagnostics = semantic.details
      return
    }
    if (semantic.type === "toolCall") {
      sawToolCall = true
      closeBlock()
      const toolCall = { type: "toolCall" as const, id: semantic.id, name: semantic.name, arguments: semantic.arguments, ...(semantic.signature ? { thoughtSignature: semantic.signature } : {}) }
      output.content.push(toolCall)
      const contentIndex = output.content.length - 1
      stream.push({ type: "toolcall_start", contentIndex, partial: output })
      stream.push({ type: "toolcall_delta", contentIndex, delta: semantic.argumentsJson, partial: output })
      stream.push({ type: "toolcall_end", contentIndex, toolCall, partial: output })
      return
    }
    if (isContentSemantic(semantic)) {
          if (!currentBlock || currentBlock.type !== semantic.type) {
            closeBlock()
            if (semantic.type === "text") {
              currentBlock = { type: "text", text: "" }
              output.content.push(currentBlock)
              stream.push({ type: "text_start", contentIndex: output.content.length - 1, partial: output })
            } else {
              currentBlock = { type: "thinking", thinking: "" }
              output.content.push(currentBlock)
              stream.push({ type: "thinking_start", contentIndex: output.content.length - 1, partial: output })
            }
          }
          const contentIndex = output.content.length - 1
          if (semantic.type === "text" && currentBlock.type === "text") {
            currentBlock.text += semantic.text
            if (semantic.signature) currentBlock.textSignature = semantic.signature
            stream.push({ type: "text_delta", contentIndex, delta: semantic.text, partial: output })
          } else if (semantic.type === "thinking" && currentBlock.type === "thinking") {
            currentBlock.thinking += semantic.thinking
            if (semantic.signature) currentBlock.thinkingSignature = semantic.signature
            stream.push({ type: "thinking_delta", contentIndex, delta: semantic.thinking, partial: output })
          }
          return
        }
        if (semantic.type === "text" && semantic.text) {
      if (!textStarted) {
        textStarted = true
        output.content.push({ type: "text", text: "" })
        stream.push({ type: "text_start", contentIndex: 0, partial: output })
      }
      const text = output.content[0]
      if (text?.type === "text") text.text += semantic.text
      stream.push({ type: "text_delta", contentIndex: 0, delta: semantic.text, partial: output })
    } else if (semantic.type === "usage") {
      output.usage.input = semantic.input
      output.usage.output = semantic.output
      output.usage.cacheRead = semantic.cacheRead
      output.usage.cacheWrite = semantic.cacheWrite
          output.usage.reasoning = semantic.reasoning
      output.usage.totalTokens = semantic.input + semantic.output + semantic.cacheRead + semantic.cacheWrite
      output.usage.cost = calculateCost(input.model, output.usage)
    } else if (semantic.type === "finish") finalize(semantic.reason)
  }

  stream.push({ type: "start", partial: output })
  if (input.signal) {
    const abort = () => finalize("aborted")
    input.signal.addEventListener("abort", abort, { once: true })
    removeAbort = () => input.signal?.removeEventListener("abort", abort)
    if (input.signal.aborted) abort()
  }
  if (!complete) void Promise.resolve().then(() => input.runTransport({ onSemantic, signal })).then(
    () => { if (!complete) finalize(signal.aborted ? "aborted" : "error") },
    (error) => finalize(
      signal.aborted || input.signal?.aborted ? "aborted" : "error",
      isLocalStreamError(error) ? error.message : undefined,
      isLocalStreamError(error) ? error.details : undefined,
    ),
  )
  return stream
}

function isContentSemantic(semantic: ResponseSemantic): boolean {
  return semantic.type === "text" || semantic.type === "thinking"
}

export async function executeStreamTransport(input: StreamTransportInput): Promise<void> {
  validateInput(input)
  const signal = totalSignal(input)
  const headers = requestHeaders(input)
  let responseBody: ReadableStream<Uint8Array> | null = null
  let selection: GenerationSelection | undefined
  let recoveryCount = 0
  try {
    const entry = getCatalogEntry(input.model.id)!
    selection = input.selection ?? resolveGenerationSelection(entry, input.generationOptions?.reasoning)
    const original = serializeContext(
      { context: input.context, model: input.model, options: input.generationOptions, project: input.projectId, requestId: input.requestId },
      selection,
      (count) => { recoveryCount = count },
    )
    if (hasToolContext(input.context)) await deliver(input.onSemantic, { type: "toolDiagnostics", details: toolDiagnostics(entry.publicId, selection, recoveryCount, "accepted") })
    const payload = await payloadHook(input, original, signal)
    const response = await abortable(input.fetch(ENDPOINT, { method: "POST", redirect: "error", headers, body: JSON.stringify(payload), signal }), signal)
    await responseHook(input, response, signal)
    responseBody = response.body
    if (!response.ok) throw await httpError(response, signal)
    if (!response.body || !isSse(response.headers.get("content-type"))) {
      await boundedBody(response.body, signal)
      throw streamError("response", "Antigravity did not return an SSE response.")
    }
    await consume(response.body, signal, input.onSemantic, inactivityTimeout(input), responsePolicy(original, selection))
  } catch (error) {
    void responseBody?.cancel().catch(() => undefined)
    if (isLocalStreamError(error)) throw error
    if (signal.aborted) throw streamError("aborted", "Generation was cancelled.")
    if (error instanceof ToolPreflightError && selection) {
      const details = toolDiagnostics(getCatalogEntry(input.model.id)!.publicId, selection, recoveryCount, error.code, error.path)
      throw streamError("preflight", error.message, undefined, details)
    }
    if (error instanceof ContextSerializationError && error.message.startsWith("PI_TOOL_CAPABILITY_NOT_ENABLED") && selection) {
      throw streamError("capability", error.message, undefined, toolDiagnostics(getCatalogEntry(input.model.id)!.publicId, selection, recoveryCount, "PI_TOOL_CAPABILITY_NOT_ENABLED"))
    }
    if (error instanceof SseFrameError || error instanceof ResponseSemanticError) throw streamError("response", "Antigravity returned an invalid stream.")
    throw streamError("transport", "Antigravity generation request failed.")
  }
}

function validateInput(input: StreamTransportInput): void {
  if (!getCatalogEntry(input.model.id) || input.model.api !== API) throw streamError("response", "The selected Antigravity model or API is unsupported.")
}

function toolDiagnostics(publicModelId: string, selection: GenerationSelection, recoveryCount: number, preflight: "accepted" | string, preflightPath?: string): ToolStreamDiagnostics {
  return {
    publicModelId,
    reasoning: selection.level,
    capabilityState: selection.tools.state,
    preflight,
    ...(preflight === "accepted" ? { recoveryCount } : { preflightCategory: preflightCategory(preflight), ...(preflightPath ? { preflightPath } : {}) }),
  }
}

function preflightCategory(code: string): string {
  if (code.includes("SCHEMA")) return "schema"
  if (code.includes("CHOICE")) return "tool-choice"
  if (code.includes("DECLARATION") || code.includes("CONSTRAINED")) return "declaration"
  if (code.includes("RESULT") || code.includes("CALL") || code.includes("HISTORY")) return "history"
  return "capability"
}

function responsePolicy(payload: GenerationRequest, selection: GenerationSelection): ToolResponsePolicy {
  const declarations = payload.request.tools?.[0]?.functionDeclarations
  if (selection.tools.state !== "enabled" || payload.request.toolConfig?.functionCallingConfig.mode === "NONE" || !Array.isArray(declarations)) return { kind: "reject" }
  const names = declarations.map((declaration) => Object.getOwnPropertyDescriptor(declaration, "name")?.value)
  return names.every((name): name is string => typeof name === "string") ? { kind: "accept", declaredNames: new Set(names) } : { kind: "reject" }
}

async function payloadHook(input: StreamTransportInput, payload: unknown, signal: AbortSignal): Promise<unknown> {
  try {
    const replacement = await abortable(Promise.resolve().then(() => input.generationOptions?.onPayload?.(payload, input.model)), signal)
    if (replacement !== undefined && JSON.stringify(replacement) !== JSON.stringify(payload)) throw streamError("callback", "Payload replacement cannot alter the fixed request.")
    return replacement ?? payload
  } catch (error) { if (isLocalStreamError(error)) throw error; throw streamError("callback", "Payload handling failed.") }
}

async function responseHook(input: StreamTransportInput, response: Response, signal: AbortSignal): Promise<void> {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => { headers[key] = value })
  try { await abortable(Promise.resolve().then(() => input.generationOptions?.onResponse?.({ status: response.status, headers }, input.model)), signal) }
  catch (error) {
    if (isLocalStreamError(error)) throw error
    throw streamError("callback", "Response handling failed.")
  }
}

function requestHeaders(input: StreamTransportInput): Record<string, string> {
  for (const name of Object.keys(input.headers ?? {})) if (PROTECTED_HEADERS.has(name.toLowerCase())) throw streamError("response", "Custom headers cannot replace protected request headers.")
  return {
    ...input.headers,
    Authorization: `Bearer ${input.accessToken}`,
    Accept: "text/event-stream",
    "Content-Type": "application/json",
    "User-Agent": ANTIGRAVITY_USER_AGENT,
  }
}

async function consume(body: ReadableStream<Uint8Array>, signal: AbortSignal, onSemantic: StreamTransportInput["onSemantic"], inactivityMs: number, policy: ToolResponsePolicy): Promise<void> {
  const reader = body.getReader()
  const framer = new SseFramer()
  const semantics = new ResponseSemantics(policy)
  try {
    while (true) {
      const next = await abortable(reader.read(), AbortSignal.any([signal, AbortSignal.timeout(inactivityMs)]))
      if (next.done) break
      for (const record of framer.push(next.value)) for (const semantic of semantics.push(record)) await deliver(onSemantic, semantic)
    }
    for (const record of framer.finish()) for (const semantic of semantics.push(record)) await deliver(onSemantic, semantic)
    await deliver(onSemantic, semantics.finish())
  } catch (error) {
    void reader.cancel().catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
}

async function deliver(callback: StreamTransportInput["onSemantic"], semantic: StreamSemantic): Promise<void> {
  try { await callback(semantic) } catch { throw streamError("callback", "Semantic delivery failed.") }
}

async function httpError(response: Response, signal: AbortSignal): Promise<StreamTransportError> {
  const body = await boundedBody(response.body, signal)
  if (response.status === 401) return streamError("access", "Authentication expired. Run /login antigravity-guard.", 401)
  if (response.status === 403) return streamError("access", "Antigravity access was denied. Check your entitlement.", 403)
  if (response.status === 404) return streamError("model", "The requested Antigravity model is unavailable.", 404)
  if (response.status === 429 || body.includes("RESOURCE_EXHAUSTED")) return streamError("quota", "Antigravity quota or rate limit was reached.", response.status)
  return streamError("response", "Antigravity generation request was rejected.", response.status)
}

async function boundedBody(body: ReadableStream<Uint8Array> | null, signal: AbortSignal): Promise<string> {
  if (!body) return ""
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await abortable(reader.read(), signal)
      if (next.done || size + next.value.byteLength > MAX_ERROR_BYTES) break
      chunks.push(next.value)
      size += next.value.byteLength
    }
    const output = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength }
    return new TextDecoder().decode(output)
  } finally {
    void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function totalSignal(input: StreamTransportInput): AbortSignal {
  const timeout = remaining(input, TOTAL_TIMEOUT_MS)
  if (timeout <= 0 || input.signal?.aborted) throw streamError("aborted", "Generation was cancelled.")
  return input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout)
}

function remaining(input: StreamTransportInput, fallback: number): number {
  return input.timeoutMs === undefined ? fallback : input.timeoutMs > 0 && Number.isFinite(input.timeoutMs) ? Math.min(input.timeoutMs, fallback) : 0
}

function isSse(value: string | null): boolean { return value?.split(";", 1)[0]?.trim().toLowerCase() === "text/event-stream" }

function inactivityTimeout(input: StreamTransportInput): number {
  return input.inactivityTimeoutMs === undefined ? INACTIVITY_TIMEOUT_MS : input.inactivityTimeoutMs > 0 && Number.isFinite(input.inactivityTimeoutMs) ? Math.min(input.inactivityTimeoutMs, INACTIVITY_TIMEOUT_MS) : 0
}

function streamError(kind: StreamErrorKind, message: string, status?: number, details?: ToolStreamDiagnostics): StreamTransportError {
  const error = new StreamTransportError(kind, message, status, details)
  LOCAL_ERRORS.add(error)
  return error
}

function isLocalStreamError(error: unknown): error is StreamTransportError { return error instanceof StreamTransportError && LOCAL_ERRORS.has(error) }

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(streamError("aborted", "Generation was cancelled."))
  return new Promise((resolve, reject) => {
    const abort = () => reject(streamError("aborted", "Generation was cancelled."))
    signal.addEventListener("abort", abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
}
