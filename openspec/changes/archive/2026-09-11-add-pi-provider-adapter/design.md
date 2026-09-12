# Design: isolated Pi text streaming with a minimal shared core

Add npm workspaces without relocating or replacing the OpenCode package. Pi owns its OAuth interaction, credential lifecycle, text serialization, HTTP stream consumption, and native assistant events. Share small pure auth/wire primitives, not the OpenCode interceptor. This is a design only; implementation, live account operations, and publishing remain unauthorized.

## Readiness and authority

- Inputs read directly: `explore.md`, `preproposal.md`, `proposal.md`, `specs/pi-provider-adapter/spec.md`, and `../../config.yaml`.
- Native session authority and config select hybrid storage: this file is the detailed artifact; Engram records the design decisions and provenance under `sdd/add-pi-provider-adapter/design`.
- Status: complete; ready for `sdd-tasks`. The corrected specification resolves G1 and no other specification blocker remains. Strict TDD and `ask-on-risk`, 400 authored changed lines, remain mandatory. Design completion does not authorize apply.
- Scope explicitly expands to this repository's root, `packages/core`, and `packages/pi`; there is no local `packages/coding-agent` modification.
- Actual root manifest identity is `@benjamolina/opencode-antigravity-guard@1.1.10`, not the stale package name in OpenSpec config. Preserve the actual manifest name and `dist/index.js` / `dist/index.d.ts` entry points; do not silently repair config in this phase.

### Gate G1 resolved: public-to-wire namespace translation

The corrected specification explicitly requires Pi selectable/public ID `antigravity-gemini-3.8-flash` and Antigravity wire ID `gemini-3.8-flash`. Register only the public ID and serialize only the wire ID for that selection. This is namespace translation, not fallback or model substitution. Local `src/plugin/config/models.ts` defines context 1048576 and output 65536; `resolveModelWithTier()` in `src/plugin/transform/model-resolver.ts` removes `antigravity-`, consistent with this mapping and the existing default thinking level `low`.

G1 is closed; no identifier clarification is required before tasks. Registration and request fixtures must assert both identifiers at their respective boundaries and prove no alternate model is selected. Neither local definitions nor the dated API guide establish live availability or entitlement. Missing authorized smoke evidence is a verification limitation, not a design or tasks blocker. An observed unavailable model blocks live acceptance/release, never permits substitution.

### Gate G2 deferred: post-tasks delivery decision, before apply

The preliminary design estimate is 2060–2910 authored lines including tests/docs and this design, before unknown corrective work. It is input to, not a replacement for, the formal Review Workload Forecast produced by `sdd-tasks`. Proceed to tasks without a pre-tasks delivery decision. Under `ask-on-risk`, the parent presents that formal forecast for the human delivery decision after tasks and before apply. Proposed work units below remain candidate PR boundaries only; neither small commits nor this design authorizes chaining, a chain strategy, or `size:exception`.

## 1. Runtime and distribution topology

```text
root OpenCode wrappers ── package import ──> neutral core
Pi extension ──────────── package import ──> neutral core
Pi Context -> Pi serializer -> HTTP/SSE -> Pi AssistantMessageEventStream
Pi OAuth callbacks -> Pi attempt/listener -> neutral forms -> Google endpoints
                                           -> Pi-owned OAuthCredentials
```

| Package | Build/publish decision |
|---|---|
| Repository root | Remains publishable OpenCode package with current files, exports, dependencies, and Node >=20 runtime. Add `workspaces: ["packages/core", "packages/pi"]`. No Pi runtime or peer dependency on root. |
| `packages/core` | Publish ordinary dependency `@benjamolina/antigravity-guard-core`, initially `0.1.0`, ESM, Node >=20, no host dependencies and no Pi manifest. `exports["."]` points to `dist/index.js` / `dist/index.d.ts`; files allowlist is dist, license, README. |
| `packages/pi` | Publish `@benjamolina/pi-antigravity-guard`, initially `0.1.0`, ESM, Node >=22.19 matching installed Pi. Exact core dependency `0.1.0`. `pi.extensions: ["./dist/extension.js"]`, `pi-package` keyword, dist/license/README allowlist. |

