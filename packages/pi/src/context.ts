import type { Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai"
import {
  MIN_THOUGHT_SIGNATURE_LENGTH,
  SKIP_THOUGHT_SIGNATURE,
  buildSignatureSessionKey,
  signatureCacheProjectKey,
  stripThinkingTierSuffixForCacheKey,
  type SessionSignatureCache,
} from "@benjamolina/antigravity-guard-core"

import { CLAUDE_CUSTOM_PARAMETERS_PROFILE, getCatalogEntry, resolveGenerationSelection, type GenerationSelection, type ToolCapability } from "./catalog.ts"
import { normalizeCustomToolSchema } from "./tool-schema.ts"
import { buildAntigravityEnvelope, resolveSessionTrajectory } from "./envelope.ts"
import { hasToolContext, prepareToolContext, replayToolHistory, type ToolReplayDiagnostics } from "./tool-context.ts"

const MAX_TEXT_BYTES = 8 * 1024 * 1024
const PROVIDER = "antigravity-guard"
const RESERVED_HEADERS = new Set(["authorization", "host", "content-type", "content-length"])
const THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh"] as const
const PI_HARNESS_MARKER = "operating inside pi, a coding agent harness"

type ThinkingLevel = typeof THINKING_LEVELS[number]

interface Part {
  text?: string
  thought?: true
  thoughtSignature?: string
  inlineData?: { mimeType: string, data: string }
}

interface Content {
  role: "user" | "model"
  parts: object[]
}

interface GeminiFunctionDeclaration {
  readonly name: string
  readonly description: string
  readonly parametersJsonSchema?: object
  readonly parameters?: object
}

export interface GenerationRequest {
  project: string
  model: string
  request: {
    contents: Content[]
    systemInstruction?: { role?: "user", parts: Part[] }
    tools?: Array<{
      functionDeclarations: readonly GeminiFunctionDeclaration[]
      googleSearch?: Record<string, never>
    }>
    toolConfig?: { functionCallingConfig: { mode: "AUTO" | "NONE" } }
    generationConfig: {
      temperature: number
      maxOutputTokens: number
      thinkingConfig?:
        | { thinkingLevel: ThinkingLevel, includeThoughts: boolean }
        | { thinkingBudget: number, includeThoughts: boolean }
    }
    sessionId?: string
    labels?: Record<string, string>
  }
  requestType: "agent"
  userAgent: "antigravity"
  requestId: string
}

export type SignatureRestoreSource = Pick<SessionSignatureCache, "getCachedSignature">

export interface SerializeTextContextInput {
  context: Context
  model: Model<string>
  options?: SimpleStreamOptions
  project: string
  requestId: string
  signatureCache?: SignatureRestoreSource
  allowSentinelFallback?: boolean
}

interface SignatureRestoreState {
  readonly family: "gemini" | "claude" | "gpt-oss"
  readonly hasCache: boolean
  readonly allowSentinelFallback: boolean
  readonly getSignature: (thinkingText: string) => string | undefined
}

export function resolvePiSignatureSessionKey(options: {
  context: unknown
  wireModel: string
  projectId: string
}): string {
  const rawMessagesField = isRecord(options.context) ? field(options.context, "messages") : undefined
  const rawMessages = Array.isArray(rawMessagesField) ? rawMessagesField : []
  const conversationMessages = rawMessages.filter(
    (msg) => !(isRecord(msg) && field(msg, "role") === "system"),
  )
  const trajectoryId = resolveSessionTrajectory(conversationMessages).trajectoryId
  const modelForCacheKey = stripThinkingTierSuffixForCacheKey(options.wireModel)
  return buildSignatureSessionKey(
    "pi",
    modelForCacheKey,
    trajectoryId,
    signatureCacheProjectKey(modelForCacheKey, options.projectId),
  )
}

function buildSignatureRestoreState(options: {
  signatureCache: SignatureRestoreSource | undefined
  allowSentinelFallback: boolean | undefined
  messages: readonly unknown[]
  wireModel: string
  projectId: string
  family: "gemini" | "claude" | "gpt-oss"
}): SignatureRestoreState | undefined {
  const hasCache = Boolean(options.signatureCache)
  const allowSentinelFallback = hasCache
    ? options.allowSentinelFallback !== false
    : options.allowSentinelFallback === true
  if (!hasCache && !allowSentinelFallback) return undefined
  if (!hasCache) {
    return {
      family: options.family,
      hasCache: false,
      allowSentinelFallback,
      getSignature: () => undefined,
    }
  }
  const trajectoryId = resolveSessionTrajectory(options.messages).trajectoryId
  const modelForCacheKey = stripThinkingTierSuffixForCacheKey(options.wireModel)
  const sessionKey = buildSignatureSessionKey(
    "pi",
    modelForCacheKey,
    trajectoryId,
    signatureCacheProjectKey(modelForCacheKey, options.projectId),
  )
  return {
    family: options.family,
    hasCache: true,
    allowSentinelFallback,
    getSignature: (thinkingText: string) =>
      options.signatureCache!.getCachedSignature(sessionKey, thinkingText),
  }
}

export class ContextSerializationError extends Error {}

const PI_DOCS_BLOCK_REGEX =
  /(?:<docs>\r?\n)?Pi documentation \(read only when the user asks about pi[^)]*\):\r?\n- Main documentation: ([^\r\n]+)\r?\n- Additional docs: ([^\r\n]+)\r?\n- Examples: ([^\r\n]+)[^\r\n]*\r?\n(?:- When reading pi docs or examples[^\r\n]+\r?\n)?- When asked about:[^\r\n]+\r?\n(?:- When working on pi topics[^\r\n]+\r?\n)?- Always read pi \.md files completely[^\r\n]+(?:\r?\n<\/docs>)?/g

