# Delta for Pi Provider Adapter

## MODIFIED Requirements

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

## ADDED Requirements

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
