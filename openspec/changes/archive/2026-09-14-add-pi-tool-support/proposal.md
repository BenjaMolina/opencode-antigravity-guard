# Proposal: Add evidence-gated Pi tool support

## Intent

Make `@benjamolina/pi-antigravity-guard` usable in normal Pi agent sessions where built-in or extension tools are present. The provider will carry tool declarations, assistant tool calls, tool results, multi-turn replay, and interrupted-call recovery across the existing Antigravity transport instead of rejecting or silently discarding tool state.

Tool support will be admitted per model family or catalog row only after evidence proves the complete declaration -> call -> result -> continuation loop. All seven published text routes and their existing no-tool behavior remain available throughout the staged rollout.

## Authority and readiness

- Change: `add-pi-tool-support`.
- Inputs: [explore.md](explore.md), [preproposal.md](preproposal.md), [project configuration](../../config.yaml), and repository `AGENTS.md` standards.
- The mandatory pre-proposal gate is confirmed. Its product decisions are authoritative, so no additional proposal interview is required.
- Optional external research is unselected because this runtime has no evidence grants. This proposal uses repository evidence, installed Pi contract evidence recorded by exploration, and hermetic fixtures; it does not claim live model validation.
- This artifact authorizes proposal work only. It does not authorize implementation, account access, live model calls, publication, or a review-budget exception.

## Scope

### Capability-aware rollout

Keep the current static catalog at exactly seven text routes, in its current order. Add a Pi-local tool capability policy that is resolved independently from text and thinking capabilities.

Each catalog row will have one of these tool states:

1. **Disabled:** tool-bearing contexts fail before transport with a stable capability error; text-only requests remain unchanged.
2. **Fixture-qualified:** hermetic request, response, lifecycle, and replay fixtures pass, but the row is not yet advertised or enabled for ordinary use.
3. **Enabled:** hermetic qualification and separately authorized direct validation both prove the complete multi-turn tool loop for that row and its admitted route.

A row must not become enabled because another row in the same family succeeds. A reasoning level or route must not inherit evidence from a different route. Missing, conflicting, or stale evidence keeps that row fail-closed without removing its text registration.

The seven retained text rows are Gemini 3.8 Flash, Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, Claude Opus 4.6 Thinking, and GPT-OSS 120B. Claude rows remain disabled for tools until recorded evidence proves safe tool-call, result-replay, thinking-signature, resume, and interruption continuity. No sentinel signature, speculative replay, or durable signature cache will be introduced to bypass that gate.

Documentation and provider metadata must distinguish “registered for text” from “enabled for tools.” The provider must never silently strip tools to make an unsupported row behave as text-only.

### Tool declarations and choice

Extend the Pi context boundary to accept `Context.tools` and serialize declarations as Antigravity `functionDeclarations` while preserving declaration order. Validate names, uniqueness, descriptions, parameter schemas, and supported metadata before any HTTP request.

Supported Pi tool-choice values are:

- `auto`: retain declarations and request automatic function selection.
- `none`: retain declarations and explicitly disable function selection for the turn.

Forced, named, required, or otherwise unsupported selection modes fail preflight with an actionable error. `constrainedSampling` is not treated as permission to force a tool and must not alter the wire contract unless a later specification admits a proven mapping.

### Bounded deterministic schema normalization

Introduce an immutable, typed, Pi-local schema normalization boundary. It must not import the OpenCode request transformer or its host-specific configuration, logging, or permissive `any`-based cleanup.

The boundary will:

- accept only a documented Antigravity-compatible JSON Schema subset;
- apply only explicitly enumerated, semantics-preserving transformations, such as a single `const` becoming an equivalent one-value `enum` where the target subset supports it;
- produce stable output independent of object insertion accidents and never mutate Pi's input context;
- reject unresolved references, ambiguous unions, unsupported constraints, empty-schema repairs, or any construct whose accepted argument set cannot be preserved;
- identify the declaration and schema path in every normalization failure; and
- never drop a declaration, property, required constraint, or unsupported keyword merely to obtain upstream acceptance.

Every admitted transformation must have characterization fixtures for accepted input, exact normalized output, immutability, and rejection boundaries. Later specification/design may narrow the accepted subset but must not broaden it into lossy best-effort cleanup without a new product decision.