export function sanitizeAntigravitySystemPrompt(systemPrompt: string): string {
  if (!systemPrompt.includes(PI_HARNESS_MARKER)) return systemPrompt
  return systemPrompt
    .replaceAll(PI_HARNESS_MARKER, "working on software projects")
    .replace(
      PI_DOCS_BLOCK_REGEX,
      [
        "Local harness documentation (read only when the user explicitly asks about local agent customization):",
        "<reference_paths>",
        "- Main reference: $1",
        "- Additional docs: $2",
        "- Examples: $3",
        "</reference_paths>",
      ].join("\n"),
    )
    .replace(/Pi documentation \(read only when the user asks about pi[^)]*\):/g, "Local harness documentation (read only when the user explicitly asks about local agent customization):")
    .replace(/<docs>([\s\S]*?)<\/docs>/g, "<reference_paths>$1</reference_paths>")
}

export function serializeContext(input: SerializeTextContextInput, injectedSelection?: GenerationSelection, onDiagnostics?: (diagnostics: ToolReplayDiagnostics) => void): GenerationRequest {
  const context = input.context as unknown
  if (!hasToolContext(context)) return serializeTextContext(input)
  const options = input.options as unknown
  const entry = isRecord(input.model) ? getCatalogEntry(field(input.model, "id", true)) : undefined
  if (!entry || !isRecord(context)) return serializeTextContext(input)
  const selected = resolveGenerationSelection(entry, isRecord(options) ? option(options, "reasoning") : undefined)
  const selection = injectedSelection ?? selected
  if (selection.level !== selected.level || selection.route.wireModel !== selected.route.wireModel) fail("Invalid tool capability selection.")
  if (selection.tools.state !== "enabled") fail(capabilityError(entry.publicId, selection.level, selection.tools))
  const normalized = normalizeContextRecord(context)
  const prepared = prepareToolContext(normalized.tools ?? [], isRecord(options) ? field(options, "toolChoice") : undefined, selection.tools.schemaProfile)
  const { tools: _tools, messages: _messages, systemPrompt: _systemPrompt, ...textContext } = context
  const { toolChoice: _choice, ...textOptions } = isRecord(options) ? options : {}
  const text = serializeTextContext({
    ...input,
    signatureCache: undefined,
    allowSentinelFallback: undefined,
    context: {
      ...textContext,
      ...(normalized.systemPrompt !== undefined ? { systemPrompt: normalized.systemPrompt } : {}),
      messages: [{ role: "user", content: "placeholder", timestamp: 0 }],
    } as Context,
    options: textOptions as SimpleStreamOptions,
  })
  const restore = buildSignatureRestoreState({
    signatureCache: input.signatureCache,
    allowSentinelFallback: input.allowSentinelFallback,
    messages: normalized.messages,
    wireModel: selection.route.wireModel,
    projectId: input.project,
    family: entry.response.family,
  })
  const sameModel = (message: Record<string, unknown>) => field(message, "role") === "assistant" && entry.replay.kind === "same-public-model" && isSameProviderAndModel(message, entry.publicId)
  const requireSigned = geminiRequiresSignedToolReplay(selection.route.wireModel)
  const includeToolCallId = entry.response.family === "claude" || entry.response.family === "gpt-oss"
  const allowMultimodal = entry.response.family === "gemini" || entry.response.family === "claude"
  const toolReplayPolicy = (requireSigned || includeToolCallId || !allowMultimodal) ? {
    requireSignedToolCalls: requireSigned,
    isSameModel: sameModel,
    toolCallSignature: (part: Record<string, unknown>, message: Record<string, unknown>, callIndex: number, contentIndex: number) => {
      if (!sameModel(message)) return undefined
      const rawSignature = field(part, "thoughtSignature")
      if (rawSignature !== undefined) {
        return validThoughtSignature(rawSignature, restore?.allowSentinelFallback === true)
      }
      if (!restore || callIndex > 0 || !requireSigned) return undefined
      const turnSignature = resolveTurnThinkingSignature(message, restore, contentIndex)
      if (turnSignature) return turnSignature
      return restore.allowSentinelFallback ? SKIP_THOUGHT_SIGNATURE : undefined
    },
    includeToolCallId,
    allowMultimodal,
  } : undefined
  const contents = replayToolHistory(
    normalized.messages,
    (part, message) => messagePart(part, field(message, "role") === "assistant", sameModel(message), restore, allowMultimodal),
    onDiagnostics,
    toolReplayPolicy,
    prepared?.declarations.length ?? 0,
  )
  const { systemInstruction, generationConfig } = text.request
  const sonarGrounding = !prepared && shouldInjectSonarGoogleSearch(selection.route.wireModel, options)
  const envelope = buildAntigravityEnvelope({
    wireModelId: selection.route.wireModel,
    family: entry.response.family,
    contentsCount: contents.length,
    messages: normalized.messages,
    injectedRequestId: input.requestId,
  })
  return { ...text, request: {
    contents,
    ...(systemInstruction ? { systemInstruction } : {}),
    ...(prepared ? {
      tools: [{ functionDeclarations: prepared.declarations.map(({ name, description, parameters }) => ({
        name,
        description,
        ...(selection.tools.state === "enabled" && selection.tools.schemaProfile === CLAUDE_CUSTOM_PARAMETERS_PROFILE
          ? { parameters: normalizeCustomToolSchema(parameters) }
          : { parametersJsonSchema: parameters }),
      })) }],
      ...(prepared.mode === "NONE"
        ? { toolConfig: { functionCallingConfig: { mode: "NONE" } } }
        : (entry.response.family === "claude" || entry.response.family === "gpt-oss"
          ? { toolConfig: { functionCallingConfig: { mode: "AUTO" } } }
          : {})),
    } : sonarGrounding ? {
      tools: [{ googleSearch: {} } as unknown as { functionDeclarations: readonly GeminiFunctionDeclaration[], googleSearch?: Record<string, never> }],
    } : {}),
    generationConfig,
    sessionId: envelope.sessionId,
    labels: envelope.labels,
  }, requestId: envelope.requestId }
}

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
    const selection = resolveGenerationSelection(entry, option(options, "reasoning"))
    const route = selection.route
    const normalized = normalizeContextRecord(context)
    if (isToolBearingNormalizedContext(normalized) && selection.tools.state !== "enabled") fail(capabilityError(entry.publicId, selection.level, selection.tools))
    const rawSystemPrompt = normalized.systemPrompt
    const tools = normalized.tools
    if (rawSystemPrompt !== undefined && typeof rawSystemPrompt !== "string") fail("Text-only context is required.")
    if (tools !== undefined && isDenseArray(tools).length) fail("Tools are not supported by this text-only provider.")
    validateOptions(options, entry.descriptor.maxTokens)
    const systemPrompt = rawSystemPrompt === undefined ? undefined : sanitizeAntigravitySystemPrompt(rawSystemPrompt)
    const restore = buildSignatureRestoreState({
      signatureCache: field(input, "signatureCache") as SignatureRestoreSource | undefined,
      allowSentinelFallback: field(input, "allowSentinelFallback") as boolean | undefined,
      messages: normalized.messages,
      wireModel: route.wireModel,
      projectId: project,
      family: entry.response.family,
    })
    let textBytes = byteLength(systemPrompt ?? "")
    const allowMultimodal = entry.response.family === "gemini" || entry.response.family === "claude"
    const contents: Content[] = []
    for (const message of normalized.messages) {
      if (!isRecord(message)) fail("Invalid text context.")
      const role = field(message, "role", true)
      if (role === "toolResult") fail("Tool history is not supported by this text-only provider.")
      if (role !== "user" && role !== "assistant") fail("Unsupported context role for this text-only provider.")
      const assistant = role === "assistant"
      const parts = messageParts(field(message, "content", true), assistant, assistant && entry.replay.kind === "same-public-model" && isSameProviderAndModel(message, entry.publicId), restore, allowMultimodal)
      textBytes += parts.reduce((total, part) => total + (part.text ? byteLength(part.text) : (part.inlineData ? byteLength(part.inlineData.data) : 0)), 0)
      if (textBytes > MAX_TEXT_BYTES) fail("Text context is too large.")
      contents.push({ role: role === "assistant" ? "model" : "user", parts })
    }
    if (!contents.length) fail("A text conversation is required.")
    const systemInstruction = systemPrompt === undefined ? undefined : { role: "user" as const, parts: [{ text: systemPrompt }] }
    const temperature = option(options, "temperature")
    const maxTokens = option(options, "maxTokens")
    const sonarGrounding = shouldInjectSonarGoogleSearch(route.wireModel, options)
    const envelope = buildAntigravityEnvelope({
      wireModelId: route.wireModel,
      family: entry.response.family,
      contentsCount: contents.length,
      messages: normalized.messages,
      injectedRequestId: requestId,
    })
    return { project, model: route.wireModel, request: { contents, ...(systemInstruction ? { systemInstruction } : {}), ...(sonarGrounding ? { tools: [{ googleSearch: {} } as unknown as { functionDeclarations: readonly GeminiFunctionDeclaration[], googleSearch?: Record<string, never> }] } : {}), generationConfig: {
      temperature: typeof temperature === "number" ? temperature : 1,
      maxOutputTokens: resolveOutputTokens(maxTokens, entry.descriptor.maxTokens, route.thinking),
      ...(() => {
        const thinkingConfig = serializeThinkingConfig(route.thinking)
        return thinkingConfig ? { thinkingConfig } : {}
      })(),
    }, sessionId: envelope.sessionId, labels: envelope.labels }, requestType: "agent", userAgent: "antigravity", requestId: envelope.requestId }
  } catch (error) {
    if (error instanceof ContextSerializationError) throw error
    fail("Invalid text context.")
  }
}

