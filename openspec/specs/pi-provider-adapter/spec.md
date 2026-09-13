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

The Pi provider MUST register a typed, static Antigravity model catalog rather than independently maintained model allowlists. The catalog MUST be the sole source of Pi public identifiers, display metadata, exact wire identifiers, text limits, descriptor capabilities, registration order, generation policy, and thinking-signature replay policy. `provider`, request-context serialization, and stream validation MUST resolve the same catalog entry. Public identifiers MUST use the `antigravity-*` namespace; display labels MUST NOT be serialized as runtime identities; wire identifiers and generation settings MUST NOT be derived by generic string replacement.

The released catalog entry `antigravity-gemini-3.8-flash` MUST remain exactly compatible: it MUST use wire identifier `gemini-3.8-flash-tiered`; retain its released public descriptor and `off`, `low`, `medium`, and `high` reasoning choices; send native `low` reasoning with hidden thoughts when Pi reasoning is `off`; retain its text-only validation, same-model signature handling, request envelope, Gemini-shaped SSE interpretation, and Pi event lifecycle. This mapping remains namespace translation, not fallback or model substitution.

Beyond the retained 3.8 entry, the only public namespace targets eligible for admission are `antigravity-gemini-3.7-flash`, `antigravity-gemini-3.6-flash`, `antigravity-gemini-3.5-flash`, `antigravity-gemini-3.1-pro`, `antigravity-claude-sonnet-4.6`, `antigravity-claude-opus-4.6-thinking`, and `antigravity-gpt-oss-120b`. These targets are not asserted wire identities. A target or reasoning level MUST remain unregistered unless it passes the evidence gate defined by this delta; the provider MUST report the missing or conflicting evidence as a blocker rather than guess, substitute, fall back, or document it as supported. No other model target is in scope for catalog admission.

All catalog generation MUST use the existing Pi-managed credentials and the existing Antigravity OAuth endpoint and quota path only. It MUST NOT use Gemini CLI, API-key, Antigravity SDK, alternate quota pools, account rotation, hidden fallback, or model substitution.

(Previously: The provider registered exactly one selectable Gemini 3.8 Flash model and specified its public-to-wire translation.)

#### Scenario: Released Gemini 3.8 behavior is unchanged

- GIVEN Pi selects `antigravity-gemini-3.8-flash` with each released reasoning choice
- WHEN the provider registers, serializes, and streams the request
- THEN it retains the released descriptor, wire ID `gemini-3.8-flash-tiered`, native-low hidden-thought behavior for `off`, text-only rejection, signature handling, request envelope, SSE interpretation, and terminal Pi event lifecycle

#### Scenario: An unproven target is not advertised

- GIVEN an eligible target lacks any required model-level or reasoning-level evidence
- WHEN Pi lists the provider models or requests that target or level
- THEN the target or level is not registered and the provider does not guess an identity, generation setting, or substitute model

#### Scenario: Catalog routing remains Antigravity-only

- GIVEN a registered catalog model is invoked
- WHEN the provider creates and sends its generation request
- THEN it uses the existing Pi-managed Antigravity OAuth endpoint and quota path without alternate routing, quota pools, fallback, or account rotation

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

For every registered catalog entry, the provider MUST serialize supported system, user, and assistant text context using that entry's proven generation policy and MUST translate supported streamed text into Pi-native partial-message events. The provider MUST explicitly reject tool definitions, tool calls or tool history, and image content before transport; it MUST NOT silently omit or transform unsupported context, register a non-text modality, or substitute a different model. Documentation MUST describe only evidence-validated text capabilities and the text-only limitation.

Thinking signatures MUST be replayed only for a subsequent request targeting the exact same public catalog model and only when that model's replay policy is explicitly evidenced. Signatures MUST be stripped for a different model, a different model family, or any model lacking explicit replay evidence.

(Previously: Text serialization and explicit unsupported-context rejection applied only to Gemini 3.8 Flash.)

#### Scenario: Supported text conversation streams

- GIVEN a context containing only supported system, user, and assistant text for a registered catalog model
- WHEN Pi invokes that model
- THEN the provider sends equivalent text context using the model's evidenced policy and exposes returned text as Pi partial-message events

