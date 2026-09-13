# Tasks: Add evidence-gated Pi tool support

Canonical requirements: [`specs/pi-provider-adapter/spec.md`](specs/pi-provider-adapter/spec.md). This plan does not authorize live validation, capability activation, publishing, a delivery strategy, or a size exception.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,100–3,100 across production, tests, fixtures, docs, and pack assertions |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR candidate A → B → C → D → E → F → G → H (each is an autonomous work unit) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

## Confirmed delivery decision

The user selected `feature-branch-chain` after reviewing the 2,100–3,100-line forecast. Implementation will use one draft/no-merge tracker branch and eight focused child branches A → B → C → D → E → F → G → H. Child A targets the tracker; every later child targets its immediate predecessor. Each child keeps behavior and tests together and targets at most 400 changed lines. No `size:exception` is granted.

**Apply is authorized under the confirmed feature-branch-chain strategy.** If one honest slicing pass cannot keep a cohesive unit at or below 400 lines, stop and request a bounded `size:exception` rather than compressing or omitting tests/docs.

## Global implementation boundaries

- Allowed production surface is `packages/pi/` plus `scripts/pack-consumer.ts`; root `src/` and `packages/core/` are compatibility-only and must not change.
- Preserve legacy `registerProvider("antigravity-guard", config)`, seven text registrations and order, current transport/auth/headers/timeouts, and byte-equivalent no-tool request behavior.
- Keep each work unit’s tests, fixtures, and user-facing documentation with its behavior. Stop and re-plan if its complete diff exceeds 400 changed lines rather than separating safety tests.
- Required final verification after all accepted units: `npm test`, `npm run typecheck:pi`, `npm run build:pi`, `npm run typecheck`, `npm run build`, and `npm run test:pack`.

## A — Catalog capability foundation and fail-before-fetch admission

**Depends on:** delivery choice; no earlier implementation unit.  
**Allowed edits:** `packages/pi/src/catalog.ts`, `packages/pi/src/catalog.test.ts`, narrowly necessary `packages/pi/src/context.ts`, `packages/pi/src/stream.ts`, and their colocated tests.  
**Budget / commit candidate:** 250–350 lines; `feat(pi): gate tool contexts by exact catalog route`.  
**Finish / rollback boundary:** Every route is fail-closed for tool-bearing context while text behavior remains unchanged; reverting this unit restores the released text-only behavior without changing routes or credentials.

- [x] **RED:** Add catalog and transport-spy tests proving seven descriptors and order remain unchanged, every concrete reasoning route owns frozen capability data, stale/mismatched evidence resolves to disabled, Claude has the continuity-disabled reason, and disabled/fixture-qualified tool contexts fail before `fetch` while no-tool contexts do not. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Add Pi-local capability/evidence types and exact route selection in `packages/pi/src/catalog.ts`; retain `resolveGenerationRoute()` compatibility, add the selection helper, and reject tool-bearing contexts with only safe route/model metadata before transport. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Extend colocated tests for cross-family/level non-inheritance, fixture-qualified rejection, and declaration-only, historical-call-only, and historical-result-only tool-bearing classification. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Freeze literal capability data and centralize capability resolution so context, response policy, and stream consumers cannot select different routes; retain no-tool fixture byte equivalence. <!-- sdd-owner: implementation -->
- [x] Verify this unit with `npm test -- --run packages/pi/src/catalog.test.ts`, the affected context/stream tests, `npm run typecheck:pi`, and `npm test`; record the candidate commit only if the complete unit remains within budget. <!-- sdd-owner: implementation -->

## B — Strict JSON contract, declaration validation, and schema normalization

