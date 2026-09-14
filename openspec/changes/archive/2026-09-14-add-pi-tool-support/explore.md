# Exploration: Add Pi Tool Support

## Status

Exploration complete. No source, package metadata, lockfile, credentials, or runtime state was changed. This artifact is the only write.

## Intent and preserved behavior

The change aims to make the published `@benjamolina/pi-antigravity-guard` provider usable in ordinary Pi sessions, where built-in or extension tools are active. It must implement tool declarations, assistant tool calls, tool-result replay, multi-turn continuation, and interruption recovery instead of rejecting or silently removing tool state.

The following must remain unchanged unless a later approved artifact explicitly changes it:

- The registered static catalog remains exactly seven models, in its current order.
- Text-only request and response behavior, including routes, thinking defaults, token limits, response parsing, OAuth, and zero-cost reporting, remains unchanged for contexts without tools.
- No dynamic catalog discovery, account rotation, quota fallback, model substitution, image support, or Google Search grounding is introduced.
- The Pi package remains independently buildable and distributable; it must not import unpublished root source paths at runtime.

## Current Pi implementation

`packages/pi/src/provider.ts` registers the legacy provider-config form with `api: "antigravity-guard-sse"` and delegates every generation to `streamText()`. `streamText()` parses the Pi OAuth API key as the JSON pair `{ token, projectId }` and calls `executeStreamTransport()`.

The active serialization boundary is `packages/pi/src/context.ts`:

- `serializeTextContext()` writes the Antigravity envelope `{ project, model, request, requestType, userAgent, requestId }`.
- It sends Pi system text as `request.systemInstruction.parts`, maps Pi user/assistant messages to Gemini `user`/`model` `contents`, and supports text and selected same-model thinking/text signatures only.
- It expressly rejects nonempty `Context.tools`, `toolResult` messages, assistant `toolCall` content blocks, and every non-text input.
- It rejects every `toolChoice` except Pi's explicit `"none"` value. Therefore normal Pi sessions fail before HTTP whenever tools are active, including when the model would not actually call one.
- Its catalog replay policy is `same-public-model` only for Gemini 3.8; Gemini 3.7, Gemini 3.6, Gemini 3.1 Pro, both Claude models, and GPT-OSS strip historical thinking signatures but preserve their text. This policy is validated by `context.test.ts`.

`packages/pi/src/response.ts` only accepts text/thinking parts and `STOP` or `MAX_TOKENS`. It rejects a streamed `functionCall` part and does not expose a tool-use finish. `packages/pi/src/stream.ts` can emit text and thinking blocks but has no `toolcall_start`, `toolcall_delta`, or `toolcall_end` lifecycle. It finalizes only `stop` or `length`; a tool-calling response would become a generic response error. It does already have useful cancellation, framing, timeout, neutral-error, and partial-message infrastructure.

## Pi runtime contract

Pi 0.85.1's installed type declarations and `docs/custom-provider.md` establish the required provider behavior:

- `Context.tools?: Tool[]` supplies `{ name, description, parameters, constrainedSampling? }`; tools may be present on every normal agent turn.
- An assistant response represents a call as `{ type: "toolCall", id, name, arguments, thoughtSignature? }` and must finish with `stopReason: "toolUse"` and a `done` event whose reason is `"toolUse"`.
- A completed Pi tool execution is replayed as `ToolResultMessage` with `toolCallId`, `toolName`, text/image content, `isError`, and optional `addedToolNames`/usage. The provider must serialize this message as a result, not discard it or recast it as ordinary user prose.
- Custom streams must emit `start`, indexed tool-call start/delta/end events, then one terminal `done` or `error`. Partial assistant state is shared and must contain the parsed `ToolCall` by `toolcall_end`.
- Pi executes siblings in a call batch concurrently by default, but persists final `toolResult` messages in assistant source order. A serializer must thus rely on call IDs, not completion ordering.
- Session resumes, forks, compaction, and model changes recreate a `Context` from persisted messages. There is no provider-owned memory callback in `streamSimple`; enough transport-neutral state must be reconstructed from context, or a scoped durable cache must be intentionally designed.
- The custom provider guide specifically names `tool-call-without-result.test.ts`, image-tool-result, cross-provider handoff, abort, and empty-stream cases as provider compatibility tests.

