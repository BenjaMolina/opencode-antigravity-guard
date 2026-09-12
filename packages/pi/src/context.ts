import type { Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai"

import { getCatalogEntry, resolveGenerationRoute } from "./catalog.ts"

const MAX_TEXT_BYTES = 8 * 1024 * 1024
const PROVIDER = "antigravity-guard"
const RESERVED_HEADERS = new Set(["authorization", "host", "content-type", "content-length"])
const THINKING_LEVELS = ["low", "medium", "high"] as const

type ThinkingLevel = typeof THINKING_LEVELS[number]

interface Part {
  text: string
  thought?: true
  thoughtSignature?: string
}

interface Content {
  role: "user" | "model"
  parts: Part[]
}

export interface GenerationRequest {
  project: string
  model: string
  request: {
    contents: Content[]
    systemInstruction?: { parts: Part[] }
    generationConfig: {
      temperature: number
      maxOutputTokens: number
      thinkingConfig: { thinkingLevel: "low" | "medium" | "high", includeThoughts: boolean }
    }
  }
  requestType: "agent"
  userAgent: "antigravity"
  requestId: string
}

export interface SerializeTextContextInput {
  context: Context
  model: Model<string>
  options?: SimpleStreamOptions
  project: string
  requestId: string
}

export class ContextSerializationError extends Error {}

export function serializeTextContext(input: SerializeTextContextInput): GenerationRequest {
  try {
    if (!isRecord(input)) fail("Invalid text context.")
    const context = field(input, "context", true)
    const model = field(input, "model", true)
    const options = field(input, "options")
    const project = field(input, "project", true)
    const requestId = field(input, "requestId", true)
    const entry = isRecord(model) ? getCatalogEntry(field(model, "id", true)) : undefined
    if (!isRecord(context) || !entry || typeof project !== "string" || typeof requestId !== "string") fail("Invalid text context.")
    const route = resolveGenerationRoute(entry, option(options, "reasoning"))
    const systemPrompt = field(context, "systemPrompt")
    const tools = field(context, "tools")
    if (systemPrompt !== undefined && typeof systemPrompt !== "string") fail("Text-only context is required.")
    if (tools !== undefined && isDenseArray(tools).length) fail("Tools are not supported by this text-only provider.")
    validateOptions(options)
    let textBytes = byteLength(systemPrompt ?? "")
    const contents: Content[] = []
    for (const message of isDenseArray(field(context, "messages", true))) {
      if (!isRecord(message)) fail("Invalid text context.")
      const role = field(message, "role", true)
      if (role === "toolResult") fail("Tool history is not supported by this text-only provider.")
      if (role !== "user" && role !== "assistant") fail("Unsupported context role for this text-only provider.")
      const assistant = role === "assistant"
      const parts = messageParts(field(message, "content", true), assistant, assistant && isSameProviderAndModel(message, entry.publicId))
      textBytes += parts.reduce((total, part) => total + byteLength(part.text), 0)
      if (textBytes > MAX_TEXT_BYTES) fail("Text context is too large.")
      contents.push({ role: role === "assistant" ? "model" : "user", parts })
    }
    if (!contents.length) fail("A text conversation is required.")
    const systemInstruction = systemPrompt === undefined ? undefined : { parts: [{ text: systemPrompt }] }
    const temperature = option(options, "temperature")
    const maxTokens = option(options, "maxTokens")
    return { project, model: route.wireModel, request: { contents, ...(systemInstruction ? { systemInstruction } : {}), generationConfig: {
      temperature: typeof temperature === "number" ? temperature : 1,
      maxOutputTokens: typeof maxTokens === "number" ? maxTokens : 4096,
      thinkingConfig: serializeThinkingConfig(route.thinking),
    } }, requestType: "agent", userAgent: "antigravity", requestId }
  } catch (error) {
    if (error instanceof ContextSerializationError) throw error
    fail("Invalid text context.")
  }
}

function messageParts(content: unknown, assistant: boolean, sameProviderAndModel: boolean): Part[] {
  if (typeof content === "string") return content ? [{ text: content }] : fail("A text conversation is required.")
  const parts = isDenseArray(content)
  if (!parts.length) fail("A text conversation is required.")
  return parts.map((part) => {
    if (!isRecord(part)) fail("Only text context is supported by this provider.")
    const type = field(part, "type", true)
    if (type === "text") {
      const text = field(part, "text", true)
      if (typeof text !== "string") fail("Only text context is supported by this provider.")
      const thoughtSignature = sameProviderAndModel ? validThoughtSignature(field(part, "textSignature")) : undefined
      if (!text && !thoughtSignature) fail("Only text context is supported by this provider.")
      return { text, ...(thoughtSignature ? { thoughtSignature } : {}) }
    }
    if (type === "thinking" && assistant && sameProviderAndModel) {
      const text = field(part, "thinking", true)
      if (typeof text !== "string") fail("Only text context is supported by this provider.")
      const thoughtSignature = validThoughtSignature(field(part, "thinkingSignature"))
      if (!text && !thoughtSignature) fail("Only text context is supported by this provider.")
      return { thought: true, text, ...(thoughtSignature ? { thoughtSignature } : {}) }
    }
    if (type === "thinking" && assistant) {
      const text = field(part, "thinking", true)
      if (typeof text !== "string" || !text) fail("Only text context is supported by this provider.")
      return { text }
    }
    fail("Only text context is supported by this provider.")
  })
}

function isSameProviderAndModel(message: Record<string, unknown>, publicId: string): boolean {
  return field(message, "provider") === PROVIDER && field(message, "model") === publicId
}

function serializeThinkingConfig(thinking: ReturnType<typeof resolveGenerationRoute>["thinking"]): { thinkingLevel: "low" | "medium" | "high", includeThoughts: boolean } {
  if (thinking.kind !== "native-level") fail("Unsupported reasoning policy.")
  return { thinkingLevel: thinking.thinkingLevel, includeThoughts: thinking.includeThoughts }
}

function validThoughtSignature(value: unknown): string | undefined {
  if (typeof value !== "string" || !value || value.length % 4 !== 0) return undefined
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined
}

function validateOptions(options: unknown): void {
  if (options === undefined) return
  if (!isRecord(options)) fail("Invalid generation options.")
  const reasoning = option(options, "reasoning"), budgets = option(options, "thinkingBudgets"), deferred = option(options, "deferred"), toolChoice = option(options, "toolChoice"), sampling = option(options, "samplingParams"), temperature = option(options, "temperature"), maxTokens = option(options, "maxTokens"), headers = option(options, "headers")
  if (reasoning !== undefined && reasoning !== "off" && !isThinkingLevel(reasoning) && reasoning !== "minimal") fail("Unsupported reasoning level.")
  if (budgets !== undefined) fail("Thinking budgets are not supported.")
  if (deferred) fail("Deferred requests are not supported.")
  if (toolChoice !== undefined && toolChoice !== "none") fail("Tools are not supported by this text-only provider.")
  if (sampling !== undefined) fail("Custom generation options are not supported.")
  if (temperature !== undefined && (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2)) fail("Temperature must be finite and between 0 and 2.")
  if (maxTokens !== undefined && (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens <= 0 || maxTokens > 65_536)) fail("maxTokens must be a positive integer no greater than 65536.")
  if (headers !== undefined && !isRecord(headers)) fail("Invalid generation options.")
  for (const name of headers ? Object.keys(headers) : []) if (RESERVED_HEADERS.has(name.toLowerCase())) fail("Custom headers cannot replace protected request headers.")
}

function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return typeof value === "string" && THINKING_LEVELS.includes(value as ThinkingLevel)
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function field(record: Record<string, unknown>, name: string, required = false): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, name)
  if (!descriptor) return required ? fail("Invalid text context.") : undefined
  return "value" in descriptor ? descriptor.value : fail("Invalid text context.")
}

function option(options: unknown, name: string): unknown {
  return isRecord(options) ? field(options, name) : undefined
}

function isDenseArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) fail("Invalid text context.")
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (!descriptor || !("value" in descriptor)) fail("Invalid text context.")
  }
  return value
}

function fail(message: string): never {
  throw new ContextSerializationError(message)
}