**Depends on:** A.  
**Allowed edits:** new `packages/pi/src/tool-contract.ts`, new `packages/pi/src/tool-schema.ts`, their colocated tests, and synthetic fixtures under `packages/pi/fixtures/tools/`; no imports from root `src/plugin/`.  
**Budget / commit candidate:** 320–400 lines; `feat(pi): validate immutable tool declarations`. Split hostile/boundary cases into a follow-up candidate only if tests and the behavior stay together.  
**Finish / rollback boundary:** A typed, dependency-neutral normalizer accepts only the specified grammar and fails locally for all other input; reverting removes the unused modules without changing the text serializer.

- [x] **RED:** Create normalizer/declaration tests for ordered valid declarations, exact canonical nested output, `const`-to-singleton-`enum`, frozen output, and deep input immutability. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Implement strict plain-data/JSON helpers and immutable allowlist normalization in `tool-contract.ts` and `tool-schema.ts`, including canonical key order, declaration name/description validation, duplicate-name rejection, and safe declaration/path errors. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Add fixture-backed rejection and limit tests for unknown/reference/union/constraint keywords, invalid enum/type combinations, empty object schemas, cycles/accessors/sparse arrays/symbols/non-finite values, and depth/node/size boundaries. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Consolidate recursive validation and resource accounting without weakening exact errors, output order, immutability, or the no-`any` Pi boundary. <!-- sdd-owner: implementation -->
- [x] Verify this unit with `npm test -- --run packages/pi/src/tool-schema.test.ts`, `npm run typecheck:pi`, and `npm test`; rollback by removing only the new contract/schema modules and their fixtures. Aggregate normalized-schema limit correction verified. <!-- sdd-owner: implementation -->

## C — Tool request preparation and no-tool-compatible dispatcher

**Depends on:** A and B.  
**Allowed edits:** `packages/pi/src/context.ts`, new `packages/pi/src/tool-context.ts` limited to declaration/tool-choice preparation, `context.test.ts`, `tool-context.test.ts`, and declaration fixtures.  
**Budget / commit candidate:** 300–400 lines; `feat(pi): serialize admitted tool declarations`.  
**Finish / rollback boundary:** The dispatcher calls `serializeTextContext()` unchanged for non-tool context and emits only validated declaration fields for enabled routes; reverting restores the direct text serializer call.

- [ ] **RED:** Add context golden tests for unchanged no-tool envelopes and field order, exact `tools`/`toolConfig` request order, omitted choice and `auto` mapping to `AUTO`, `none` mapping to `NONE`, and declaration order retention. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Expose `serializeContext()` in `context.ts`, preserve `serializeTextContext()` as the exact fast path, and use prepared declarations to emit only `tools` and `toolConfig` for enabled tool-bearing requests. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Add preflight tests for forced/named/unknown choices, `auto` without declarations, `constrainedSampling`, history-only contexts, and rejected contexts proving `fetch` is never called. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Keep tool classification and tool-choice preparation request-local and narrow the dispatcher interface so no tool-only fields or policy leaks into no-tool serialization. <!-- sdd-owner: implementation -->
- [ ] Verify this unit with focused `context.test.ts`/`tool-context.test.ts`, `npm run typecheck:pi`, and `npm test`; rollback by reverting dispatcher/preparation edits together while retaining A/B foundations. <!-- sdd-owner: implementation -->

## D — Assistant-call and tool-result replay with deterministic parallel grouping

**Depends on:** B and C.  
**Allowed edits:** `packages/pi/src/tool-context.ts`, `packages/pi/src/context.ts`, their colocated tests, and `packages/pi/fixtures/tools/{parallel-replay,orphan-replay}.json` using synthetic values only.  
**Budget / commit candidate:** 350–400 lines; `feat(pi): replay exact tool call results in source order`.  
**Finish / rollback boundary:** Valid persisted call/result groups serialize adjacent model/user contents with exact IDs/names; reverting returns tool-bearing histories to the prior explicit preflight outcome, not heuristic repair.