The existing extension registers the legacy config form. Pi documentation prefers a complete native `Provider` when custom authentication, filtering, refresh, or streaming is required, but either form accepts custom `streamSimple`. A migration to the native form is an architectural/product decision, not required merely to add tool events.

## Antigravity wire semantics established locally

`docs/ANTIGRAVITY_API_SPEC.md` and the existing OpenCode adapter establish the common Gemini-shaped wire format:

1. Function declarations go in `request.tools: [{ functionDeclarations: [{ name, description, parameters }] }]`.
2. A streamed model call arrives in a model content part as `{ functionCall: { name, args, id } }`; the documented terminal finish reason is `OTHER`.
3. The next request must replay the model function-call part followed immediately by a `user` content with matching `{ functionResponse: { name, id, response } }` parts. Parallel results belong in the same response content group and preserve each call ID.
4. Function declaration names must start with a letter or `_`, use only letters/numbers/`_`/`.`/`:`/`-`, and be at most 64 characters.
5. Function schemas accept a narrow JSON-Schema subset. `const`, `$ref`, `$defs`/`definitions`, `$schema`, `$id`, defaults, examples, and some constraints are rejected or need transformation. `googleSearch`/`urlContext` cannot coexist with function declarations, but this Pi package does not currently offer either grounding feature.

The current Pi response parser has no admission fixture for a tool call from any catalog model. The API specification contains a general example but not a recorded per-model-family tool response, signature requirement, or terminal metadata matrix. It is insufficient evidence to claim every catalog row supports identical tool semantics.

## Existing OpenCode behavior that can inform but cannot be reused directly

The OpenCode adapter is host-specific, but it contains relevant domain behavior:

- `src/plugin/request.ts` normalizes declarations. Claude paths consolidate definitions into `functionDeclarations`, sanitize names, clean schemas, set `toolConfig.functionCallingConfig.mode = "VALIDATED"`, optionally add parameter-description hardening, and track debug data.
- Gemini paths delegate to `applyGeminiTransforms()`, so their exact declaration/option behavior is not duplicated in the Pi package today.
- `src/plugin/request-helpers.ts` has a broad, lossy `cleanJSONSchemaForAntigravity()` transformer. It converts `const` to `enum`, flattens unions, removes unsupported keywords, adds description hints, and inserts required placeholder properties for empty object schemas. It is implemented with `any`, OpenCode config/logging dependencies, and behavior beyond the current strict Pi package style; it should not be imported directly into Pi without a deliberately typed, characterized extraction.
- The OpenCode helper treats tool pairing as a recovery problem: it assigns missing IDs, matches result IDs by per-name FIFO, groups responses immediately after calls, inserts synthetic failure responses when results are missing, and finally may remove unrecoverable orphan calls. This proves the upstream pairing sensitivity but is not a ready Pi policy.
- OpenCode thinking/signature behavior is model-sensitive. Gemini 3 and Claude signatures are cached for multi-turn tool calls. Claude normally strips all historical thinking, conditionally injects cached/sentinel thinking before tool use, and has an additional "fresh turn" recovery path. Those helpers use global/session caches keyed by OpenCode conversation/project assumptions and must not be copied into Pi without defining Pi session/replay ownership.

Pi must serialize its own `Context`, emit Pi events itself, and never route a Pi request through the OpenCode fetch interceptor. `packages/core` currently exports OAuth constants/forms/expiry and Antigravity headers only; it does not export tool conversion, response parsing, pairing, signatures, or recovery.

## Candidate implementation seams (not decisions)