Both root and Pi use bare package imports of the same exact core version, not `../../packages/core/src`, `file:`, `link:`, or `workspace:*` dependencies in published manifests. npm links a matching version locally; registry dependencies resolve it in consumer installs. Publish core first, then dependents, only after separate publishing authorization and scope/name availability checks. This extra package is an explicit distribution decision, not an authorized publish action. Avoid bundling: two implementations of core and a root build-tool replacement cost more regression risk than one tiny ordinary dependency.

Build rules:

1. Keep the existing root tsc + `scripts/fix-esm-imports.ts` pipeline as `build:opencode`. `npm run build` builds core then OpenCode, so root users never need to compile Pi.
2. Add `build:all`: core, OpenCode, then Pi explicitly, not unordered recursive workspace execution. Pi's build ensures core exists first. Typecheck similarly has root/core and all-workspace variants.
3. Use TypeScript 5.9.3 in development, with workspace tsconfigs explicitly setting rootDir `src`, outDir `dist`, declaration true, and `rewriteRelativeImportExtensions: true`. Source-relative imports end in `.ts`; emitted imports end in `.js`. Override inherited include/exclude; do not pull root scripts or tests into workspace output. Root compiler behavior remains unchanged.
4. `npm test` retains all root tests and includes `packages/{core,pi}/src/**/*.test.ts`; exclude every dist directory. Build core before tests consuming its exported dist; do not use source-path aliases that hide packaging defects. Add type-level registration fixtures and independent workspace typechecks.
5. One root npm lockfile records workspace links, exact development Pi versions, and runtime dependency versions. Root-only production consumers receive core but not Pi's SDK graph. Root development installs require Node >=22.19 for the combined workspace; separately test the packed root/core on Node 20.
6. Use `prepack` for each publishable package's required build, not only `prepublishOnly` (which does not prove npm-pack output). Build from checkout; installed packages require no compiler, tsx, lifecycle script, or repository path.

Packed acceptance: create archives for core, root, and Pi; inspect files and emitted JS/d.ts imports; install the archives in a clean consumer outside the repository with lifecycle scripts disabled. Preinstall the core archive at the exact declared version in the consumer before installing dependent archives, or use an isolated local registry serving the archives. Verify with production-only dependencies, no workspace symlinks, no source tree and no NODE_PATH. Root and Pi use separate consumers; Pi consumer supplies exact host peers. Import root entry points and load Pi via its resource loader, not merely Node import. A local-registry dependent-only install proves ordinary dependency resolution; preinstalling tarballs alone does not prove registry availability. Include dist extension default-export and declaration resolution assertions.

## 2. Neutral core and unchanged OpenCode ownership

Keep core's public interface small; no generic provider framework or shared conversation abstraction.

| Core contract | Responsibility / consumer |
|---|---|
| `OAuthClientConfig` | Client ID, installed-app client credential, scopes, redirect URI, authorize/token endpoints. Plain immutable values, never logged. |
| `buildAuthorizationUrl(config, { challenge, state })` | Pure URL construction, S256 and offline consent parameters. Both adapters supply their own state policy. |
| `buildCodeExchangeForm(config, { code, verifier })` | Pure URLSearchParams with authorization-code grant and fixed redirect URI. |
| `buildRefreshForm(config, refreshToken)` | Pure URLSearchParams for refresh grant. |
| `TokenSet` | `{ accessToken, refreshToken, expiresAtMs }`; neutral normalized domain result. Pi validates raw unknown token JSON before constructing it. |
| `calculateTokenExpiry(requestTimeMs, expiresInSeconds)` | Existing pure expiry calculation moved exactly; Pi adds finite-positive validation before calling. No new skew policy imposed on OpenCode. |
| `AntigravityEndpoints`, `buildAntigravityHeaders({ version, platform })` | Immutable endpoint values and deterministic headers; no mutable global version, fingerprint or randomization. Existing wrapper supplies current version/platform. |