- [ ] **RED:** Add replay tests for one and same-name parallel calls, reverse result completion ordering, exact `functionCall` and `functionResponse` field order, success/error/multiple/empty text encodings, and preserved text/thinking ordering. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Implement request-local call-group validation and exact result association by `(toolCallId, toolName)`; emit grouped responses in assistant source-call order and reject no IDs, mismatches, duplicates, foreign/separated results, invalid call terminal state, media, and deferred added-tool names. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Add reconstructed-context cases for resume/fork/compaction/model handoff, noncontiguous history, mixed image/text result content, and concurrent serializations to prove there is no global state or FIFO/name fallback. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Isolate pending-group finalization from wire encoding and retain deterministic JSON insertion order without mutating Pi messages. <!-- sdd-owner: implementation -->
- [ ] Verify this unit with focused `tool-context.test.ts` and `context.test.ts`, `npm run typecheck:pi`, and `npm test`; rollback by removing replay serialization as one unit so request emission cannot retain half a pairing implementation. <!-- sdd-owner: implementation -->

## E — Context-derived orphan-call recovery

**Depends on:** D.  
**Allowed edits:** `packages/pi/src/tool-context.ts`, its tests, and the redacted orphan fixture only.  
**Budget / commit candidate:** 250–350 lines; `feat(pi): recover missing tool results from context`.  
**Finish / rollback boundary:** Missing results become the specified adjacent synthetic failed response, solely from supplied context; reverting removes only synthetic recovery and leaves valid actual-result replay intact.

- [ ] **RED:** Add tests for all-orphan and partially completed parallel groups, asserting the exact fixed error object and insertion order, source-order mixing of actual/synthetic results, and no synthetic call/result after an incomplete generated assistant message. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** At pending-group finalization, create the prescribed `PI_TOOL_RESULT_MISSING` response for each absent exact result without persistence, cache, lock, history mutation, retry, or route change. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Add later-real-result, delayed-result-after-unrelated-history, repeated reconstruction, resume/fork, and concurrency tests to prove deterministic recovery and fail-closed separated results. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Make synthetic construction a fixed-order local factory and keep recovery count request-scoped for later safe diagnostics. <!-- sdd-owner: implementation -->
- [ ] Verify this unit with focused tool-context tests, `npm run typecheck:pi`, and `npm test`; rollback by reverting the recovery finalizer only, never by deleting user history or evidence. <!-- sdd-owner: implementation -->

## F — Atomic streamed function-call semantics and delayed terminal commit

**Depends on:** A and B; C supplies declared-name policy.  
**Allowed edits:** `packages/pi/src/response.ts`, `packages/pi/src/response.test.ts`, and synthetic SSE fixtures under `packages/pi/fixtures/tools/`.  
**Budget / commit candidate:** 320–400 lines; `feat(pi): parse validated Antigravity function calls`.  
**Finish / rollback boundary:** Response parsing can produce validated tool-call semantics but does not itself emit Pi lifecycle events; reverting restores strict rejection of function calls and `OTHER` finishes.

- [ ] **RED:** Add SSE/parser tests for single, parallel, and interleaved calls; declared-name policy; canonical argument JSON; call ordinals; `OTHER`/`STOP`/`MAX_TOKENS` finish matrix; and unchanged text/thinking/signature/usage fixtures. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Add transactional `ToolCallSemantic`, strict complete `functionCall` validation, request-derived accept/reject response policy, and deferred finish emission until `[DONE]` or clean EOF validates terminal state. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Add malformed/extra-field/blank-or-duplicate-ID/scalar-args/unknown-name tests plus same-record transactional failure, late frames, missing finish, empty/truncated stream, and usage placement tests. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Share canonical JSON validation with the Pi-local contract and make parser state explicitly reject records after finish or `[DONE]` without changing existing text behavior. <!-- sdd-owner: implementation -->
- [ ] Verify this unit with `npm test -- --run packages/pi/src/response.test.ts`, `npm run typecheck:pi`, and `npm test`; rollback by restoring function-call and `OTHER` rejection together. <!-- sdd-owner: implementation -->

## G — Pi lifecycle events, terminal cleanup, diagnostics, and transport integration

