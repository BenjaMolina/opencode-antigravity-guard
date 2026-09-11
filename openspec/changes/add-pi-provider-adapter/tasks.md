# Tasks: Add Pi Provider Adapter

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,500–3,600 authored lines across eleven behavior units; lockfile churn tracked separately |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Feature-branch chain: A → B → C1 → C2 → D1 → E → F → G1 → G2a → G2b → H; C1/C2, G1/G2, and G2a/G2b are selected cohesive splits |
| Delivery strategy | ask-on-risk (maintainer-authorized native split recorded) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

The forecast exceeds the 400 changed-line review budget even though every autonomous unit is planned at or below that threshold. The maintainer selected the cohesive C1/C2, G1/G2, and native-authorized G2a/G2b splits under `ask-on-risk`; implement through the selected feature-branch chain. This plan has no effective `size:exception`.

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
| C1 — Pi token exchange/refresh HTTP | A | 190–290 | Pi safely exchanges and refreshes tokens without OpenCode storage | `packages/pi/src/auth-http.ts` and its tests |
| C2 — Pi project-resolution HTTP | A | 200–300 | Pi resolves a project per access token with exact metadata/headers and no persistence | `packages/pi/src/project.ts` and its tests |
| D1 — secure loopback receiver | A | 260–360 | A bounded loopback/manual callback receiver validates and cleans up one OAuth attempt | `packages/pi/src/loopback.ts` and its tests |
| E — Pi OAuth lifecycle | C1, C2, D1 | 260–350 | Pi login/refresh lifecycle maps isolated credentials and settles cancellation safely | `packages/pi/src/oauth.ts` and its tests |
| F — text context and byte framing | A | 230–330 | Supported text is serialized exactly and SSE bytes are framed safely | `packages/pi/src/context.ts`, `sse.ts`, and their tests |
| G1 — Antigravity SSE response semantics | F | 260–360 | SSE records are semantically validated and map candidates/text/finish/usage without HTTP or Pi lifecycle ownership | `packages/pi/src/response.ts`, `response.test.ts`, and semantic fixtures |
| G2a — fixed-origin HTTP/SSE transport | C2, F, G1 | 260–360 | Fixed-origin request validation, per-generation project lookup, bounded HTTP/SSE byte transport, and G1 semantic delivery through an injected neutral callback boundary | `packages/pi/src/stream.ts`, `stream.test.ts`, and transport fixtures |
| G2b — Pi-native stream lifecycle | G2a | 260–380 | Pi partial-event ordering, mutable snapshots, usage/cost propagation, and exactly-once terminal/result/cleanup lifecycle | `packages/pi/src/stream.ts`, `stream.test.ts`, and lifecycle fixtures |
| H — discoverable vertical slice/docs | E, G2b | 220–380 | Pi registers exactly one model and packed consumers can load the documented text-only provider | `packages/pi/src/provider.ts`, `extension.ts`, package/docs, and acceptance fixtures |

## A — Establish workspace and packed-distribution foundation

Allowed edit surfaces: root `package.json`, `package-lock.json`, `tsconfig*.json`, `vitest.config.ts`, `scripts/pack-*.ts` (new); `packages/core/{package.json,tsconfig.json,README.md,src/index.ts,src/index.test.ts}`; `packages/pi/{package.json,tsconfig.json,README.md}`; root `README.md` only for a short Pi-package link. Do not add Pi runtime dependencies to the root package.

