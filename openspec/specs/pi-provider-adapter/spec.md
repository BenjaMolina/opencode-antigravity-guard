# Pi Provider Adapter Specification

## Purpose

Provide a text-only Pi provider for Antigravity-backed Gemini 3.8 Flash while preserving the existing root OpenCode package and its behavior.

## Requirements

### Requirement: Workspace topology preserves the OpenCode package

The repository MUST retain its existing OpenCode package at the repository root, including its package identity, supported entry points, fetch-interceptor behavior, and host-specific persistence. The repository SHALL expose `packages/core` and `packages/pi` as workspaces. `packages/core` MUST contain only framework-neutral Antigravity domain behavior needed by both adapters, and MUST NOT depend on Pi or OpenCode SDK types, host UI, credential persistence, account selection, quota state, or recovery state. `packages/pi` MUST own Pi integration behavior.

#### Scenario: Root OpenCode behavior remains available

- GIVEN the repository is installed through its root package
- WHEN an existing OpenCode build, typecheck, or test workflow is run
- THEN the root package entry points and existing OpenCode request behavior remain available without requiring Pi installation or configuration

#### Scenario: Core remains host-neutral

- GIVEN functionality is shared between the OpenCode and Pi adapters
- WHEN that functionality is made available through `packages/core`
- THEN its public contract contains neutral domain data and no host SDK or host-persistence dependency

### Requirement: Pi package is independently discoverable and distributable

The Pi workspace MUST produce a package named `@benjamolina/pi-antigravity-guard` that Pi can discover as an extension and that registers its provider integration. A packed installation of that package MUST contain and resolve all runtime-required artifacts and dependencies without imports to unpublished repository-relative source paths. Pi SDK runtime dependencies SHALL be declared according to Pi package compatibility requirements.

#### Scenario: Packed package installs outside the repository

- GIVEN a package archive produced from the Pi workspace
- WHEN the archive is installed in a clean consumer environment with its declared dependencies
- THEN Pi can discover the extension and load its provider without resolving source files outside the archive or published dependencies

### Requirement: Exactly one intended Antigravity model is registered

The Pi provider MUST register a typed, static Antigravity model catalog rather than independently maintained model allowlists. The catalog MUST be the sole source of Pi public identifiers, display metadata, exact wire identifiers, text limits, descriptor capabilities, registration order, generation policy, thinking-signature replay policy, and tool-capability state. `provider`, request-context serialization, response validation, and stream validation MUST resolve the same catalog entry. Public identifiers MUST use the `antigravity-*` namespace; display labels MUST NOT be serialized as runtime identities; wire identifiers and generation settings MUST NOT be derived by generic string replacement.

The released catalog MUST retain exactly seven text routes, in their released order: Gemini 3.8 Flash, Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, Claude Opus 4.6 Thinking, and GPT-OSS 120B. Each route MUST retain its released public identifier, descriptor, wire identifier, text limits, reasoning choices, and evidenced no-tool request, response, OAuth, header, token, and zero-cost behavior. Tool support MUST be governed independently by the row/route capability requirement; it MUST NOT change text registration or imply a fallback, substitution, or catalog discovery.

All catalog generation MUST use the existing Pi-managed credentials and the existing Antigravity OAuth endpoint and quota path only. It MUST NOT use Gemini CLI, API-key, Antigravity SDK, alternate quota pools, account rotation, hidden fallback, or model substitution.

(Previously: The catalog admitted only text-only behavior, and its released Gemini 3.8 compatibility explicitly rejected tool context.)

#### Scenario: The released text catalog remains unchanged

- GIVEN Pi lists or invokes the provider without tool-bearing context
- WHEN the static catalog is registered and the request is serialized
- THEN all seven text routes MUST remain present in their released order with their released text behavior unchanged

#### Scenario: Tool capability does not alter catalog routing

- GIVEN a text route is disabled, fixture-qualified, or enabled for tools
- WHEN Pi invokes that route
- THEN it MUST use the same Pi-managed Antigravity credentials and routing without alternate quota pools, fallback, account rotation, or model substitution

### Requirement: Pi authentication supports safe automatic and manual completion

