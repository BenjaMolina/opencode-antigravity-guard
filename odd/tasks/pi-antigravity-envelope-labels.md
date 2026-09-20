# ODD Feature: Antigravity Request Envelope, SessionId, and Labels in Pi

## Objective
Align \packages/pi\ generation requests with the authentic Google Antigravity CLI wire format from \pi-antigravity\ by attaching \equest.sessionId\, \equest.labels\ (\used_claude\, \used_claude_conservative\, \used_non_gemini_model\, \model_enum\, \	rajectory_id\, \equest_id\, \last_step_index\), \systemInstruction.role = \"user\"\, and CLI-formatted \equestId\ (\gent/\/\/\/\\), eliminating Turn 1 rejection on Claude and GPT-OSS models.

## Context & Issue
- Issue: #60
- Reference implementation: \C:\Github\Ordico\pi-antigravity\src\utils\util.ts\ & \src\stream\stream.ts\

## Tasks
- [x] Task 1: Create \packages/pi/src/envelope.ts\ with \ANTIGRAVITY_MODEL_ENUM\, \esolveSessionTrajectory\, and \uildAntigravityEnvelope\ matching \pi-antigravity\.
- [x] Task 2: Update \GenerationRequest\, \serializeContext\, and \serializeTextContext\ in \packages/pi/src/context.ts\ to populate \equest.sessionId\, \equest.labels\, \systemInstruction.role = \"user\"\, and envelope \equestId\.
- [x] Task 3: Add unit tests in \packages/pi/src/context.test.ts\ verifying \sessionId\, \labels\ (including \used_claude\, \model_enum\, etc.), and formatted \equestId\ for Claude, GPT-OSS, and Gemini models.
- [x] Task 4: Run full verification (\
pm test\, \
pm run typecheck:all\), commit work units, open and merge PR linked to #60, release v1.1.23 (@benjamolina/pi-antigravity-guard@0.4.9), and update in Pi via Bun.