Extract OAuth constants and deterministic header construction from `src/constants.ts`, retaining same-named reexports/wrappers, ordering, and exact wire values. Move expiry helper from `src/plugin/auth.ts` with same-named reexport. In `src/antigravity/oauth.ts` replace only authorization URL/form assembly; in `src/plugin/token.ts` replace only refresh form assembly. OpenCode wrappers retain fetch timing, headers, raw response handling, return unions, logging, `refresh|project` representation, userinfo lookup, cache invalidation, invalid_grant behavior, and persistence semantics. Characterize these before extraction.

Do not move OpenCode's encode/decode state into shared core: its encoded state contains the verifier. Pi must use a separate opaque nonce and private verifier. Preserving legacy behavior here is not an endorsement of that state policy; any OpenCode OAuth security change needs its own scoped change.

Untouched production sources: `src/plugin.ts`, `src/plugin/request.ts`, `src/plugin/request-helpers.ts`, model definitions/resolver, fingerprint storage/rotation, `src/plugin/project.ts`, accounts/storage/locks, quota, refresh queues, recovery, signature caches, image saver, and `src/plugin/core/streaming/*`. Existing SSE transformer unwraps Google-shaped payloads and invokes image/signature behavior: importing it into Pi would violate isolation.

Pi-only domain HTTP operations live in `packages/pi/src/auth-http.ts` and `project.ts` for now, using neutral core primitives. Sharing pure request forms rather than wholesale HTTP orchestration avoids changing OpenCode's errors, caching, retry and timeout policies. Promote another operation to core only once both consumers actually need its identical contract.

No new credential database, files, migration or locking protocol. Pi stores credentials through its own auth lifecycle; core has no filesystem imports. Process-local login attempt state is the only new coordination state.

## 3. OAuth, credentials and project context

### Attempt lifecycle

`idle -> selecting -> listening/manual -> validating -> exchanging -> resolving-project -> complete`, with cancellation, denial, timeout, invalid callback and transport errors reaching one failed terminal state. All terminals run the same idempotent cleanup.

- Create independent 32-byte cryptographically random state and PKCE verifier, S256 challenge; store verifier only in attempt memory. State contains no verifier, project, token, email or host path. Dependency-inject randomness for tests only.
- Reject a second concurrent login for this extension instance with a safe busy message. Separate processes may contend for the fixed port; loser offers manual mode without killing another process.
- Total deadline: five minutes starting before method selection; token/project requests have ten-second deadlines bounded by remaining attempt time. Use an attempt AbortController composed with `callbacks.signal` and session shutdown. Test abort before work, during listen/prompt/fetch/body read, and after terminal settlement.
- First `onSelect` offers browser/loopback or manual callback. Undefined selection, empty manual input or rejected prompt means cancellation. Automatic mode creates listener before `onAuth`; manual mode never opens a socket.
- Keep registered redirect exactly `http://localhost:51121/oauth-callback` in both URL and token form. Bind explicitly to `127.0.0.1:51121`, not hostname/wildcard; optional IPv6 is not required. Browser IPv6-only localhost behavior falls back to manual. Do not assume Google accepts arbitrary ports or redirect IP literals.
- Automatic wait gets a 30-second local callback window; on expiry close listener and offer manual input within the original five-minute deadline. Listener bind failure offers manual immediately. Avoid racing an uncancellable manual prompt against successful automatic completion. `onManualCodeInput` exists in installed types but is not required for this sequential fallback.
- Fixed path, GET only, expected Host `localhost:51121`, loopback remote address, bounded URL length (8 KiB), no credentials/fragment in callback URL. Unrelated paths/methods get fixed 404/405 without affecting the attempt. A malformed callback at the callback path or wrong state fails the attempt and closes the listener; no exchange.
- Both manual and loopback completion require exactly one nonempty state and either one code or one OAuth error, never duplicates or both. Compare expected state after length validation using timing-safe byte comparison. Expired/completed attempts reject late callbacks. Validate state before processing denial or exchanging a code.
- Manual input accepts the complete callback URL only. A bare code cannot prove returned state and is rejected with instructions to paste the full URL; this selects the callback-URL branch of the spec's alternative rather than weakening state checks. Never regenerate verifier/state between automatic and manual paths.
- Claim the winning callback synchronously before await; close listener before token exchange. Respond with static HTML, `Cache-Control: no-store`, restrictive CSP and no query echo. Track sockets and destroy remaining owned connections on cleanup so server.close cannot hang. Clear timers, remove abort/error listeners, discard references to verifier/state/code on every exit. JavaScript memory cannot promise cryptographic zeroization.
- Callback promises are wrapped with abort/deadline races with handlers attached to losing promises; late prompt results cannot exchange or persist credentials. Legacy callbacks provide no provider-controlled prompt dismissal; verify actual Pi login UI tears down when login rejects. A stale UI prompt is a compatibility failure to fix before release, not a reason to leave network resources alive.