The Pi provider MUST initiate Antigravity OAuth using PKCE and a state value bound to the login attempt. It MUST offer automatic completion through a bounded loopback callback listener for local-browser login and a manual callback-URL fallback for SSH, headless, unavailable-listener, or user-selected manual flows. The listener MUST bind only to loopback and MUST be cleaned up after successful completion, denial, timeout, cancellation, listener failure, or invalid callback handling. Both completion paths MUST validate state before exchanging authorization data and MUST return actionable, redacted authentication failures. Pi authorization adds `https://www.googleapis.com/auth/aicode` through a Pi-local OAuth configuration only; shared OpenCode scopes and token forms remain unchanged. After a successful token exchange, Pi MAY best-effort read the user email and discover a project through fixed `loadCodeAssist` origins in this order: `https://daily-cloudcode-pa.googleapis.com`, `https://daily-cloudcode-pa.sandbox.googleapis.com`, then `https://cloudcode-pa.googleapis.com`. Discovery requests use only Authorization, JSON Content-Type, and `antigravity/cli/1.1.23 (aidev_client; os_type=linux; arch=amd64; cl=974125021; auth_method=consumer)` User-Agent headers, with load body `{metadata:{ideType:"ANTIGRAVITY"}}`. On the first successful load response, Pi recursively extracts a supported direct, nested, or list project shape; when absent, it best-effort posts `{}` to fixed `listCloudAICompanionProjects` endpoints in the same order and returns the first extracted project. Non-OK and transport failures continue without exposing status, response bodies, or tokens. These failures never block login and are redacted. Pi stores the discovered project when present; otherwise it deterministically derives a version-five project ID from the email or the fixed `antigravity-default` seed. Refresh preserves this credential project without discovery. Generation receives that stored credential project directly at the fixed daily stream endpoint using the same Antigravity Authorization, JSON Content-Type, and User-Agent headers (plus its required SSE Accept header), and MUST NOT call `loadCodeAssist`, onboard, cache, persist elsewhere, invent a tier, or use arbitrary origins.

#### Scenario: Local loopback login completes

- GIVEN a user starts login on a machine that can receive loopback callbacks
- WHEN the authorization response returns with the matching state before the bounded wait expires
- THEN the login completes through the loopback path and the listener is closed

#### Scenario: Manual callback fallback completes

- GIVEN loopback completion is unavailable or the user needs a headless flow
- WHEN the user supplies a valid callback URL or authorization code associated with the active login state
- THEN the provider completes the same OAuth exchange without requiring a loopback listener

#### Scenario: Invalid or incomplete authorization fails safely

- GIVEN a callback has an invalid state, represents denied authorization, arrives after expiry, or the login is cancelled
- WHEN the provider processes the login attempt
- THEN it does not exchange invalid authorization data, cleans up any listener, and reports an actionable error without exposing tokens or authorization secrets

#### Scenario: Login stores a narrow credential project

- GIVEN token exchange succeeds
- WHEN user-info or each fixed project discovery request fails or returns no project
- THEN login still succeeds with the deterministic fallback project, and later generation uses the credential project without discovery or provisioning

### Requirement: Pi exclusively owns Pi credentials

The provider MUST return credentials through Pi's OAuth lifecycle so that Pi persists and refreshes them. Pi credentials include the access token, refresh token, expiry, and optional email/project metadata; `getApiKey` serializes exactly `{token,projectId}`. At the provider boundary, malformed, missing, empty, or extra credential JSON fields MUST be rejected before any network request. Token refresh MUST preserve the credential project, honor cancellation, and surface actionable, redacted authentication errors. The Pi adapter MUST NOT read, modify, migrate, synchronize, or delete OpenCode account or credential files. Pi package removal MUST NOT silently delete Pi-managed credentials or revoke tokens.

#### Scenario: Pi credentials remain separate from OpenCode accounts

- GIVEN a user has existing OpenCode account data and completes Pi login
- WHEN Pi persists or refreshes the provider credentials
- THEN only Pi's credential lifecycle is used and the OpenCode account data is neither read nor modified by the Pi adapter

#### Scenario: Refresh is cancelled

