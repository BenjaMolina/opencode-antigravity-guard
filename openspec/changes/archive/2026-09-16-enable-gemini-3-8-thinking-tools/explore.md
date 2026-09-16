# Exploration: Enable Gemini 3.8 Flash Thinking Tool Loops

## Result

**Status:** complete. No source, fixture, evidence, credential, runtime, model, branch, commit, or publication change occurred. This is the only write.

**Change:** `enable-gemini-3-8-thinking-tools`  
**Artifact store:** OpenSpec  
**Skill resolution:** `paths-injected` (`gentle-ai`)  
**Research lane:** unselected; no additional external research was performed. The previously inspected `Rahularya01/pi-antigravity` v0.7.3 commit `26214b59e9fafe791dffc306b7f21760a2506646` is contextual comparison only and does not override local contracts or evidence gates.

## Confirmed scope

Enable Pi tool loops only for these exact existing routes, and only independently after direct evidence passes:

| Public model | Reasoning | Wire model | Current thinking wire policy | Current tool state |
|---|---|---|---|---|
| `antigravity-gemini-3.8-flash` | `low` | `gemini-3.8-flash-tiered` | `thinkingLevel: "low"`, `includeThoughts: true` | disabled: `missing-direct-evidence` |
| `antigravity-gemini-3.8-flash` | `medium` | `gemini-3.8-flash-tiered` | `thinkingLevel: "medium"`, `includeThoughts: true` | disabled: `missing-direct-evidence` |
| `antigravity-gemini-3.8-flash` | `high` | `gemini-3.8-flash-tiered` | `thinkingLevel: "high"`, `includeThoughts: true` | disabled: `missing-direct-evidence` |

`off` is already the sole enabled tool route. It uses the same wire model with invisible low thinking (`thinkingLevel: "low"`, `includeThoughts: false`) and record `pi-json-tool-loop/gemini-3.8-flash-off-v1`; it must remain byte-for-byte and behaviorally unchanged. Gemini 3.7/3.6/3.1, Claude, GPT-OSS, image contexts, dynamic discovery, and root OpenCode code remain out of scope.

## Local architecture and evidence state

- `packages/pi/src/catalog.ts` is the single authority for the public route, wire model, thinking policy, replay policy, schema profile, and per-route `ToolCapability`. `resolveToolCapability()` fails closed when an enabled/fixture record does not match the containing public ID, reasoning key, or wire model.
- `packages/pi/src/context.ts` resolves one `GenerationSelection` and rejects tool-bearing context unless its exact route is enabled. Tool-free contexts retain the text serializer. The selected 3.8 route applies signed replay only when the assistant belongs to the same Pi provider and public model.
- `packages/pi/src/tool-context.ts` already supplies deterministic context reconstruction: call/result association is by Pi call ID and exact name; parallel results serialize in assistant call-source order; duplicate, foreign, separated, mismatched, media-bearing, and deferred-tool histories reject; absent results synthesize the fixed failure. Its signed branch emits Gemini function call/response replay, while an unsigned or invalid/cross-model group is intentionally rendered as a text observation.
- `packages/pi/src/response.ts` and `packages/pi/src/stream.ts` already implement accepted-call validation, visible thinking blocks, tool-call lifecycle, `toolUse`, cleanup on abort/error, and safe diagnostics. Existing behavior includes request-local IDs where Gemini omits an ID and tool-use completion for a valid accepted call; this change must not relax or broaden those policies.
- The route-local schema profile remains `gemini-parameters-json-schema`; the existing schema normalizer, all-or-nothing declaration preflight, local-reference handling, and input/resource defenses are compatibility surfaces, not targets.
- `packages/pi/evidence/gemini-3.8-flash-off-tool-loop.json` proves only a sanitized two-turn `off` echo loop. Its assertions prove one tool execution, first-turn `toolUse`, final marker, and agent end. It does **not** establish low, medium, or high; it does not assert visible thought/signature continuity; and its record cannot be reused for another reasoning route.

## Exact-route evidence admission

Each candidate must retain `disabled` until all of the following are true for that same reasoning key and wire model:

1. Hermetic qualification passes against the current local serializer, schema, replay, response, lifecycle, and redaction contracts.
2. A bounded direct Pi JSON-mode probe passes with `--thinking <low|medium|high>`, the deterministic non-terminating echo tool, no session, no unrelated extensions, no skills, and no automatic approval.
3. The direct probe proves the ordered chain **visible signed thinking -> tool call -> Pi tool result -> signed replay/continuation**, without storing prompt text, thought text, signatures, call IDs, arguments, tool-result content, credentials, headers, or raw provider records.
4. A redacted evidence record has a unique revision such as `gemini-3.8-flash-low-tool-loop-v1`, binds public ID/reasoning/wire model, and contains only route/provenance/assertion metadata.
5. The catalog literal is changed only for that exact route to an enabled capability with matching fixture and direct evidence references, the existing Gemini schema profile, and README status changed in the same work unit.