interface NormalizedContextRecord {
  readonly systemPrompt: unknown
  readonly tools: unknown
  readonly messages: unknown[]
}

function normalizeContextRecord(context: Record<string, unknown>): NormalizedContextRecord {
  const rawSystemPrompt = field(context, "systemPrompt")
  const rawTools = field(context, "tools")
  const rawMessages = isDenseArray(field(context, "messages", true))
  const hasSystemMessage = rawMessages.some((message) => isRecord(message) && field(message, "role") === "system")
  if (!hasSystemMessage) {
    return { systemPrompt: rawSystemPrompt, tools: rawTools, messages: rawMessages }
  }
  if (rawSystemPrompt !== undefined && typeof rawSystemPrompt !== "string") fail("Text-only context is required.")
  const systemContentParts: string[] = []
  const sectionMap = new Map<string, string>()
  const toolMap = new Map<string | symbol, unknown>()
  if (rawTools !== undefined) {
    for (const tool of isDenseArray(rawTools)) {
      const name = isRecord(tool) ? field(tool, "name") : undefined
      toolMap.set(typeof name === "string" && name ? name : Symbol("tool"), tool)
    }
  }
  const conversationMessages: unknown[] = []
  for (const message of rawMessages) {
    if (!isRecord(message)) fail("Invalid text context.")
    const role = field(message, "role", true)
    if (role !== "system") {
      conversationMessages.push(message)
      continue
    }
    const contentText = extractSystemMessageContent(field(message, "content", true))
    if (contentText.length > 0) systemContentParts.push(contentText)
    const rawSections = field(message, "sections")
    if (rawSections !== undefined) {
      if (!isRecord(rawSections)) fail("Invalid text context.")
      for (const sectionName of Object.keys(rawSections)) {
        const sectionValue = field(rawSections, sectionName)
        if (sectionValue === null) sectionMap.delete(sectionName)
        else if (typeof sectionValue === "string") sectionMap.set(sectionName, sectionValue)
        else fail("Invalid text context.")
      }
    }
    const rawRemoved = field(message, "toolsRemoved")
    if (rawRemoved !== undefined) {
      for (const ref of isDenseArray(rawRemoved)) {
        if (!isRecord(ref)) fail("Invalid text context.")
        const removedName = field(ref, "name", true)
        if (typeof removedName !== "string" || !removedName) fail("Invalid text context.")
        toolMap.delete(removedName)
      }
    }
    const rawAdded = field(message, "toolsAdded")
    if (rawAdded !== undefined) {
      for (const tool of isDenseArray(rawAdded)) {
        const addedName = isRecord(tool) ? field(tool, "name") : undefined
        toolMap.set(typeof addedName === "string" && addedName ? addedName : Symbol("tool"), tool)
      }
    }
  }
  const basePrompt = systemContentParts.join("\n\n")
  const transcriptPrompt = [basePrompt, ...sectionMap.values()].filter((part) => part.length > 0).join("\n\n")
  const effectiveSystemPrompt = typeof rawSystemPrompt === "string"
    ? [rawSystemPrompt, transcriptPrompt].filter((part) => part.length > 0).join("\n\n")
    : (transcriptPrompt.length > 0 ? transcriptPrompt : undefined)
  const effectiveTools = toolMap.size > 0 ? [...toolMap.values()] : (rawTools !== undefined ? [] : undefined)
  return { systemPrompt: effectiveSystemPrompt, tools: effectiveTools, messages: conversationMessages }
}