| Seam | Current state | Required capability | Safe exploration direction |
|---|---|---|---|
| Context serialization | Text-only `serializeTextContext()` rejects all tool values. | Validate and serialize tool definitions, assistant tool calls, and tool results into ordered Gemini contents. | Split text-only validation from a typed full-context serializer so no-tool fixtures remain byte-equivalent. |
| Schema boundary | Pi currently has no tool schema processor. | Preserve declaration intent while satisfying the upstream schema contract. | Create a Pi-local, immutable, strict typed normalizer or extract a typed core primitive only after characterization tests. Do not silently omit a declaration. |
| Call identity | Pi currently sees Pi-generated stable tool call IDs. | Preserve Pi ID verbatim in `functionCall.id` and match `functionResponse.id`; preserve source order for parallel calls. | Reject malformed/duplicate IDs rather than inventing mappings, except under an explicitly approved recovery policy. |
| Response semantics | `ResponseSemantics` rejects `functionCall` and `OTHER`. | Parse non-streamed Antigravity function-call objects, validate name/args/id, emit a tool-use terminal semantic. | Extend semantic types and finish validation without loosening existing text/thinking validation. |
| Event lifecycle | `createPiLifecycleStream()` handles text/thinking only. | Build indexed tool-call blocks and emit lifecycle events exactly once, then `done/toolUse`. | Use one shared block state machine for text, thinking, and calls; never emit a call with unparsed/malformed arguments. |
| Result replay | `toolResult` is rejected. | Encode text result content and error state under a response object, adjacent to the corresponding call group. | Define an explicit, tested encoding for multiple text items, empty content, errors, and image results. Image results are a product boundary because catalog input remains text-only. |
| Replay/signatures | Catalog strip/same-model policy covers only text/thinking. | Replay calls/results and retain only signatures proven valid for a family/model and source. | Make replay classification capability-based, separating tool-call continuity from thinking-signature continuity. |
| Interrupt recovery | Pi only aborts current HTTP transport. | Avoid an orphan call when Pi tool execution is interrupted after the assistant message has persisted. | Prefer context-derived synthetic `functionResponse` only with an approved recovery content/error policy; do not mutate session history from provider transport. |
| Packaging | `packages/pi` has its own compile/package manifest and a published core dependency. | Keep runtime imports resolvable after `pi install --omit=dev`. | Keep Pi host packages as `*` peers and runtime packages in dependencies; add package-level build/type/pack validation. |

## Model-family implications and evidence gaps

| Family / catalog rows | Existing text replay policy | Known tool-specific local evidence | Consequence for proposal |
|---|---|---|---|
| Gemini 3.8 Flash | Same public model may replay valid Pi text/thinking signatures. | General Gemini-shaped calls/results are documented; no recorded Pi tool response fixture. | Must retain current valid signature behavior while independently preserving call IDs and results. |
| Gemini 3.7, 3.6, 3.1 Pro | Historical signatures are stripped. | General request format only. | Tool replay must work without relying on thought signatures; whether upstream requires a signature beside a function call needs evidence. |
| Claude Sonnet 4.6 | Historical signatures are stripped. | OpenCode applies `VALIDATED` declarations and special pairing, but Pi has no direct fixture. | Do not assume the non-thinking text policy establishes tool capability or the required schema/pairing/recovery format. |
| Claude Opus 4.6 Thinking | Historical signatures are stripped. | OpenCode has cache/sentinel/warmup/recovery complexity for tool use. | Highest semantic risk: call/result replay and thinking signatures must be tested together across turns, restart/resume, and cancellation. |
| GPT-OSS 120B | Historical signatures are stripped. | Text/thinking SSE fixture only. | Require an observed tool-call/result fixture before advertising tool behavior for this row. |

Preserving seven catalog rows does not require claiming uniform tool support. The proposal gate must decide whether all seven rows must offer tools, whether rows with insufficient evidence fail closed when tools are active, or whether capability metadata may hide/selectively disable tool use while preserving text availability.

## Interruption and recovery analysis

A normal Pi sequence is:

```text
request with declarations
  -> Antigravity emits assistant functionCall(s)
  -> provider emits toolcall lifecycle and done/toolUse
  -> Pi persists assistant message, executes tool(s), persists toolResult(s)
  -> next request replays assistant functionCall(s) + matching functionResponse(s)
```

The failure seam is after Pi has persisted an assistant call but before every tool result exists (Esc, timeout, tool crash, process exit, branch/compaction restore). The next context contains an orphan call, and upstream requires a matching result. The current provider cannot serialize that context at all.

The implementation must distinguish:

