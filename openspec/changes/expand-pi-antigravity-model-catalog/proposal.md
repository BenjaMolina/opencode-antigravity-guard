# Proposal: Expand Pi's evidence-gated Antigravity model catalog

## Intent

Expand `@benjamolina/pi-antigravity-guard` from its single-model registration to a static, typed catalog for selected Gemini, Claude, and GPT-OSS models. Every registered model and reasoning level must be proven against the Antigravity OAuth/quota path before Pi advertises it, while the released Gemini 3.8 Flash mapping and behavior remain exactly compatible.

This change improves model choice for Pi users without turning the adapter into a dynamic discovery client or broadening its current text-only boundary.

## Authority and readiness

- Change: `expand-pi-antigravity-model-catalog`.
- Inputs: [explore.md](explore.md), the confirmed pre-proposal handoff, and [project configuration](../../config.yaml).
- Product decisions are confirmed by the orchestrator; no proposal interview is required.
- Research was not selected. This proposal relies on repository-local exploration and does not claim external research or current upstream availability.
- `Rahularya01/pi-antigravity` is a pinned-reference hypothesis only. Its exact revision and claims must be inspected and reconciled during later evidence work; it is not authoritative on its own.
- The user has authorized later read-only Antigravity account model discovery and bounded text-only smoke requests using their existing Pi credentials and quota. This proposal performs and authorizes no call beyond that stated later scope.

## Scope

### Static catalog and compatibility boundary

Introduce one Pi-local typed catalog as the source of truth for:

- public `antigravity-*` IDs and display metadata;
- exact evidence-derived Antigravity wire IDs;
- text limits and descriptor capabilities;
- generation policy, including no reasoning, string reasoning levels, or integer thinking budgets;
- safe thinking/signature replay behavior; and
- static registration order or priority.

`provider.ts` must derive Pi descriptors from this catalog. `context.ts` and `stream.ts` must resolve and validate the same entries instead of maintaining independent model allowlists. Request serialization must use a discriminated per-model policy rather than deriving wire IDs or reasoning settings through generic string replacement.

The existing public ID `antigravity-gemini-3.8-flash` must continue to use wire ID `gemini-3.8-flash-tiered`. Its public descriptor, `off`/`low`/`medium`/`high` choices, native-low request behavior when Pi reasoning is off, hidden-thought behavior, text-only validation, signature handling, request envelope, SSE interpretation, and Pi event lifecycle must remain unchanged.

### Target catalog

The intended static catalog adds these public model targets:

| Public target | Registration boundary |
|---|---|
| `antigravity-gemini-3.7-flash` | Exact wire identity, limits, and each reasoning level remain evidence-gated. |
| `antigravity-gemini-3.6-flash` | Bare versus tiered backend identity and each reasoning level remain evidence-gated. |
| `antigravity-gemini-3.5-flash` | Exceptional backend selection must be resolved without copying OpenCode's resolver assumptions. |
| `antigravity-gemini-3.1-pro` | Exact wire identity, limits, and each reasoning level remain evidence-gated. |
| `antigravity-claude-sonnet-4.6` | Reasoning configuration and response compatibility must be proven; no Gemini setting is assumed. |
| `antigravity-claude-opus-4.6-thinking` | Every exposed Pi level must have a proven integer-budget mapping. |
| `antigravity-gpt-oss-120b` | The complete identity, descriptor, reasoning policy, limits, and response contract remain evidence-gated. |

These are public namespace targets, not asserted wire IDs. Display labels must never be serialized as runtime identities. If evidence cannot establish a candidate or level, it must remain unregistered and be reported as a blocker rather than guessed, substituted, or documented as supported.

### Registration evidence gate

A model may enter the static Pi catalog only after a versioned, redacted evidence record reconciles all four required sources:

1. **Pinned reference:** record the exact revision/date inspected from `Rahularya01/pi-antigravity` and distinguish display IDs, public IDs, and proposed wire IDs.
2. **Account discovery:** use the authorized read-only Antigravity discovery path to confirm that the existing Pi account can see the candidate through the Antigravity OAuth/quota service. Discovery is evidence collection only and must not become runtime dynamic registration.
3. **Strict fixtures:** capture and redact the exact request and response shape for the model and each proposed level, including wire ID, generation configuration, text/thought parts, signatures when present, finish reason, model version, and usage fields. Fixtures must either pass the current strict parser or justify the smallest family-specific parser change.
4. **Authorized live smoke:** issue only bounded text-only calls with the existing Pi credentials, covering reasoning off and every level proposed for exposure. Record success or failure without recording credentials or sensitive account data.