function extractSystemMessageContent(content: unknown): string {
  if (typeof content === "string") return content
  const parts = isDenseArray(content)
  const texts: string[] = []
  for (const item of parts) {
    if (!isRecord(item) || field(item, "type", true) !== "text") fail("Only text context is supported by this provider.")
    const text = field(item, "text", true)
    if (typeof text !== "string") fail("Only text context is supported by this provider.")
    texts.push(text)
  }
  return texts.join("\n")
}

function capabilityError(publicId: string, reasoning: string, capability: ToolCapability): string {
  const reason = capability.state === "disabled" ? capability.reason : capability.state
  return `PI_TOOL_CAPABILITY_NOT_ENABLED: ${publicId}/${reasoning} is ${capability.state} (${reason}).`
}

function isToolBearingNormalizedContext(context: NormalizedContextRecord): boolean {
  const tools = context.tools
  if (tools !== undefined && isDenseArray(tools).length > 0) return true
  for (const message of context.messages) {
    if (!isRecord(message)) continue
    if (field(message, "role") === "toolResult") return true
    const content = field(message, "content")
    if (!Array.isArray(content)) continue
    for (const part of content) if (isRecord(part) && field(part, "type") === "toolCall") return true
  }
  return false
}

function messageParts(content: unknown, assistant: boolean, sameProviderAndModel: boolean, restore?: SignatureRestoreState, allowMultimodal = true): Part[] {
  if (typeof content === "string") return content ? [{ text: content }] : fail("A text conversation is required.")
  const parts = isDenseArray(content)
  if (!parts.length) fail("A text conversation is required.")
  return parts.map((part) => messagePart(isRecord(part) ? part : fail("Only text context is supported by this provider."), assistant, sameProviderAndModel, restore, allowMultimodal))
}