### Assistant tool-call responses

Extend strict Antigravity response semantics to parse streamed `functionCall` parts with validated `id`, `name`, and object arguments. A malformed call, duplicate ID, unknown declaration name, or unsupported terminal combination fails closed and must not leave a valid-looking partial tool call in Pi state.

For each accepted call, the Pi stream will emit the indexed lifecycle required by the installed Pi contract:

```text
start
  -> toolcall_start
  -> toolcall_delta
  -> toolcall_end
  -> ...additional content/calls in observed order...
  -> done(reason: "toolUse")
```

The partial assistant message must contain the parsed `toolCall` by `toolcall_end`, and the final assistant message must use `stopReason: "toolUse"`. The stream must emit exactly one terminal `done` or `error` event. Existing text/thinking ordering, cancellation, redaction, usage, empty-stream, and one-terminal behavior remain unchanged when no call is present.

The response layer may admit Antigravity's documented tool terminal reason only when at least one valid function call was parsed. It must not reinterpret an unexplained `OTHER` finish as successful text or tool use.

### Tool-result replay and call identity

Serialize Pi assistant `toolCall` blocks as model `functionCall` parts and Pi `toolResult` messages as matching user `functionResponse` parts. Preserve every Pi call ID and name verbatim; do not generate replacement IDs or match by name/FIFO.

For parallel calls:

- associate results by exact `toolCallId` and matching tool name;
- place responses immediately after the corresponding assistant call group;
- order response parts by assistant source-call order, regardless of execution completion order; and
- reject duplicate IDs, name mismatches, foreign results, or ambiguous grouping before transport.

Text result items will be encoded into one documented deterministic response object. Pi error results must remain visibly marked as failures in that object. Empty text results require an explicit deterministic representation rather than omission. Any image-bearing tool result fails preflight in this scope, including mixed text/image results.

### Deterministic orphan-call recovery

Reconstruct recovery entirely from the supplied Pi `Context`; do not add provider-owned durable session state or mutate Pi's persisted history.

When a persisted assistant tool call has no matching result in the reconstructed context, serialize a synthetic `functionResponse` at the required adjacent response position. Its model-visible response object will be fixed by specification to the following semantic payload and byte-stable field order:

```json
{
  "error": {
    "code": "PI_TOOL_RESULT_MISSING",
    "message": "Tool execution did not complete or its result was not recorded. Treat the call as failed; do not assume it had no side effects and do not retry it automatically."
  }
}
```

The synthetic response preserves the original call ID and name and is treated as a failed tool result. In a partially completed parallel batch, actual and synthetic responses are emitted together in assistant source-call order. Recovery is applied only to a valid persisted call; generation aborted before a complete terminal call follows Pi's existing abort/error path and must not fabricate one.

A later context containing the real matching result uses the real result rather than the synthetic one. Malformed, duplicate, mismatched, or heuristically repairable histories remain errors. Because recovery is context-derived, resumes, forks, and compaction receive the same output for the same reconstructed context without a durable store.

### Provider and package boundary

Retain the legacy `registerProvider(name, config)` integration and existing `streamSimple` ownership. A migration to a complete native Pi `Provider` is outside this change.

Keep all new runtime behavior inside the publishable Pi package or an intentionally exported, framework-neutral core surface. `packages/pi` must remain independently buildable and installable with production dependencies and must not import unpublished root source paths. Any new runtime dependency must be declared in the published package boundary.

## Non-goals

- Changing the seven-model catalog, its order, public IDs, existing wire routes, or text-only behavior.
- Enabling every catalog row at once or inferring family parity from generic Gemini-shaped API documentation.
- Enabling Claude tools before safe thinking/signature and replay continuity is directly proven.
- Dynamic model discovery, account rotation, quota aggregation, fallback pools, model substitution, or Google Search grounding.
- Image inputs or image-bearing tool results.
- Forced, required, or named tool selection beyond Pi's `auto` and `none` values.
- Heuristic call/result ID repair, name-based FIFO matching, or silent declaration/schema removal.
- Durable provider session storage, a signature cache, a Pi history mutation hook, or migration of existing credentials/state.
- Reusing the OpenCode fetch interceptor or importing OpenCode host-specific tool/recovery modules into the Pi runtime.
- Publishing, credential changes, unbounded live probes, or external model/account calls during this proposal phase.