- [x] Create the minimal npm workspace topology and deterministic build/typecheck/test/pack harness so root OpenCode remains independently consumable, core has an exported package surface, and clean-consumer checks fail before wiring then pass without repository-relative runtime imports. <!-- sdd-owner: implementation -->

  - **RED:** add isolated clean-consumer and workspace-test-discovery fixtures that demonstrate missing workspace exports, omitted package files, or a source-path import failure; record `npm test -- --run` only after test discovery is wired and the targeted pack fixture command.
  - **GREEN:** add root `build:opencode`, ordered `build`/`build:all`, workspace typecheck/test discovery, per-package `prepack`, ESM declarations, package files allowlists, exact core dependency, Pi peer dependency policy, and a root lockfile without relocating the root package.
  - **TRIANGULATE:** test root/core archives in a Node 20 consumer and Pi archive in a separate Node 22.19+ consumer with lifecycle scripts disabled, production-only dependencies, no workspace symlink/source/NODE_PATH, then assert emitted JS/d.ts imports and extension resource loading.
  - **REFACTOR/verify:** run `npm run build`, `npm run typecheck`, `npm test`, the explicit all-workspace build/typecheck commands added here, and the packed-consumer script; record exact results. Roll back only the allowed workspace/pack surfaces and associated lockfile changes.

## B — Extract characterized neutral core primitives without OpenCode drift

Depends on A. Allowed edit surfaces: `packages/core/src/{oauth.ts,constants.ts,headers.ts,expiry.ts,index.ts}` and colocated `*.test.ts`; `src/constants.ts`, `src/antigravity/oauth.ts`, `src/plugin/auth.ts`, `src/plugin/token.ts`, plus new/colocated characterization tests for those exact seams. Do not alter OpenCode request transformation, persistence, cache, logging, raw-response handling, or model behavior.

- [x] Characterize existing OpenCode OAuth URL/form, refresh-form, deterministic header, and expiry behavior, then move only the neutral contracts into core while retaining equivalent root reexports/wrappers and all host-owned side effects. <!-- sdd-owner: implementation -->

  - **RED:** first add failing exported-core contract tests for `OAuthClientConfig`, authorization URL, code/refresh forms, immutable endpoints/headers, and expiry calculation; preserve baseline observations for existing wrapper cache/error behavior.
  - **GREEN:** implement core `buildAuthorizationUrl`, `buildCodeExchangeForm`, `buildRefreshForm`, `calculateTokenExpiry`, endpoint values, and deterministic header construction; replace only the designated assembly sites in `src/antigravity/oauth.ts` and `src/plugin/token.ts`, retaining same wire values and root wrapper semantics.
  - **TRIANGULATE:** compare multiple PKCE/state inputs, refresh-token inputs, platform/version header variants, and expiry boundaries against root characterization fixtures; assert core has no Pi/OpenCode SDK, filesystem, persistence, account, quota, or recovery imports.
  - **REFACTOR/verify:** run `npx vitest run packages/core/src/oauth.test.ts packages/core/src/headers.test.ts packages/core/src/expiry.test.ts src/antigravity/oauth.test.ts src/plugin/token.test.ts src/plugin/auth.test.ts`, then `npm run typecheck` and `npm test`; record exact results. Roll back core plus only the four named root seams as one unit.

## C1 — Implement Pi-local token exchange and refresh HTTP

Depends on A. Allowed edit surfaces: `packages/pi/src/{auth-http.ts,auth-http.test.ts,types.ts}` and Pi-local HTTP test helpers under `packages/pi/src/test/`; `packages/pi/package.json` only if a Pi-local runtime dependency is proven necessary. Use only core OAuth forms/expiry and injected fetch/clock; do not import `src/plugin/*`, read files, resolve projects, or add credential persistence.