function isSupportedInlineMimeType(mimeType: string): boolean {
  const lower = mimeType.trim().toLowerCase()
  return lower === "application/pdf" || lower.startsWith("image/")
}

function extractInlineMediaPart(part: Record<string, unknown>, type: "image" | "document" | "file", allowMultimodal: boolean): Part {
  if (!allowMultimodal) fail("Only text context is supported by this provider.")
  const source = isRecord(field(part, "source")) ? (field(part, "source") as Record<string, unknown>) : undefined
  const rawData = field(part, "data") ?? (source ? field(source, "data") : undefined)
  if (typeof rawData !== "string" || !rawData) fail(type === "image" ? "Invalid image data." : "Invalid document data.")
  const dataUriMatch = /^data:([^;,]+);base64,/is.exec(rawData)
  const rawMime = field(part, "mimeType") ?? (source ? field(source, "media_type") ?? field(source, "mimeType") : undefined) ?? dataUriMatch?.[1]
  const defaultMime = type === "image" ? "image/jpeg" : "application/pdf"
  const mimeType = typeof rawMime === "string" && rawMime.trim() ? rawMime.trim() : defaultMime
  if (!isSupportedInlineMimeType(mimeType)) fail("Unsupported media type.")
  if ((type === "document" || type === "file") && mimeType.toLowerCase() !== "application/pdf") fail("Unsupported document media type.")
  const cleanedData = rawData.replace(/^data:[^;]+;base64,/is, "").replace(/\s+/g, "")
  if (!cleanedData || cleanedData.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleanedData)) {
    fail(type === "image" ? "Invalid image data." : "Invalid document data.")
  }
  return { inlineData: { mimeType, data: cleanedData } }
}

