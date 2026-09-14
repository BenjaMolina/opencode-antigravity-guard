import { spawn } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { StringDecoder } from "node:string_decoder"

export const PROBE_ROUTE = {
  publicModelId: "antigravity-gemini-3.8-flash",
  reasoning: "off",
  wireModel: "gemini-3.8-flash-tiered",
} as const

const COMPLETION_MARKER = "PI_EVIDENCE_LOOP_OK"
const ECHO_VALUE = "gemini-tool-loop"
const TIMEOUT_MS = 90_000
const EVIDENCE_PATH = "packages/pi/evidence/gemini-3.8-flash-off-tool-loop.json"
const EVIDENCE_PROMPT = "Call pi_evidence_echo exactly once with value gemini-tool-loop. After it returns, reply with exactly PI_EVIDENCE_LOOP_OK and no other text or tool calls."
const STOP_REASONS = new Set(["stop", "length", "toolUse", "error", "aborted", "pending"])
const REPLAY_MODES = new Set(["none", "signed-function-response", "unsigned-observation"])
const CAPABILITY_STATES = new Set(["enabled", "disabled"])
const PREFLIGHT_CATEGORIES = new Set(["schema", "tool-choice", "declaration", "history", "capability"])
const FAILURE_KINDS = new Set(["aborted", "access", "capability", "model", "quota", "preflight", "response", "transport", "callback"])
const CREDENTIAL_ERROR_MESSAGES = new Set([
  "Antigravity credentials are invalid. Run /login antigravity-guard.",
  "An Antigravity login is already in progress.",
  "Antigravity login failed.",
  "Antigravity token exchange failed after authorization.",
  "Antigravity credential refresh failed.",
  "Antigravity authorization was denied.",
  "Paste the full callback URL from Antigravity login.",
  "Antigravity login was cancelled.",
])
const PREFLIGHT_ERROR_MESSAGES = new Set(["Tool history is not supported by this text-only provider."])
const MODEL_ERROR_MESSAGES = new Set(["The selected Antigravity model or API is unsupported.", "The requested Antigravity model is unavailable."])
const TRANSPORT_ERROR_MESSAGES = new Set([
  "Antigravity generation failed.", "Antigravity generation request failed.", "Antigravity generation request was rejected.",
  "Antigravity access was denied. Check your entitlement.", "Antigravity quota or rate limit was reached.",
  "Antigravity did not return an SSE response.", "Antigravity returned an invalid stream.",
  "SSE stream ended with an unterminated record.", "SSE stream contains invalid UTF-8.", "SSE record is too large.",
  "Antigravity returned an error response.", "Antigravity returned an invalid response.", "Antigravity returned invalid usage.",
  "Antigravity returned invalid candidates.", "Antigravity returned invalid content.", "Antigravity returned unsupported content.",
  "Antigravity returned an unsupported finish reason.", "Antigravity returned invalid function call.", "Antigravity returned invalid metadata.", "Antigravity returned invalid JSON.",
])
const CONTEXT_CONVERSION_ERROR_MESSAGES = new Set([
  "Invalid text context.", "Text-only context is required.", "Tools are not supported by this text-only provider.",
  "Unsupported context role for this text-only provider.", "Text context is too large.", "A text conversation is required.",
  "Only text context is supported by this provider.", "Invalid generation options.", "Unsupported reasoning level.",
  "Thinking budgets are not supported.", "Deferred requests are not supported.", "Custom generation options are not supported.",
  "Temperature must be finite and between 0 and 2.", "Custom headers cannot replace protected request headers.",
])

