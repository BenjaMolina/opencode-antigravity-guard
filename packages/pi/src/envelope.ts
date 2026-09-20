import { createHash } from "node:crypto"

export const ANTIGRAVITY_MODEL_ENUM: Readonly<Record<string, string>> = Object.freeze({
  // Gemini 3.8 Flash
  "gemini-3.8-flash": "MODEL_PLACEHOLDER_M318",
  "gemini-3.8-flash-high": "MODEL_PLACEHOLDER_M318",
  "gemini-3.8-flash-medium": "MODEL_PLACEHOLDER_M319",
  "gemini-3.8-flash-low": "MODEL_PLACEHOLDER_M320",
  "gemini-3.8-flash-tiered": "MODEL_PLACEHOLDER_M322",
  // Gemini 3.7 Flash
  "gemini-3.7-flash": "MODEL_PLACEHOLDER_M298",
  "gemini-3.7-flash-high": "MODEL_PLACEHOLDER_M298",
  "gemini-3.7-flash-medium": "MODEL_PLACEHOLDER_M299",
  "gemini-3.7-flash-low": "MODEL_PLACEHOLDER_M300",
  "gemini-3.7-flash-tiered": "MODEL_PLACEHOLDER_M301",
  // Gemini 3.6 Flash
  "gemini-3.6-flash": "MODEL_PLACEHOLDER_M71",
  "gemini-3.6-flash-high": "MODEL_PLACEHOLDER_M71",
  "gemini-3.6-flash-medium": "MODEL_PLACEHOLDER_M72",
  "gemini-3.6-flash-low": "MODEL_PLACEHOLDER_M73",
  "gemini-3.6-flash-tiered": "MODEL_PLACEHOLDER_M196",
  // Gemini 3.5 Flash
  "gemini-3.5-flash": "MODEL_PLACEHOLDER_M20",
  "gemini-3.5-flash-extra-low": "MODEL_PLACEHOLDER_M187",
  "gemini-3.5-flash-low": "MODEL_PLACEHOLDER_M20",
  "gemini-3-flash-agent": "MODEL_PLACEHOLDER_M84",
  // Gemini 3.1 Pro
  "gemini-3.1-pro": "MODEL_PLACEHOLDER_M36",
  "gemini-3.1-pro-low": "MODEL_PLACEHOLDER_M36",
  "gemini-3.1-pro-high": "MODEL_PLACEHOLDER_M37",
  "gemini-pro-agent": "MODEL_PLACEHOLDER_M16",
  // Claude
  "claude-sonnet-4-6": "MODEL_PLACEHOLDER_M35",
  "claude-opus-4-6": "MODEL_PLACEHOLDER_M26",
  "claude-opus-4-6-thinking": "MODEL_PLACEHOLDER_M26",
  // GPT-OSS
  "gpt-oss-120b": "MODEL_OPENAI_GPT_OSS_120B_MEDIUM",
  "gpt-oss-120b-medium": "MODEL_OPENAI_GPT_OSS_120B_MEDIUM",
})

export function stableUuid(seed: string): string {
  const bytes = createHash("sha1").update(seed).digest().subarray(0, 16)
  bytes[6] = (bytes[6]! & 0x0f) | 0x50
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const sessionTrajectoryMap = new Map<string, { conversationId: string, trajectoryId: string }>()

export function resolveSessionTrajectory(messages?: readonly unknown[]): { conversationId: string, trajectoryId: string } {
  const firstMsg = Array.isArray(messages) ? messages[0] : undefined
  if (!isRecord(firstMsg)) {
    return { conversationId: crypto.randomUUID(), trajectoryId: crypto.randomUUID() }
  }
  const role = typeof firstMsg.role === "string" ? firstMsg.role : "user"
  const timestamp = typeof firstMsg.timestamp === "number" ? String(firstMsg.timestamp) : ""
  const rawContent = firstMsg.content
  const contentSeed = typeof rawContent === "string"
    ? rawContent.slice(0, 64)
    : Array.isArray(rawContent)
      ? JSON.stringify(rawContent[0] ?? "").slice(0, 64)
      : ""
  const seed = `${role}:${timestamp}:${contentSeed}`
  let entry = sessionTrajectoryMap.get(seed)
  if (!entry) {
    entry = {
      conversationId: stableUuid(`antigravity:conv:${seed}`),
      trajectoryId: stableUuid(`antigravity:traj:${seed}`),
    }
    sessionTrajectoryMap.set(seed, entry)
    if (sessionTrajectoryMap.size > 64) {
      const oldestKey = sessionTrajectoryMap.keys().next().value
      if (oldestKey !== undefined) sessionTrajectoryMap.delete(oldestKey)
    }
  }
  return entry
}

export function clearSessionTrajectoryMap(): void {
  sessionTrajectoryMap.clear()
}

export interface AntigravityEnvelope {
  readonly requestId: string
  readonly sessionId: string
  readonly labels: Record<string, string>
}

const UUID_AGENT_REGEX = /^agent-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildAntigravityEnvelope(options: {
  wireModelId: string
  family: "gemini" | "claude" | "gpt-oss"
  contentsCount: number
  messages?: readonly unknown[]
  explicitSessionId?: string
  injectedRequestId?: string
}): AntigravityEnvelope {
  const isClaude = options.family === "claude"
  const isNonGemini = options.family === "claude" || options.family === "gpt-oss"
  const step = Math.max(1, options.contentsCount)
  const lastStepIndex = String(Math.max(0, step - 1))
  const assistantMsgCount = Array.isArray(options.messages)
    ? options.messages.filter((m) => isRecord(m) && m.role === "assistant" && m.stopReason !== "error" && m.stopReason !== "aborted").length
    : 0
  const requestIndex = Math.max(0, assistantMsgCount)
  const { conversationId, trajectoryId } = resolveSessionTrajectory(options.messages)

  const sessionHash = createHash("sha1").update(`session:${trajectoryId}`).digest().subarray(0, 8)
  const generatedSessionId = String(new DataView(sessionHash.buffer, sessionHash.byteOffset, 8).getBigInt64(0, true))
  const sessionId = options.explicitSessionId || generatedSessionId

  const labels: Record<string, string> = {
    last_step_index: lastStepIndex,
    request_id: `${trajectoryId}-${requestIndex}`,
    trajectory_id: trajectoryId,
    used_claude: isClaude ? "true" : "false",
    used_claude_conservative: isClaude ? "true" : "false",
    used_non_gemini_model: isNonGemini ? "true" : "false",
  }

  const modelEnum = ANTIGRAVITY_MODEL_ENUM[options.wireModelId]
  if (modelEnum) {
    labels.model_enum = modelEnum
  }

  const requestId = options.injectedRequestId && !UUID_AGENT_REGEX.test(options.injectedRequestId)
    ? options.injectedRequestId
    : `agent/${conversationId}/${trajectoryId}/${step}`

  return { requestId, sessionId, labels }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
