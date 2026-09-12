# Exploration: Add Pi Provider Adapter

## Outcome

The first delivery can preserve the existing OpenCode plugin while adding a separate Pi package, but it must not treat the current fetch interceptor as the shared core. The portable first core should be deliberately small: Antigravity OAuth/token domain operations plus transport-neutral endpoint/header/request primitives. The Pi adapter must own Pi `Context` serialization and `streamSimple` event emission; the OpenCode adapter retains fetch interception and OpenCode session/UI behavior.

## Confirmed boundaries

| Decision | Exploration consequence |
|---|---|
| Support OpenCode and Pi | Keep `@opencode-ai/plugin` imports and OpenCode client calls outside shared modules. |
| First slice: OAuth plus one functional model | Deliver one explicitly named Gemini Antigravity text-streaming model before account rotation, quota, Claude recovery, or full catalog support. |
| Pi name is `@benjamolina/pi-antigravity-guard` | It must be a Pi package with an extension entry and a `pi` manifest or conventional `extensions/` directory. |
| Shared core with separate adapters | Do not fork `pi-antigravity`; use it only as an optional MIT implementation reference if the research lane is selected. |
| Research lane unselected | This phase did not retrieve or depend on external implementation code. |

## Current architecture

```text
OpenCode request
  -> createAntigravityPlugin() in src/plugin.ts
  -> auth.loader() supplies a fetch interceptor
  -> prepareAntigravityRequest() in src/plugin/request.ts
  -> Antigravity HTTP endpoint
  -> transformAntigravityResponse() / SSE transformer
  -> OpenCode's Google-shaped response path
```

`createAntigravityPlugin()` is the composition root. It loads configuration, initializes OpenCode TUI logging, recovery, update checks, account management, provider-model discovery, and the OAuth-backed fetch loader. It is intentionally OpenCode-specific.

`prepareAntigravityRequest(input, init, accessToken, projectId, endpointOverride?, headerStyle?, forceThinkingRecovery?, options?)` consumes a Google-style intercepted `RequestInfo` and produces Antigravity request data. It combines model resolution, request wrapping, schema sanitization, thinking behavior, tool-ID handling, headers, fingerprint selection, and debug state. `transformAntigravityResponse(response, streaming, ...)` converts Antigravity envelope/SSE output back to the Google-shaped response expected by OpenCode. Neither is a Pi `streamSimple` boundary without substantial adaptation.

## Candidate reuse map

| Area | Current location | Reuse classification | First-slice treatment |
|---|---|---|---|
| OAuth authorization URL and code exchange | `src/antigravity/oauth.ts` | Nearly framework-neutral HTTP/domain code | Extract or expose through a core OAuth surface after tests. Pi calls `callbacks.onAuth()` then accepts a manually pasted callback URL/code. |
| Token refresh | `src/plugin/token.ts` | Domain logic with accidental OpenCode type coupling (`PluginClient`, provider id) | Refactor to an abort-aware core refresh function returning Pi `OAuthCredentials`; preserve an OpenCode wrapper if its cache behavior remains needed. |
| Project resolution | `src/plugin/project.ts`, OAuth exchange | Antigravity-domain HTTP behavior but current auth/cache types are OpenCode-shaped | Defer full extraction; Pi first slice may use the project id obtained during OAuth exchange or a narrow, tested resolver. |
| Endpoint constants and Antigravity/Gemini header construction | `src/constants.ts`, `src/plugin/fingerprint.ts` | Portable with configuration isolation | Make a narrow core API for endpoint selection and required headers; keep storage-backed fingerprint rotation out of the first slice. |
| Schema sanitization and model classification | `src/plugin/request-helpers.ts`, `src/plugin/transform/*` | Mostly portable transformations, but coupled to Google/OpenCode payload conventions | Preserve in place initially; extract only helpers directly used by the selected Pi model path with fixtures proving unchanged OpenCode output. |
| SSE line transformer and signature cache | `src/plugin/core/streaming/*` | Generic byte/SSE utility but emits Google-shaped payloads | Do not directly reuse as Pi output; Pi must map Antigravity chunks into Pi assistant event-stream events. |
| Models and model discovery | `src/plugin/config/models.ts`, `src/plugin.ts` | Current definitions are OpenCode-provider shaped | Define one Pi-native model descriptor only; defer shared catalog/discovery. |
| Accounts, quota, proactive refresh, disk storage | `src/plugin/accounts.ts`, `quota.ts`, `storage.ts`, `refresh-queue.ts` | Stateful domain logic tied to OpenCode auth/client and `~/.config/opencode` storage | Explicitly defer from the vertical slice. Do not share account files between hosts without a migration decision. |
| Session/tool recovery, Google Search tool, update checker, config updater, TUI logs | `recovery.ts`, `plugin.ts`, `hooks/*`, `config/updater.ts`, logger | OpenCode adapter only | Preserve unchanged and exclude from Pi first slice. |