- GIVEN Pi requests a credential refresh with an abort signal
- WHEN that signal is aborted before refresh completes
- THEN refresh terminates without an unhandled rejection or secret-bearing diagnostic

### Requirement: Text context is serialized and unsupported context is explicit

For every registered catalog entry, the provider MUST serialize supported system, user, and assistant text context using that entry's proven generation policy and MUST translate supported streamed text into Pi-native partial-message events. A context with no tools, assistant tool calls, or tool results MUST remain structurally equivalent to the released serialized request fixtures for that exact model and reasoning route. Image inputs and every other unsupported non-text input MUST be explicitly rejected before transport; the provider MUST NOT silently omit or transform unsupported context, register a non-text modality, or substitute a different model.

Tool definitions, assistant tool calls, and tool-result history MUST be processed only under the tool capability, declaration, schema, lifecycle, replay, and recovery requirements in this delta. For a tool-disabled row/route, any such context MUST fail before transport without dropping content. For an enabled row/route, only validated tool context MUST be serialized. Documentation MUST describe only evidence-validated text and enabled-tool capabilities.

Thinking signatures MUST be replayed only for a subsequent request targeting the exact same public catalog model and only when that model's replay policy is explicitly evidenced. Signatures MUST be stripped for a different model, a different model family, or any model lacking explicit replay evidence. Tool call/result identity continuity MUST NOT depend on a thinking signature unless the exact row/route has been enabled with the required continuity evidence.

(Previously: Tool definitions, calls, and results were always rejected as unsupported text context.)

#### Scenario: Supported text conversation streams unchanged

- GIVEN a context containing only supported system, user, and assistant text for a registered catalog model
- WHEN Pi invokes that model
- THEN the provider MUST send equivalent text context using the model's evidenced policy and expose returned text as Pi partial-message events

#### Scenario: Tool-disabled validation is explicit

- GIVEN a request for a tool-disabled registered catalog row includes a tool definition, tool call, or tool result history
- WHEN the provider validates the context
- THEN it MUST reject the request before transport without dropping the content, registering the modality, or substituting a model

#### Scenario: Image content remains unsupported

- GIVEN a request for any registered catalog model includes image input or an image-bearing tool result
- WHEN the provider validates the context
- THEN it MUST reject the request before transport without silently removing the image

#### Scenario: Signatures are not replayed across model boundaries

- GIVEN prior assistant context contains a thinking signature from one catalog model
- WHEN the next request selects a different public catalog model or a model without explicit replay evidence
- THEN the provider MUST strip the signature before serialization

#### Scenario: Evidenced same-model replay is preserved

- GIVEN a catalog model has explicit replay evidence and prior assistant context contains its signature
- WHEN the next request selects that exact same public catalog model
- THEN the provider MUST preserve the signature according to that model's replay policy

### Requirement: Streaming has strict terminal semantics

The provider MUST preserve the order of emitted text, thinking, and accepted tool-call content and MUST update Pi's partial assistant state consistently with the emitted Pi-native events. Each stream invocation MUST emit exactly one terminal outcome: a successful `done` event with its valid completion reason or an error terminal event, but never both and never more than one. `done` with reason `toolUse` is valid only under the tool-call streaming requirement. Cancellation, malformed or truncated streams, empty responses, upstream HTTP failures, and rate-limit or quota failures MUST terminate promptly without hanging or unhandled rejections. Rate-limit and quota failures MUST be surfaced clearly and MUST NOT trigger quota gating, account rotation, hidden fallback, or model substitution.

(Previously: Successful terminal semantics covered only text stop or length completion and rejected tool-use completion.)

#### Scenario: Chunked text completes once

- GIVEN an upstream stream delivers ordered text chunks and a completion indication
- WHEN the provider maps the stream to Pi events
- THEN the text deltas preserve their upstream order, partial assistant state reflects them, and exactly one successful terminal event follows the content events

#### Scenario: Tool use completes once

- GIVEN an upstream stream contains one or more valid function calls and its admitted tool terminal finish
- WHEN the provider maps the stream to Pi events
- THEN it MUST preserve content order, update the parsed calls in partial state, and emit exactly one `done` event with reason `toolUse`

#### Scenario: Stream failure terminates once

