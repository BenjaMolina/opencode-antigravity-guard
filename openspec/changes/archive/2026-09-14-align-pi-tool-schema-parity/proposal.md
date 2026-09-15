# Proposal: Align Pi tool schema parity

## Intent

Repair the published `@benjamolina/pi-antigravity-guard` 0.4.1 schema-preflight defect so normal Pi tool declarations can pass through the adapter on the already enabled Gemini 3.8 Flash `off` tool route.

The fix will replace the Pi adapter's legacy-style keyword allowlist with an explicit Gemini `parametersJsonSchema` profile, informed by `Rahularya01/pi-antigravity`. It will preserve ordinary JSON Schema structure and constraints, safely inline local references, and retain this package's stricter fail-closed treatment of malformed or hostile runtime values.

This is a systemic schema-profile correction, not a special case for `ask_user_choice`. It does not enable or claim support for any currently disabled route, and it does not alter root OpenCode behavior.

## Authority and readiness

- Change: `align-pi-tool-schema-parity`.
- Confirmed evidence: [explore.md](explore.md) and repository `AGENTS.md` standards.
- Research lane: unselected. The checked-out repository and cached `Rahularya01/pi-antigravity` reference are sufficient for proposal scope; no external or live research is claimed.
- Pre-proposal gate: satisfied. The user confirmed the product direction and no additional proposal interview is required in auto mode.
- Session controls: OpenSpec artifact store, `ask-on-risk` delivery, and a 400 changed-line review budget.
- This proposal authorizes specification and design work only. It does not authorize implementation, credential access, live probes, route enablement, publication, or a review-budget exception.

## Problem and current-state gap

Version 0.4.1 rejects an ordinary Pi declaration before request construction with an error such as:

```text
PI_TOOL_SCHEMA_UNSUPPORTED: declaration ask_user_choice at $.additionalProperties
```

`packages/pi/src/tool-schema.ts` currently applies a narrow, profile-agnostic keyword allowlist. As a result, normal TypeBox-produced constraints such as `additionalProperties`, `minItems`, `maxItems`, string and numeric bounds, `patternProperties`, definitions, and local references are rejected even though the enabled Gemini path already emits declarations through `functionDeclarations[*].parametersJsonSchema`.

The failure therefore occurs before transport and is not evidence of a defect in OAuth, request envelopes, streaming tool calls, tool-result replay, recovery, or Pi's tool lifecycle. Fixing only `ask_user_choice` would leave every other ordinary schema construct exposed to the same root mismatch and would grow a symptom-by-symptom exception list.

## Product outcome

On the existing Gemini 3.8 Flash `off` tool route, ordinary Pi/TypeBox tool declarations will serialize as self-contained `parametersJsonSchema` values without losing their accepted-value semantics. `ask_user_choice` is the published reproduction and a required regression, but compatibility will be defined by the Gemini schema profile rather than by tool name.

Invalid declarations will still fail locally, safely, and as a complete request before `fetch`. Disabled Gemini rows and all Claude/GPT tool routes will remain disabled. Text-only behavior, tool lifecycle behavior, and the root OpenCode plugin will remain unchanged.

## Scope

### Gemini schema profile

Introduce an explicit schema target selected at the Pi context/catalog boundary for tool-enabled routes. The broader normalizer may run only when the selected route is admitted for tools and emits Gemini `parametersJsonSchema`.

For that profile, normalization will:

1. Accept structurally valid, JSON-compatible ordinary JSON Schema content instead of applying the current legacy protobuf-style keyword allowlist.
2. Preserve schema constraints and values losslessly, including `additionalProperties`, `minItems`, `maxItems`, `minLength`, `maxLength`, `pattern`, numeric bounds, `uniqueItems`, combinators, defaults, and `patternProperties`.
3. Resolve only local RFC 6901 references (`#` and `#/...`) against the original declaration schema, including `~0`/`~1` decoding and valid array-index segments.
4. Inline repeated local references deterministically, preserve valid reference siblings, and remove `$defs` and Draft-07 `definitions` containers after successful expansion.
5. Strip only non-runtime schema metadata: `$schema`, `$id`, `$anchor`, `$dynamicAnchor`, `$vocabulary`, and `$comment`, plus definition containers after reference resolution.
6. Preserve keyword-like property names when they occur inside a schema's `properties` map; names such as `$ref` or `definitions` are user property names there, not schema control keywords.
7. Produce canonical, deeply frozen output without mutating the source declaration.