function messagePart(part: Record<string, unknown>, assistant: boolean, sameProviderAndModel: boolean, restore?: SignatureRestoreState, allowMultimodal = true): Part {
  const type = field(part, "type", true)
  if (type === "text") {
    const text = field(part, "text", true)
    if (typeof text !== "string") fail("Only text context is supported by this provider.")
    const thoughtSignature = sameProviderAndModel ? validThoughtSignature(field(part, "textSignature"), restore?.allowSentinelFallback === true) : undefined
    if (!text && !thoughtSignature) fail("Only text context is supported by this provider.")
    return { text, ...(thoughtSignature ? { thoughtSignature } : {}) }
  }
  if (type === "thinking" && assistant && sameProviderAndModel) {
    const text = field(part, "thinking", true)
    if (typeof text !== "string") fail("Only text context is supported by this provider.")
    const rawThinkingSig = field(part, "thinkingSignature")
    const explicitSig = validThoughtSignature(rawThinkingSig, restore?.allowSentinelFallback === true)
    let thoughtSignature: string | undefined
    if (restore && restore.family === "claude") {
      const cachedSig =
        text.length > 0 && restore.hasCache
          ? restoreCachedSignature(restore.getSignature(text))
          : undefined
      if (explicitSig === SKIP_THOUGHT_SIGNATURE) {
        thoughtSignature = SKIP_THOUGHT_SIGNATURE
      } else if (rawThinkingSig !== undefined && !explicitSig) {
        thoughtSignature = undefined
      } else if (explicitSig && !restore.hasCache) {
        thoughtSignature = explicitSig
      } else if (explicitSig && cachedSig && explicitSig === cachedSig) {
        thoughtSignature = explicitSig
      } else if (!explicitSig && cachedSig) {
        thoughtSignature = cachedSig
      } else if (restore.allowSentinelFallback) {
        thoughtSignature = SKIP_THOUGHT_SIGNATURE
      }
    } else {
      const cachedSig =
        rawThinkingSig === undefined && text.length > 0 && restore?.hasCache
          ? restoreCachedSignature(restore.getSignature(text))
          : undefined
      thoughtSignature = explicitSig ?? cachedSig
    }
    if (!text && !thoughtSignature) fail("Only text context is supported by this provider.")
    return { thought: true, text, ...(thoughtSignature ? { thoughtSignature } : {}) }
  }
  if (type === "thinking" && assistant) {
    const text = field(part, "thinking", true)
    if (typeof text !== "string" || !text) fail("Only text context is supported by this provider.")
    return { text }
  }
  if (type === "image" || type === "document" || type === "file") {
    if (assistant) fail("Only text context is supported by this provider.")
    return extractInlineMediaPart(part, type, allowMultimodal)
  }
  fail("Only text context is supported by this provider.")
}

function shouldInjectSonarGoogleSearch(wireModel: string, options: unknown): boolean {
  if (!wireModel.toLowerCase().endsWith("-sonar")) return false
  if (isRecord(options) && option(options, "toolChoice") === "none") return false
  return true
}

function isSameProviderAndModel(message: Record<string, unknown>, publicId: string): boolean {
  return field(message, "provider") === PROVIDER && field(message, "model") === publicId
}