- GIVEN a stream is cancelled, malformed, truncated, empty, rate-limited, quota-limited, has an HTTP error, or has invalid tool semantics
- WHEN the provider processes the failure
- THEN it emits exactly one error terminal outcome, does not emit a successful terminal event, and does not remain pending

### Requirement: OpenCode regressions are protected

Any behavior moved into the shared core MUST have focused equivalence or characterization coverage that preserves the existing OpenCode-observable result. The completed change MUST preserve existing OpenCode model behavior, request transformation, streaming behavior, token behavior, account persistence, quota routing, and recovery behavior outside the Pi adapter's new workspace boundaries.

#### Scenario: Shared behavior retains OpenCode equivalence

- GIVEN an OpenCode behavior is shared with the core
- WHEN representative existing inputs are exercised before and after the change
- THEN the OpenCode-observable request, response, and authentication behavior remains equivalent

#### Scenario: Pi remains isolated from OpenCode-only features

- GIVEN Pi uses the new provider
- WHEN the provider authenticates or streams Gemini 3.8 Flash text
- THEN it does not invoke OpenCode account selection, quota routing, recovery, UI, configuration writing, or fetch interception

### Requirement: Catalog admission requires per-model and per-level four-source evidence

The provider MUST admit a candidate model or advertised reasoning level only when a versioned, redacted evidence record reconciles all four sources: (1) a pinned `Rahularya01/pi-antigravity` reference revision or date that distinguishes display, public, and proposed wire identifiers; (2) authorized read-only Antigravity account discovery confirming visibility through the existing Antigravity OAuth/quota service; (3) strict redacted request/response fixtures for the candidate and proposed level; and (4) an authorized bounded text-only live smoke result for reasoning `off` and every exposed level. The record MUST identify the exact wire ID, text limits, generation configuration, request/response shape, text and thought parts when present, signatures when present, finish reason, model version, and usage fields.

The gate MUST be evaluated independently for each model and each advertised reasoning level. Evidence for one level MUST NOT authorize another. Conflicting, incomplete, stale, or non-unique evidence MUST block admission until separately resolved; it MUST NOT create a discretionary mapping. Authorized discovery and smoke activity are evidence collection only and MUST NOT create runtime or startup discovery, dynamic registration, automatic catalog synchronization, or catalog mutation.

#### Scenario: Complete evidence admits only its proven scope

- GIVEN a candidate's versioned redacted record reconciles all four required sources for `off` and a specific proposed reasoning level
- WHEN the static catalog is assembled for release
- THEN it MAY register only that candidate identity and those evidenced choices with their recorded limits and policy

#### Scenario: Evidence for one level does not admit another

- GIVEN a candidate has complete evidence for `off` but lacks a required source for `high`
- WHEN Pi lists the static catalog
- THEN the catalog MAY expose `off` but MUST NOT expose `high`

#### Scenario: Discovery cannot dynamically add a model

- GIVEN authorized account discovery observes a model visible to the account
- WHEN the provider starts or serves a request
- THEN the observation is used only as recorded admission evidence and does not dynamically register or mutate the catalog

### Requirement: Generation policies and response compatibility are discriminated and evidenced

Each catalog entry MUST use one explicit discriminated generation policy: no reasoning configuration, a finite set of Pi string reasoning levels with their exact recorded serialization, or a finite set of Pi reasoning levels mapped to exact recorded integer thinking budgets. The serializer MUST emit only the selected entry's evidenced configuration. It MUST NOT send Gemini `thinkingLevel` to Claude or GPT-OSS unless that exact configuration is evidenced, and it MUST NOT expose an integer-budget mapping without an explicitly evidenced and product-approved Pi-level mapping.

A model family MAY use the shared Gemini-shaped transport and SSE parser only when its strict fixtures prove compatibility with the supported text, thought, signature, finish-reason, model-version, usage, and, where tool-enabled, tool-call behavior. A fixture that reveals an incompatibility MUST block the relevant capability or registration unless a smallest necessary, family-specific, strictly tested parser behavior is specified and evidenced. Function calls and `OTHER` finishes MUST remain unsupported except for a row/route enabled under this delta that satisfies the strict tool-call streaming requirement. Malformed frames and unsupported response content MUST continue to fail under the provider's strict terminal semantics.

