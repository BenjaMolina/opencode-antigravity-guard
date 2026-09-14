import { resolve } from "node:path"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { describe, expect, it } from "vitest"

import { normalizeToolDeclarations } from "../packages/pi/src/tool-schema.ts"
import extension from "../packages/pi/evidence/pi-evidence-echo.ts"
import { isJsonProbeComplete, jsonProbeArgs, sanitizeTerminalCategory, summarizeTerminalMessages, validateDisabledProbeEvents, validateProbeEvents } from "./pi-tool-loop-probe.ts"

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

  it("returns the exact non-terminating valid execution result and retains exact-value runtime validation", async () => {
    const tool = registerEvidenceEcho()

    await expect(tool.execute("test-call", { value: "gemini-tool-loop" }, undefined)).resolves.toEqual({ content: [{ type: "text", text: "PI_EVIDENCE_ECHO_OK" }], details: { value: "gemini-tool-loop" }, terminate: false })
    await expect(tool.execute("test-call", { value: "other" }, undefined)).rejects.toThrow("pi_evidence_echo requires the fixed evidence value.")
  })

  it("admits exactly one successful echo, two terminal turns, and one agent end", () => {
    expect(validateProbeEvents([
      { type: "tool_execution_start", toolName: "pi_evidence_echo", args: { value: "gemini-tool-loop" } },
      { type: "tool_execution_end", toolName: "pi_evidence_echo", isError: false },
      { type: "turn_end", message: { stopReason: "toolUse", content: [] } },
      { type: "turn_end", message: { stopReason: "stop", content: [{ type: "text", text: "PI_EVIDENCE_LOOP_OK" }] } },
      { type: "session", id: "ignored-session-header" },
      { type: "agent_end" },
    ], route)).toEqual({
      passed: true,
      route,
      assertions: ["echo-started", "echo-completed", "first-turn-tool-use", "second-turn-marker", "agent-ended"],
    })
  })

  it("rejects raw provider output, missing completion, and any tool other than the deterministic echo", () => {
    expect(validateProbeEvents([
      { type: "tool_execution_start", toolName: "bash", args: { command: "echo unsafe" } },
      { type: "agent_end" },
    ], route)).toEqual({
      passed: false,
      route,
      assertions: ["agent-ended"],
    })
  })

  it("builds an isolated Pi JSON-mode command with the evidence prompt as positional input", () => {
    expect(jsonProbeArgs("/workspace")).toEqual([
      "--mode", "json",
      "--no-session",
      "--no-extensions",
      "-e", resolve("/workspace", "packages/pi/dist/extension.js"),
      "-e", resolve("/workspace", "packages/pi/evidence/pi-evidence-echo.ts"),
      "--no-skills",
      "--no-prompt-templates",
      "--no-context-files",
      "--no-approve",
      "--provider", "antigravity-guard",
      "--model", "antigravity-gemini-3.8-flash",
      "--thinking", "off",
      "--tools", "pi_evidence_echo",
      "Call pi_evidence_echo exactly once with value gemini-tool-loop. After it returns, reply with exactly PI_EVIDENCE_LOOP_OK and no other text or tool calls.",
    ])
  })

  it("completes only when a JSON-mode session emitted one agent_end and the child exited", () => {
    const ended = [{ type: "session" }, { type: "agent_end" }]
    expect(isJsonProbeComplete(ended, "exit")).toBe(true)
    expect(isJsonProbeComplete(ended, "timeout")).toBe(false)
    expect(isJsonProbeComplete([{ type: "agent_end" }, { type: "agent_end" }], "exit")).toBe(false)
    expect(isJsonProbeComplete([{ type: "turn_end" }], "exit")).toBe(false)
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

  it("emits only allowlisted agent-end termination and message-role counts", () => {
    const secret = "CANARY-secret-text-and-arguments"
    const summary = summarizeTerminalMessages([{
      type: "agent_end",
      toolExecutionTerminate: false,
      messages: [
        { role: "user", content: secret, id: secret },
        { role: "assistant", content: [{ type: "text", text: secret }], diagnostics: [{ secret }] },
        { role: "toolResult", content: secret, toolName: secret, args: { secret } },
        { role: "system", content: secret },
      ],
      diagnostics: { secret },
    }, {
      type: "agent_end",
      messages: [],
    }, {
      type: "agent_end",
      toolExecutionTerminate: true,
      messages: [{ role: "assistant" }],
    }])
    expect(summary).toEqual([
      { toolExecutionTerminate: false, userMessageCount: 1, assistantMessageCount: 1, toolResultMessageCount: 1 },
      { userMessageCount: 0, assistantMessageCount: 0, toolResultMessageCount: 0 },
      { toolExecutionTerminate: true, userMessageCount: 0, assistantMessageCount: 1, toolResultMessageCount: 0 },
    ])
    expect(JSON.stringify(summary)).not.toContain(secret)
  })

  it("rejects malformed agent-end termination and message inputs", () => {
    const summaries = [
      { type: "agent_end", toolExecutionTerminate: "false", messages: [] },
      { type: "agent_end", toolExecutionTerminate: 0, messages: [] },
      { type: "agent_end", messages: "not-an-array" },
      { type: "agent_end", messages: [{ role: 1 }] },
      { type: "message_end", messages: [] },
    ].map((event) => summarizeTerminalMessages([event]))
    expect(summaries).toEqual([[], [], [], [], []])
  })

  it("recognizes only the local fail-closed capability rejection with no tool execution and one agent end", () => {
    expect(validateDisabledProbeEvents([
      { type: "message_end", message: { errorMessage: "PI_TOOL_CAPABILITY_NOT_ENABLED: antigravity-gemini-3.8-flash/off is disabled (missing-direct-evidence)." } },
      { type: "agent_end" },
    ], route)).toEqual({
      passed: true,
      route,
      assertions: ["capability-rejected", "no-tool-execution", "agent-ended"],
    })

    expect(validateDisabledProbeEvents([
      { type: "message_end", message: { errorMessage: "credential failure" } },
      { type: "agent_end" },
    ], route)).toMatchObject({ passed: false })
  })
})