- **Generation abort before a terminal tool call:** produce Pi's ordinary aborted/error terminal response and do not fabricate a tool call.
- **Valid persisted call with a completed Pi result:** replay the exact ID/name and an explicit response encoding.
- **Valid persisted call with an error result:** replay it as an upstream function response that makes the error visible to the model.
- **Persisted call without a result:** either synthesize an explicit cancelled/unfinished error response, reject with recoverable guidance, or use a Pi session-level recovery hook. The choice changes the model-visible conversation and is a mandatory product decision.
- **Malformed IDs, mismatched names, duplicate IDs, or call/result order loss:** fail closed unless an approved deterministic repair policy exists. Name-based FIFO repair is unsafe for repeated/parallel Pi calls without an audited invariant.

The provider's `streamSimple` boundary cannot itself execute tools or observe a future tool execution result. Recovery should be context-driven and deterministic, or use a narrowly scoped Pi extension lifecycle hook with deliberate persisted state. It should not inherit OpenCode's session-client injection behavior.

## Strict TDD plan

Strict TDD is required. Start with RED tests organized by behavioral vertical slice, implement the minimum GREEN behavior, then triangulate edge conditions and refactor. Do not modify the static catalog assertions except to update wording that no longer says tools are unsupported.

1. **Declarations and request context**
   - One/multiple Pi tools; valid descriptions and nested schemas; declaration ordering; no-tools request structural equivalence to current fixtures.
   - Valid and invalid names, empty/missing schemas, unsupported schema constructs, duplicate names, constrained-sampling metadata, toolChoice `auto`/`none`.
   - Assert input context is not mutated and unsupported transformations become a declared error or documented normalized output according to the approved policy.
2. **Assistant call stream**
   - SSE fixtures for one/multiple `functionCall` parts, calls interleaved with thinking/text, `OTHER` terminal reason, usage before/after finish, malformed JSON args, missing/duplicate IDs, unknown tool names, and late data.
   - Assert exact `start -> toolcall_start -> toolcall_delta -> toolcall_end -> done(toolUse)` ordering, indexes, mutable partial content, final `stopReason: toolUse`, and no text regression.
3. **Result replay and multi-turn context**
   - Exact call/result ID/name preservation; multiple same-name parallel calls; completed/error results; ordered assistant-to-user grouping; no result, foreign-model handoff, session restore/fork-like reconstructed contexts, and compaction-reduced contexts.
   - Text content behavior must remain unchanged; image tool results need an explicit accepted/rejected decision and test.
4. **Family-specific replay**
   - Fixture matrix for the seven static rows at each admitted reasoning route, proving tool declarations, a call, and next-turn result replay, or proving the specified fail-closed capability outcome.
   - Dedicated Claude Opus thought/call/result fixture tests, including signature cache miss and interrupted result recovery.
5. **Transport/lifecycle resilience**
   - Abort during HTTP, partial call stream, tool-use terminal without `[DONE]`, timeout, stale events, malformed SSE, response errors, and response callback failures.
   - Verify exactly one terminal event and no unhandled rejection; preserve current error redaction and transport cancellation tests.
6. **Distribution and regression**
   - Run `npm test` (the configured root runner includes `packages/*/src/**/*.test.ts`), `npm run typecheck:pi`, `npm run build:pi`, root type/build checks appropriate to changed packages, and `npm run test:pack` or an equivalent consumer installation test that validates the Pi tarball under production dependencies.
   - Run an authorized manual normal-Pi session with an ordinary built-in tool only after hermetic fixtures pass; this external check is not a substitute for tests.

The likely implementation affects context, response, stream, provider tests, documentation, and potentially a new typed tool/recovery module. It is materially likely to exceed the 400-line review budget. Under `ask-on-risk`, the later proposal/tasks phase must estimate the diff and pause for a delivery decision if the forecast remains over budget.

## Packaging and runtime boundaries

- `packages/pi/package.json` correctly exposes `./dist/extension.js` through its `pi.extensions` manifest, lists Pi packages as peer dependencies, lists core as a runtime dependency, and excludes source/tests from the package files.
- Pi package installation uses production dependencies. Any new runtime schema utility must be in `dependencies`; a dev-only test helper cannot be used by `dist/extension.js`.
- The root `npm test` builds core then runs Vitest over Pi source tests, but root `tsconfig.json` does not include `packages/pi`; Pi type validation must remain the package command (`npm run typecheck:pi`).
- The published package currently describes itself and its README as text-only/unsupported-tools. Documentation and package description must be updated only to the capability guarantees actually admitted by tests and product decisions.
- The Pi package's `engines.node` is `>=22.19.0`, while the monorepo root is `>=20`. New runtime APIs must honor the package boundary rather than accidentally widening the published runtime contract.