#### Scenario: Text-only validation applies to every catalog model

- GIVEN a request for any registered catalog model includes a tool definition, tool call or result history, or image content
- WHEN the provider validates the context
- THEN it rejects the request before transport without dropping the content, registering the modality, or substituting a model

#### Scenario: Signatures are not replayed across model boundaries

- GIVEN prior assistant context contains a thinking signature from one catalog model
- WHEN the next request selects a different public catalog model or a model without explicit replay evidence
- THEN the provider strips the signature before serialization

#### Scenario: Evidenced same-model replay is preserved

- GIVEN a catalog model has explicit replay evidence and prior assistant context contains its signature
- WHEN the next request selects that exact same public catalog model
- THEN the provider preserves the signature according to that model's replay policy

### Requirement: Streaming has strict terminal semantics

The provider MUST preserve the order of emitted text content and MUST update Pi's partial assistant state consistently with the emitted Pi-native events. Each stream invocation MUST emit exactly one terminal outcome: a successful completion terminal event or an error terminal event, but never both and never more than one. Cancellation, malformed or truncated streams, empty responses, upstream HTTP failures, and rate-limit or quota failures MUST terminate promptly without hanging or unhandled rejections. Rate-limit and quota failures MUST be surfaced clearly and MUST NOT trigger quota gating, account rotation, hidden fallback, or model substitution.

#### Scenario: Chunked text completes once

- GIVEN an upstream stream delivers ordered text chunks and a completion indication
- WHEN the provider maps the stream to Pi events
- THEN the text deltas preserve their upstream order, partial assistant state reflects them, and exactly one successful terminal event follows the content events

#### Scenario: Stream failure terminates once

- GIVEN an upstream stream is cancelled, malformed, truncated, empty, rate-limited, quota-limited, or fails with an HTTP error
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

A model family MAY use the shared Gemini-shaped transport and SSE parser only when its strict fixtures prove compatibility with the supported text, thought, signature, finish-reason, model-version, and usage behavior. A fixture that reveals an incompatibility MUST block registration unless a smallest necessary, family-specific, strictly tested parser behavior is specified and evidenced. Unsupported function calls, `OTHER` finishes, malformed frames, and unsupported response content MUST continue to fail under the provider's strict terminal semantics.

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
- THEN the candidate remains unregistered unless a narrowly specified and tested compatibility behavior is evidenced

### Requirement: Expanded catalog scope preserves explicit non-goals

The expanded catalog MUST remain a static, text-only Pi provider. It MUST NOT add runtime or startup model discovery, dynamic catalog mutation, model-list synchronization, images, PDFs, tools, tool history, non-text prompts, multi-account support, rotation, quota aggregation or gating, fallback, hidden model substitution, Gemini CLI routing, API-key routing, Antigravity SDK routing, OAuth login or refresh changes, credential migration, project-resolution changes, OpenCode catalog or resolver changes, root-plugin behavior changes, publishing, or credential migration. It MUST NOT claim live availability or entitlement for any identifier without the corresponding authorized evidence record.

#### Scenario: A non-goal remains unavailable

- GIVEN a user attempts to use a tool, image, dynamic model discovery, alternate credential route, or fallback through the Pi provider
- WHEN the requested behavior is outside the static text-only catalog
- THEN the provider does not silently enable it, substitute another behavior, or claim it is supported

## Deferred Capabilities

The following capabilities are explicitly out of scope for this change and MUST NOT be represented as supported by the Pi provider: multi-account support or rotation; quota gating, aggregation, or fallback; tools and tool execution; Claude models or thinking-signature handling; image inputs; dynamic model discovery or catalog parity; session recovery; shared credential migration or synchronization; proactive refresh; fingerprint history or rotation; Google Search; auto-updates; and OpenCode configuration writing from Pi.

#### Scenario: Deferred features are not silently enabled

- GIVEN a user attempts to use a deferred capability through the Pi provider
- WHEN the capability requires provider behavior outside this specification
- THEN the provider does not silently enable it, substitute another behavior, or claim support for it