function serializeThinkingConfig(thinking: ReturnType<typeof resolveGenerationSelection>["route"]["thinking"]):
  | { thinkingLevel: ThinkingLevel, includeThoughts: boolean }
  | { thinkingBudget: number, includeThoughts: boolean }
  | undefined {
  if (thinking.kind === "native-level") return { thinkingLevel: thinking.thinkingLevel, includeThoughts: thinking.includeThoughts }
  if (thinking.kind === "budget") return { thinkingBudget: thinking.budget, includeThoughts: thinking.includeThoughts }
  return undefined
}

function resolveOutputTokens(maxTokens: unknown, maxAllowed: number, thinking: ReturnType<typeof resolveGenerationSelection>["route"]["thinking"]): number {
  if (typeof maxTokens === "number") {
    if (maxTokens > maxAllowed) fail(`maxTokens must be a positive integer no greater than ${maxAllowed}.`)
    if (thinking.kind === "budget" && thinking.budget > 0 && maxTokens <= thinking.budget) fail("maxTokens must exceed the selected thinking budget.")
    return maxTokens
  }
  return thinking.kind === "budget" && thinking.budget > 0 ? Math.max(4096, thinking.budget + 1024) : 4096
}

function geminiRequiresSignedToolReplay(wireModel: string): boolean {
  if (!wireModel.startsWith("gemini-")) return false
  const match = /^gemini-(\d+)/.exec(wireModel)
  if (match) return Number(match[1]) >= 3
  return true
}

function validThoughtSignature(value: unknown, allowSentinel = false): string | undefined {
  if (allowSentinel && value === SKIP_THOUGHT_SIGNATURE) return SKIP_THOUGHT_SIGNATURE
  if (typeof value !== "string" || !value || value.length % 4 !== 0) return undefined
  return /^[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined
}

function restoreCachedSignature(value: string | undefined): string | undefined {
  if (typeof value !== "string" || !value) return undefined
  if (value === SKIP_THOUGHT_SIGNATURE) return undefined
  return validThoughtSignature(value, false) ?? (value.length >= MIN_THOUGHT_SIGNATURE_LENGTH ? value : undefined)
}

function resolveTurnThinkingSignature(
  message: Record<string, unknown>,
  restore: SignatureRestoreState,
  beforeContentIndex: number,
): string | undefined {
  const content = field(message, "content")
  if (!Array.isArray(content)) return undefined
  const upperBound = Math.min(beforeContentIndex, content.length)
  for (let index = upperBound - 1; index >= 0; index--) {
    const item = content[index]
    if (!isRecord(item) || field(item, "type") !== "thinking") continue
    const rawThinkingSig = field(item, "thinkingSignature")
    if (rawThinkingSig !== undefined) {
      return validThoughtSignature(rawThinkingSig, false)
    }
    const thinkingText = field(item, "thinking")
    if (typeof thinkingText === "string" && thinkingText.length > 0 && restore.hasCache) {
      return restoreCachedSignature(restore.getSignature(thinkingText))
    }
    return undefined
  }
  return undefined
}

function validateOptions(options: unknown, maxAllowedTokens: number): void {
  if (options === undefined) return
  if (!isRecord(options)) fail("Invalid generation options.")
  const reasoning = option(options, "reasoning"), budgets = option(options, "thinkingBudgets"), deferred = option(options, "deferred"), toolChoice = option(options, "toolChoice"), sampling = option(options, "samplingParams"), temperature = option(options, "temperature"), maxTokens = option(options, "maxTokens"), headers = option(options, "headers")
  if (reasoning !== undefined && reasoning !== "off" && !isThinkingLevel(reasoning)) fail("Unsupported reasoning level.")
  if (budgets !== undefined) fail("Thinking budgets are not supported.")
  if (deferred) fail("Deferred requests are not supported.")
  if (toolChoice !== undefined && toolChoice !== "none") fail("Tools are not supported by this text-only provider.")
  if (sampling !== undefined) fail("Custom generation options are not supported.")
  if (temperature !== undefined && (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2)) fail("Temperature must be finite and between 0 and 2.")
  if (maxTokens !== undefined && (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens <= 0 || maxTokens > maxAllowedTokens)) fail(`maxTokens must be a positive integer no greater than ${maxAllowedTokens}.`)
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