**Depends on:** C, E, and F.  
**Allowed edits:** `packages/pi/src/stream.ts`, narrowly necessary `context.ts`/`response.ts` interfaces, `stream.test.ts`, and tool SSE fixtures; do not alter auth, endpoint, header, timeout, or callback ownership.  
**Budget / commit candidate:** 350–400 lines; `feat(pi): emit safe tool-call stream lifecycle`.  
**Finish / rollback boundary:** Accepted semantics become Pi events with one terminal outcome; failure scrubs calls from shared partial state. Revert this unit together with F before any tool-capable route can be enabled.

- [ ] **RED:** Add lifecycle tests for exact `start → toolcall_start → toolcall_delta → toolcall_end → done(toolUse)`, shared partial identity, complete canonical argument delta including `{}`, real content indexes versus call indexes, interleaved text/thinking, and multiple calls. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Extend `stream.ts` to map validated tool-call semantics into indexed Pi blocks/events, set `stopReason: "toolUse"` only on committed success, attach safe tool-only diagnostics, and centralize `open | succeeded | failed` finalization. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Add abort, timeout, malformed/late stream, callback failure, post-call response error, and concurrent-stream tests proving calls are scrubbed on failure and exactly one `done` or `error` occurs. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Consolidate block-closing and terminal guards while preserving existing cancellation, body cancellation, HTTP/quota error, and no-tool terminal behavior. <!-- sdd-owner: implementation -->
- [ ] Verify this unit with `npm test -- --run packages/pi/src/stream.test.ts`, `npm run typecheck:pi`, `npm test`, and `npm run build:pi`; rollback by reverting lifecycle and F response admission in dependency order. <!-- sdd-owner: implementation -->

## H — Provider compatibility, documentation, package consumer, and cross-slice regression

**Depends on:** A–G.  
**Allowed edits:** `packages/pi/src/provider.ts`, `provider.test.ts`, `packages/pi/README.md`, optionally the truthful `packages/pi/package.json` description, `scripts/pack-consumer.ts`, and their tests. Do not add runtime dependencies or mark any route enabled without separately authorized evidence.  
**Budget / commit candidate:** 220–320 lines; `docs(pi): document evidence-gated tool capability`.  
**Finish / rollback boundary:** Public package wording and distribution checks match fail-closed catalog status; reverting docs/pack assertions does not alter runtime tool policy, and route activation remains out of scope.

- [ ] **RED:** Add provider and pack-consumer tests asserting the legacy two-argument registration, unchanged seven descriptors/OAuth hooks, emitted runtime module availability, clean production install/load, and absence of source/tests/fixtures or repository-relative runtime imports from the archive. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Update only necessary provider imports, pack assertions, and README/package wording; document route-level states, text-versus-tool distinction, preflight boundaries, `AUTO`/`NONE`, schema/result limits, and Claude’s disabled status without claiming enabled tools. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Add documentation-to-catalog consistency assertions for disabled and fixture-qualified routes and run the full no-tool plus tool preflight/regression matrix against all seven text registrations. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Remove duplicated status literals by deriving documentation test data from catalog-facing data where package boundaries permit, while keeping OpenSpec evidence out of runtime loading. <!-- sdd-owner: implementation -->
- [ ] Verify this unit and the complete accepted change with `npm test`, `npm run typecheck:pi`, `npm run build:pi`, `npm run typecheck`, `npm run build`, and `npm run test:pack`; report any environment-dependent direct-validation gap as a blocker rather than enabling a route. <!-- sdd-owner: implementation -->

## Handoff conditions

- Implementation starts only after the delivery decision is recorded; these candidates must be rechecked against the 400-line budget at apply time.
- Capability activation from `disabled` to `fixture-qualified` or `enabled` requires its own evidence and authorization gates and is not planned as an implementation task here.
- If a discovered need touches root `src/`, `packages/core/`, credentials, live models, publication, or durable state, stop as a design deviation and seek new scope approval.
