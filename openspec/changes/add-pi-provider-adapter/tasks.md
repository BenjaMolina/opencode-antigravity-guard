# Tasks: Add Pi Provider Adapter

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,060–2,910 authored lines across eight behavior units; lockfile churn tracked separately |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Candidate work units A → B → C → D1 → E → F → G → H; final PR/branch arrangement awaits human choice |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

The forecast exceeds the 400 changed-line review budget even though each autonomous unit is planned below that threshold. Under `ask-on-risk`, pause after these tasks are accepted and obtain a human delivery decision before apply. This plan does not select `stacked-to-main`, `feature-branch-chain`, a single oversized PR, or `size:exception`.

## Guardrails and evidence protocol

- Preserve unrelated dirty files, including `.atl/*` and `.gitignore`; do not reset the worktree.
- Keep the root OpenCode package identity and `dist/index.js` / `dist/index.d.ts` entry points intact. Do not edit the design-marked OpenCode-only production sources: `src/plugin.ts`, `src/plugin/request.ts`, `src/plugin/request-helpers.ts`, `src/plugin/project.ts`, account/storage/quota/recovery modules, fingerprint persistence, or `src/plugin/core/streaming/*`.
- Keep tests and user documentation in the work unit that changes the protected behavior. Every behavioral increment records its focused command, exit code, test/assertion count, and outcome at RED, GREEN, TRIANGULATE, and REFACTOR; a pre-existing characterization pass is baseline evidence, not RED.
- RED adds one failing observable behavior before production implementation; GREEN adds the minimum implementation to pass it; TRIANGULATE adds a materially different boundary case; REFACTOR removes duplication only while the focused suite remains green. Tests added after implementation do not count as TDD evidence.
- Each unit records its exact rollback boundary independently of any commit. A failed authorized live model check blocks acceptance/release and never authorizes a substitute model. Live login, generation, and publishing remain separately human-authorized.

## Work-unit forecast and dependencies

| Unit | Depends on | Authored-line estimate | Finished behavior | Rollback boundary |
|------|------------|----------------------:|-------------------|-------------------|
| A — workspace/distribution foundation | None | 250–350 | Root, core, and Pi package topology can build/test/pack without source-path runtime imports | Workspace manifests, tsconfigs, test/build scripts, pack harness, and lockfile wiring |
| B — neutral-core extraction | A | 280–380 | OpenCode consumes equivalent pure OAuth/header/expiry primitives through core | Core primitives plus the four named OpenCode wrapper seams |
| C — Pi auth HTTP/project operations | A | 260–360 | Pi can safely exchange/refresh tokens and resolve a project without OpenCode storage | `packages/pi/src/auth-http.ts`, `project.ts`, and their tests |
| D1 — secure loopback receiver | A | 260–360 | A bounded loopback/manual callback receiver validates and cleans up one OAuth attempt | `packages/pi/src/loopback.ts` and its tests |
| E — Pi OAuth lifecycle | C, D1 | 260–350 | Pi login/refresh lifecycle maps isolated credentials and settles cancellation safely | `packages/pi/src/oauth.ts` and its tests |
| F — text context and byte framing | A | 230–330 | Supported text is serialized exactly and SSE bytes are framed safely | `packages/pi/src/context.ts`, `sse.ts`, and their tests |
| G — response validation and native stream | C, F | 300–400 | Validated Antigravity SSE becomes one correctly finalized Pi text stream | `packages/pi/src/response.ts`, `stream.ts`, and their tests |
| H — discoverable vertical slice/docs | E, G | 220–380 | Pi registers exactly one model and packed consumers can load the documented text-only provider | `packages/pi/src/provider.ts`, `extension.ts`, package/docs, and acceptance fixtures |

## A — Establish workspace and packed-distribution foundation

Allowed edit surfaces: root `package.json`, `package-lock.json`, `tsconfig*.json`, `vitest.config.ts`, `scripts/pack-*.ts` (new); `packages/core/{package.json,tsconfig.json,README.md,src/index.ts,src/index.test.ts}`; `packages/pi/{package.json,tsconfig.json,README.md}`; root `README.md` only for a short Pi-package link. Do not add Pi runtime dependencies to the root package.

