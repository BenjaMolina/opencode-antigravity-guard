import { describe, expect, it } from "vitest"

import { hasPromptRunSettled, sanitizeTerminalCategory, validateDisabledProbeEvents, validateProbeEvents } from "./pi-tool-loop-probe.ts"

const route = {
  publicModelId: "antigravity-gemini-3.8-flash",
  reasoning: "off",
  wireModel: "gemini-3.8-flash-tiered",
} as const

describe("Pi tool-loop probe evidence", () => {
  it("admits exactly one completed pi_evidence_echo call followed by the completion marker", () => {
    expect(validateProbeEvents([
      { type: "tool_execution_start", toolName: "pi_evidence_echo", args: { value: "gemini-tool-loop" } },
      { type: "tool_execution_end", toolName: "pi_evidence_echo", isError: false },
      { type: "turn_end", message: { stopReason: "toolUse", content: [] } },
      { type: "turn_end", message: { stopReason: "stop", content: [{ type: "text", text: "PI_EVIDENCE_LOOP_OK" }] } },
      { type: "agent_settled" },
    ], route)).toEqual({
      passed: true,
      route,
      assertions: ["echo-started", "echo-completed", "first-turn-tool-use", "second-turn-marker", "agent-settled"],
    })
  })

  it("rejects raw provider output, missing completion, and any tool other than the deterministic echo", () => {
    expect(validateProbeEvents([
      { type: "tool_execution_start", toolName: "bash", args: { command: "echo unsafe" } },
      { type: "agent_settled" },
    ], route)).toEqual({
      passed: false,
      route,
      assertions: ["agent-settled"],
    })
  })

  it("ignores initial settlement until the correlated accepted prompt has started and settled", () => {
    const accepted = { type: "response", id: "pi-tool-loop-probe", command: "prompt", success: true }
    expect(hasPromptRunSettled([{ type: "agent_settled" }, accepted, { type: "agent_start" }, { type: "agent_settled" }])).toBe(true)
    expect(hasPromptRunSettled([{ type: "agent_settled" }, accepted, { type: "agent_start" }])).toBe(false)
    expect(hasPromptRunSettled([{ type: "agent_settled" }, { ...accepted, id: "other" }, { type: "agent_start" }, { type: "agent_settled" }])).toBe(false)
  })

  it.each([
    ["PI_TOOL_CAPABILITY_NOT_ENABLED", "capability"],
    ["Authentication expired", "auth"],
    ["model is unavailable", "model"],
    ["extension_error", "extension"],
    ["generation request failed", "transport"],
    ["unclassified", "process"],
  ] as const)("sanitizes %s as %s", (message, category) => {
    expect(sanitizeTerminalCategory([{ type: "message_end", message: { errorMessage: message } }])).toBe(category)
  })

  it("recognizes only the local fail-closed capability rejection in the disabled control", () => {
    expect(validateDisabledProbeEvents([
      { type: "message_end", message: { errorMessage: "PI_TOOL_CAPABILITY_NOT_ENABLED: antigravity-gemini-3.8-flash/off is disabled (missing-direct-evidence)." } },
      { type: "agent_settled" },
    ], route)).toEqual({
      passed: true,
      route,
      assertions: ["capability-rejected", "no-tool-execution", "agent-settled"],
    })

    expect(validateDisabledProbeEvents([
      { type: "message_end", message: { errorMessage: "credential failure" } },
      { type: "agent_settled" },
    ], route)).toMatchObject({ passed: false })
  })
})