A failed, partial, timed-out, credential-limited, unsigned, replay-fallback, or malformed result is non-admission for that route only. It must leave its catalog capability disabled and cannot block or imply a result for either sibling level. No fallback to `off`, another model, another quota pool, or a different reasoning route is permitted.

Direct validation is expressly prohibited during this exploration. Therefore no new evidence exists and all three target routes remain disabled at this phase boundary.

## Probe gap and bounded change direction

`scripts/pi-tool-loop-probe.ts` is currently hard-coded to `PROBE_ROUTE` `off`, its `off` evidence path/revision, and five coarse assertions. It only checks tool start/end, first `toolUse`, the final marker, and `agent_end`; it cannot validate a visible signed thought, tool-call ordering, a persisted tool result, or signed continuation replay.

A narrow probe refactor should:

- preserve the existing zero-argument/default `off` route, command arguments, output path, evidence revision, and five `off` assertions;
- add a closed route selector that admits only `off`, `low`, `medium`, and `high` for this one public model and always maps them to literal `gemini-3.8-flash-tiered`;
- require an explicit target selector for `low`/`medium`/`high`, reject duplicate/unknown flags before spawning Pi, and derive a distinct safe evidence filename and revision from the selected literal route;
- retain `--live` plus exactly one expectation flag and write an evidence file only after a clean child exit and all assertions pass;
- inspect the in-memory JSON events for the first assistant terminal sequence: visible thinking before exactly one expected tool call, `toolUse`, and valid opaque signatures where Pi exposes them; inspect the final reconstructed history for exactly one corresponding tool result, a marker-only continuation, and `signed-function-response` diagnostics; and emit only fixed assertion labels and sanitized summaries;
- retain disabled-control validation for routes that are not admitted, with zero `tool_execution_*` events and one agent termination.

The probe must not record or print raw provider output. Signature checks are boolean structural checks only; the signature itself must not enter the evidence record, terminal summary, assertion label, or failure output.

## Hermetic matrix

The live probe is necessary but not sufficient. Before one route can be fixture-qualified or enabled, add fixture-driven coverage for each of `low`, `medium`, and `high`:

| Surface | Required proof |
|---|---|
| Catalog admission | Each route has distinct matching evidence references; a mismatched reasoning/wire/public ID resolves disabled; `off` remains the current enabled record; every non-3.8 route remains profile-free and disabled. |
| Request serialization | Exact literal thinking configuration remains `includeThoughts: true` for target levels; tools remain `parametersJsonSchema`; no-tool request bytes remain unchanged. |
| Visible response/lifecycle | SSE fixture ordering is visible thinking, valid signed function call, then `OTHER`/accepted tool terminal; Pi emits indexed thinking and tool-call events followed once by `done/toolUse`. Invalid signatures, undeclared calls, malformed args, and incompatible finishes still fail once. |
| Signed replay/continuation | Same-public-model signed call plus matching result emits function call/function response replay and `signed-function-response`; cross-model, absent, or invalid signatures retain the existing observation fallback rather than being silently promoted. |
| Parallel replay | Two calls with distinct IDs, including same-name calls and reverse result completion, serialize response parts in assistant source order; signature continuity must not rely on completion order. |
| Interrupted/reconstructed history | Partial parallel results receive the existing fixed synthetic failure; a later contiguous real result supersedes it; separated, duplicate, foreign, mismatched, media, or non-`toolUse` call history fails before fetch. |
| Isolation and safety | Abort/error scrubs emitted tool calls and yields one terminal error; no tool preflight, schema, replay, response, OAuth, route, or header behavior is weakened; malformed inputs make zero fetch calls. |
| Probe contract | Synthetic JSON events exercise every new assertion, route parsing, unique evidence paths/revisions, disabled control, redaction, and rejection of raw/ambiguous event shapes. |

Use synthetic fixtures and mocked transport for this matrix. Direct evidence should validate exact backend behavior only after these tests are green; it must not replace hostile-input, interruption, or parallel-history coverage.

## Likely affected files