The profile is intentionally permissive about ordinary JSON Schema vocabulary but strict about runtime representation and reference safety. It must not silently fall back to the old allowlist, translate constraints into descriptions, erase constraints, or route the schema through a legacy Claude/GPT conversion.

### Fail-closed preflight and hostile-input safety

Retain the adapter's existing own-data, plain-object, dense-array, finite-number, cycle, canonical-ordering, immutability, and size protections. Extend those protections through reference expansion.

The complete declaration preflight must reject before transport when any declaration contains:

- an external, URI, malformed, missing, unresolved, or otherwise non-local `$ref`;
- malformed pointer escapes or invalid array indexes;
- direct object cycles, reference cycles, recursive expansion, excessive depth, or excessive expanded node count;
- getters/accessors, inherited values, symbols, sparse arrays, class instances, functions, `undefined`, `bigint`, or non-finite numbers;
- an unsafe or structurally invalid reference-sibling merge;
- per-declaration or aggregate byte-limit overflow; or
- a backend route/profile selection that is not enabled for Gemini `parametersJsonSchema` tools.

Validation and diagnostics must identify the declaration and safe structural path without evaluating getters or exposing schema values/descriptions. If one declaration is invalid, the entire request fails; declarations must never be skipped individually.

Existing conservative limits remain the default design baseline: depth 32, 2,048 nodes, 256 KiB per declaration, and 1 MiB aggregate. Specification/design may clarify whether expanded-node accounting needs a separately named bounded counter, but may not adopt the reference implementation's 10,000-node policy without explicit evidence and review.

### Compatibility regressions

Add representative Pi/TypeBox-shaped coverage rather than one-keyword exceptions:

- the published `ask_user_choice` shape with nested closed objects and bounded options;
- string, numeric, array, and nested object constraints;
- open objects, schema-valued `additionalProperties`, and `patternProperties` records;
- `$defs` and `definitions`, repeated references, escaped pointers, array segments, combinator references, and valid reference siblings;
- keyword-like user property names;
- hostile runtime values, malformed/unresolved/external references, cycles, depth/node/byte limits, and all-declaration failure;
- exact Gemini `parametersJsonSchema` serialization with no legacy `parameters` field; and
- an unsupported legacy/profile selection that fails before transport.

The full request regression must prove that `ask_user_choice` reaches `functionDeclarations[*].parametersJsonSchema` on Gemini 3.8 Flash `off` with its constraints intact. A transport spy must prove invalid declarations and profiles make zero network calls.

### Documentation accuracy

Update the Pi package README to replace the obsolete strict-subset promise with the actual Gemini schema-profile boundary. Documentation must state that schema parity applies only to the currently evidence-enabled Gemini 3.8 Flash `off` tool route.

The existing simple echo evidence remains valid for its recorded tool loop, but it does not prove live backend acceptance of the broader schema set. No evidence JSON rewrite or live-support claim is part of this change.

## Non-goals

- Special-casing `ask_user_choice` or maintaining a per-tool compatibility list.
- Enabling another model, family, catalog row, reasoning level, or wire route.
- Adding legacy Claude/GPT `parameters` conversion, lossy union handling, declaration omission, fallback, retries, or dynamic discovery.
- Modifying tool-call parsing, stream events, synthetic IDs, result replay, orphan recovery, result encoding, OAuth, transport, or session behavior.
- Modifying root `src/` OpenCode request conversion, schema cleaning, routing, auth, quota, account, recovery, fingerprint, or model behavior.
- Changing the existing Gemini route identity or rewriting the existing redacted echo evidence.
- Running a live probe, accessing credentials, publishing a package, or claiming direct runtime evidence for constrained/reference-based schemas.
- Copying the reference implementation's warning-and-skip behavior, broad unvalidated object acceptance, or 10,000-node expansion policy.