type Route = typeof PROBE_ROUTE
type ProbeEvent = Record<string, unknown>
type ProbeResult = {
  readonly passed: boolean
  readonly route: Route
  readonly assertions: readonly string[]
}
type ProbeTermination = "exit" | "spawn-error" | "timeout"
type ProbeRun = {
  readonly events: readonly ProbeEvent[]
  readonly termination: ProbeTermination
}
type StopReason = "stop" | "length" | "toolUse" | "error" | "aborted" | "pending"
type AssistantErrorCategory = "capability" | "credentials" | "preflight" | "model" | "transport" | "context-conversion" | "unknown"
type ContentBlockCounts = {
  readonly text: number
  readonly thinking: number
  readonly toolCall: number
}
type ToolTerminalDiagnostics = {
  readonly capabilityState?: "enabled" | "disabled"
  readonly replayMode?: "none" | "signed-function-response" | "unsigned-observation"
  readonly recoveryCount?: number
  readonly userMessageCount?: number
  readonly assistantMessageCount?: number
  readonly toolResultMessageCount?: number
  readonly assistantToolCallBlockCount?: number
  readonly declaredToolCount?: number
  readonly preflightCategory?: "schema" | "tool-choice" | "declaration" | "history" | "capability"
  readonly preflightPath?: string
  readonly failure?: {
    readonly kind: "aborted" | "access" | "capability" | "model" | "quota" | "preflight" | "response" | "transport" | "callback"
    readonly status?: number
  }
  readonly terminal?: StopReason
}
type AssistantTerminalSummary = {
  readonly ordinal: number
  readonly stopReason?: StopReason
  readonly content: ContentBlockCounts
  readonly errorCategory?: AssistantErrorCategory
  readonly toolDiagnostics?: ToolTerminalDiagnostics
}

export function validateProbeEvents(events: readonly ProbeEvent[], route: Route): ProbeResult {
  const assertions: string[] = []
  const toolStarts = events.filter((event) => event.type === "tool_execution_start")
  const toolEnds = events.filter((event) => event.type === "tool_execution_end")
  const turns = events.filter((event) => event.type === "turn_end")
  const agentEnds = events.filter((event) => event.type === "agent_end")
  const start = toolStarts[0]
  const end = toolEnds[0]

  if (toolStarts.length === 1 && start?.toolName === "pi_evidence_echo" && objectValue(start.args)?.value === ECHO_VALUE) assertions.push("echo-started")
  if (toolEnds.length === 1 && end?.toolName === "pi_evidence_echo" && end.isError === false) assertions.push("echo-completed")
  if (turns.length === 2 && objectValue(turns[0]?.message)?.stopReason === "toolUse") assertions.push("first-turn-tool-use")
  if (turns.length === 2 && hasExactMarker(objectValue(turns[1]?.message), COMPLETION_MARKER)) assertions.push("second-turn-marker")
  if (agentEnds.length === 1) assertions.push("agent-ended")

  return { passed: assertions.length === 5, route, assertions }
}

export function validateDisabledProbeEvents(events: readonly ProbeEvent[], route: Route): ProbeResult {
  const assertions: string[] = []
  const capabilityError = events.some((event) => containsText(event, "PI_TOOL_CAPABILITY_NOT_ENABLED"))
  const toolEvents = events.filter((event) => typeof event.type === "string" && event.type.startsWith("tool_execution_"))
  const agentEnds = events.filter((event) => event.type === "agent_end")

  if (capabilityError) assertions.push("capability-rejected")
  if (toolEvents.length === 0) assertions.push("no-tool-execution")
  if (agentEnds.length === 1) assertions.push("agent-ended")

  return { passed: assertions.length === 3, route, assertions }
}

export function jsonProbeArgs(root: string): readonly string[] {
  const providerExtension = resolve(root, "packages/pi/dist/extension.js")
  const probeExtension = resolve(root, "packages/pi/evidence/pi-evidence-echo.ts")
  return [
    "--mode", "json",
    "--no-session",
    "--no-extensions",
    "-e", providerExtension,
    "-e", probeExtension,
    "--no-skills",
    "--no-prompt-templates",
    "--no-context-files",
    "--no-approve",
    "--provider", "antigravity-guard",
    "--model", PROBE_ROUTE.publicModelId,
    "--thinking", PROBE_ROUTE.reasoning,
    "--tools", "pi_evidence_echo",
    EVIDENCE_PROMPT,
  ]
}

export function isJsonProbeComplete(events: readonly ProbeEvent[], termination: ProbeTermination): boolean {
  return termination === "exit" && events.filter((event) => event.type === "agent_end").length === 1
}

