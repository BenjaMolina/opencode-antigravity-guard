# Proposal: Enable Gemini 3.8 Flash Thinking Tool Loops

## Intent

Individually qualify and enable Pi JSON tool loops for `antigravity-gemini-3.8-flash` at reasoning levels `low`, `medium`, and `high` without weakening the plugin's existing fail-closed admission, schema, response, replay, lifecycle, or data-handling guarantees.

Each reasoning level is an independent admission decision. Only an exact public-model/reasoning/wire-model route with passing hermetic qualification and later authorized direct evidence may be enabled. Partial admission is acceptable: a failed, unavailable, or inconclusive level remains disabled and does not block or imply support for either sibling level.

## Current-state gap

The three target routes already map to `gemini-3.8-flash-tiered` with visible thinking, but remain disabled as `missing-direct-evidence`. The existing `off` route is enabled from a separate sanitized echo-loop record and proves only invisible low thinking. It cannot establish support for `low`, `medium`, or `high`.

The current probe is also specific to `off` and checks only coarse tool-loop outcomes. It does not prove the required visible signed-thinking, tool-call, Pi tool-result, and signed-continuation sequence for the target routes.

## Proposed outcome

For each of `low`, `medium`, and `high`:

1. Establish hermetic fixture-driven proof for the route's request configuration, visible-thinking response lifecycle, signed replay, continuation, parallel calls, interrupted history, strict rejection behavior, and redaction contract.
2. Extend the probe through a closed selector for only `off`, `low`, `medium`, and `high`, while preserving the existing zero-argument/default `off` contract.
3. Stop at a human-controlled live-validation gate before making any direct model call.
4. If explicitly authorized later, run a bounded direct Pi JSON-mode probe for one exact route at a time.
5. Admit only a route whose direct probe proves the ordered chain `visible signed thinking -> tool call -> Pi tool result -> signed replay/continuation` and produces a unique redacted evidence record.
6. Update the matching catalog capability and README status in the same work unit. Leave every unsuccessful or untested target disabled.

No live probe is authorized or performed by this proposal.

## Scope

### In scope

- Exact public model `antigravity-gemini-3.8-flash` with reasoning `low`, `medium`, and `high`.
- Existing wire model `gemini-3.8-flash-tiered`.
- Existing visible-thinking policies:
  - `low`: `thinkingLevel: "low"`, `includeThoughts: true`
  - `medium`: `thinkingLevel: "medium"`, `includeThoughts: true`
  - `high`: `thinkingLevel: "high"`, `includeThoughts: true`
- Independent route-bound evidence revisions and files for each admitted level.
- A closed, deterministic probe contract that preserves default `off` behavior, rejects ambiguous selectors before spawning Pi, and emits only sanitized assertion metadata.
- Fixture and mocked-transport coverage for catalog isolation, request bytes, schema preflight, visible response events, signed continuation, parallel replay, interrupted/reconstructed history, abort/error cleanup, malformed inputs, disabled controls, and evidence redaction.
- Route-local catalog activation and README updates only after passing direct evidence.

### Non-goals

- Claude models.
- Other Gemini versions or routes.
- GPT-OSS models.
- Image or media-bearing tool contexts.
- Dynamic model or capability discovery.
- OpenCode root behavior or changes under root `src/`.
- Relaxing strict schema, response, replay, signature, tool-call, lifecycle, or history validation.
- Reworking shared transport/parser behavior without a separately approved scope decision.
- Running live model calls, committing, pushing, publishing, or changing credentials in this proposal phase.

## Admission and safety rules

- Admission remains fail-closed and exact-route-bound by public ID, reasoning key, and wire model.
- `off` remains behaviorally and evidentially unchanged, including its current route, default probe behavior, evidence path, evidence revision, and five existing assertions.
- The `off` evidence record must never be reused or treated as proof for visible-thinking routes.
- Each target remains disabled until its own hermetic checks and authorized bounded direct probe pass.
- Failure, timeout, missing credentials, quota exhaustion, inaccessible model, malformed output, absent/invalid signature, or replay fallback is non-admission for that route only.
- There is no fallback to `off`, another reasoning level, another model, or another quota pool.
- The route-local schema profile remains `gemini-parameters-json-schema`; tool declaration preflight and existing input/resource defenses remain strict.
- Signed function replay is permitted only for the same Pi provider and public model under the existing signature rules. Invalid, unsigned, absent, or cross-model signatures retain the existing observation fallback.
- Existing call/result association, assistant source ordering, synthetic missing-result behavior, and rejection of duplicate, foreign, separated, mismatched, media-bearing, or deferred-tool histories remain intact.
- Evidence and diagnostics may contain route, provenance, clean-exit state, fixed assertion labels, and boolean structural outcomes only. They must not persist or print prompt text, thought text, signatures, call IDs, arguments, tool-result content, credentials, headers, or raw provider output.
- A direct evidence record is retained only after clean child termination and all exact-route assertions pass.

## Delivery approach

Implementation must follow strict TDD:

1. **RED:** Add focused failing tests for closed route selection, unique evidence identity, signed-chain ordering, route isolation, replay, parallel/interrupted history, disabled controls, and redaction.
2. **GREEN:** Make the smallest probe and route-local changes needed to satisfy those tests while all target capabilities remain disabled.
3. **TRIANGULATE:** Add hostile, ambiguous, malformed, cross-route, and raw-data-canary cases to prevent accidental broadening or leakage.
4. **REFACTOR:** Improve structure only after behavior is protected, preserving the existing `off` contract and strict compatibility surfaces.
5. **HUMAN GATE:** Pause for explicit authorization before any live validation. If authorized, stage and probe one exact candidate at a time, retaining evidence and enabling the literal only on success.
6. Re-run focused and repository verification after each admitted route.