(Previously: All function calls and `OTHER` finishes were unsupported response content.)

#### Scenario: A no-reasoning model omits unproven thinking settings

- GIVEN a registered model has a no-reasoning generation policy
- WHEN Pi sends a text request for that model
- THEN the serialized request omits Gemini string levels and integer thinking budgets

#### Scenario: Integer budgets use only the recorded mapping

- GIVEN a registered model has an integer-budget policy with evidence for a Pi reasoning level
- WHEN Pi selects that level
- THEN the request uses only that level's exact recorded integer budget and does not infer a budget for another level

#### Scenario: Response compatibility is fixture-gated

- GIVEN a candidate's strict response fixture does not fit the supported parser behavior
- WHEN its catalog admission is evaluated
- THEN the candidate remains unregistered or its tool capability remains disabled unless a narrowly specified and tested compatibility behavior is evidenced

### Requirement: Expanded catalog scope preserves explicit non-goals

The expanded catalog MUST remain static and MUST preserve all released text-only behavior while allowing only evidence-gated tool capability defined by this delta. It MUST NOT add runtime or startup model discovery, dynamic catalog mutation, model-list synchronization, image inputs or image-bearing tool results, multi-account support, rotation, quota aggregation or gating, fallback, hidden model substitution, Gemini CLI routing, API-key routing, Antigravity SDK routing, OAuth login or refresh changes, credential migration, project-resolution changes, OpenCode catalog or resolver changes, root-plugin behavior changes, publishing, or credential migration. It MUST NOT claim live availability or entitlement for any identifier or tool capability without the corresponding authorized evidence record.

(Previously: The expanded catalog was required to remain text-only and listed tools, Claude models, and session recovery as blanket non-goals.)

#### Scenario: A retained non-goal remains unavailable

- GIVEN a user attempts to use image content, dynamic model discovery, an alternate credential route, fallback, rotation, quota pooling, or forced tool selection through the Pi provider
- WHEN the requested behavior is outside this specification
- THEN the provider MUST not silently enable it, substitute another behavior, or claim support for it

### Requirement: Tool capability is admitted per catalog row and route

The provider MUST retain exactly seven registered text routes, in their existing order: Gemini 3.8 Flash, Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.1 Pro, Claude Sonnet 4.6, Claude Opus 4.6 Thinking, and GPT-OSS 120B. Tool capability MUST be resolved independently for every catalog row and admitted reasoning route. Each row/route MUST have exactly one tool state: `disabled`, `fixture-qualified`, or `enabled`.

A `disabled` row/route MUST reject a tool-bearing context before transport with a stable, actionable capability error and MUST continue to serve text-only contexts unchanged. A `fixture-qualified` row/route MUST have passing hermetic qualification evidence but MUST NOT be advertised or enabled for ordinary tool use. An `enabled` row/route MUST have both passing hermetic qualification and separately authorized direct validation of declaration, call, result replay, and continuation for that exact row/route. Missing, conflicting, stale, or route-scoped evidence MUST leave the row/route disabled; evidence from another row, family, or reasoning route MUST NOT be inherited.

Claude Sonnet 4.6 and Claude Opus 4.6 Thinking MUST remain tool-disabled until direct evidence proves safe declaration, call, result replay, thinking-signature, resume, and interruption continuity. The provider MUST NOT introduce a sentinel signature, speculative replay, or durable signature cache to bypass that gate. The provider MUST distinguish text registration from tool enablement in its metadata and documentation, and MUST NOT silently remove tools to downgrade an unsupported turn to text.

#### Scenario: A disabled row receives a tool-bearing context

- GIVEN a registered text route whose tool state is `disabled`
- WHEN Pi sends a context containing a declaration, assistant tool call, or tool result
- THEN the provider MUST fail before network transport with the stable capability error and MUST retain normal no-tool behavior for that route

#### Scenario: Qualification does not enable another route

- GIVEN one row/route is fixture-qualified or enabled
- WHEN a different row, family, or reasoning route has no complete evidence
- THEN that other route MUST remain disabled and MUST NOT be advertised as tool-capable