async function run(): Promise<void> {
  const expectation = expectationFromArgs(process.argv.slice(2))
  if (!expectation) {
    emit({ status: "refused", reason: "Pass --live with exactly one expected capability state." })
    process.exitCode = 2
    return
  }

  const probe = await runJsonProbe()
  const result = expectation === "enabled"
    ? validateProbeEvents(probe.events, PROBE_ROUTE)
    : validateDisabledProbeEvents(probe.events, PROBE_ROUTE)

  if (!isJsonProbeComplete(probe.events, probe.termination) || !result.passed) {
    emit({ status: "not-admitted", expectation, route: result.route, assertions: result.assertions, terminalCategory: sanitizeTerminalCategory(probe.events), terminal: summarizeTerminalMessages(probe.events) })
    process.exitCode = 1
    return
  }

  if (expectation === "enabled") await writeEvidence(result)
  emit({ status: expectation === "enabled" ? "admitted" : "disabled-control-passed", route: result.route, assertions: result.assertions })
}

function expectationFromArgs(args: readonly string[]): "disabled" | "enabled" | undefined {
  if (!args.includes("--live")) return undefined
  const disabled = args.includes("--expect-disabled")
  const enabled = args.includes("--expect-enabled")
  return disabled === enabled ? undefined : disabled ? "disabled" : "enabled"
}

function runJsonProbe(): Promise<ProbeRun> {
  const root = process.cwd()
  const child = spawn("pi", jsonProbeArgs(root), { cwd: root, stdio: ["ignore", "pipe", "ignore"] })

  return new Promise((resolveEvents) => {
    const events: ProbeEvent[] = []
    const decoder = new StringDecoder("utf8")
    let buffer = ""
    let finished = false
    let exited = false
    let stdoutEnded = child.stdout === null
    const finish = (termination: ProbeTermination) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      flush()
      resolveEvents({ events, termination })
    }
    const consume = (chunk: Buffer) => {
      buffer += decoder.write(chunk)
      while (true) {
        const newline = buffer.indexOf("\n")
        if (newline < 0) return
        const line = buffer.slice(0, newline).replace(/\r$/, "")
        buffer = buffer.slice(newline + 1)
        collectEvent(line, events)
      }
    }
    const flush = () => {
      const trailing = `${buffer}${decoder.end()}`.replace(/\r$/, "")
      buffer = ""
      if (trailing) collectEvent(trailing, events)
    }
    const finishAfterExit = () => {
      if (exited && stdoutEnded) finish("exit")
    }
    const timeout = setTimeout(() => {
      if (!child.killed) child.kill()
      finish("timeout")
    }, TIMEOUT_MS)

    child.stdout?.on("data", consume)
    child.stdout?.once("end", () => {
      stdoutEnded = true
      finishAfterExit()
    })
    child.once("error", () => finish("spawn-error"))
    child.once("exit", () => {
      exited = true
      finishAfterExit()
    })
    child.once("close", () => {
      if (exited) finish("exit")
    })
  })
}

function collectEvent(line: string, events: ProbeEvent[]): void {
  try {
    const parsed: unknown = JSON.parse(line)
    const event = objectValue(parsed)
    if (event && event.type !== "session") events.push(event)
  } catch {
    // JSON-mode output outside Pi's event contract is intentionally discarded.
  }
}

function objectValue(value: unknown): ProbeEvent | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as ProbeEvent : undefined
}

function hasExactMarker(message: ProbeEvent | undefined, marker: string): boolean {
  if (!message || message.stopReason !== "stop" || !Array.isArray(message.content)) return false
  const text = message.content
    .map((part) => objectValue(part))
    .filter((part): part is ProbeEvent => part !== undefined && part.type === "text")
    .map((part) => typeof part.text === "string" ? part.text : "")
    .join("")
  return text === marker
}

function containsText(value: unknown, target: string, depth = 0): boolean {
  if (depth > 6) return false
  if (typeof value === "string") return value.includes(target)
  if (Array.isArray(value)) return value.some((item) => containsText(item, target, depth + 1))
  const object = objectValue(value)
  return object ? Object.values(object).some((item) => containsText(item, target, depth + 1)) : false
}

