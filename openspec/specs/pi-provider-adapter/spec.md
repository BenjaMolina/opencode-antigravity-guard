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

The Pi provider MUST register exactly one selectable model for this slice: Gemini 3.8 Flash. Its Pi selectable/public model identifier MUST be `antigravity-gemini-3.8-flash`, matching the repository-local Antigravity model definition. For requests for that selected model, its intended Antigravity wire model identifier MUST be `gemini-3.8-flash-tiered`. This mapping MUST be treated as namespace translation, not fallback or model substitution: the provider MUST NOT expose a second tiered public model or substitute a model. Its user-facing name MUST identify Gemini 3.8 Flash. The provider MUST support text input and streamed text output for that model only. The package MUST NOT claim that either identifier's model is live, entitled, or available without separately authorized smoke evidence.

#### Scenario: Provider exposes the selected model only

- GIVEN Pi loads the installed provider
- WHEN Pi lists the provider's models
- THEN it lists Gemini 3.8 Flash with Pi selectable/public identifier `antigravity-gemini-3.8-flash` and does not list an alternate model as supported by this slice

#### Scenario: Selected model namespace is translated on the wire

- GIVEN Pi invokes the selectable/public model `antigravity-gemini-3.8-flash`
- WHEN the provider creates its Antigravity request
- THEN the request uses intended wire model identifier `gemini-3.8-flash-tiered` as namespace translation, without exposing a second public model or using fallback or model substitution

#### Scenario: Live availability remains an evidence gate

- GIVEN no authorized live smoke result is recorded
- WHEN package metadata or documentation describes either model identifier for Gemini 3.8 Flash
- THEN it identifies the selectable/public-to-wire mapping without representing either identifier's live availability or entitlement as verified

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

For Gemini 3.8 Flash, the provider MUST serialize supported system, user, and assistant text context into an Antigravity request and MUST translate streamed text into Pi-native partial-message events. The provider MUST explicitly reject tool definitions, tool calls or tool history, and image content rather than silently omitting or transforming them. Documentation MUST state that this is a text-only slice and explain that active tools are unsupported.

#### Scenario: Supported text conversation streams

- GIVEN a context containing only supported system, user, and assistant text
- WHEN Pi invokes the registered Gemini 3.8 Flash model
- THEN the provider sends equivalent text context upstream and exposes the returned text as Pi partial-message events

#### Scenario: Tool or image context is rejected

- GIVEN a context includes a tool definition, tool call or result history, or image content
- WHEN Pi invokes the provider
- THEN the provider reports the unsupported context explicitly and does not silently discard it or substitute a different model

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

## Deferred Capabilities

The following capabilities are explicitly out of scope for this change and MUST NOT be represented as supported by the Pi provider: multi-account support or rotation; quota gating, aggregation, or fallback; tools and tool execution; Claude models or thinking-signature handling; image inputs; dynamic model discovery or catalog parity; session recovery; shared credential migration or synchronization; proactive refresh; fingerprint history or rotation; Google Search; auto-updates; and OpenCode configuration writing from Pi.

#### Scenario: Deferred features are not silently enabled

- GIVEN a user attempts to use a deferred capability through the Pi provider
- WHEN the capability requires provider behavior outside this specification
- THEN the provider does not silently enable it, substitute another behavior, or claim support for it
