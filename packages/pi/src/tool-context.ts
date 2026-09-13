import { ToolPreflightError } from "./tool-contract.ts"
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

export function prepareToolContext(tools: unknown, choice: unknown): PreparedToolContext | undefined {
  const declarations = normalizeToolDeclarations(tools ?? [])
  if (!declarations.length) {
    if (choice === "auto") throw new ToolPreflightError("PI_TOOL_CHOICE_WITHOUT_DECLARATIONS", "tools", "$")
    if (choice !== undefined && choice !== "none") unsupportedChoice()
    return undefined
  }
  if (choice !== undefined && choice !== "auto" && choice !== "none") unsupportedChoice()
  return { declarations, mode: choice === "none" ? "NONE" : "AUTO" }
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