## Affected areas

These are expected seams, not a requirement to edit every file listed.

| Area | Expected impact |
|---|---|
| `packages/pi/src/tool-schema.ts` | Replace narrow keyword rejection with the explicit Gemini profile, safe local-reference expansion, metadata stripping, canonicalization, and bounded validation. |
| `packages/pi/src/tool-schema.test.ts` | Replace tests that pin the obsolete policy and add representative compatibility, immutability, hostile-input, reference, and limit regressions. |
| `packages/pi/fixtures/tools/` | Add synthetic TypeBox-equivalent acceptance/rejection fixtures only where they improve test clarity. |
| `packages/pi/src/context.ts` and possibly `packages/pi/src/catalog.ts` | Select or assert the named schema profile at the existing route/capability boundary without changing request field placement or route admission. |
| `packages/pi/src/context.test.ts` | Prove the published reproduction serializes under `parametersJsonSchema`, and prove unsupported profiles fail before transport. |
| `packages/pi/README.md` | Document the corrected schema contract and exact supported-route limit without overstating live evidence. |
| `scripts/pi-tool-loop-probe.test.ts` | Optional static assertion only if needed to protect declaration wiring; the live probe and evidence record remain unchanged. |

`packages/pi/src/tool-context.ts`, `response.ts`, `stream.ts`, `provider.ts`, root `src/`, and `packages/core/` are compatibility surfaces and are not intended implementation targets unless design finds a minimal profile-selection interface cannot otherwise be expressed.

## Compatibility requirements

- Gemini 3.8 Flash `off` remains the only currently enabled Pi tool route.
- Every disabled route remains capability-rejected before transport when tools are present and remains unchanged for text-only use.
- Gemini declarations use only `parametersJsonSchema`; no legacy `parameters` field is introduced.
- Declaration source order and the existing all-or-nothing preflight contract are preserved.
- No declaration, constraint, property, or required field is silently removed to obtain backend acceptance, except the explicitly listed metadata and successfully resolved definition containers.
- Existing Pi tool-call/result lifecycle, deterministic replay, recovery, cancellation, usage, and terminal behavior remain unchanged.
- Root OpenCode behavior and its existing schema cleaners remain unchanged.
- Existing credentials, account state, package identity, route identity, and evidence files are not migrated or rewritten.

## Success criteria

- [ ] The exact 0.4.1 `ask_user_choice` reproduction normalizes and serializes before transport on Gemini 3.8 Flash `off`, retaining root/nested `additionalProperties` and array bounds.
- [ ] Representative normal Pi/TypeBox schemas preserve ordinary constraints and JSON values exactly after permitted metadata stripping, reference inlining, and canonical ordering.
- [ ] Local `$ref` values resolve according to RFC 6901, repeated and escaped references work, and emitted schemas contain no resolved `$ref`, `$defs`, or `definitions` control keywords.
- [ ] Keyword-like names inside `properties` remain intact.
- [ ] Source declarations remain unchanged, normalized output is deeply frozen and deterministic, and declaration order is preserved.
- [ ] Every hostile value, malformed/unresolved/external reference, cycle, depth/node/byte overflow, and unsupported profile fails locally with a safe declaration/path diagnostic and zero `fetch` calls.
- [ ] One invalid declaration rejects the complete request; no declaration is silently omitted.
- [ ] Gemini request fixtures contain `parametersJsonSchema` and never legacy `parameters`.
- [ ] All disabled Gemini, Claude, and GPT tool routes remain disabled, while their text-only behavior remains unchanged.
- [ ] Existing tool-context, response, stream, and probe-test suites show no lifecycle or evidence-contract regression.
- [ ] `packages/pi/README.md` describes the fixed Gemini profile and route boundary without claiming unsupported routes or unperformed live validation.
- [ ] Pi-focused type/build checks, root type/build checks, package-install verification, and the full test suite establish that root OpenCode behavior remains unchanged.

