import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { spawn } from "node:child_process"
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

type Route = typeof PROBE_ROUTE
type ProbeEvent = Record<string, unknown>
type ProbeResult = {
  readonly passed: boolean
  readonly route: Route
  readonly assertions: readonly string[]
}

export function validateProbeEvents(events: readonly ProbeEvent[], route: Route): ProbeResult {
  const assertions: string[] = []
  const toolStarts = events.filter((event) => event.type === "tool_execution_start")
  const toolEnds = events.filter((event) => event.type === "tool_execution_end")
  const turns = events.filter((event) => event.type === "turn_end")
  const settled = events.filter((event) => event.type === "agent_settled")
  const start = toolStarts[0]
  const end = toolEnds[0]

  if (toolStarts.length === 1 && start?.toolName === "pi_evidence_echo" && objectValue(start.args)?.value === ECHO_VALUE) assertions.push("echo-started")
  if (toolEnds.length === 1 && end?.toolName === "pi_evidence_echo" && end.isError === false) assertions.push("echo-completed")
  if (turns.length === 2 && objectValue(turns[0]?.message)?.stopReason === "toolUse") assertions.push("first-turn-tool-use")
  if (turns.length === 2 && hasExactMarker(objectValue(turns[1]?.message), COMPLETION_MARKER)) assertions.push("second-turn-marker")
  if (settled.length === 1) assertions.push("agent-settled")

  return { passed: assertions.length === 5, route, assertions }
}

export function validateDisabledProbeEvents(events: readonly ProbeEvent[], route: Route): ProbeResult {
  const assertions: string[] = []
  const capabilityError = events.some((event) => containsText(event, "PI_TOOL_CAPABILITY_NOT_ENABLED"))
  const toolEvents = events.filter((event) => typeof event.type === "string" && event.type.startsWith("tool_execution_"))
  const settled = events.filter((event) => event.type === "agent_settled")

  if (capabilityError) assertions.push("capability-rejected")
  if (toolEvents.length === 0) assertions.push("no-tool-execution")
  if (settled.length === 1) assertions.push("agent-settled")

  return { passed: assertions.length === 3, route, assertions }
}

async function run(): Promise<void> {
  const expectation = expectationFromArgs(process.argv.slice(2))
  if (!expectation) {
    emit({ status: "refused", reason: "Pass --live with exactly one expected capability state." })
    process.exitCode = 2
    return
  }

  const events = await runRpcProbe()
  const result = expectation === "enabled"
    ? validateProbeEvents(events, PROBE_ROUTE)
    : validateDisabledProbeEvents(events, PROBE_ROUTE)

  if (!result.passed) {
    emit({ status: "not-admitted", expectation, route: result.route, assertions: result.assertions, terminalCategory: sanitizeTerminalCategory(events), events: summarizeEvents(events) })
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

function runRpcProbe(): Promise<ProbeEvent[]> {
  const root = process.cwd()
  const providerExtension = resolve(root, "packages/pi/dist/extension.js")
  const probeExtension = resolve(root, "packages/pi/evidence/pi-evidence-echo.ts")
  const child = spawn("pi", [
    "--mode", "rpc",
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
  ], { cwd: root, stdio: ["pipe", "pipe", "ignore"] })

  return new Promise((resolveEvents) => {
    const events: ProbeEvent[] = []
    const decoder = new StringDecoder("utf8")
    let buffer = ""
    let finished = false
    const timeout = setTimeout(() => finish(true), TIMEOUT_MS)

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
    const finish = (timedOut = false) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      child.stdin.end()
      if (timedOut && !child.killed) child.kill()
      resolveEvents(events)
    }

    child.stdout.on("data", consume)
    child.stdout.on("end", () => {
      const trailing = `${buffer}${decoder.end()}`.replace(/\r$/, "")
      if (trailing) collectEvent(trailing, events)
    })
    child.once("error", finish)
    child.once("exit", () => setTimeout(finish, 0))
    child.stdin.write(`${JSON.stringify({
      id: "pi-tool-loop-probe",
      type: "prompt",
      message: "Call pi_evidence_echo exactly once with value gemini-tool-loop. After it returns, reply with exactly PI_EVIDENCE_LOOP_OK and no other text or tool calls.",
    })}\n`)
    child.stdout.on("data", () => {
      if (hasPromptRunSettled(events)) finish()
    })
  })
}

export function hasPromptRunSettled(events: readonly ProbeEvent[]): boolean {
  let accepted = false
  let started = false
  for (const event of events) {
    if (!accepted && event.type === "response" && event.id === "pi-tool-loop-probe" && event.command === "prompt" && event.success === true) accepted = true
    else if (accepted && !started && event.type === "agent_start") started = true
    else if (started && event.type === "agent_settled") return true
  }
  return false
}

function collectEvent(line: string, events: ProbeEvent[]): void {
  try {
    const parsed: unknown = JSON.parse(line)
    if (objectValue(parsed)) events.push(parsed)
  } catch {
    // RPC output outside the JSONL contract is intentionally discarded.
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

function summarizeEvents(events: readonly ProbeEvent[]): readonly { readonly type: string, readonly capabilityRejected: boolean }[] {
  return events.flatMap((event) => typeof event.type === "string" ? [{
    type: event.type,
    capabilityRejected: containsText(event, "PI_TOOL_CAPABILITY_NOT_ENABLED"),
  }] : [])
}

async function writeEvidence(result: ProbeResult): Promise<void> {
  const path = resolve(process.cwd(), EVIDENCE_PATH)
  await mkdir(resolve(process.cwd(), "packages/pi/evidence"), { recursive: true })
  await writeFile(path, `${JSON.stringify({
    schemaVersion: 1,
    record: "pi-rpc-tool-loop",
    revision: "gemini-3.8-flash-off-v1",
    route: result.route,
    provenance: {
      runner: "Pi RPC",
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