#### Scenario: Claude lacks continuity evidence

- GIVEN either Claude catalog row lacks the required direct continuity evidence
- WHEN Pi sends a tool-bearing context to that row
- THEN the provider MUST fail before transport and MUST NOT create signature-replay or durable-session workarounds

### Requirement: Tool declarations and tool choice are explicit

For an enabled row/route, the provider MUST validate and serialize Pi tool declarations in their supplied order as Antigravity `functionDeclarations` before transport. Declaration names MUST start with a letter or `_`, contain only letters, numbers, `_`, `.`, `:`, or `-`, be at most 64 characters, and be unique within the request. Each declaration MUST have a nonempty name, description, and valid parameters schema. Validation failure MUST identify the declaration and MUST prevent transport; the provider MUST NOT silently remove a declaration.

Pi tool choice `auto` MUST retain declarations and serialize automatic function selection. Pi tool choice `none` MUST retain declarations and serialize an explicit function-selection disablement. Forced, required, named, unknown, or otherwise unsupported choice modes MUST fail before transport with an actionable error. `constrainedSampling` MUST NOT be interpreted as forced selection and MUST NOT alter the Antigravity wire contract without a separately admitted mapping.

#### Scenario: Automatic choice retains ordered declarations

- GIVEN an enabled row/route, two valid Pi tools, and tool choice `auto`
- WHEN the context is serialized
- THEN the request MUST contain both declarations in supplied order and automatic function selection

#### Scenario: None disables selection without dropping declarations

- GIVEN an enabled row/route, valid Pi tools, and tool choice `none`
- WHEN the context is serialized
- THEN the request MUST retain the declarations and explicitly disable function selection for that turn

#### Scenario: Unsupported choice fails locally

- GIVEN a tool-bearing context selects a forced, required, named, or unknown tool-choice mode
- WHEN the provider validates the context
- THEN it MUST reject the request before transport and MUST NOT reinterpret the mode as `auto` or `none`

### Requirement: Tool schemas use bounded immutable normalization

The provider MUST use a typed Pi-local schema boundary and MUST NOT import OpenCode host-specific request transformation, configuration, logging, or permissive cleanup into the Pi runtime. The boundary MUST accept only an object-rooted schema with nonempty `properties`, using the documented compatible subset: `type`, `description`, `properties`, `required`, `items`, `enum`, and `nullable`, with single primitive types or nested object/array schemas composed from that subset. It MAY transform a single `const` value into an equivalent one-value `enum` only when the value is otherwise valid in that subset.

The boundary MUST reject missing or empty schemas; unresolved references; `$ref`, `$defs`, `definitions`, `$schema`, or `$id`; ambiguous unions; defaults; examples; unsupported constraints; additional-property or empty-schema repair; unknown keywords; and every construct whose accepted argument set cannot be preserved. Each error MUST identify the declaration name and schema path. It MUST preserve every admitted property and required constraint, MUST produce a canonical stable representation independent of source object insertion order, and MUST NOT mutate Pi context, tools, schemas, or nested input values.

#### Scenario: A supported constant is normalized without mutation

- GIVEN a valid declaration whose schema contains an admitted single `const` value
- WHEN the declaration is normalized
- THEN the output MUST contain the equivalent one-value `enum`, retain all other admitted semantics, and leave the complete input context unchanged

#### Scenario: A lossy schema is rejected

- GIVEN a declaration whose schema contains a reference, ambiguous union, unsupported constraint, or unknown keyword
- WHEN the declaration is validated
- THEN the provider MUST reject it before transport with its declaration name and schema path and MUST NOT drop or repair the unsupported content

### Requirement: Tool-call streaming has executable lifecycle semantics

The response layer MUST admit a streamed Antigravity `functionCall` only when its ID is nonempty and unique in the response, its name is a declared tool name, and its arguments are a valid JSON object. For each accepted call, the stream MUST emit `toolcall_start`, exactly one `toolcall_delta` containing the complete canonical JSON arguments, and `toolcall_end` at the call's zero-based source-call index. The shared Pi partial assistant state MUST contain the parsed tool call with the exact ID, name, and arguments by `toolcall_end`.