### HTTP auth and redaction

Use injected fetch and clock. Set redirect `error` for authenticated requests, forward the composed signal to fetch and body reads, and bound JSON/error bodies (64 KiB). Exchange uses core form and existing Google token endpoint; validate nonempty access/refresh tokens and finite positive expires_in. Request-start timestamp plus duration defines expiry. Refresh preserves the previous refresh token when rotation is absent; invalid_grant says to run `/login antigravity-guard`. Never revoke automatically.

Do not emit raw upstream error bodies, callback URLs, Authorization headers, client credential, codes, state, verifier, token forms, or credentials through logs, exceptions, session entries, events or test snapshots. Expose an allowlisted error kind, numeric HTTP status and fixed actionable message; optionally validated numeric retry delay. Unknown error.message/cause is not safe to forward. The authorization URL is delivered only to Pi's intended `onAuth` interaction, not debug logging. Tests inject canary secrets into every upstream error and assert absence from diagnostics.

Pi credential mapping is exactly `{ refresh: tokenSet.refreshToken, access: tokenSet.accessToken, expires: tokenSet.expiresAtMs }`. `getApiKey(credentials)` returns only access. No composite API key containing project/token JSON, no OpenCode pipe-delimited refresh string, no module-global last-account value.

Project context is deliberately not persisted in opaque extra credential fields: login validates access with one `POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist`, and each generation resolves again using its own access token. Request body is `{ metadata: { ideType: "ANTIGRAVITY", platform: "WINDOWS" | "MACOS", pluginType: "GEMINI" } }`, matching the existing compatibility mapping (non-Windows maps to MACOS). Headers use existing Gemini CLI UA and Antigravity client metadata. Accept only nonempty `cloudaicompanionProject` string or `.id` string. Missing project fails with setup/access guidance, not a hardcoded project, onboarding, endpoint fallback, or account discovery. Additional lookup latency is accepted to avoid account-keyed caching/persistence complexity. Refresh only returns tokens; generation revalidates project after refresh.

## 4. Pi registration and native stream contract

Use documented legacy `pi.registerProvider("antigravity-guard", config)` because its explicit OAuth plus streamSimple contract suffices and is present in installed 0.85.1. Do not override `google` or built-in providers. Register synchronously at extension load with no network, timers or listener. Keep normal modules named-export only; `packages/pi/src/extension.ts` is the sole default-export factory required by Pi.

Configuration: name `Antigravity Guard`, custom api `antigravity-guard-sse`, daily endpoint base URL, OAuth handlers, and streamSimple. Exactly one descriptor: ID `antigravity-gemini-3.8-flash`, name `Gemini 3.8 Flash (Antigravity, text only)`, input `["text"]`, reasoning false, contextWindow 1048576, maxTokens 65536. Cost rates zero mean unpriced subscription usage, not proof of free access. No model discovery or alternate IDs. Runtime request validates the selected provider/model/API and fixed endpoint; models.json overrides must not redirect bearer credentials to another origin.

`streamSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream` returns immediately, not a Promise. Its owned async task catches all failures. Initialize assistant role, model/provider/api, timestamp, empty content, zero usage/cost, stopReason pending; emit start before updates. On setup errors including missing credentials return one error terminal rather than throwing synchronously, honoring this change's stricter terminal specification (installed general types document a synchronous missing-auth convention; test the registered adapter boundary explicitly).

On first nonempty text, append `{ type: "text", text: "" }`, emit text_start with contentIndex 0, mutate text before each text_delta with identical delta, and at successful completion emit text_end with the full content. Partials are the shared live output object, not immutable snapshots; tests snapshot at push time when asserting intermediate values. No thinking/toolcall events are produced.

Only a centralized finalize path emits `{ type: "done", reason: "stop" | "length", message }` or `{ type: "error", reason: "error" | "aborted", error: output }`, then stream.end exactly once. Error output preserves already-delivered text and usage and supplies a safe errorMessage. No text_end is synthesized on failure. Finalization guard prevents abort/reader/error races and mutation after terminal. stream.result must resolve on every path. Finally cancel/release reader, abort owned transport and clear timers even if caller abandons iteration; bounded request lifetime prevents indefinitely retained work.

## 5. Serialization, HTTP and SSE boundaries

### Context and outgoing request

Validate the entire context before any project or generation fetch. Accept systemPrompt string, user string or text-block arrays, and assistant text blocks. Map user to `contents[].role: "user"`, assistant to `"model"`, each text block to `{ text }`, preserving ordering and whitespace without mutating caller data. System text becomes `systemInstruction: { parts: [{ text }] }`; omit only when undefined. Empty overall conversation fails explicitly. Do not inject OpenCode's Antigravity/Claude system prompts or synthetic turns.

Reject nonempty context.tools even with toolChoice none, toolResult messages, toolCall blocks, image blocks, thinking blocks, unknown runtime block/role kinds, and deferred requests with clear text-only guidance and no payload echo. This includes image/tool history from a different provider. Reject explicit reasoning options; descriptor reasoning false is an adapter limitation, not a claim that Gemini lacks internal reasoning. Set upstream `thinkingConfig: { thinkingLevel: "low", includeThoughts: false }` to follow local Gemini defaults while exposing only text. Unexpected thought/image/function output fails explicitly rather than leaking reasoning as answer text.

For the specified public-to-wire mapping, send once:

```text
POST https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:streamGenerateContent?alt=sse
Authorization: Bearer <access>
Content-Type: application/json
Accept: text/event-stream
User-Agent / X-Goog-Api-Client / Client-Metadata: deterministic core headers
```

JSON envelope: `{ project, model: "gemini-3.8-flash", request: { contents, systemInstruction?, generationConfig }, requestType: "agent", userAgent: "antigravity", requestId: "agent-<uuid>" }`. No signature/session recovery state. Generation config contains finite temperature in [0,2] when supplied and positive integer maxOutputTokens no greater than 65536; default 4096. Invalid options fail, not silently clamp. Use `options.fetch ?? injectedFetch`. Authenticated origins remain fixed; no redirects, retries, quota gating, rotation or fallback.

Honor options.signal and options.timeoutMs with positive finite validation; default total generation lifetime 120 seconds including project lookup. Reader inactivity deadline 30 seconds, refreshed on incoming bytes; total deadline still limits comment-only streams. Forward lifecycle onPayload and onResponse when supplied, bounded by the same signal/deadline. Revalidate replacement payload against exact text-only/model/project envelope before send. Custom headers merge case-insensitively; reject attempts to alter Authorization, Host, content type or content length. Never send caller auth to an overridden endpoint. Hook errors become safe error terminals. No generic samplingParams, cache retention or session-affinity behavior is promised.

### Incoming framing and schema

Separate modules: `sse.ts` owns byte framing only; `response.ts` validates Antigravity events; `stream.ts` owns Pi output/events and HTTP lifecycle. None calls OpenCode transformers.