## Mandatory pre-proposal product/business decisions

Human confirmation is required before proposal/specification because these choices change advertised behavior and model-visible recovery semantics:

1. **Tool-capability scope:** Must all seven static catalog rows support tool use, or may capability be explicitly family/row-gated while all seven retain unchanged text support?
2. **Evidence threshold:** Is direct authenticated verification required per model family/route before a row is advertised as tool-capable, or may implementation rely on the generic documented wire format until external validation is available?
3. **Schema fidelity policy:** When Pi tool schemas use unsupported Antigravity features, should the provider reject preflight, perform a visible deterministic normalization, or use the OpenCode-style lossy description-hint conversion? Silent declaration removal is out of scope.
4. **Tool-choice semantics:** How should Pi `auto` and `none` map to Antigravity, and is a force/required-tool behavior intentionally unsupported or needed by normal Pi workflows?
5. **Interrupted-call policy:** For a persisted assistant call lacking a tool result, should the next turn synthesize a cancelled/error result, stop with user recovery instructions, or install a session hook that repairs history? Define the exact model-visible error text and whether it is marked as tool failure.
6. **Tool result media boundary:** May text-only models serialize an image-bearing Pi tool result (and, if so, how), or must the provider reject it while keeping catalog input descriptors unchanged?
7. **Claude thinking continuity policy:** For Claude Opus tool loops, should the provider implement durable per-session signature/replay state, strip thinking and permit tool calls without continuity, or initially fail closed until supported by recorded evidence?
8. **Provider architecture:** Keep the legacy `registerProvider(name, config)` adapter or migrate to a complete Pi native Provider as part of this change. The latter may improve ownership of auth/stream behavior but increases review and compatibility surface.

## Optional external research

External research is **useful and recommended before proposal**, not required to finish this exploration. The repository lacks tool-call capture fixtures for every static model family and lacks a direct normal-Pi integration result. A bounded research/verification lane should collect sanitized authenticated request/response transcripts for declaration -> call -> result -> next turn for Gemini, Claude, and GPT-OSS rows, including a parallel call and an interrupted call where safe. It should also confirm the installed/published Pi runtime's tool event behavior at the declared peer range. No external implementation should be copied, and no credentials, account artifacts, package publishing, or model-catalog changes are in scope.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Generic API docs overstate family parity | A model may be advertised as tool-capable but reject declarations/calls. | Obtain per-family fixtures and gate capability from evidence. |
| Lossy schema cleanup changes a tool contract | The model can invoke an argument shape Pi did not declare or validate. | Make schema policy explicit, immutable, and fully fixture-tested; prefer fail-closed where fidelity cannot be maintained. |
| Call/result ID mismatch in parallel execution | The model associates an output with the wrong operation. | Preserve Pi IDs exactly and group results in assistant source order; avoid heuristic name matching by default. |
| Incomplete execution creates an orphan call | Subsequent requests can be rejected or repeat unsafe work. | Obtain approval for deterministic interrupted-call recovery and test restart/abort paths. |
| Claude signatures and tool calls interact | Tool loops can replan forever or fail after replay/compaction. | Treat Claude as a separate capability lane with signature/recovery fixtures, not a text-path extension. |
| Stream lifecycle is malformed | Pi will not execute the tool or will persist corrupt assistant state. | Test exact indexed event order, partial state, terminal reason, and one-terminal invariant. |
| Consumer package misses runtime dependencies | Source tests pass but `pi install` fails. | Build/pack/install the Pi package with production dependencies in verification. |
| Review scope exceeds budget | A multi-module tool/recovery implementation becomes unreviewable. | Forecast at proposal; pause under `ask-on-risk` if above 400 changed lines. |

## Recommended next phase

Run the mandatory pre-proposal gate to resolve the eight product decisions above. If authorized, perform the bounded external evidence lane first, then produce proposal/spec/design with a capability matrix and a budget forecast before any implementation work.