The stream MUST preserve observed ordering among text, thinking, and accepted calls. A documented upstream `OTHER` finish MUST yield `done` with reason `toolUse` only when at least one valid function call was parsed and no incompatible terminal condition exists. The final assistant message MUST use `stopReason: "toolUse"`. Malformed arguments, missing or duplicate IDs, unknown names, invalid terminal combinations, late data after termination, or a tool terminal without a valid call MUST emit exactly one error terminal and MUST NOT leave an executable or valid-looking partial tool call in Pi state.

#### Scenario: A valid parallel call batch completes for tool use

- GIVEN an enabled row receives a stream with two valid function calls and the documented tool terminal finish
- WHEN the provider maps the stream to Pi events
- THEN it MUST emit `start`, the indexed lifecycle for each call in source order, and exactly one `done` with reason `toolUse`, with both parsed calls present in partial state

#### Scenario: A malformed streamed call fails closed

- GIVEN a streamed function call has malformed JSON arguments, a missing or duplicate ID, or an unknown name
- WHEN the provider processes that call
- THEN it MUST emit exactly one error terminal and MUST NOT emit `toolcall_end` or retain an executable call for that malformed input

### Requirement: Tool result replay preserves exact identity and source order

The provider MUST serialize persisted Pi assistant `toolCall` blocks as model `functionCall` parts and contiguous matching Pi `toolResult` messages as the immediately following user `functionResponse` content. Each response MUST preserve its source call's `toolCallId` and `toolName` verbatim. The provider MUST associate results only by exact ID and matching name; it MUST NOT generate replacement IDs, match by name, use FIFO repair, or use result completion order.

For a parallel call group, the provider MUST emit all actual and synthetic response parts together in assistant source-call order, regardless of tool execution completion order. A duplicate call ID, duplicate result ID, name mismatch, result without a preceding matching call, result separated from its call group by unrelated history, or any ambiguous/foreign history MUST fail before transport. Reconstructed contexts from resume, fork, model handoff, or compaction MUST be validated under the same rules and MUST produce the same serialization for the same valid context.

A non-error result with text items MUST encode its items in Pi item order as `{ "result": "<items joined by \\n\\n>" }`. An error result MUST encode its items in the same order as `{ "error": "<items joined by \\n\\n>" }`. A non-error or error result with no text items MUST use the same respective object with the empty string value. The outer object field order and all inner text ordering MUST be deterministic. Any image-bearing result, including mixed text/image content, MUST fail before transport.

#### Scenario: Parallel same-name results retain their calls

- GIVEN an assistant message contains two parallel calls with distinct IDs and the same tool name
- WHEN their persisted results arrive in a different completion order
- THEN the provider MUST match each result by its exact ID and emit the response parts in assistant source-call order

#### Scenario: Text, error, and empty results have stable encoding

- GIVEN matching tool results containing multiple text items, an error result, and an empty result
- WHEN the provider serializes the response group
- THEN it MUST use the specified `result` or `error` object, join text only with `\n\n`, and represent empty content with an empty string rather than omitting it

#### Scenario: A media or identity violation is rejected

- GIVEN a tool result contains an image, a mixed image/text payload, a mismatched name, or an unknown call ID
- WHEN the reconstructed context is validated
- THEN the provider MUST fail before transport and MUST NOT discard media or repair identity

### Requirement: Orphaned calls receive context-derived failed responses

When a valid persisted assistant tool call lacks a matching result in an otherwise valid reconstructed context, the provider MUST serialize an adjacent synthetic `functionResponse` using the original call ID and name. The synthetic response MUST be a failed result with this byte-stable response object and field order:

```json
{
  "error": {
    "code": "PI_TOOL_RESULT_MISSING",
    "message": "Tool execution did not complete or its result was not recorded. Treat the call as failed; do not assume it had no side effects and do not retry it automatically."
  }
}
```

In a partially completed parallel batch, actual and synthetic responses MUST be emitted together in source-call order. If the reconstructed context later contains a real matching result, the real result MUST be used instead. Recovery MUST be derived solely from supplied context, MUST NOT mutate persisted Pi history, and MUST NOT use provider-owned durable session state. An aborted generation that never produced a complete terminal call MUST follow the existing abort/error path and MUST NOT fabricate a call or response.

