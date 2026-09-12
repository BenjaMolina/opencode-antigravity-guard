# Exploration: Expand Pi Antigravity Model Catalog

## Outcome

The Pi package is a deliberately isolated, text-only Antigravity OAuth adapter. It currently hard-codes one public model and one Gemini request protocol in three production seams. The requested catalog needs a typed static public-to-wire registry plus per-model generation/thinking policies; simply expanding `provider.ts` would expose models that `context.ts` and `stream.ts` reject or silently route as Gemini 3.8.

No external research, OAuth flow, model call, source implementation, or dynamic discovery was performed. Findings are repository-local only.

## Confirmed retained behavior

| Public ID | Wire ID | Pi reasoning exposure | Evidence |
|---|---|---|---|
| `antigravity-gemini-3.8-flash` | `gemini-3.8-flash-tiered` | `off`, `low`, `medium`, `high`; off sends native `low` with hidden thoughts | Current Pi README records its authorized live matrix, and `provider/context/stream` tests lock the mapping. |

This mapping, its text-only rejection behavior, and its existing Pi event/SSE semantics are compatibility requirements.

## Current Pi architecture and hard-coded seams

```text
Pi extension.ts
  -> provider.ts registerProvider()
     -> static one-item Pi models array
     -> streamSimple(model, context, options)
        -> stream.ts validates one model/API
           -> context.ts validates one public ID and emits one wire ID
           -> Antigravity daily OAuth SSE endpoint
           -> response.ts parses Gemini-shaped SSE envelopes
           -> Pi assistant text/thinking events
```

- `packages/pi/src/provider.ts` owns the registered Pi descriptors. It advertises `reasoning` and `thinkingLevelMap`, but has one model constant.
- `packages/pi/src/context.ts` validates the selected model against the same one ID, declares `GenerationRequest.model` as the one literal wire ID, always adds Gemini-style `thinkingConfig`, rejects Pi `thinkingBudgets`, and only preserves signed thinking/text across messages from that exact public model.
- `packages/pi/src/stream.ts` validates the same one ID/API before transport.
- `packages/pi/src/response.ts` accepts a strict Gemini-shaped SSE envelope with one candidate, `text`/`thought` parts, optional signatures, `STOP`/`MAX_TOKENS`, and usage snapshots. It already emits both Pi text and thinking blocks.
- `packages/pi/src/provider.test.ts`, `context.test.ts`, `stream.test.ts`, and `response.test.ts` thoroughly characterize the current contract, but the registration test asserts exactly one model.

The OAuth lifecycle, subscription cost behavior, stored project, daily Antigravity endpoint, headers, cancellation, and no-tool/no-image restrictions are host-independent from the chosen model and should remain unchanged.

## Local OpenCode evidence versus Pi applicability

The OpenCode catalog in `src/plugin/config/models.ts` locally contains static entries for Gemini 3.5 Flash, 3.6 Flash Tiered, 3.7 Flash (and tiered), 3.1 Pro, Claude Sonnet 4.6, and Claude Opus 4.6 Thinking. It also contains image/pdf modalities and OpenCode variants; neither must be copied into Pi because this change remains text-only and Pi's descriptor API differs.

OpenCode model resolution is not a safe Pi registry source of truth:

- It deliberately supports Gemini CLI and Antigravity SDK/API-key routes, whereas Pi must use Antigravity OAuth/quota only.
- Gemini 3.5 has an exceptional resolver: it maps the UI name to `gemini-3.5-flash-low` or `gemini-3-flash-agent`, not a bare wire ID.
- It treats tier suffixes as thinking tiers only for Gemini and Claude-thinking names; `gpt-oss-120b-medium` deliberately must retain `medium` as part of its model ID.
- Claude variants use integer `thinkingBudget` values, while current Pi accepts only Gemini string levels and rejects `thinkingBudgets`.

The local API specification says the gateway uses a Gemini-style envelope for Claude, Gemini, and GPT-OSS, and documents historical/verified Claude wire IDs plus `gpt-oss-120b-medium`. This supports reusing the endpoint and provides a response-protocol hypothesis, but it does not establish current candidate availability, entitlement, limits, Pi maps, or every SSE shape.

## Candidate registration status

| Candidate public family | Local clues | Status before evidence |
|---|---|---|
| Gemini 3.7 Flash, 3.6 Flash, 3.5 Flash | OpenCode static catalog contains related Antigravity names and Gemini thinking levels. 3.5 has exceptional backend selection; 3.6/3.7 have competing bare/tiered names. | Do not choose a wire ID or expose Pi levels yet. |
| Gemini 3.1 Pro | OpenCode static catalog records `antigravity-gemini-3.1-pro` and low/high style variants. | Do not assume exact wire ID, supported Pi levels, or limits. |
| Claude Sonnet 4.6 | OpenCode catalog and local API spec name `claude-sonnet-4-6`; local spec indicates Gemini-style request/response framing. | Needs a no-reasoning request policy and protocol fixture/live confirmation. |
| Claude Opus 4.6 Thinking | OpenCode uses 8,192 and 32,768 numeric budgets; local API spec describes numeric `thinkingBudget`. | Requires an explicit Pi-level-to-integer-budget product policy, then protocol/live confirmation. |
| GPT-OSS 120B | No OpenCode catalog entry; local API spec records historical `gpt-oss-120b-medium`. | Requires all descriptor, wire, limits, thinking, and response evidence. |