- [x] Create the minimal npm workspace topology and deterministic build/typecheck/test/pack harness so root OpenCode remains independently consumable, core has an exported package surface, and clean-consumer checks fail before wiring then pass without repository-relative runtime imports. <!-- sdd-owner: implementation -->

  - **RED:** add isolated clean-consumer and workspace-test-discovery fixtures that demonstrate missing workspace exports, omitted package files, or a source-path import failure; record `npm test -- --run` only after test discovery is wired and the targeted pack fixture command.
  - **GREEN:** add root `build:opencode`, ordered `build`/`build:all`, workspace typecheck/test discovery, per-package `prepack`, ESM declarations, package files allowlists, exact core dependency, Pi peer dependency policy, and a root lockfile without relocating the root package.
  - **TRIANGULATE:** test root/core archives in a Node 20 consumer and Pi archive in a separate Node 22.19+ consumer with lifecycle scripts disabled, production-only dependencies, no workspace symlink/source/NODE_PATH, then assert emitted JS/d.ts imports and extension resource loading.
  - **REFACTOR/verify:** run `npm run build`, `npm run typecheck`, `npm test`, the explicit all-workspace build/typecheck commands added here, and the packed-consumer script; record exact results. Roll back only the allowed workspace/pack surfaces and associated lockfile changes.

## B — Extract characterized neutral core primitives without OpenCode drift

Depends on A. Allowed edit surfaces: `packages/core/src/{oauth.ts,constants.ts,headers.ts,expiry.ts,index.ts}` and colocated `*.test.ts`; `src/constants.ts`, `src/antigravity/oauth.ts`, `src/plugin/auth.ts`, `src/plugin/token.ts`, plus new/colocated characterization tests for those exact seams. Do not alter OpenCode request transformation, persistence, cache, logging, raw-response handling, or model behavior.

- [ ] Characterize existing OpenCode OAuth URL/form, refresh-form, deterministic header, and expiry behavior, then move only the neutral contracts into core while retaining equivalent root reexports/wrappers and all host-owned side effects. <!-- sdd-owner: implementation -->

  - **RED:** first add failing exported-core contract tests for `OAuthClientConfig`, authorization URL, code/refresh forms, immutable endpoints/headers, and expiry calculation; preserve baseline observations for existing wrapper cache/error behavior.
  - **GREEN:** implement core `buildAuthorizationUrl`, `buildCodeExchangeForm`, `buildRefreshForm`, `calculateTokenExpiry`, endpoint values, and deterministic header construction; replace only the designated assembly sites in `src/antigravity/oauth.ts` and `src/plugin/token.ts`, retaining same wire values and root wrapper semantics.
  - **TRIANGULATE:** compare multiple PKCE/state inputs, refresh-token inputs, platform/version header variants, and expiry boundaries against root characterization fixtures; assert core has no Pi/OpenCode SDK, filesystem, persistence, account, quota, or recovery imports.
  - **REFACTOR/verify:** run `npx vitest run packages/core/src/oauth.test.ts packages/core/src/headers.test.ts packages/core/src/expiry.test.ts src/antigravity/oauth.test.ts src/plugin/token.test.ts src/plugin/auth.test.ts`, then `npm run typecheck` and `npm test`; record exact results. Roll back core plus only the four named root seams as one unit.

## C — Implement Pi-local token and project HTTP domain operations

Depends on A. Allowed edit surfaces: `packages/pi/src/{auth-http.ts,project.ts,auth-http.test.ts,project.test.ts,types.ts}` and `packages/pi/package.json` only if a Pi-local runtime dependency is proven necessary. Use only core forms/constants/headers and injected fetch/clock; do not import `src/plugin/*`, read files, or add credential persistence.