export function sanitizeTerminalCategory(events: readonly ProbeEvent[]): "capability" | "auth" | "model" | "extension" | "transport" | "process" {
  if (events.some((event) => containsText(event, "PI_TOOL_CAPABILITY_NOT_ENABLED"))) return "capability"
  if (events.some((event) => containsText(event, "Authentication") || containsText(event, "credentials") || containsText(event, "access was denied"))) return "auth"
  if (events.some((event) => containsText(event, "model is unavailable") || containsText(event, "model or API is unsupported"))) return "model"
  if (events.some((event) => event.type === "extension_error" || containsText(event, "extension_error"))) return "extension"
  return events.some((event) => containsText(event, "generation request") || containsText(event, "SSE") || containsText(event, "stream")) ? "transport" : "process"
}

type TerminalDiagnostics = {
  readonly toolExecutionTerminate?: boolean
  readonly userMessageCount: number
  readonly assistantMessageCount: number
  readonly toolResultMessageCount: number
  readonly assistantMessages: readonly AssistantTerminalSummary[]
}

export function summarizeTerminalMessages(events: readonly ProbeEvent[]): readonly TerminalDiagnostics[] {
  return events.flatMap((event) => {
    if (event.type !== "agent_end") return []
    const summary = summarizeAgentEnd(event)
    return summary ? [summary] : []
  })
}

function summarizeAgentEnd(event: ProbeEvent): TerminalDiagnostics | undefined {
  if (event.toolExecutionTerminate !== undefined && typeof event.toolExecutionTerminate !== "boolean") return undefined
  if (!Array.isArray(event.messages)) return undefined

  let userMessageCount = 0
  let assistantMessageCount = 0
  let toolResultMessageCount = 0
  const assistantMessages: AssistantTerminalSummary[] = []
  for (const message of event.messages) {
    const value = objectValue(message)
    if (!value || typeof value.role !== "string") return undefined
    if (value.role === "user") userMessageCount += 1
    if (value.role === "assistant") {
      assistantMessageCount += 1
      assistantMessages.push(summarizeAssistantTerminal(value, assistantMessageCount))
    }
    if (value.role === "toolResult") toolResultMessageCount += 1
  }

  return {
    ...(event.toolExecutionTerminate === undefined ? {} : { toolExecutionTerminate: event.toolExecutionTerminate }),
    userMessageCount,
    assistantMessageCount,
    toolResultMessageCount,
    assistantMessages,
  }
}

function summarizeAssistantTerminal(message: ProbeEvent, ordinal: number): AssistantTerminalSummary {
  const stopReason = allowedStopReason(message.stopReason)
  const toolDiagnostics = sanitizeToolDiagnostics(message.diagnostics)
  return {
    ordinal,
    ...(stopReason ? { stopReason } : {}),
    content: summarizeContentBlocks(message.content),
    ...(stopReason === "error" ? { errorCategory: classifyAssistantError(message.errorMessage) } : {}),
    ...(toolDiagnostics ? { toolDiagnostics } : {}),
  }
}

function classifyAssistantError(value: unknown): AssistantErrorCategory {
  if (typeof value !== "string") return "unknown"
  if (value.startsWith("PI_TOOL_CAPABILITY_NOT_ENABLED")) return "capability"
  if (CREDENTIAL_ERROR_MESSAGES.has(value)) return "credentials"
  if (value.startsWith("PI_TOOL_") || PREFLIGHT_ERROR_MESSAGES.has(value)) return "preflight"
  if (MODEL_ERROR_MESSAGES.has(value)) return "model"
  if (TRANSPORT_ERROR_MESSAGES.has(value)) return "transport"
  return CONTEXT_CONVERSION_ERROR_MESSAGES.has(value) ? "context-conversion" : "unknown"
}

function summarizeContentBlocks(content: unknown): ContentBlockCounts {
  const counts = { text: 0, thinking: 0, toolCall: 0 }
  if (!Array.isArray(content)) return counts
  for (const item of content) {
    const block = objectValue(item)
    if (block?.type === "text") counts.text += 1
    if (block?.type === "thinking") counts.thinking += 1
    if (block?.type === "toolCall") counts.toolCall += 1
  }
  return counts
}