## Verification expectations

Implementation must follow strict TDD and keep each behavior with its verification. The required post-implementation checks are:

```text
npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts scripts/pi-tool-loop-probe.test.ts
npm run typecheck:pi
npm run build:pi
npm run typecheck
npm run build
npm run test:pack
npm test
```

Any inherited failure must be reproduced on the implementation baseline and attributed rather than reported as a passing result. No live model call is required or authorized for this hermetic correction.

## Risks and mitigations

| Risk | Impact | Mitigation / gate |
|---|---|---|
| Broad schema preservation admits hostile JavaScript values | Getters, prototypes, cycles, or oversized expansion could execute code or exhaust resources. | Preserve own-data/plain-object validation and enforce depth, node, cycle, and byte limits throughout traversal and expansion. |
| Reference expansion changes semantics or grows exponentially | The emitted declaration may be wrong or exceed safe resource bounds. | Resolve only local RFC 6901 pointers from the original schema, track reference chains and expanded nodes, preserve valid siblings, and fail closed on ambiguity or limits. |
| Gemini behavior leaks into a future legacy route | Claude/GPT could receive an incompatible wire schema after a capability flip. | Make the schema profile explicit at route/context selection and regression-test unsupported legacy selection before transport. |
| A permissive fix silently drops constraints | Pi may execute tools with arguments outside the author's intended schema. | Preserve ordinary schema members verbatim; strip only enumerated metadata and resolved definition containers; assert exact outputs. |
| Corrected documentation overstates runtime evidence | Users may expect unverified routes or schema shapes to work. | Scope wording to Gemini 3.8 Flash `off`, distinguish hermetic compatibility from live backend evidence, and leave all other routes disabled. |
| Tests preserve the shipped defect as intended policy | The fix could be blocked or later reverted by obsolete rejection fixtures. | Replace the `minLength`/strict-subset expectations with root-cause compatibility and hostile-input regressions. |
| Root OpenCode behavior changes accidentally | Existing OpenCode consumers could regress for an unrelated Pi fix. | Keep root `src/` out of scope and run root type, build, and test checks as compatibility verification. |
| Cohesive safety coverage exceeds the review budget | Splitting resolver behavior from its safety tests would impair review and rollback. | Refine the estimate during design/tasks; under `ask-on-risk`, pause for a human delivery decision if the honest forecast remains above 400 changed lines. |

## Rollback

Before publication, revert the Gemini schema-profile implementation, its profile-selection wiring, tests/fixtures, and README update as one coherent behavior unit. This restores the explicit 0.4.1 preflight limitation without touching route admission, credentials, evidence records, tool lifecycle code, or root OpenCode behavior.

If a corrected package is later published and the broader profile proves unsafe, disable the affected Gemini tool capability in a corrective release before considering a normalizer rollback. Do not silently drop declarations, reroute to another model, enable a legacy conversion, rewrite user state, or unpublish without separate authorization.

Because this change adds no durable state, rollback requires no data migration. Any publication, unpublication, credential action, or destructive repository operation remains a separate human-control gate.

## Delivery forecast and next step

Proceed to normative specification and design for the Gemini schema profile, reference-resolution semantics, explicit route/profile selection, fail-closed limits, and representative regressions. The implementation should remain one behavioral work unit with tests and documentation alongside the behavior unless design identifies a genuinely independent profile-selection foundation.

Exploration estimates **400–550 changed lines**. That is a review-budget risk, not approval to exceed the configured 400-line limit. Delivery remains `ask-on-risk`: if the refined design/tasks forecast is still over 400 authored changed lines, pause for the user to choose a chain strategy, reduce scope, or explicitly approve `size:exception`. No chain strategy or exception is selected by this proposal.

## Evidence limits

No implementation, shell command, test, build, network request, OAuth action, credential access, live model probe, evidence rewrite, or publication occurred in this proposal phase. The proposal relies on confirmed repository exploration and the cached reference analysis; it makes no support claim beyond the existing Gemini 3.8 Flash `off` tool route.