- [ ] Add Pi-local, abort-aware OAuth exchange/refresh and per-access-token project resolution that validate responses, redact diagnostics, and return neutral/Pi credential data without accessing OpenCode account state. <!-- sdd-owner: implementation -->

  - **RED:** use mocked fetch/clock tests for token success, missing fields, non-finite expiry, rotated and absent refresh tokens, `invalid_grant`, bounded error bodies containing canary secrets, abort before/during fetch, required project response shapes, and no project-cache cross-token reuse.
  - **GREEN:** implement ten-second/remaining-attempt bounded HTTP calls, core form use, safe error kinds/status messages, refresh-token preservation, exact Pi mapping `{ refresh, access, expires }`, and `loadCodeAssist` project lookup with fixed metadata/headers and accepted project shapes only.
  - **TRIANGULATE:** assert exact request URL/form/headers for exchange, refresh, and both Windows/non-Windows project metadata; test malformed JSON, response/body aborts, redirects, missing project, and every canary’s absence from errors/loggable outputs.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/auth-http.test.ts packages/pi/src/project.test.ts` after `npm run build --workspace=@benjamolina/antigravity-guard-core`, then workspace typecheck and `npm test`; record exact results. Roll back only C’s Pi-local HTTP/project files.

## D1 — Build the bounded, loopback-only OAuth callback receiver

Depends on A. Allowed edit surfaces: `packages/pi/src/{loopback.ts,loopback.test.ts,types.ts}` and Pi-local test helpers under `packages/pi/src/test/`. No root OAuth change, no listener in manual mode, and no Google/token HTTP calls in this unit.

- [ ] Implement a single-attempt callback receiver that binds `127.0.0.1:51121`, validates one complete callback URL and state, offers safe manual fallback conditions, and closes every owned resource on all terminal paths. <!-- sdd-owner: implementation -->

  - **RED:** add fake-server/state-validator tests for wrong host/path/method/remote address, 8-KiB overflow, duplicate code/state/error parameters, code-plus-error, wrong/late state, denial, occupied port, timeout, cancellation, repeat callbacks, and socket cleanup.
  - **GREEN:** implement fixed redirect/path validation, cryptographic timing-safe state comparison after length validation, synchronous winner claiming, 30-second loopback window within a five-minute total deadline, static no-store/CSP response, listener-failure/timeout fallback signals, and idempotent timer/listener/socket cleanup.
  - **TRIANGULATE:** run a real local loopback integration fixture covering accepted callback then rebind, malformed callback then closure, cancellation during wait, and late arrival after settlement; assert manual mode opens no socket.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/loopback.test.ts` and the focused real-loopback fixture, followed by workspace typecheck; record exact results. Roll back only D1’s receiver and test-helper files.

## E — Compose the Pi OAuth lifecycle and isolated credentials

Depends on C and D1. Allowed edit surfaces: `packages/pi/src/{oauth.ts,oauth.test.ts,types.ts}` and Pi-local test helpers. It may call C/D1/core only; it must not modify or read `src/plugin/accounts.ts`, `storage.ts`, `refresh-queue.ts`, or any OpenCode credential file.