#### Scenario: An interrupted parallel batch is replayed safely

- GIVEN a reconstructed assistant call group has one matching result and one valid call without a result
- WHEN the next turn is serialized
- THEN the provider MUST emit the actual response and the specified synthetic failed response together in source-call order

#### Scenario: A later real result supersedes recovery

- GIVEN a context that previously lacked a result now contains the exact matching real result
- WHEN the context is reconstructed
- THEN the provider MUST serialize the real result and MUST NOT add a synthetic response for that call

### Requirement: Tool outcomes are observable without secret disclosure

The provider MUST expose tool capability state, preflight category, stream terminal category, and recovery use through its existing observability surface using only stable public model identifiers, capability states, safe validation paths, and redacted error categories. Capability, schema, history, transport, and stream errors MUST be actionable without exposing OAuth tokens, API keys, project IDs, authorization headers, raw prompts, raw tool arguments, raw tool results, or unredacted upstream response bodies. A tool failure MUST NOT trigger alternate provider routing, quota fallback, account rotation, model substitution, or retries that alter call identity.

#### Scenario: A tool preflight error is reported safely

- GIVEN validation rejects a tool declaration or reconstructed history
- WHEN the provider reports the failure
- THEN its diagnostic MUST identify the safe category and applicable public model or schema path while omitting credentials, headers, prompts, arguments, and results

### Requirement: Tool support has mandatory qualification and distribution gates

Before any row/route becomes `fixture-qualified`, focused hermetic tests MUST cover declarations, `auto` and `none`, normalization output and immutability, rejected schemas, one and parallel calls, exact lifecycle order, malformed calls, result replay, source ordering, text/error/empty encoding, image rejection, orphan recovery, reconstructed histories, text-only regression, abort, timeout, malformed/empty streams, and one-terminal behavior. Before it becomes `enabled`, separately authorized direct validation MUST prove the exact row/route's declaration-to-continuation loop; absent authorization or failed validation MUST remain a capability blocker rather than a support claim.

The completed change MUST follow strict TDD (RED, GREEN, TRIANGULATE, REFACTOR) and pass `npm test`, `npm run typecheck:pi`, `npm run build:pi`, applicable root type/build checks, and a packed production-dependency installation test for `packages/pi`. Existing root OpenCode regression coverage MUST continue to pass. No live validation, publication, credential action, or review-budget exception is authorized by this requirement.

#### Scenario: A row lacks direct validation

- GIVEN hermetic fixtures pass for a row/route but direct validation is absent or unauthorized
- WHEN capability admission is evaluated
- THEN the row/route MAY be fixture-qualified but MUST NOT become enabled or be advertised for ordinary tool use

#### Scenario: A packed consumer loads the extension

- GIVEN the Pi package archive is installed with production dependencies outside the repository
- WHEN Pi discovers and loads the extension
- THEN every runtime import MUST resolve without unpublished root source paths and the verification gate MUST pass

### Requirement: Deferred capabilities are not silently enabled

The following capabilities remain out of scope and MUST NOT be represented as supported by the Pi provider: multi-account support or rotation; quota gating, aggregation, or fallback; image inputs and image-bearing tool results; dynamic model discovery or catalog parity; shared credential migration or synchronization; proactive refresh; fingerprint history or rotation; Google Search; auto-updates; forced, required, or named tool selection; durable provider session storage or signature caching; Pi history mutation; and OpenCode configuration writing from Pi. Tool declarations, tool calls, tool-result replay, and context-derived orphan recovery are no longer deferred only to the limited extent specified by this delta. Claude tool capability remains disabled until its separate admission evidence is complete.

(Previously: Tools, tool execution, Claude models or thinking-signature handling, and session recovery were entirely deferred.)

#### Scenario: Deferred features are not silently enabled

- GIVEN a user attempts to use a deferred capability through the Pi provider
- WHEN the capability requires provider behavior outside this specification
- THEN the provider MUST not silently enable it, substitute another behavior, or claim support for it