## OpenCode coupling seams

1. `src/plugin/types.ts` imports `PluginInput` from `@opencode-ai/plugin` to define `PluginClient`; it is the primary type boundary that should not enter core.
2. `src/plugin.ts` relies on OpenCode auth loading, provider model hooks, `client.auth`, `client.session`, and `client.tui`; recovery, toasts, configuration updating, and Google Search belong behind the OpenCode adapter.
3. `src/plugin/token.ts`, `quota.ts`, and `refresh-queue.ts` accept `PluginClient` even where the operation is largely HTTP/token work; separate persistence/cache side effects from token refresh before sharing it.
4. The request path intercepts Google Generative Language URLs and returns `Response` objects. Pi supplies `Model`, `Context`, and `SimpleStreamOptions`, so its transport boundary is structurally different.
5. Storage currently includes OpenCode-specific config-path assumptions and account metadata. Reusing its rate-limit selection without changing storage ownership risks cross-host credential collisions and incompatible lifecycle semantics.

## Pi adapter requirements

Pi supports a complete native provider or legacy `pi.registerProvider(name, config)`. This slice needs the latter (or an equivalent complete provider) to register `@benjamolina/pi-antigravity-guard`'s provider identity with:

- `pi.registerProvider("<provider-id>", { models, oauth, streamSimple })` from an extension exported as the Pi package entry.
- A Pi-native model descriptor for exactly one supported Antigravity model, including `id`, `name`, `reasoning`, inputs, zero/known cost metadata, `contextWindow`, and `maxTokens`.
- OAuth callbacks compatible with Pi: `login(callbacks)` calls `callbacks.onAuth({ url })`, receives a pasted callback URL or authorization code with `callbacks.onPrompt`, exchanges it, and returns `{ refresh, access, expires }`. Pi persists these in `~/.pi/agent/auth.json`; `refreshToken(credentials, signal)` must honor the supplied signal, and `getApiKey` returns the current access token.
- `streamSimple(model, context, options)` that constructs an Antigravity request from Pi messages/tools/system prompt, sends an abort-aware request, parses Antigravity streaming output, and emits Pi events in strict order: `start`, content start/delta/end events, then `done`, or a single error terminal event.
- Package metadata: a `pi` extension declaration (or conventional extension directory); runtime dependencies under `dependencies`; Pi core packages under `peerDependencies` with `"*"` ranges, per Pi package guidance.

The existing Pi provider documentation is clear that a custom streaming API must produce Pi `AssistantMessageEventStream` events and update partial assistant state. An OpenCode `Response`/Google SSE transform is not a substitute.

## First-slice acceptance boundary

### In scope

- A distributable Pi package named `@benjamolina/pi-antigravity-guard` that Pi discovers as an extension.
- `/login` OAuth opens the Antigravity authorization URL, accepts the documented manual callback/code handoff, stores credentials through Pi, and refreshes credentials through Pi's OAuth lifecycle.
- One documented Antigravity model can be selected and completes a text-only streamed prompt through `streamSimple`.
- Cancellation returns an aborted/error terminal event without leaking an unhandled rejection.
- The existing OpenCode package still builds, type-checks, and passes its unchanged test suite.
- Core extraction has focused tests that establish equivalence for any behavior moved out of existing OpenCode modules.

### Explicit non-goals