| Path | Intended role | Scope constraint |
|---|---|---|
| `packages/pi/src/catalog.ts` | Replace only the three exact capability literals after evidence passes. | Do not alter `off`, catalog order, routes, wire IDs, or other families. |
| `packages/pi/src/catalog.test.ts` | Assert independent low/medium/high evidence identity and all unaffected disabled routes. | Keep the existing `off` regression. |
| `scripts/pi-tool-loop-probe.ts` | Closed per-level selection, stronger sanitized chain proof, unique evidence output. | Preserve default `off` behavior and no raw-output persistence. |
| `scripts/pi-tool-loop-probe.test.ts` | Hermetic flag/event/redaction/evidence tests. | Add route-local cases, not model discovery. |
| `packages/pi/src/context.test.ts`, `response.test.ts`, `stream.test.ts`, `tool-context.test.ts` | Route-aware request, signed visible-thinking, lifecycle, replay, parallel, and interruption regressions. | Characterize current strict local behavior; do not broaden it. |
| `packages/pi/evidence/gemini-3.8-flash-{low,medium,high}-tool-loop.json` | Redacted direct evidence, created only by a passing authorized direct probe. | Do not edit the `off` evidence record. |
| `packages/pi/README.md` | Mark only individually evidenced levels enabled. | Never claim a pending or failed level is enabled. |

`tool-schema.ts`, `tool-contract.ts`, `context.ts`, `response.ts`, `stream.ts`, root `src/`, and `packages/core/` are regression/compatibility surfaces. They should not change merely to activate the three route literals; any evidence-driven need to alter them is a scope deviation requiring a new proposal decision.

## Safe activation sequence

1. Add and pass hermetic per-level qualification and probe-contract tests while all target routes remain disabled.
2. Add the closed probe selection while preserving existing `off` behavior and execute only disabled controls if separately authorized.
3. At the human-controlled live-validation gate, stage one exact candidate route at a time, run its bounded direct signed loop, and retain its new redacted evidence only on success.
4. Enable only that matching catalog route and update its README row after successful direct evidence; revert the staged literal and retain no success record if the probe fails.
5. Repeat independently for the next reasoning level. A partial outcome is valid: one or two levels may be enabled while remaining levels stay disabled.
6. Re-run focused and package/root verification after each activation; no model call, commit, push, or publication is part of this exploration.

The user has prohibited live calls in this phase, so step 3 is an explicit later authorization boundary rather than executable work now.

## Verification plan for a later implementation

Required hermetic commands after source changes:

```text
npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts packages/pi/src/tool-context.test.ts scripts/pi-tool-loop-probe.test.ts
npm run typecheck:pi
npm run build:pi
npm run typecheck
npm run build
npm run test:pack
npm test
```

A later direct-validation receipt must list the exact selected route, sanitized assertion labels, clean child termination, and no persisted raw data. It must separately report unavailable credentials/quota/model access as non-admission, never as evidence of support.

## Review forecast and gates

The narrow catalog literals are small, but a trustworthy parameterized probe plus synthetic signed-chain, route-isolation, replay, parallel, interruption, and redaction tests is estimated at **380–480 changed lines**, excluding any failed-attempt artifacts. This crosses the 400-line review budget at the likely upper bound.

Under the active `ask-on-risk` strategy, the proposal/tasks phase must refine the estimate and pause for a delivery decision if it remains over 400 lines. A likely safe split is (A) probe/evidence contract plus its tests and (B) per-route admission, evidence records, README, and focused Pi regression tests; tests stay with the behavior they prove. No chain strategy or `size:exception` is selected here.

## Key risks

| Risk | Mitigation |
|---|---|
| `off` evidence is incorrectly inherited by a visible-thinking route. | Require a unique route-bound direct and fixture record for each level. |
| A probe observes tool execution but not signed continuation. | Assert visible thought/call ordering and sanitized `signed-function-response` continuation diagnostics. |
| Raw signatures, arguments, or model output leak into evidence. | Restrict stored output to route/provenance/fixed labels and test redaction with canaries. |
| Parallel or interrupted history is falsely claimed from a single live loop. | Keep deterministic parallel/recovery tests mandatory and do not elevate them to a live claim. |
| A failed candidate alters the catalog or broadens another route. | Stage and admit one literal route only after success; preserve all remaining disabled states. |
| Shared transport/parser changes broaden behavior to other families. | Treat current context/schema/response/stream code as regression-only unless a separately approved incompatibility is demonstrated. |

## Recommended next phase

Parent validation may proceed to proposal/specification with the exact-route evidence matrix, the no-live-call boundary, the independent partial-success admission rule, and the review-budget delivery gate intact. No implementation should start until the proposal resolves the forecast; no activation can complete until a later explicit live-validation authorization is granted.
