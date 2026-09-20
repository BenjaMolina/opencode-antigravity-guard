# ODD Feature: Claude and GPT-OSS Tool Call ID Preservation in Pi

## Objective
Preserve sanitized matching tool call IDs on both \unctionCall\ and \unctionResponse\ (including synthetic missing result recovery) for Claude and GPT-OSS models in \@benjamolina/pi-antigravity-guard\, eliminating the Turn 2 rejection (\Error: Antigravity generation request was rejected\) caused by Anthropic/OpenAI proxy validation.

## Context & Issue
- Issue: #58
- Reference implementation: \C:\Github\Ordico\pi-antigravity\src\stream\stream.ts\ (\sanitizeToolCallId\ & \	oolCallIdNeeded\)

## Tasks
- [x] Task 1: Add \sanitizeToolCallId\ and update \ToolReplayPolicy\ with \includeToolCallId?: boolean\ in \packages/pi/src/tool-context.ts\, injecting IDs into \unctionCall\, \unctionResponse\, and \missingResult\ when enabled.
- [x] Task 2: Pass \includeToolCallId\ in \packages/pi/src/context.ts\ when \entry.response.family === "claude" || entry.response.family === "gpt-oss"\.
- [x] Task 3: Add unit tests in \packages/pi/src/tool-context.test.ts\ and \packages/pi/src/context.test.ts\ verifying ID preservation on Claude/GPT-OSS and omission on Gemini.
- [x] Task 4: Run full test suite & typecheck, commit work units, open and merge PR #58, release v1.1.22 (@benjamolina/pi-antigravity-guard@0.4.8), and update in Pi via Bun.