- [ ] Compose browser/loopback and manual callback-URL login, token/project completion, refresh, cancellation, single-attempt coordination, and Pi credential mapping through Pi’s OAuth lifecycle only. <!-- sdd-owner: implementation -->

  - **RED:** add deferred-callback/clock tests for browser versus manual selection, empty/rejected prompt, listener failure and expiry fallback, concurrent login busy response, cancellation at every lifecycle phase, late prompt/callback races, denied/invalid state without exchange, and no secret-bearing diagnostic.
  - **GREEN:** create independent random state/verifier/challenge per attempt, retain verifier only in attempt memory, call `onAuth` only with the authorization URL, use full callback-URL manual input, compose signals/deadlines, invoke C/D1 operations, resolve project before returning credentials, and make shared terminal cleanup idempotent.
  - **TRIANGULATE:** exercise automatic-to-manual fallback without regenerating state/verifier, refresh with Pi’s abort signal, absent refresh rotation, successful and failed project resolution, and an installed-Pi login UI fixture that proves cancellation tears down prompts/listeners without browser or account access.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/oauth.test.ts` plus the Pi OAuth compatibility fixture and workspace typecheck; record exact results. Roll back only E’s lifecycle/test files, leaving C/D1 independently testable.

## F — Serialize text-only context and frame SSE bytes

Depends on A. Allowed edit surfaces: `packages/pi/src/{context.ts,context.test.ts,sse.ts,sse.test.ts,types.ts}` and Pi-local byte/fixture helpers. No Pi registration, HTTP execution, or reuse/import of `src/plugin/core/streaming/*`.

- [ ] Implement immutable text-only context serialization with explicit unsupported-content errors and a bounded incremental UTF-8 SSE framer that preserves records across arbitrary byte boundaries. <!-- sdd-owner: implementation -->

  - **RED:** add supported system/user/assistant serialization fixtures plus pre-fetch rejection tests for tools/tool history, image, thinking, unknown blocks/roles, deferred requests, reasoning options, empty conversation, invalid generation options, and caller-context mutation; add byte-split SSE failures for malformed UTF-8, unterminated records, and records above 1 MiB.
  - **GREEN:** serialize the exact `systemInstruction`, ordered `contents`, public-to-wire model mapping, fixed request envelope/generation defaults, and text-only guards; frame BOM, LF/CRLF/bare-CR, comments, id/retry, optional data space, and multiline data using fatal incremental UTF-8 decoding.
  - **TRIANGULATE:** execute every split point of compact Unicode/multiline/CRLF fixtures, repeated identical text records, whitespace-only text, custom-header collision rejection, and 8-MiB text-bound fixture; assert no OpenCode system prompt, synthetic turn, or payload echo is introduced.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/context.test.ts packages/pi/src/sse.test.ts` and workspace typecheck; record exact results. Roll back only F’s serializer/framer files and fixtures.

## G — Validate response semantics and emit one Pi-native stream terminal

Depends on C and F. Allowed edit surfaces: `packages/pi/src/{response.ts,response.test.ts,stream.ts,stream.test.ts,types.ts}` and Pi-local stream fixtures. Do not import OpenCode response transformers, add retries/fallback, write responses to disk, or change quota/account/recovery modules.

- [ ] Implement the fixed-origin Antigravity HTTP/SSE consumer that validates response/usage semantics and emits ordered Pi partial text events with exactly one success, error, or aborted terminal outcome. <!-- sdd-owner: implementation -->

  - **RED:** use fake-fetch `Response` fixtures consumed through the real Pi event stream to fail on start/order/mutable-partial-state contract errors, public-versus-wire model misuse, invalid options/hooks/headers, non-SSE or non-2xx bodies, every HTTP class guidance case, byte-boundary aborts, malformed/truncated/empty/over-limit streams, finish-plus-error, and terminal races.
  - **GREEN:** validate fixed endpoint/model/API, merge safe headers case-insensitively, bound total/inactivity time, resolve project per generation, parse exactly one candidate/allowed text delta/metadata usage, map STOP/MAX_TOKENS, update cost/usage snapshots, and centralize finalization so `done` or `error` plus `stream.end` occurs once and `stream.result` always settles.
  - **TRIANGULATE:** cover each UTF-8 framing boundary, repeated deltas, BOM/comments/trailers/`[DONE]`, late transport errors, prompt blocks, forbidden thought/function/image output, candidate conflicts, unknown finish reasons, usage discrepancies/cache arithmetic, 401/403/404/429/RESOURCE_EXHAUSTED safe messages, and concurrent stream isolation.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/response.test.ts packages/pi/src/stream.test.ts` after core build, then workspace typecheck and `npm test`; record exact results. Roll back only G’s response/stream files and fixtures, leaving C/F separately usable.

## H — Register the complete Pi vertical slice and document safe use

Depends on E and G. Allowed edit surfaces: `packages/pi/src/{provider.ts,provider.test.ts,extension.ts,extension.test.ts}`, `packages/pi/{package.json,README.md}`, root `README.md`, `scripts/pack-*.ts`, and package/pack test fixtures created in A. Do not change root provider registration, OpenCode model definitions/resolver, or publish packages.

- [ ] Register exactly `antigravity-guard` with one public model `antigravity-gemini-3.8-flash`, wire it to `gemini-3.8-flash`, connect the completed OAuth and stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->

  - **RED:** add Pi registration/resource-loader tests that fail for missing default extension factory, asynchronous registration, zero/multiple/alternate models, wrong public descriptor metadata, wrong wire serialization, missing OAuth handlers, or packed artifacts that resolve a repository path; add docs assertions for text-only/tools, manual callback URL, account separation, fixed port, removal, and unverified live availability.
  - **GREEN:** synchronously register the legacy provider with exact name/API/model descriptor, pure factory default export only in `extension.ts`, `streamSimple` that returns immediately and owns failures, and the completed E/G handlers; write Pi/root docs covering `/login antigravity-guard`, fresh `--no-builtin-tools` text-only sessions, no active extension tools, zero/unpriced costs, independent credentials, and removal without credential deletion/revocation.
  - **TRIANGULATE:** execute an offline end-to-end fixture for login, refresh, project resolution, and streamed text; pack core/root/Pi then load the Pi resource via its host loader in a clean Node 22.19+ consumer with exact host peers and no workspace symlinks; separately import packed root/core in Node 20. Assert no peer duplication and no alternate-model substitution.
  - **REFACTOR/verify:** run targeted provider/extension tests, the packed-consumer script, `npm run build`, `npm run typecheck`, `npm test`, all-workspace build/typecheck, and `npm run test:coverage`; record exact results and any environment-backed gap. Roll back H in isolation: registration/docs/pack acceptance fixtures only; before-release rollback proceeds H → G/F → E/D1/C → B → A without resetting unrelated files.

## Final verification and release limitations

After all selected work units are applied, rerun the final H command set from a clean build state and compare root OpenCode baseline results collected before A against post-B/H results. Environment-backed `npm run test:e2e:models` and `npm run test:e2e:regression` run only with explicit account authorization; otherwise record them as unexecuted gaps. A separately authorized browser/manual login and exact-model streamed-text smoke check is required for live acceptance/release, with redacted endpoint/model evidence only. Publishing, credential deletion/revocation, account rotation, quota gating, tool support, model substitution, and OpenCode configuration changes are outside this plan.
