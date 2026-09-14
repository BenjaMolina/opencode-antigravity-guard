import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { describe, expect, it } from "vitest"

import { normalizeToolDeclarations } from "../packages/pi/src/tool-schema.ts"
import extension from "../packages/pi/evidence/pi-evidence-echo.ts"
import { hasPromptRunSettled, sanitizeTerminalCategory, summarizeTerminalMessages, validateDisabledProbeEvents, validateProbeEvents } from "./pi-tool-loop-probe.ts"

type RegisteredTool = Parameters<ExtensionAPI["registerTool"]>[0]

function registerEvidenceEcho(): RegisteredTool {
  const registrations: RegisteredTool[] = []
  extension({
    registerTool(tool) {
      registrations.push(tool)
    },
  } as ExtensionAPI)
  expect(registrations).toHaveLength(1)
  return registrations[0]!
}

const route = {
  publicModelId: "antigravity-gemini-3.8-flash",
  reasoning: "off",
  wireModel: "gemini-3.8-flash-tiered",
} as const

describe("Pi tool-loop probe evidence", () => {
  it("registers a declaration that Pi's request preflight preserves", () => {
    const tool = registerEvidenceEcho()

    expect(normalizeToolDeclarations([tool])).toEqual([{
      name: "pi_evidence_echo",
      description: "Return the fixed Pi tool-loop evidence value. Call only with value gemini-tool-loop.",
      parameters: {
        type: "object",
        properties: {
          value: { type: "string" },
        },
        required: ["value"],
      },
    }])
  })

  it("retains exact-value runtime validation", async () => {
    const tool = registerEvidenceEcho()

    await expect(tool.execute("test-call", { value: "other" }, undefined)).rejects.toThrow("pi_evidence_echo requires the fixed evidence value.")
  })

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

  it("emits only allowlisted replay and local failure facts", () => {
    const secret = "CANARY-secret-text-and-arguments"
    const summary = summarizeTerminalMessages([{
      type: "message_end",
      message: {
        role: "assistant",
        content: [{ type: "text", text: secret }, { type: "toolCall", arguments: { secret } }],
        diagnostics: [{ type: "antigravity-guard.tools", details: {
          publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", capabilityState: "enabled", preflight: "accepted",
          replayMode: "signed-function-response", recoveryCount: 1, userMessageCount: 1, assistantMessageCount: 1, toolResultMessageCount: 1, assistantToolCallBlockCount: 1, declaredToolCount: 1, preflightCategory: "history", preflightPath: "$.content[0]",
          failure: { kind: "response", status: 400 }, terminal: "error",
        } }],
        headers: { authorization: secret }, providerPayload: { secret },
      },
    }])
    expect(summary).toEqual([{
      replayMode: "signed-function-response", recoveryCount: 1, userMessageCount: 1, assistantMessageCount: 1, toolResultMessageCount: 1, assistantToolCallBlockCount: 1, declaredToolCount: 1, capabilityState: "enabled",
      preflightCategory: "history", preflightPath: "$.content[0]", failure: { kind: "response", status: 400 },
    }])
    expect(JSON.stringify(summary)).not.toContain(secret)
  })

    it("rejects malformed diagnostic values and secret-bearing extras", () => {
    const valid = {
      publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", capabilityState: "enabled", preflight: "accepted",
      replayMode: "unsigned-observation", recoveryCount: 0,
      userMessageCount: 1, assistantMessageCount: 0, toolResultMessageCount: 0, assistantToolCallBlockCount: 0, declaredToolCount: 1,
    }
    const summaries = [
      { ...valid, secret: "CANARY-extra" },
      { ...valid, replayMode: "forged" },
      { ...valid, recoveryCount: -1 },
      { ...valid, userMessageCount: Number.NaN },
      { ...valid, assistantMessageCount: -1 },
      { ...valid, toolResultMessageCount: 0.5 },
      { ...valid, assistantToolCallBlockCount: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, declaredToolCount: -1 },
      { ...valid, preflightPath: "CANARY-path" },
      { ...valid, failure: { kind: "response", status: 600 } },
    ].map((details) => summarizeTerminalMessages([{ type: "turn_end", message: { role: "assistant", diagnostics: [{ type: "antigravity-guard.tools", details }] } }]))
    expect(summaries).toEqual([[], [], [], [], [], [], [], [], [], []])
    expect(JSON.stringify(summaries)).not.toContain("CANARY")
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
