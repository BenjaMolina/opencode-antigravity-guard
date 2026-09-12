# Proposal: Add a Pi Antigravity provider without changing OpenCode

## Intent

Enable Pi users to authenticate with Antigravity and stream text from Gemini 3.8 Flash through `@benjamolina/pi-antigravity-guard`, while preserving the existing OpenCode package and behavior. Share a small framework-neutral core rather than maintaining a permanent external fork or forcing Pi through OpenCode's fetch interceptor.

This is a text-only vertical slice, not full coding-agent or provider feature parity.

## Authority and readiness

- Change: `add-pi-provider-adapter`.
- Inputs: [explore.md](explore.md), [preproposal.md](preproposal.md), and [project configuration](../../config.yaml), plus repository AGENTS.md standards.
- Product discovery is confirmed by the orchestrator; no further proposal interview is required. Research is unselected.
- The pre-proposal handoff supersedes exploration's unresolved package topology and manual-only OAuth recommendation: use npm workspaces and automatic loopback callback handling with manual callback-URL fallback.
- This artifact proposes work only. It does not authorize implementation, publishing, external-account testing, or a review-budget exception.

## Scope

### Package boundaries

| Area | Responsibility |
|---|---|
| Repository root | Keep the existing OpenCode npm package, entry points, fetch interception, and host-specific behavior. Add workspace wiring without relocating the package. |
| `packages/core` | Share only the OAuth/token domain operations and endpoint/header/request primitives needed by both adapters. No Pi/OpenCode SDK types, host UI, host persistence, or account-selection state. |
| `packages/pi` | Publishable package named `@benjamolina/pi-antigravity-guard`; owns Pi extension registration, OAuth interaction, credential mapping, text-context serialization, and Pi streaming events. |

Both adapters consume the shared core. Existing OpenCode wrappers retain host-specific cache and persistence behavior. Core functions return neutral domain data, not Pi OAuth credential types. Avoid wholesale extraction of the existing request transformer or streaming response converter.

The Pi package must declare discoverable extension resources and installable runtime dependencies. A packed installation must not depend on unpublished repository-relative source paths. Core package naming, exports, and distribution mechanics remain design details.

### Authentication

- Offer automatic loopback callback completion for local browser login and manual callback-URL fallback for SSH/headless use or unavailable local callbacks.
- Preserve PKCE and validate OAuth state for both paths. Bind only to loopback, bound the wait, reject invalid callbacks, and clean up listeners on completion, failure, or cancellation.
- Map core results into Pi's OAuth lifecycle and delegate credential persistence to Pi. Refresh must honor cancellation and return actionable authentication errors without exposing secrets.
- Keep Pi credentials separate from OpenCode account files; do not import, migrate, or synchronize existing accounts.
- Resolve the Antigravity project context required for requests through a narrow domain operation; do not import the full OpenCode account-management system.

### One functional model

- Register Gemini 3.8 Flash as the single supported Pi model, with text input and streamed text output.
- Serialize supported system, user, and assistant text context into Antigravity requests and translate response chunks into Pi-native partial-message events.
- Preserve event ordering and emit exactly one terminal success or error event. Handle cancellation, malformed/truncated streams, empty responses, and upstream failures without hanging or unhandled rejections.
- Report unsupported tools, tool history, and image content explicitly rather than silently discarding user context. Document how to use this text-only slice without active tools.
- Surface rate-limit/quota failures clearly; do not add quota gating, account rotation, or hidden model substitution.

The model choice is confirmed, but its exact upstream identifier, availability, limits, and metadata have not been verified by these artifacts. Specification/design must establish these from evidence; an unavailable model is a blocker, not permission to select another model.

### Explicit non-goals

Multi-account support, quota gating/aggregation/fallback, tools, Claude, images, dynamic discovery, recovery, shared credential migration, proactive refresh, fingerprint history/rotation, Google Search, auto-updates, and OpenCode configuration writing from Pi are deferred. No permanent external fork, replacement of the OpenCode fetch interceptor, or changes to existing OpenCode model behavior are included.

## Affected areas

These are anticipated touchpoints from exploration, not a mandate to edit every listed module.