function sanitizeToolDiagnostics(value: unknown): ToolTerminalDiagnostics | undefined {
  if (!Array.isArray(value)) return undefined
  const diagnostic = value.find((item) => {
    const entry = objectValue(item)
    return entry?.type === "antigravity-guard.tools" && objectValue(entry.details) !== undefined
  })
  const details = objectValue(diagnostic)
  const source = details && objectValue(details.details)
  if (!source) return undefined

  const output: { -readonly [Name in keyof ToolTerminalDiagnostics]?: ToolTerminalDiagnostics[Name] } = {}
  const capabilityState = allowedCapabilityState(source.capabilityState)
  const replayMode = allowedReplayMode(source.replayMode)
  const recoveryCount = safeCount(source.recoveryCount)
  const userMessageCount = safeCount(source.userMessageCount)
  const assistantMessageCount = safeCount(source.assistantMessageCount)
  const toolResultMessageCount = safeCount(source.toolResultMessageCount)
  const assistantToolCallBlockCount = safeCount(source.assistantToolCallBlockCount)
  const declaredToolCount = safeCount(source.declaredToolCount)
  const preflightCategory = allowedPreflightCategory(source.preflightCategory)
  const preflightPath = typeof source.preflightPath === "string" ? source.preflightPath : undefined
  const failure = sanitizeFailure(source.failure)
  const terminal = allowedStopReason(source.terminal)

  if (capabilityState) output.capabilityState = capabilityState
  if (replayMode) output.replayMode = replayMode
  if (recoveryCount !== undefined) output.recoveryCount = recoveryCount
  if (userMessageCount !== undefined) output.userMessageCount = userMessageCount
  if (assistantMessageCount !== undefined) output.assistantMessageCount = assistantMessageCount
  if (toolResultMessageCount !== undefined) output.toolResultMessageCount = toolResultMessageCount
  if (assistantToolCallBlockCount !== undefined) output.assistantToolCallBlockCount = assistantToolCallBlockCount
  if (declaredToolCount !== undefined) output.declaredToolCount = declaredToolCount
  if (preflightCategory) output.preflightCategory = preflightCategory
  if (preflightPath !== undefined) output.preflightPath = preflightPath
  if (failure) output.failure = failure
  if (terminal) output.terminal = terminal
  return Object.keys(output).length ? output : undefined
}

function allowedStopReason(value: unknown): StopReason | undefined {
  return typeof value === "string" && STOP_REASONS.has(value) ? value as StopReason : undefined
}

function allowedCapabilityState(value: unknown): ToolTerminalDiagnostics["capabilityState"] {
  return typeof value === "string" && CAPABILITY_STATES.has(value) ? value as ToolTerminalDiagnostics["capabilityState"] : undefined
}

function allowedReplayMode(value: unknown): ToolTerminalDiagnostics["replayMode"] {
  return typeof value === "string" && REPLAY_MODES.has(value) ? value as ToolTerminalDiagnostics["replayMode"] : undefined
}

function allowedPreflightCategory(value: unknown): ToolTerminalDiagnostics["preflightCategory"] {
  return typeof value === "string" && PREFLIGHT_CATEGORIES.has(value) ? value as ToolTerminalDiagnostics["preflightCategory"] : undefined
}

function safeCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function sanitizeFailure(value: unknown): ToolTerminalDiagnostics["failure"] {
  const failure = objectValue(value)
  if (!failure || typeof failure.kind !== "string" || !FAILURE_KINDS.has(failure.kind)) return undefined
  const status = failure.status
  return {
    kind: failure.kind as NonNullable<ToolTerminalDiagnostics["failure"]>["kind"],
    ...(typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
  }
}

async function writeEvidence(result: ProbeResult): Promise<void> {
  const path = resolve(process.cwd(), EVIDENCE_PATH)
  await mkdir(resolve(process.cwd(), "packages/pi/evidence"), { recursive: true })
  await writeFile(path, `${JSON.stringify({
    schemaVersion: 1,
    record: "pi-json-tool-loop",
    revision: "gemini-3.8-flash-off-v1",
    route: result.route,
    provenance: {
      runner: "Pi JSON event mode",
      credentialSource: "Pi-managed antigravity-guard OAuth",
      providerExtension: "packages/pi/dist/extension.js",
      probeTool: "pi_evidence_echo",
    },
    assertions: result.assertions,
    capturedAt: new Date().toISOString(),
    sanitized: true,
    rawResponseStored: false,
  }, null, 2)}\n`, "utf8")
}

function emit(value: object): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void run().catch(() => {
    emit({ status: "not-admitted", reason: "probe-runner-failed" })
    process.exitCode = 1
  })
}