- Require HTTP success, body, and media type text/event-stream (parameters allowed). 401 => login guidance; 403 => entitlement/access guidance; 404 => intended model unavailable; 429/RESOURCE_EXHAUSTED => quota/rate-limited plus validated retry delay. No automatic retry. Non-SSE success and non-2xx bodies fail safely after bounded inspection.
- Use incremental fatal UTF-8 decoding across Uint8Array boundaries; handle BOM at start, LF/CRLF/bare CR lines, blank-line record delimiter, optional space after data colon and multiline data joined with newline. Ignore comments, id and retry fields (never reconnect). Unknown non-error event labels do not override validated data. Bound one record to 1 MiB and text accumulation to 8 MiB; exceeding a bound errors explicitly, never truncates successfully.
- Parse each dispatched data record once as unknown JSON. Require object `response` envelope, or recognize top-level/response error. `response.candidates` permits a single candidate (index absent or 0); reject multiple/conflicting indices. Candidate text parts are deltas, not cumulative text, so repeated identical chunks must not be deduplicated.
- Metadata-only records with validated usage/responseId/modelVersion are permitted. Unknown additive metadata is ignored; malformed known fields fail. Reject functionCall, functionResponse, inlineData, fileData, thought true and unknown content-part kinds. A text part's opaque signature metadata is not persisted or replayed. No response body/image data is written to disk.
- STOP maps to stop; MAX_TOKENS maps to length. OTHER, safety/block reasons, absent terminal reason, and unknown reasons fail explicitly. Prompt-block metadata fails even without candidates. A complete stop record marks semantic completion but does not immediately emit done: drain bounded metadata trailers to clean EOF, rejecting later text/second finish/error. Optional `[DONE]` is only an end marker after a valid finish; never a substitute for finish. After it, only whitespace/comments are allowed until EOF.
- Flush decoder at EOF. Any unterminated data record, invalid UTF-8, truncated JSON, missing finish, or zero text characters makes the invocation fail. Whitespace text counts as text. Clean EOF plus one supported finish and nonempty text is success. A transport error after finish remains error; no premature done can hide truncation. A hung trailer reader times out.
- Usage records are cumulative snapshots, not increments. Validate nonnegative finite integer counts. Set cacheRead from cachedContentTokenCount, input from promptTokenCount minus cacheRead, output from candidatesTokenCount plus thoughtsTokenCount, optional reasoning from thoughtsTokenCount, cacheWrite zero. Reject cacheRead > prompt count. totalTokens is the normalized sum; preserve previous known counts when omitted, never double-add repeated metadata. Validate reported total when supplied and test discrepancies explicitly. Zero rates give zero cost; call Pi calculateCost after updates. Missing usage is unknown represented by initial zeros, documented rather than estimated.

## 6. Files and strict-TDD work units

Expected production additions: core `src/{index,oauth,constants,headers,expiry}.ts`; Pi `src/{extension,provider,oauth,auth-http,loopback,project,context,sse,response,stream}.ts`. Prefer colocated focused tests; these are responsibility boundaries, not a mandate for empty modules. Add workspace manifests/tsconfigs/READMEs, root package/lock/test wiring, a packed-consumer smoke script, and a short root README link. Limit root production edits to the seams named in section 2.

Each row is a potential independently reviewable work unit, including behavior tests and documentation. Ranges count authored additions plus deletions; generated lockfile churn is reported separately and still included in snapshot identity. Do not compress tests or code to fit.