Synthetic fixtures and mocked transport must prove deterministic edge cases; direct evidence validates backend behavior but does not replace hermetic coverage.

## Affected areas

| Area | Intended change | Constraint |
|---|---|---|
| `scripts/pi-tool-loop-probe.ts` | Add closed per-level selection and sanitized signed-chain proof. | Preserve zero-argument `off`, existing flags, path, revision, and assertions. |
| `scripts/pi-tool-loop-probe.test.ts` | Cover parsing, event ordering, evidence identity, disabled control, and redaction. | No dynamic discovery or raw-output fixtures. |
| `packages/pi/src/catalog.ts` | Enable only exact routes that obtain matching direct evidence. | Do not change `off`, route order, wire IDs, or other model families. |
| `packages/pi/src/catalog.test.ts` | Prove independent route evidence and fail-closed mismatches. | Retain the existing `off` regression and unaffected disabled routes. |
| `packages/pi/src/context.test.ts` | Prove exact thinking configuration and request/replay isolation. | No weakening of serializer, schema, or no-tool behavior. |
| `packages/pi/src/response.test.ts` and `packages/pi/src/stream.test.ts` | Prove visible signed call ordering and one terminal lifecycle. | Invalid signatures, calls, arguments, and finishes must still fail once. |
| `packages/pi/src/tool-context.test.ts` | Prove signed continuation, source-ordered parallel replay, and interrupted history. | Preserve observation fallback and strict pre-fetch rejection. |
| `packages/pi/evidence/gemini-3.8-flash-{low,medium,high}-tool-loop.json` | Store route-specific redacted evidence only after a passing authorized probe. | Never store raw output or edit the `off` record. |
| `packages/pi/README.md` | Mark only admitted levels enabled. | Pending or failed levels remain documented as disabled. |

`tool-schema.ts`, `tool-contract.ts`, production `context.ts`, `response.ts`, `stream.ts`, root `src/`, and `packages/core/` are compatibility surfaces rather than planned implementation targets. Any demonstrated need to change them is a scope deviation requiring a new decision before proceeding.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| `off` evidence is inherited by a visible-thinking route. | Require a unique evidence file and revision bound to each exact route. |
| Tool execution passes while signed continuation is broken. | Assert visible thought/call ordering, corresponding result reconstruction, and sanitized `signed-function-response` continuation diagnostics. |
| Raw signatures or provider content leak through evidence or errors. | Use fixed labels and structural booleans only; test redaction with canary values and reject ambiguous event shapes. |
| Parallel or interrupted behavior is overclaimed from one live loop. | Require deterministic hermetic tests and limit direct evidence claims to the bounded observed chain. |
| One failed candidate broadens or blocks sibling routes. | Stage, validate, admit, and roll back each route independently. |
| Shared parser or transport edits affect other model families. | Treat production compatibility surfaces as unchanged unless a separately approved incompatibility is demonstrated. |
| The review exceeds the 400-line budget. | Refine the estimate during tasks and pause under `ask-on-risk` if the forecast remains above 400 lines. |

## Review and delivery gate

Exploration forecasts approximately 380–480 changed lines, so the likely upper bound exceeds the 400-line review budget. The tasks phase must refine the forecast before implementation. If risk remains above 400 lines, work must pause for a delivery decision; no chain strategy or `size:exception` is inferred.

A likely review split, if approved later, is:

- Probe/evidence contract with its tests.
- Per-route admission, evidence records, README updates, and focused Pi regression tests.

Tests must remain in the same review slice as the behavior they prove.

## Rollback

Rollback is route-local:

- Before admission, a failed or inconclusive probe restores the candidate's disabled catalog literal and retains no success evidence record.
- After admission, disable only the affected exact route, remove its README enabled claim, and withdraw its route-specific evidence record if its validity is compromised.
- Leave successfully proven sibling routes unchanged unless they share the demonstrated defect.
- Preserve the `off` route and evidence record throughout rollback.
- Never retain raw failed-probe output as a diagnostic artifact.

If qualification exposes a required change to a production compatibility surface outside this proposal, stop rather than broadening scope.

## Success criteria

- `low`, `medium`, and `high` are each evaluated as independent exact routes.
- Every admitted route has passing hermetic qualification, a later explicitly authorized passing direct probe, a unique sanitized evidence record, a matching enabled catalog capability, and a matching README status.
- Every failed, inaccessible, untested, or inconclusive route remains disabled with no success evidence.
- The `off` route's behavior, evidence, default probe invocation, output path, revision, and existing assertions remain unchanged.
- Tests prove visible signed-thinking ordering, accepted tool lifecycle, signed replay/continuation, parallel source ordering, interrupted-history handling, strict malformed-input rejection, abort/error cleanup, and zero-fetch preflight failures.
- No schema, response, replay, route, OAuth, header, or tool validation is relaxed.
- No prompt, thought, signature, call ID, arguments, result content, credential, header, or raw provider record is printed or persisted by evidence handling.
- Focused Pi tests, Pi typecheck/build, root typecheck/build, pack tests, and the full test suite pass after any route activation.
- Any review-budget overrun is resolved through the configured `ask-on-risk` decision before oversized implementation proceeds.