- Multi-account rotation, shared credential-file migration, quota aggregation/fallback, verification workflows, proactive refresh, fingerprint history, session recovery, Google Search, auto-update, or OpenCode config writing in Pi.
- Claude models, replayed thinking signatures, tool calling, image inputs, dynamic model discovery, and full catalog parity in the first Pi slice.
- Replacing the OpenCode fetch interceptor or changing OpenCode model behavior as part of the Pi milestone.
- Permanently copying or forking an external `pi-antigravity` implementation.

## Strict-TDD seams

| Seam | RED test first | GREEN target |
|---|---|---|
| OAuth authorization/exchange | Mock `fetch`; verify PKCE/state, token failure, missing refresh token, project resolution fallback, and returned expiry/credentials | Extracted OAuth operations preserve today’s wire behavior. Current `oauth.ts` has no covering tests. |
| Token refresh | Mock success, `invalid_grant`, malformed failures, and an aborted signal | Pi OAuth `refreshToken` returns refreshed Pi credentials and never relies on OpenCode persistence. |
| Shared request/header primitive | Fixture exact endpoint, authorization/content headers, model and project envelope | OpenCode fixture output remains byte/structure equivalent after extraction. |
| Pi context serialization | Text-only system/user/assistant fixture and explicit unsupported-content rejection | Pi request matches the selected Antigravity model contract. |
| Pi SSE/event parser | Chunked SSE fixture with text deltas, terminal usage/stop, error body, and abort | Event ordering and partial assistant state match Pi `streamSimple` rules. |
| OpenCode regression | Run existing `src/plugin/request.test.ts`, `src/plugin/token.test.ts`, and whole suite | Existing request transformation, SSE behavior, tool ID handling, and refresh behavior remain protected. |

Existing tests cover `request.ts` and `token.ts`, while CodeGraph reports no coverage for OAuth exchange, fingerprint helpers, `TransformContext`/`TransformResult`, and several adapter-facing type surfaces. Extraction must add characterization tests before moving those untested behaviors.

## Migration and delivery risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Package topology is unresolved | The repository is currently one npm package with one build output; a separate publishable Pi package needs independent source ownership, dependency resolution, and publish files. | Decide in proposal/design whether to introduce workspaces/packages or a separately built nested package; do not publish a package that imports unpublished root source paths. |
| Core scope grows into a rewrite | `request.ts` combines host format conversion with Antigravity rules. | Enforce a minimal core and defer full transformer/account extraction. |
| OAuth callback mismatch | Existing flow can use a local listener, while Pi documents UI-neutral browser plus manual prompt callbacks. | Use Pi callback primitives for first slice; retain the local listener only in OpenCode. |
| Credential collision/leakage | Current account storage is under OpenCode configuration and contains refresh tokens. | Pi uses Pi auth persistence for its OAuth credential; do not automatically read/write OpenCode account files. |
| Stream protocol mismatch | OpenCode expects transformed `Response` objects; Pi expects event streams and partial assistant messages. | Build a Pi-specific parser/emitter with SSE fixtures rather than adapting the interceptor response object. |
| Hidden OpenCode regressions | Shared files currently mix OpenCode types and mutable cache/state. | Characterize first, move in small commits, and run full OpenCode tests/typecheck after every extraction step. |
| Review budget | A workspace conversion, core extraction, new Pi package, fixtures, and docs can exceed 400 changed lines. | Estimate proposal/tasks line budget; with `ask-on-risk`, pause for a human delivery decision if forecast exceeds 400. |

## Recommended implementation sequence

1. Proposal/specify the package topology, selected first model, and exact OAuth manual callback UX; make a delivery decision if the line estimate exceeds 400.
2. Add OAuth and refresh characterization tests, then extract only the portable contract needed by Pi.
3. Create the Pi package/extension scaffold and provider registration tests without touching OpenCode behavior.
4. Implement text-only `streamSimple` with fixture-driven request serialization and SSE event tests.
5. Run Pi package tests plus `npm run typecheck` and `npm test` for the existing OpenCode package; verify manual login/model selection against one authorized account.
6. Treat broader model support, tools, Claude thinking, accounts, and quota as follow-on changes with separate specs.