The supplied third-party reference table remains a hypothesis. Display labels must never be used as runtime IDs.

## Evidence gate before each static registration

A candidate can be added only after a versioned evidence record supplies all of the following:

1. **Identity:** public `antigravity-*` ID, display label, exact wire ID, and confirmation that it is reachable through the Antigravity OAuth endpoint rather than Gemini CLI/API-key routing.
2. **Capabilities:** text input/output limits, whether Pi reasoning is absent/string-level/integer-budget, exact `off` behavior, and every advertised Pi reasoning level or budget mapping.
3. **Protocol fixture:** a redacted captured request/response fixture demonstrating the requested generation configuration and all relevant SSE parts, finish reason, signatures, and usage fields. A Claude or GPT fixture must prove it fits the strict Pi parser or define the smallest parser extension.
4. **Authorized live matrix:** after a human authorizes it, request a simple text turn using off plus every exposed reasoning choice; record success/failure, returned `modelVersion`, response shape, and no-tool/no-image enforcement. This is a later authorization-dependent verification activity, not a discovery feature or a runtime model-list call.
5. **Pinned source/reference reconciliation:** if a reference plugin or vendor/source documentation is selected later, pin its revision/date and reconcile any display-ID versus wire-ID difference against the live matrix. Repository-local OpenCode entries alone are insufficient.

The existing 3.8 release already meets the retained compatibility requirement described above; it must be re-characterized, not re-routed.

## Design direction after evidence exists

Introduce a Pi-local static catalog module that is the sole source for public IDs, descriptor metadata, wire IDs, limits, and a discriminated request policy. Suggested policy families are `gemini-level`, `integer-budget`, and `no-reasoning`; do not encode guessed mappings as generic string replacement.

`provider.ts` should derive registered Pi models from that catalog. `context.ts` should resolve the selected descriptor before serialization, generate the matching wire model and optional thinking configuration, preserve signatures only when the source/target descriptor policy permits it, and retain the current strict text-only validation. `stream.ts` should validate membership in the same catalog/API. Response parsing stays shared only if captured fixtures prove compatibility.

This preserves a static catalog: there is no startup model discovery, account rotation, fallback, or cross-host account storage.

## Response-protocol and replay risks

- The current response parser rejects function calls and `OTHER`; that is appropriate for a text-only first slice, but candidate text fixtures must confirm their normal finishes remain `STOP`/`MAX_TOKENS`.
- Claude and GPT may share Gemini envelopes but may differ in thought parts, signatures, metadata, or usage. Parser tolerance must be evidence-driven and narrowly tested.
- Current context replays thought signatures only for Gemini 3.8. Generalizing this without a per-model policy risks replaying a signature into a different model family; default to stripping rather than preserving absent explicit evidence.
- Sending the current mandatory Gemini `thinkingLevel` to Claude or GPT is unsafe. Sonnet likely needs no reasoning config; Opus needs numeric budgets only after a product mapping is selected and validated.

## Strict-TDD seams

1. Characterize 3.8 registration, serialized envelope, and SSE behavior before registry extraction.
2. Add catalog tests covering unique public IDs, descriptor-to-wire lookup, duplicate prevention, and 3.8's exact compatibility policy.
3. For each accepted candidate, add serializer tests for public ID, exact wire ID, text-only rejection, `off`, and every exposed reasoning mapping before implementation.
4. Add one captured SSE fixture per response-policy family and lifecycle assertions for content blocks, finish, usage, malformed frames, and safe terminal errors.
5. Update provider registration tests to assert the selected static catalog exactly; update `packages/pi/README.md` only with validated labels, IDs, limits, and reasoning behavior.
6. Run the focused Pi tests, `npm run typecheck:pi`, `npm run build:pi`, then root `npm test` and `npm run typecheck` to protect the independent OpenCode plugin.

## Safe delivery slices and review risk

The full candidate list is not a safe single change under the 400-line review budget: catalog extraction, six-plus serializer policies, fixture expansion, registration assertions, and documentation are likely well over budget and span materially different protocols.

Recommended slices, each gated by its own evidence record:

1. **Compatibility/catalog foundation:** characterize 3.8 and introduce the static registry without changing its descriptor, wire ID, or behavior.
2. **Gemini candidates:** add only evidence-validated Gemini entries, isolating 3.5 because its documented OpenCode backend mapping differs from other Flash candidates.
3. **Claude Sonnet:** add a no-reasoning policy plus its response fixture.
4. **Claude Opus Thinking:** add the explicitly approved Pi-level-to-integer-budget policy and its thought/replay fixture.
5. **GPT-OSS:** add the separate non-tier-suffix identity policy and its fixture.

At proposal time, select which evidence-validated entries belong in the first delivery and estimate actual diffs. Because delivery is `ask-on-risk`, pause for a human delivery decision if a chosen slice forecasts over 400 changed lines; do not auto-chain or infer a size exception.

## Non-goals retained

- Gemini CLI/API-key/Antigravity SDK routing, fallback, or quota-pool substitution.
- Images, PDFs, tools, tool history, multi-account rotation, account-file sharing, and dynamic model discovery.
- OAuth behavior changes, OpenCode catalog/resolver edits, publishing, or live calls in this phase.