## Affected areas

These are expected implementation seams, not a requirement to edit every listed file.

| Area | Expected impact |
|---|---|
| `packages/pi/src/context.ts` | Preserve the no-tool serializer contract while adding validated declarations, assistant calls, result grouping, capability checks, and context-derived orphan recovery. |
| New Pi-local tool/schema module(s) | Typed capability resolution, deterministic schema normalization, call/result validation, and stable response encoding. |
| `packages/pi/src/response.ts` | Strictly parse function calls and tool-use terminal semantics without loosening text/thinking validation. |
| `packages/pi/src/stream.ts` | Emit indexed tool-call lifecycle events and `done/toolUse` with one-terminal guarantees. |
| `packages/pi/src/provider.ts` and catalog policy | Retain legacy registration and seven text routes while exposing evidence-gated tool capability. |
| Colocated Pi tests and redacted fixtures | Cover declarations, schemas, call streams, replay, recovery, capability gates, cancellation, and text regressions. |
| `packages/pi/README.md` and package-facing wording | Describe only enabled rows and the explicit unsupported/rejected boundaries. |
| OpenSpec capability artifacts | Specify the normative tool contract, family gates, design, tasks, verification evidence, and later archive delta. |

Root OpenCode request interception, auth, account storage, quota routing, recovery, fingerprints, and model behavior are compatibility-only areas and are not intended implementation targets.

## Compatibility requirements

- A context with no tools, tool calls, or tool results must remain structurally equivalent to current serialized request fixtures for every existing model/reasoning route.
- The seven static text registrations remain present and ordered exactly as before, including rows whose tool capability is disabled.
- Existing thinking visibility, signature stripping/replay policy, token limits, OAuth, headers, endpoint selection, cancellation, usage, and zero-cost reporting remain unchanged unless a later normative specification identifies a tool-only branch.
- Tool-disabled rows fail before network transport only when tool-bearing context is present; they continue normal text generation otherwise.
- Existing Pi credentials and project mapping are neither migrated nor rewritten.
- Packed production installation must resolve every runtime import without repository-relative source dependencies.
- Root OpenCode behavior must remain unchanged and pass its existing regression suite.

## Measurable outcomes and success criteria

- [ ] Ordinary Pi contexts may include tools without global rejection; each row deterministically enables the proven tool path or returns a stable preflight capability error.
- [ ] All seven text routes remain registered in their current order, and existing no-tool request/response fixtures remain byte- or structure-equivalent as appropriate.
- [ ] Enabled rows have evidence for declaration, one and multiple streamed calls, text/error result replay, parallel same-name calls, and a subsequent model continuation.
- [ ] No row is advertised or enabled until both hermetic qualification and separately authorized direct validation pass for that exact row/route; evidence gaps remain explicit blockers.
- [ ] Claude tool contexts fail before transport until tool/signature continuity, resume, interruption, and multi-turn fixtures plus direct validation pass.
- [ ] `auto` and `none` have exact request fixtures; forced, required, named, and unknown choices fail before transport.
- [ ] Every supported schema transformation has exact input/output and immutability tests; fidelity-ambiguous schemas fail with declaration and schema-path diagnostics, and no tool declaration is silently removed.
- [ ] Valid calls emit exact indexed Pi lifecycle order and terminate once with `toolUse`; malformed calls terminate once with an error and never become executable Pi tool calls.
- [ ] Call IDs/names are preserved exactly, parallel results replay in source-call order, and mismatched/duplicate/foreign results fail without heuristic reassignment.
- [ ] Text and error results have deterministic wire fixtures; empty results are explicit; image-bearing or mixed-media results fail before transport.
- [ ] Persisted orphan calls receive the specified synthetic failed response, including partial parallel batches, while incomplete generation does not fabricate calls.
- [ ] Resumes, forks, and compaction-derived contexts produce deterministic replay without provider-owned durable state.
- [ ] Focused Pi tests follow RED, GREEN, TRIANGULATE, REFACTOR, and `npm test`, `npm run typecheck:pi`, `npm run build:pi`, root type/build checks, and a production packed-install test pass before release.
- [ ] Authorized direct validation, when separately granted, is bounded and redacted; absent authorization is reported as a capability blocker rather than converted into a support claim.
- [ ] Root OpenCode auth, quota, account, recovery, request routing, and model behavior remain unchanged.