- [x] Add Pi-local, abort-aware OAuth code-exchange and refresh operations that validate token responses, preserve refresh semantics, and redact all diagnostics without accessing OpenCode account state. <!-- sdd-owner: implementation -->

  - **RED:** use mocked fetch/clock tests for code exchange and refresh success, missing access/refresh fields, non-finite or nonpositive expiry, rotated and absent refresh tokens, `invalid_grant`, bounded error bodies containing canary secrets, and abort before/during fetch or body read.
  - **GREEN:** implement ten-second/remaining-attempt bounded token calls using core forms/expiry, redirect-error handling, safe allowlisted error kinds/status messages, exact Pi credential mapping `{ refresh, access, expires }`, and prior-refresh preservation when rotation is absent.
  - **TRIANGULATE:** assert exact token endpoint/forms/redirect URI for exchange and refresh; test malformed JSON, redirect responses, HTTP/body aborts, transport failures, and every canary’s absence from errors/loggable outputs.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/auth-http.test.ts` after `npm run build --workspace=@benjamolina/antigravity-guard-core`, then the Pi workspace typecheck and `npm test`; record exact results. Roll back only C1’s auth HTTP, types limited to its contract, and HTTP test-helper files.

## C2 — Implement Pi-local per-access-token project resolution

Depends on A. Allowed edit surfaces: `packages/pi/src/{project.ts,project.test.ts,types.ts}` and Pi-local HTTP test helpers under `packages/pi/src/test/`. Use only core endpoint/header primitives and injected fetch/clock; do not import `src/plugin/*`, invoke C1, read files, cache project results, or add credential persistence.

- [x] Add Pi-local, abort-aware `loadCodeAssist` project resolution that sends exact Antigravity metadata and headers for each access token, accepts only supported project shapes, and redacts failures. <!-- sdd-owner: implementation -->

  - **RED:** use mocked fetch/clock tests for accepted nonempty `cloudaicompanionProject` string and `.id` shapes, missing/empty/invalid projects, per-access-token isolation with no cache reuse, bounded error bodies with canary secrets, and abort before/during fetch or body read.
  - **GREEN:** implement ten-second/remaining-attempt bounded `POST https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist` calls with fixed Antigravity metadata, deterministic Gemini CLI/Antigravity headers, redirect-error handling, safe allowlisted error kinds/status messages, and no persisted project data.
  - **TRIANGULATE:** assert exact URL/body/headers for Windows and non-Windows platform mapping; test malformed JSON, redirects, 401/403 guidance, HTTP/body aborts, transport failures, and every canary’s absence from errors/loggable outputs.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/project.test.ts` after `npm run build --workspace=@benjamolina/antigravity-guard-core`, then the Pi workspace typecheck and `npm test`; record exact results. Roll back only C2’s project resolver, types limited to its contract, and HTTP test-helper files.

## D1 — Build the bounded, loopback-only OAuth callback receiver

Depends on A. Allowed edit surfaces: `packages/pi/src/{loopback.ts,loopback.test.ts,types.ts}` and Pi-local test helpers under `packages/pi/src/test/`. No root OAuth change, no listener in manual mode, and no Google/token HTTP calls in this unit.

- [x] Implement a single-attempt callback receiver that binds `127.0.0.1:51121`, validates one complete callback URL and state, offers safe manual fallback conditions, and closes every owned resource on all terminal paths. <!-- sdd-owner: implementation -->

  - **RED:** add fake-server/state-validator tests for wrong host/path/method/remote address, 8-KiB overflow, duplicate code/state/error parameters, code-plus-error, wrong/late state, denial, occupied port, timeout, cancellation, repeat callbacks, and socket cleanup.
  - **GREEN:** implement fixed redirect/path validation, cryptographic timing-safe state comparison after length validation, synchronous winner claiming, 30-second loopback window within a five-minute total deadline, static no-store/CSP response, listener-failure/timeout fallback signals, and idempotent timer/listener/socket cleanup.
  - **TRIANGULATE:** run a real local loopback integration fixture covering accepted callback then rebind, malformed callback then closure, cancellation during wait, and late arrival after settlement; assert manual mode opens no socket.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/loopback.test.ts` and the focused real-loopback fixture, followed by workspace typecheck; record exact results. Roll back only D1’s receiver and test-helper files.

## E — Compose the Pi OAuth lifecycle and isolated credentials

Depends on C1, C2, and D1. Allowed edit surfaces: `packages/pi/src/{oauth.ts,oauth.test.ts,types.ts}` and Pi-local test helpers. It may call C1/C2/D1/core only; it must not modify or read `src/plugin/accounts.ts`, `storage.ts`, `refresh-queue.ts`, or any OpenCode credential file.

- [x] Compose browser/loopback and manual callback-URL login, token/project completion, refresh, cancellation, single-attempt coordination, and Pi credential mapping through Pi’s OAuth lifecycle only. <!-- sdd-owner: implementation -->

  - **RED:** add deferred-callback/clock tests for browser versus manual selection, empty/rejected prompt, listener failure and expiry fallback, concurrent login busy response, cancellation at every lifecycle phase, late prompt/callback races, denied/invalid state without exchange, and no secret-bearing diagnostic.
  - **GREEN:** create independent random state/verifier/challenge per attempt, retain verifier only in attempt memory, call `onAuth` only with the authorization URL, use full callback-URL manual input, compose signals/deadlines, invoke C1/C2/D1 operations, resolve project before returning credentials, and make shared terminal cleanup idempotent.
  - **TRIANGULATE:** exercise automatic-to-manual fallback without regenerating state/verifier, refresh with Pi’s abort signal, absent refresh rotation, successful and failed project resolution, and an installed-Pi login UI fixture that proves cancellation tears down prompts/listeners without browser or account access.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/oauth.test.ts` plus the Pi OAuth compatibility fixture and workspace typecheck; record exact results. Roll back only E’s lifecycle/test files, leaving C1/C2/D1 independently testable.

## F — Serialize text-only context and frame SSE bytes

Depends on A. Allowed edit surfaces: `packages/pi/src/{context.ts,context.test.ts,sse.ts,sse.test.ts,types.ts}` and Pi-local byte/fixture helpers. No Pi registration, HTTP execution, or reuse/import of `src/plugin/core/streaming/*`.

- [x] Implement immutable text-only context serialization with explicit unsupported-content errors and a bounded incremental UTF-8 SSE framer that preserves records across arbitrary byte boundaries. <!-- sdd-owner: implementation -->

  - **RED:** add supported system/user/assistant serialization fixtures plus pre-fetch rejection tests for tools/tool history, image, thinking, unknown blocks/roles, deferred requests, reasoning options, empty conversation, invalid generation options, and caller-context mutation; add byte-split SSE failures for malformed UTF-8, unterminated records, and records above 1 MiB.
  - **GREEN:** serialize the exact `systemInstruction`, ordered `contents`, public-to-wire model mapping, fixed request envelope/generation defaults, and text-only guards; frame BOM, LF/CRLF/bare-CR, comments, id/retry, optional data space, and multiline data using fatal incremental UTF-8 decoding.
  - **TRIANGULATE:** execute every split point of compact Unicode/multiline/CRLF fixtures, repeated identical text records, whitespace-only text, custom-header collision rejection, and 8-MiB text-bound fixture; assert no OpenCode system prompt, synthetic turn, or payload echo is introduced.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/context.test.ts packages/pi/src/sse.test.ts` and workspace typecheck; record exact results. Roll back only F’s serializer/framer files and fixtures.

## G1 — Validate pure Antigravity SSE response/event semantics

Depends on F. Allowed edit surfaces: `packages/pi/src/{response.ts,response.test.ts,types.ts}` and Pi-local response semantic fixtures. G1 consumes framed SSE records from F and returns validated semantic deltas, finish, and usage results; it performs no fetch, project resolution, Pi event emission, stream finalization, or lifecycle ownership. Do not import OpenCode response transformers, add retries/fallback, write responses to disk, or change quota/account/recovery modules.

- [x] Implement and verify the behavior in `packages/pi/src/response.ts`: validate Antigravity SSE response events and map one candidate’s allowed text deltas, STOP/MAX_TOKENS finish, and cumulative usage snapshots into pure semantic results. <!-- sdd-owner: implementation -->

  - **RED:** add pure framed-record fixtures that fail for malformed/empty/truncated JSON, response/top-level errors, prompt blocks, multiple/conflicting candidates, forbidden thought/function/image/file output, unknown parts or finish reasons, finish-plus-error, missing finish/text, malformed usage, cache arithmetic, and `[DONE]` before valid finish.
  - **GREEN:** parse each record once as unknown JSON; accept one candidate (index absent or zero), preserve repeated/whitespace text deltas, permit validated metadata-only records, map STOP/MAX_TOKENS, and normalize cumulative usage without double addition.
  - **TRIANGULATE:** cover BOM/comments/trailers/`[DONE]`, repeated deltas, candidate conflicts, late text/second finish/error after finish, response ID/model metadata, usage omission/discrepancy/cache bounds, and all forbidden output kinds.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/response.test.ts` after the core build and Pi workspace typecheck; record exact results. Roll back only G1 response semantics, G1-limited types, and semantic fixtures, leaving F independently usable.

## G2a — Execute fixed-origin HTTP/SSE transport through a neutral callback boundary

Depends on C2, F, and G1. Allowed edit surfaces: `packages/pi/src/{stream.ts,stream.test.ts,types.ts}` and Pi-local transport fixtures. G2a validates the fixed request/API/model/header/status/content-type contract, resolves the project for every generation, bounds HTTP/SSE byte transport through F, and delivers G1 semantic results through an injected framework-neutral callback boundary. It MUST NOT emit Pi events, mutate Pi assistant snapshots, finalize a Pi event stream, settle `stream.result`, or own Pi terminal lifecycle behavior. Do not modify `response.ts` except through a separately authorized G1 correction; do not import OpenCode response transformers, add retries/fallback, write responses to disk, or change quota/account/recovery modules.

- [x] Implement and verify the behavior in `packages/pi/src/stream.ts`: validate and execute the fixed Antigravity HTTP/SSE request, then deliver bounded G1 semantic results through an injected neutral callback boundary without Pi terminal lifecycle ownership. <!-- sdd-owner: implementation -->

  - **RED:** use injected fetch, project resolver, clock, and semantic callback fixtures to fail on public-versus-wire model/API/endpoint misuse, protected-header collisions, invalid options/hooks, per-generation project reuse, non-SSE or non-2xx responses, HTTP guidance classes, byte-boundary aborts, and G1 semantic failures.
  - **GREEN:** validate fixed origin/model/API and case-insensitive protected headers; resolve the project per generation; apply total/inactivity bounds; inspect bounded HTTP failures; consume F framing and G1 semantics; and invoke only the injected neutral callback for semantic delivery.
  - **TRIANGULATE:** cover 401/403/404/429/RESOURCE_EXHAUSTED guidance, content-type parameters, hook failures, custom-header collisions, every relevant F byte boundary, late transport errors, and cancellation/reader cleanup without emitting or finalizing Pi events.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/stream.test.ts` after core build, then Pi workspace typecheck and `npm test`; record exact results. Roll back only G2a transport/callback behavior, G2a-limited types, and transport fixtures, leaving C2/F/G1 separately usable.

## G2b — Own Pi-native partial events and exactly-once stream lifecycle

Depends on G2a. Allowed edit surfaces: `packages/pi/src/{stream.ts,stream.test.ts,types.ts}` and Pi-local lifecycle fixtures. G2b consumes G2a's neutral semantic callback boundary and owns only Pi-native output adaptation: partial event ordering, mutable assistant snapshots, usage/cost propagation, abort/error/done exactly-once finalization, result settlement, and race/concurrency cleanup. It MUST NOT duplicate G2a fixed-origin validation, project resolution, HTTP status/content-type handling, or byte transport. Do not import OpenCode response transformers, add retries/fallback, write responses to disk, or change quota/account/recovery modules.

- [x] Implement and verify the behavior in `packages/pi/src/stream.ts`: consume G2a semantic delivery to emit ordered Pi partial text events, maintain mutable snapshots and usage/cost, and finalize done, error, or aborted outcomes exactly once with settled results and cleanup. <!-- sdd-owner: implementation -->

  - **RED:** use real Pi event-stream fixtures backed by injected G2a callbacks to fail on start/text_start/text_delta/text_end ordering, shared mutable partial snapshots, usage/cost updates, missing result settlement, abort/error/done races, duplicate terminals, concurrent stream interference, and mutation after terminal.
  - **GREEN:** adapt G2a callbacks into Pi events; append and mutate the live text part before each delta; update cumulative usage and Pi cost; centralize guarded finalization; and ensure `stream.end`, error/done outcome, result settlement, transport cancellation, and cleanup execute once.
  - **TRIANGULATE:** cover success STOP/MAX_TOKENS, transport or semantic errors before and after finish, abort before/during delivery, empty/error setup, caller-supplied abort cleanup (Pi EventStream exposes no observable consumer-abandonment hook), concurrent streams, and cleanup rejection handling while preserving delivered text and usage safely.
  - **REFACTOR/verify:** run `npx vitest run packages/pi/src/stream.test.ts` after core build, then Pi workspace typecheck and `npm test`; record exact results. Roll back only G2b Pi lifecycle adaptation, G2b-limited types, and lifecycle fixtures, leaving G2a independently testable.

## H — Register the complete Pi vertical slice and document safe use

Depends on E and G2b. Allowed edit surfaces: `packages/pi/src/{provider.ts,provider.test.ts,extension.ts,extension.test.ts}`, `packages/pi/{package.json,README.md}`, root `README.md`, `scripts/pack-*.ts`, and package/pack test fixtures created in A. Do not change root provider registration, OpenCode model definitions/resolver, or publish packages.

- [ ] Register exactly `antigravity-guard` with one public model `antigravity-gemini-3.8-flash`, wire it to `gemini-3.8-flash`, connect the completed OAuth and G2b stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->

  - **RED:** add Pi registration/resource-loader tests that fail for missing default extension factory, asynchronous registration, zero/multiple/alternate models, wrong public descriptor metadata, wrong wire serialization, missing OAuth handlers, or packed artifacts that resolve a repository path; add docs assertions for text-only/tools, manual callback URL, account separation, fixed port, removal, and unverified live availability.
  - **GREEN:** synchronously register the legacy provider with exact name/API/model descriptor, pure factory default export only in `extension.ts`, `streamSimple` that returns immediately and owns failures, and the completed E/G handlers; write Pi/root docs covering `/login antigravity-guard`, fresh `--no-builtin-tools` text-only sessions, no active extension tools, zero/unpriced costs, independent credentials, and removal without credential deletion/revocation.
  - **TRIANGULATE:** execute an offline end-to-end fixture for login, refresh, project resolution, and streamed text; pack core/root/Pi then load the Pi resource via its host loader in a clean Node 22.19+ consumer with exact host peers and no workspace symlinks; separately import packed root/core in Node 20. Assert no peer duplication and no alternate-model substitution.
  - **REFACTOR/verify:** run targeted provider/extension tests, the packed-consumer script, `npm run build`, `npm run typecheck`, `npm test`, all-workspace build/typecheck, and `npm run test:coverage`; record exact results and any environment-backed gap. Roll back H in isolation: registration/docs/pack acceptance fixtures only; before-release rollback proceeds H → G/F → E/D1/C2/C1 → B → A without resetting unrelated files.

## Final verification and release limitations

After all selected work units are applied, rerun the final H command set from a clean build state and compare root OpenCode baseline results collected before A against post-B/H results. Environment-backed `npm run test:e2e:models` and `npm run test:e2e:regression` run only with explicit account authorization; otherwise record them as unexecuted gaps. A separately authorized browser/manual login and exact-model streamed-text smoke check is required for live acceptance/release, with redacted endpoint/model evidence only. Publishing, credential deletion/revocation, account rotation, quota gating, tool support, model substitution, and OpenCode configuration changes are outside this plan.
