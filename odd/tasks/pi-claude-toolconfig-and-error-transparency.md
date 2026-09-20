# ODD Feature: Claude ToolConfig Mode, Base64 Sanitization, and Error Detail

## Objective
Fix Claude tool execution Turn 2 rejection in Pi by:
1. Enforcing explicit \	oolConfig: { functionCallingConfig: { mode: 'AUTO' } }\ for Claude and GPT-OSS models when tools are declared.
2. Sanitizing image base64 data in \	oolResult\ to strip any \data:image/...;base64,\ URI prefix.
3. Surfacing actual backend error messages in \stream.ts\ \httpError\ instead of a blind generic error.

## Context & Issue
- Issue: #62
- Reference implementations:
  - \src/plugin/request.ts:1173\ (OpenCode explicit Claude \	oolConfig.functionCallingConfig.mode = 'AUTO'\)
  - \C:\Github\Ordico\pi-antigravity\scripts\smoke-tool-schema.ts:77\ (\	oolConfig\ for Claude)
  - \C:\Github\Ordico\pi-antigravity\src\stream\stream.ts:120\ (\parseImageData\)

## Tasks
- [x] Task 1: Update \packages/pi/src/context.ts\ to output \	oolConfig: { functionCallingConfig: { mode: \"AUTO\" } }\ for Claude and GPT-OSS models when tools are declared in auto mode.
- [x] Task 2: Update \packages/pi/src/tool-context.ts\ to strip data URI prefixes from image parts in \	oolResult\.
- [x] Task 3: Update \packages/pi/src/stream.ts\ \httpError\ to extract and report the backend's real error message.
- [x] Task 4: Add unit test coverage in \context.test.ts\ and \stream.test.ts\.
- [x] Task 5: Run full test suite & typecheck, commit work units, open PR #63, merge into main, release v1.1.24 (@benjamolina/pi-antigravity-guard@0.4.10), and update in Pi via Bun.