## Risks and mitigations

| Risk | Impact | Mitigation / gate |
|---|---|---|
| Generic wire documentation overstates model parity | A row may be advertised but reject or corrupt tool turns. | Gate each row/route independently on hermetic fixtures and separately authorized direct validation; default to disabled. |
| Schema normalization changes the callable contract | The model may produce arguments outside Pi's intended schema. | Permit only enumerated semantics-preserving transforms; reject unresolved or lossy constructs with paths. |
| Parallel call/result identity is corrupted | A result may be attributed to the wrong operation. | Preserve exact IDs/names, sort by assistant source order, and reject ambiguity instead of repairing heuristically. |
| Synthetic recovery hides possible side effects | The model may retry an operation that actually ran. | Use the fixed failure payload warning that side effects are unknown and automatic retry is unsafe. |
| Claude thinking/signature continuity is incomplete | Tool loops may fail, repeat, or lose reasoning on resume. | Keep Claude tools disabled until continuity and interruption evidence passes; add no speculative durable cache. |
| Stream lifecycle leaves corrupt partial state | Pi may execute malformed calls or hang. | Validate complete calls before `toolcall_end`, test interleaving/abort/late-data cases, and enforce exactly one terminal event. |
| Tool capability messaging is ambiguous | Users may confuse text registration with tool support. | Expose and document row-level capability states; never silently downgrade a tool turn to text. |
| Consumer package omits runtime code/dependencies | Source tests pass while `pi install` fails. | Run Pi build/type checks and a packed production-dependency installation test. |
| External validation consumes quota or exposes account data | Account safety, policy, or privacy may be affected. | Require separate authorization, bound the matrix, redact fixtures, avoid retries/fallback, and record gaps. |
| Scope exceeds the review budget | A cross-protocol change becomes difficult to review safely. | Treat capability foundation, request/replay, response lifecycle, family admission, and docs as reviewable slices; obtain a delivery decision before apply. |

## Rollback

Before release, revert tool capability activation and its serializer/parser/lifecycle additions as coherent work units, restoring explicit tool-context rejection while preserving all seven text registrations and no-tool behavior. Do not leave request serialization able to emit calls if response parsing or result replay has been removed.

After release, a failing row can be returned to the disabled tool state in a corrective release without removing its text route or remapping it. Preserve failed/withdrawn evidence records and continue returning an explicit capability error for tool-bearing contexts. Do not silently strip tools, alter credentials, delete session history, substitute models, or route through another quota pool.

The context-derived recovery mechanism has no durable state to migrate or delete. If its semantics prove unsafe, disable tool capability for affected rows until a corrective version is available. Publishing, unpublishing, credential revocation, and destructive history changes require separate authorization.

## Delivery forecast and next step

Proceed next to normative specification using RFC 2119 language and Given/When/Then scenarios for capability gating, schema normalization, tool choice, stream lifecycle, result grouping, orphan recovery, media rejection, family continuity, and no-tool compatibility. Design must then define typed boundaries and exact event/state transitions before tasks are created.

The implementation is expected to span context serialization, schema tooling, response semantics, stream lifecycle, provider/catalog policy, fixtures/tests, and documentation. It is materially likely to exceed the configured 400 changed-line review budget. Delivery remains `ask-on-risk`: before implementation, the parent must pause for a human choice to reduce scope, select a chain strategy, or explicitly accept `size:exception`. This proposal selects none of those options and grants no exception.

Strict TDD remains mandatory with `npm test` as the configured primary command. Tests must be introduced by behavioral vertical slice and kept with the behavior they protect.

## Evidence limits

No CodeGraph query, shell command, test, build, network request, OAuth action, credential access, or live model validation was performed in this proposal phase. No external research is claimed. The capability matrix therefore defines admission gates but does not mark any model row tool-enabled.