| Unit / start -> finished behavior | Lines | RED -> GREEN and same-unit verification |
|---|---:|---|
| D: artifacts -> reviewable design | 240–320 | Documentation-only; runtime N/A. G1 resolved; proceed to tasks, then delivery decision before apply. |
| A: single package -> resolvable workspace archives | 220–320 | Failing clean-consumer pack/import and workspace-test discovery checks, then manifests/build/test wiring and minimal actual core export. Pack root/core with no Pi runtime installed. |
| B: inline OpenCode primitives -> shared equivalent primitives | 220–320 | Characterize URL/forms/header/expiry/wrapper cache side effects against existing code first; failing core contract tests then extraction. Focused oauth/token/auth tests and full OpenCode regressions. |
| C: no Pi auth HTTP -> exchange/refresh/project result | 240–340 | Mock token success/missing fields/rotated refresh/invalid_grant/abort/project shapes, then minimum HTTP implementation. Fetch recorder verifies exact wire and canary redaction. |
| D1: no listener -> bounded secure callback receiver | 240–340 | Fake server/state validator tests then real loopback integration, including occupied port, duplicates, wrong state, socket closure and rebind. No Google call. |
| E: auth pieces -> Pi login/manual lifecycle | 240–340 | Deferred callbacks, clock and abort races fail first; wire lifecycle, single winner, cleanup and credential mapping. Actual Pi login UI fixture verifies signal/teardown without browser/account. |
| F: no request/event codec -> text wire and SSE decoding | 220–300 | Unsupported-context and exact serialization tests, then byte-split Unicode/multiline SSE cases. Test every split point of compact fixtures. |
| G: codecs -> native streamed completion | 240–340 | Fake fetch response consumed by real Pi event stream; RED order/terminal/usage/error/timeout cases then stream and response mapper. Abort before headers and during every framing boundary. |
| H: components -> discoverable Pi vertical slice | 200–290 | Registration/resource-loader and packed Pi consumer tests fail first; factory/descriptor/lifecycle wiring and user docs. End-to-end fixture login, refresh, text streaming without external accounts. |

Total 2060–2910. These ranges are forecasts, not verified diff counts; an unexpectedly large cohesive unit must stop for a delivery decision, not split code away from its tests. Work-unit dependencies: A before B/C; C and D1 before E; F/C before G; E/G before H. No registration of an unfinished provider in earlier shipped units, and no publishing until H plus all release gates.

Strict sequence for each behavioral increment: write one test, run the focused command and record the intended assertion failure (RED), implement only enough to pass (GREEN), add a second boundary case (TRIANGULATE), then refactor under green tests. Existing-behavior characterization may initially pass: that is baseline evidence, not fabricated RED. Add failing exported-core/adapter behavior before moving code. Record command, exit code, assertion/test count, and stage; never label tests written after implementation as TDD.

Key tests: state randomness/verifier absent from URL, denial, malformed/duplicate callbacks, timeout/abort races, no socket/promise leaks, safe HTTP failures, project per-access-token isolation, no OpenCode fs imports, exactly one registration/model, caller context immutability, tool/image rejection before fetch, every UTF-8 split, CRLF split, repeated deltas, finish-plus-error, empty/truncated stream, malformed usage, forbidden response content, result settlement, and concurrent streams isolated from each other. Test pushed partials at push time and final shared result.

Suggested focused command: `npx vitest run packages/pi/src/stream.test.ts` (after core build), and equivalent per-module commands. Final hermetic gate: root `npm run build`, `npm run typecheck`, `npm test`, all-workspace build/typecheck, coverage report and packed-consumer script. No tests/builds were run in design phase.

## 7. Compatibility, release and rollback

Installed reference is `@earendil-works/pi-coding-agent@0.85.1`, requiring Node >=22.19.0. Pin development Pi AI/coding-agent packages to 0.85.1 and test that exact pair. Distributed Pi peerDependencies use `"*"` for those two imported host packages, as installed Pi package guidance requires; never bundle or install a private runtime copy as dependencies. A wildcard is host-resolution policy, not a claim of compatibility with every historical/future release. Document tested compatibility as 0.85.1 only; add CI against later releases before widening documented support. Do not claim compatibility with the older `@mariozechner` package family.