The gate is per model and per advertised reasoning level. A successful call at one level does not authorize registration of another. Evidence must also show that requests use the existing Antigravity OAuth endpoint and quota, not Gemini CLI, API-key, Antigravity SDK, fallback, or substituted routing.

No new discretionary reasoning mapping may be invented during specification or implementation. If provider evidence does not uniquely establish a safe mapping, that level remains unavailable pending a separately confirmed product decision.

### Text-only request and response behavior

The expanded catalog remains text input and streamed text output only. Unsupported images, tools, tool calls, and tool history must continue to fail explicitly before transport. Model-family request configuration must be narrowly selected from the catalog policy; the current Gemini `thinkingLevel` must not be sent to Claude or GPT-OSS by default.

The Gemini-shaped transport and shared SSE parser may remain shared only where strict fixtures prove compatibility. Family-specific differences in thought parts, signatures, metadata, finish reasons, or usage must be handled narrowly and tested. In the absence of explicit replay evidence, thinking signatures must be stripped rather than replayed across models or model families.

The current OAuth lifecycle, stored project, daily Antigravity endpoint, headers, cancellation behavior, quota error surfacing, subscription-cost behavior, and Pi terminal-event semantics remain unchanged.

### Non-goals

- Runtime or startup model discovery, dynamic catalog mutation, or automatic catalog synchronization.
- Images, PDFs, tools, tool history, or broader coding-agent capability.
- Multi-account support, rotation, quota aggregation/gating, fallback, or hidden model substitution.
- Gemini CLI, API-key, Antigravity SDK, or alternate quota-pool routing.
- Changes to OAuth login/refresh, credential persistence, project resolution, OpenCode model catalogs/resolvers, or root-plugin behavior.
- Unbounded probes, performance/load tests, non-text prompts, publishing, or credential migration.

## Capability changes

### Modified capability

- `pi-provider-adapter`: replace the requirement to register exactly one model with an evidence-gated static catalog, add per-model request/reasoning policies, and retain all existing authentication, text-only, streaming, isolation, and Gemini 3.8 compatibility requirements.

### New capabilities

None. Evidence collection is a release gate for the existing Pi provider capability, not a runtime discovery feature.

## Affected areas

These are expected seams from exploration, not permission to broaden implementation.

| Area | Expected impact |
|---|---|
| `packages/pi/src/provider.ts` | Derive registered descriptors and priority from the static catalog while preserving Gemini 3.8 metadata. |
| New Pi-local catalog module and tests | Define typed public-to-wire mappings, limits, and discriminated generation/replay policies; reject duplicate IDs. |
| `packages/pi/src/context.ts` | Resolve catalog entries and serialize only their proven model-family policy while preserving strict text-only rejection. |
| `packages/pi/src/stream.ts` | Validate supported model/API membership through the shared catalog without changing transport or OAuth behavior. |
| `packages/pi/src/response.ts` | Change only if strict Claude or GPT-OSS fixtures prove a minimal compatibility gap. |
| Pi provider/context/stream/response tests and redacted fixtures | Characterize Gemini 3.8 and prove every accepted candidate and advertised reasoning level. |
| `packages/pi/README.md` | Document only evidence-validated public IDs, text limits, reasoning choices, and text-only limitations. |
| `openspec/specs/pi-provider-adapter/spec.md` | Replace the one-model requirement and remove only the model deferrals proven by this change. |

Root OpenCode catalogs, routing, quota systems, recovery, account storage, and request interception remain unchanged and require regression verification only.

## Risks and mitigations

| Risk | Mitigation / gate |
|---|---|
| A display name or stale third-party mapping is mistaken for a wire identity | Treat the pinned reference as a hypothesis and require discovery, strict fixtures, and live reconciliation before registration. |
| A model is advertised despite missing entitlement or an unsupported reasoning level | Apply the gate independently to each model and level; absent or conflicting evidence blocks registration rather than triggering fallback. |
| Gemini 3.8 behavior regresses during catalog extraction | Add characterization tests first and require exact descriptor, wire, request, reasoning-off, signature, SSE, and event compatibility. |
| Gemini configuration is sent to Claude or GPT-OSS | Use discriminated request policies with exhaustive serializer tests; omit unproven reasoning configuration. |
| Claude or GPT-OSS responses violate the strict Gemini-shaped parser | Require redacted fixtures before parser edits and permit only the smallest tested family-specific tolerance. |
| Thinking signatures are replayed into an incompatible model or family | Default to stripping; enable replay only for explicitly proven source/target policy. |
| External calls consume quota or expose account data | Limit later calls to authorized read-only discovery and bounded text-only smoke cases, use existing Pi credentials, redact evidence, and record quota/environment failures without retries beyond the bounded matrix. |
| The implementation exceeds the 400-line review budget | Deliver as evidence-gated, reviewable slices and forecast each slice. Under `ask-on-risk`, pause for a human delivery decision before any slice expected to exceed the budget; do not infer chaining or `size:exception`. |