| Area | Expected impact |
|---|---|
| Root package manifest, lockfile, TypeScript/build and test configuration | Add workspaces, build ordering, dependency resolution, and discovery of workspace tests while preserving root install/build behavior. |
| `src/antigravity/oauth.ts`, `src/plugin/token.ts` | Characterize and extract minimal neutral auth operations; retain OpenCode-specific wrappers. |
| `src/constants.ts`, request/header/project seams | Reuse only required primitives with equivalence fixtures; preserve existing transformations. |
| `packages/core`, `packages/pi` | New package surfaces, adapter behavior, focused tests, and package metadata. |
| User documentation | Explain installation, login/fallback, model selection, limitations, account separation, and removal. |

OpenCode account storage, quota routing, recovery, and UI remain owned by the root adapter. No storage migration or shared locking scheme is proposed.

## Risks and mitigations

| Risk | Mitigation / gate |
|---|---|
| Workspace wiring and extraction regress OpenCode or break published imports | Characterization tests before extraction, root regression suite, and packed-package install checks. Keep the shared surface minimal. |
| Gemini 3.8 Flash upstream contract is unverified | Verify identifier, entitlement, and limits before implementing the model descriptor; report a blocker if unavailable. |
| OAuth callback interception, stale state, listener leaks, or credential disclosure | PKCE/state checks on both paths, loopback-only binding, bounded cleanup, redacted diagnostics, and separate Pi persistence. |
| External service/account safety | Live login and generation use an explicitly authorized account and may consume quota or encounter provider policy restrictions. No automated account testing, account rotation, or publishing is authorized here. |
| Pi expects events rather than OpenCode-shaped HTTP responses | Implement an adapter-owned event mapping with chunk-boundary, terminal-event, and abort fixtures. Confirm the supported Pi API version during design. |
| Text-only scope surprises coding-agent users | Document the lack of tools and reject unsupported context clearly; do not market this slice as full agent support. |
| Scope exceeds the 400 changed-line budget | Workspace wiring, extraction, streaming, tests, and docs together are likely to exceed the budget. Parent must obtain a delivery decision before implementation; no chain strategy or `size:exception` is inferred. |

## Rollback

Before release, revert only this change's workspace wiring, adapter additions, and core extraction as coherent work units, restoring root imports and lockfile/build configuration together. Do not reset unrelated working-tree changes, especially `.atl/*` and `.gitignore`.

After installation, disabling or removing the Pi package stops its registration without changing OpenCode. Credentials remain Pi-managed; removal must not silently delete credentials or revoke tokens. If a released extraction regresses OpenCode, restore the last known-good root package and compatible dependencies through a corrective release. Publishing or unpublishing requires separate authorization.

## Success criteria

- [ ] Root OpenCode package identity and entry points remain intact; both workspaces resolve without unpublished source-path dependencies.
- [ ] A packed Pi package is discoverable as `@benjamolina/pi-antigravity-guard` and registers exactly the supported Gemini 3.8 Flash model.
- [ ] Local loopback login and SSH/headless manual callback-URL login complete; invalid state, denied authorization, listener failure, timeout, and cancellation fail safely.
- [ ] Pi persists and refreshes its own credentials; OpenCode credential files are not read or modified by Pi.
- [ ] An authorized live smoke check proves Gemini 3.8 Flash produces streamed text, with the exact upstream identifier recorded. If authorization/environment is unavailable, record the verification gap rather than claiming functional proof.
- [ ] Fixture tests cover text serialization, unsupported content, chunked/Unicode SSE, empty or truncated output, HTTP errors, terminal usage/stop handling, and cancellation with one terminal event.
- [ ] Core contains no host SDK or persistence dependencies; moved behavior has characterization/equivalence coverage.
- [ ] Existing OpenCode build, typecheck, and tests pass; workspace tests are explicitly discovered and run. Strict TDD follows RED, GREEN, TRIANGULATE, REFACTOR for behavioral changes.
- [ ] Documentation describes text-only limits, authentication fallback, account separation, and removal; unrelated dirty files remain untouched.

## Delivery and next step

Proceed to specification with Given/When/Then scenarios and RFC 2119 requirements, then design the neutral core contract, OAuth lifecycle, package distribution, and Pi event mapping. No production code is changed in this phase.

Delivery remains `ask-on-risk` with a 400 changed-line review budget. The likely over-budget implementation requires the parent to pause for a human delivery decision before apply. Specification/design may refine the estimate; neither multiple small tasks nor this proposal constitutes approval for chaining or an oversized PR.

## Evidence limits

This proposal uses the recorded exploration rather than claiming a fresh codebase audit. Installed Pi custom-provider and package documentation were read to check OAuth/event and packaging expectations. No CodeGraph query, shell command, test, build, live OAuth flow, or model request was executed during this phase.