Registration smoke and compile fixtures detect missing APIs, stopReason changes, callback signatures and peer duplication. In particular installed `compat/extension-oauth-types.d.ts` has optional signal/onManualCodeInput absent from the abbreviated guide. Verify actual host forwards cancellation and dismisses prompts before release. Failure is a compatibility blocker; do not hide it with unsafe casts or SDK bundling. Node 20 remains a root/core packed-consumer test lane, not a promise that this Pi host runs on Node 20.

User docs must lead with text-only limits: install the pinned Pi package, run `/login antigravity-guard`, choose browser or paste the full callback URL in manual mode, then select the exact model. Start a fresh session with `--no-builtin-tools` and disable any extension-provided tools; that flag alone does not disable extension tools. Do not silently call setActiveTools to alter the user's session. Old tool/image/thinking history requires a fresh text-only session. Explain zero/unpriced cost metadata, independent credentials, fixed callback port, manual flow after failed browser redirect, and unresolved live availability.

OpenCode protection: obtain baseline build/typecheck/test results before edits, then compare focused characterization and full root tests after each extraction. Keep account files, cache invalidation, quota lock/reset semantics, fetch interception, model mapping, recovery and output transformation unchanged. Run existing environment-dependent model/regression scripts only with explicit account authorization; hermetic mocks cannot prove entitlement or upstream SSE shape.

Release requires packed-install success, no peer duplication, root Node 20 regression success, Pi 0.85.1 host smoke, the post-tasks G2 delivery decision (G1 is resolved), and separately authorized browser/manual login and streamed generation evidence for the exact model. Record redacted endpoint/model metadata and result, never secrets. If live authorization is unavailable, record verification incomplete and do not claim a functional/live provider. Publication remains a separate human-controlled action.

Rollback before release removes only this change's units in reverse dependency order: H registration/docs, G/F stream codecs, E/D1/C auth, B extraction restoring original wrappers, then A workspace wiring/manifests/lockfile. Each unit's tests and runtime fixture are reverted with its behavior; never reset the worktree. After release users remove/disable `npm:@benjamolina/pi-antigravity-guard` and restart/reload Pi; this does not delete auth entries or revoke tokens. Root regressions require a corrective release restoring previous root imports/dependency set or the known-good root version. No unpublish is planned.

## Evidence and execution limitations

Read local root manifest/configs, OAuth/token/expiry/header sources, model definitions and resolver, targeted request-envelope code, streaming transformer, and `docs/ANTIGRAVITY_API_SPEC.md`. The API guide documents an envelope with response.candidates and SSE records, but its dated verification is not evidence for Gemini 3.8 Flash availability. Read installed Pi custom-provider/packages/extensions docs completely, the custom-provider-anthropic example, Pi package manifest and AI type/legacy OAuth declarations. Examples guide API shape, not this repository's safety/style policy; do not copy their any casts or raw-secret diagnostics.

No shell or CodeGraph execution tool was exposed, so root git resolution, index initialization/query, dirty-state inspection, command execution, package inspection, and live checks could not be performed. Used supplied workspace root and targeted file reads after reporting this limitation. No child agents launched because this executor is prohibited from delegating. Exact injected skills were read; no additional executor skill path was supplied or discovered. Only this design file is updated in the worktree; unrelated dirty files, especially `.atl/*` and `.gitignore`, are untouched. Parent must capture actual git diff/status and restore CodeGraph-first exploration before implementation.

Finalization provenance: reread proposal, corrected specification, current design, project config, local model definitions and the targeted resolver source; fetched the previous full Engram design observation. Earlier broad source and installed Pi documentation evidence above is retained from the original design pass, not claimed as newly executed. Loaded all three exact injected skill paths; no separate phase-executor path was supplied. This bounded correction changes readiness, namespace authority, delivery sequencing and verification wording only; detailed architecture remains intact. No production code, specification, native status file or unrelated dirty file was changed. Engram provenance is updated separately under the same design topic key.

## Next step

Run `sdd-tasks` with this complete design and corrected specification. Produce the formal Review Workload Forecast, then pause for the `ask-on-risk` human delivery decision before apply. Carry authorized live availability checks as verification/release evidence requirements, not prerequisites for task planning.