## Delivery slices

The likely implementation spans materially different protocols and is not presumed to fit one 400-line review unit. Preserve these review boundaries without selecting a chain strategy in this proposal:

1. Characterize Gemini 3.8 and extract the typed static catalog with no behavior or registration change.
2. Collect/reconcile evidence and add only accepted Gemini candidates, isolating Gemini 3.5's exceptional identity policy where necessary.
3. Add Claude Sonnet only after its no-reasoning or reasoning policy and response fixture are proven.
4. Add Claude Opus Thinking only after every exposed Pi-level-to-integer-budget mapping and replay rule is proven.
5. Add GPT-OSS only after its identity, limits, policy, and response family are proven.
6. Finalize documentation and cross-package regression evidence for the exact registered catalog.

Each behavior-changing slice must follow strict TDD and keep its tests and evidence with the change. Before implementation, estimate the selected slice; if it risks exceeding 400 changed lines, the parent must ask the user whether to chain, reduce scope, or explicitly accept an exception.

## Rollback

Before release, revert the affected evidence-gated slice as a coherent unit: remove only its catalog entries, family policy, fixtures/tests, and documentation while retaining the catalog foundation and unchanged Gemini 3.8 entry. If the foundation itself causes a regression, restore the previous three hard-coded validation seams together so provider registration, context serialization, and stream validation cannot diverge.

After release, remove a failing candidate from static registration in a corrective release and retain its redacted evidence as a failed/withdrawn record. Do not silently remap it, route it through another quota pool, delete credentials, or alter OAuth state. Publishing, unpublishing, credential revocation, and destructive account actions require separate authorization.

## Success criteria

- [ ] Pi has one typed static catalog used by provider registration, context serialization, and stream validation, with duplicate public/wire identity safeguards appropriate to the proven mappings.
- [ ] `antigravity-gemini-3.8-flash` still maps to `gemini-3.8-flash-tiered` with exactly its released descriptor, reasoning choices, off/native-low behavior, hidden thoughts, signature handling, request envelope, SSE behavior, and Pi event lifecycle.
- [ ] Each added target and each advertised reasoning level has a versioned, redacted record reconciling the pinned reference revision, authorized account discovery, strict request/response fixtures, and bounded authorized live smoke result.
- [ ] Pi documentation and registration claim support only for entries that pass the complete gate; unavailable, conflicting, or unproven candidates/levels remain unregistered and are reported as blockers.
- [ ] All registered public IDs use the repository-consistent `antigravity-*` namespace, while all wire IDs and generation policies come from recorded evidence rather than labels or string substitution.
- [ ] Gemini, Claude, and GPT-OSS requests emit only their proven generation/thinking configuration; signatures are never replayed across an unproven model boundary.
- [ ] Images, tools, tool history, and unsupported context continue to fail explicitly before transport for every catalog entry.
- [ ] The adapter continues to use only existing Pi-managed credentials, the Antigravity OAuth endpoint/quota path, and current cancellation/error/terminal-event behavior, without fallback or dynamic registration.
- [ ] Focused Pi tests, `npm run typecheck:pi`, `npm run build:pi`, root `npm test`, and root `npm run typecheck` pass; environment-backed gaps are recorded rather than converted into support claims.
- [ ] No root OpenCode model, resolver, account, quota, recovery, persistence, or request-routing behavior changes.

## Next step

Proceed to the specification phase by modifying `pi-provider-adapter` requirements and adding Given/When/Then scenarios for catalog resolution, evidence gating, per-policy serialization, Gemini 3.8 compatibility, response-family handling, and text-only rejection. Specification and design must preserve unresolved wire IDs and reasoning mappings as evidence blockers rather than filling them with assumptions.

No source implementation, external request, OAuth action, test run, commit, push, PR, or publication is part of this proposal phase.

## Evidence limits

This proposal uses the confirmed handoff and repository-local [exploration](explore.md). It does not claim inspection of `Rahularya01/pi-antigravity`, Antigravity account discovery, live model availability, fixture capture, or smoke completion. No external service or credential was accessed.
