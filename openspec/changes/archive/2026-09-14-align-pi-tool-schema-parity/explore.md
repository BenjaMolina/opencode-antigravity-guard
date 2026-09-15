# Exploration: Align Pi Tool Schema Parity

## Result

**Status:** complete; no implementation, live probe, credential access, or publication occurred.

**Change:** `align-pi-tool-schema-parity`
**Artifact store:** OpenSpec
**Skill resolution:** `paths-injected` (`gentle-ai`, `systemic-issue-triage`, and `work-unit-commits` were read)
**Research lane:** unselected; this report uses checked-out repository and cached-reference evidence only.

## Product goal and reproduction

The goal is for normal Pi agent tools to work through the published `@benjamolina/pi-antigravity-guard` adapter, beginning with the already evidence-enabled Gemini 3.8 Flash `off` route. The reproduced published-package failure is:

```text
PI_TOOL_SCHEMA_UNSUPPORTED: declaration ask_user_choice at $.additionalProperties
```

This is a schema-preflight defect, not a transport, OAuth, tool-call streaming, tool-result replay, or capability-admission failure.

## Evidence examined

### Current Pi adapter

- `packages/pi/package.json` is version `0.4.1`.
- `packages/pi/src/tool-schema.ts` is the direct root cause. Its `KEYWORDS` set admits only `type`, `description`, `nullable`, `enum`, `const`, `properties`, `required`, and `items`; `normalizeSchema()` rejects every other own schema keyword before it can serialize the declaration. Therefore a normal object schema containing `additionalProperties` fails exactly at `$.additionalProperties`.
- The same normalizer also rejects ordinary TypeBox constraints such as `minItems`, `maxItems`, `minLength`, `maxLength`, numeric bounds, `patternProperties`, `$defs`, and `$ref`.
- `packages/pi/src/context.ts` already emits the correct Gemini declaration shape for the enabled path: `request.tools[0].functionDeclarations[*].parametersJsonSchema`. It does not use legacy `parameters` there.
- `packages/pi/src/catalog.ts` enables only `antigravity-gemini-3.8-flash/off`; every other current Gemini route and both Claude/GPT families remain tool-disabled. `serializeContext()` gates tool-bearing contexts before `prepareToolContext()`, so unsupported routes currently fail before a schema is emitted.
- `packages/pi/src/tool-context.ts`, `response.ts`, and `stream.ts` already own deterministic call/result replay, orphan recovery, and the Pi tool-call lifecycle. Their behavior is not implicated by a declaration rejected before request construction.
- `packages/pi/src/tool-schema.test.ts` intentionally asserts the old policy by treating `minLength` as an unknown-keyword rejection. `packages/pi/fixtures/tools/schema-rejections.json` likewise has only `$ref` and `pattern` rejection coverage. These expectations must be revised rather than preserved as the product contract.
- `packages/pi/README.md` explicitly promises the obsolete strict subset and says references, lossy constraints, and unsupported keywords are rejected. It must be corrected together with the code and tests.

### Existing evidence harness

- `packages/pi/evidence/pi-evidence-echo.ts` uses `Type.Object({ value: Type.String() })`; it proves only the basic object/property/required shape.
- `packages/pi/evidence/gemini-3.8-flash-off-tool-loop.json` records a sanitized two-turn success for exactly Gemini 3.8 Flash `off`.
- `scripts/pi-tool-loop-probe.ts` and its tests validate declaration registration, tool execution, the `toolUse` terminal, continuation, and redacted evidence. They do **not** prove acceptance of constrained, open/closed, or reference-based schemas.
- The existing direct evidence remains valid for the tool loop but is insufficient to claim live schema parity beyond its simple echo declaration. This exploration does not authorize changing or running the probe.

### Cached `Rahularya01/pi-antigravity` reference

The cached clone is `C:/tmp/pi-github-repos/runtime-goLPqV/9af06b83d4dddbccf4ae10e73e1c9067f19b472d6c1eda01b7b50472d4b5cf45` and its Git remote is the requested public reference repository.

Its `src/stream/stream.ts` deliberately separates backend profiles:

1. It resolves local RFC 6901 `#` / `#/...` references against the original schema, inlines them, and removes `$defs`/`definitions` from emitted schemas.
2. It strips schema metadata such as `$schema`, `$id`, anchors, vocabulary, and comments.
3. For Gemini, `convertTools()` puts the self-contained result unchanged into `parametersJsonSchema`; ordinary JSON Schema fields are retained.
4. For Claude and GPT-OSS only, it instead uses legacy `parameters` and applies a narrow protobuf compatibility allowlist. The reference tests prove this distinction with the same union schema: Gemini retains it under `parametersJsonSchema`, while the legacy bridge degrades it.

`reference/scripts/test-model-routing.ts` has regression evidence for Gemini preservation of `additionalProperties`, `patternProperties`, defaults, minimum/maximum, `minLength`/`maxLength`, local `$defs` and Draft-07 `definitions`, repeated references, escaped RFC 6901 pointers, references inside combinators, and metadata removal. It also tests unresolved external references, cycles, and a bounded reference-expansion case. `reference/scripts/smoke-tool-schema.ts` is an environment-backed schema probe and was not run.

The reference is a functional compatibility reference, not a safe copy target: it warns and omits an individual malformed declaration, accepts broad unvalidated object values, and has a 10,000-node dereference policy. This adapter must retain its stricter fail-closed all-declaration contract and hostile-runtime defenses.

## Root-cause classification

**Root class:** Gemini JSON-Schema profile is incorrectly implemented as a legacy protobuf-schema allowlist.

The affected declaration never reaches the request body because `normalizeSchema()` rejects an ordinary object keyword before `context.ts` can place it under `parametersJsonSchema`. The current request path is already Gemini-specific, whereas the normalizer is profile-agnostic and inherited the old conservative semantics. The defect is systemic for ordinary Pi/TypeBox schemas, not unique to `ask_user_choice`.

## Bounded solution

### In scope

1. Replace the Pi normalizer's legacy-style schema grammar with a **Gemini `parametersJsonSchema` profile** for an evidence-enabled Gemini route.
2. Preserve ordinary JSON Schema constraints and structure losslessly after safe canonicalization, including `additionalProperties`, `minItems`, and `maxItems`; do not translate them into descriptions, delete them, or narrow their accepted values.
3. Inline only resolvable local JSON Pointer references (`#` and `#/...`) from the original declaration schema, including RFC 6901 `~0`/`~1` decoding and array-index pointer segments. Remove resolved `$defs` and `definitions` from the emitted schema.
4. Strip only schema metadata that the backend should not receive (`$schema`, `$id`, `$anchor`, `$dynamicAnchor`, `$vocabulary`, `$comment`, plus definition containers after resolution). Preserve non-metadata constraints unchanged.
5. Retain the existing own-data/plain-object/dense-array/non-finite-number/cycle defenses, canonical key ordering, deep freezing, input immutability, and per-declaration/aggregate byte limits. Apply depth, dereference-node, and emitted-byte limits during expansion as well as after output construction.
6. Keep every declaration in source order, and fail the complete declaration preflight if any declaration is invalid. Do not copy the reference behavior of silently dropping a tool.
7. Make the schema profile explicit at the context/catalog boundary. The broader Gemini normalizer must run only for a selected Gemini route that serializes `parametersJsonSchema`; a non-Gemini or unsupported backend route must remain capability-rejected before transport rather than accidentally receiving Gemini JSON Schema.
8. Add representative Pi/TypeBox compatibility fixtures, update `packages/pi/README.md`, and add a narrow static assertion to the existing probe tests only if it improves regression coverage. No live probe or evidence-record rewrite is required for the hermetic fix.

### Explicitly out of scope

- Root `src/` OpenCode request conversion and its schema cleaners.
- Reusing the reference's legacy Claude/GPT `parameters` conversion, lossy union handling, declaration skipping, retries, fallback, dynamic discovery, or session behavior.
- Enabling another catalog row or reasoning level, including Claude/GPT routes.
- Modifying tool-call response parsing, synthetic IDs, replay, result encoding, tool lifecycle, OAuth, transport, or the evidence-enabled Gemini route identity.
- Any live schema probe, credential use, package publication, or claim that direct runtime evidence covers more than the current echo schema.

## Gemini versus legacy conversion boundary

| Concern | Gemini enabled route | Claude/GPT legacy route | Required result |
|---|---|---|---|
| Wire field | `parametersJsonSchema` | legacy `parameters` only if separately evidenced | Keep the profiles separate. |
| Schema strategy | Local-reference inlining, metadata stripping, lossless ordinary-schema preservation | Existing route is disabled; a future legacy bridge needs separately specified compatibility handling | Do not broaden legacy behavior through Gemini parity. |
| `additionalProperties`, `minItems`, `maxItems` | Preserve verbatim after validation | Not admitted by this change | Regression-test Gemini preservation. |
| `$ref` / definitions | Resolve local only, then omit definition containers | Not admitted by this change | Reject unresolved/external/cyclic values. |
| Invalid declaration | Local preflight failure for the request | Local capability/preflight failure | Never silently drop the declaration. |

The existing catalog gate is important but insufficient as a long-term invariant: today only the enabled Gemini route can reach the normalizer, but the code should still select a named schema target from the route family and emitted wire field. A future capability flip must not make the broadened Gemini profile reachable by Claude/GPT accidentally.

## Representative normal-Pi/TypeBox regressions

The implementation/test plan should use actual Pi-shaped declaration objects or exact TypeBox-produced JSON equivalents, not a hand-waved one-keyword fixture.

1. **`ask_user_choice` (reproduction):** object root with `question: string`, `options: array` of nested option objects, root and nested `additionalProperties: false`, `options.minItems: 1`, and bounded `maxItems`. It must normalize and serialize unchanged under `parametersJsonSchema` except for permitted metadata stripping/canonical key order.
2. **Array and scalar constraints:** a `search`/`read` style tool with `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `minItems`, `maxItems`, `uniqueItems`, and a required array item object. Assert exact values and no input mutation.
3. **Open object / record:** an object with `additionalProperties: true` or a nested schema value, plus a TypeBox `Record`-like `patternProperties` shape. Preserve the boolean/schema rather than converting it to an empty object.
4. **Definitions and references:** a TypeBox `Type.Ref`/`$defs` or Draft-07 `definitions` schema with repeated local references, a nested escaped pointer, and a sibling description on a reference. Assert no emitted `$ref`, `$defs`, or `definitions`, and assert each expanded target remains correct.
5. **Keyword-like property names:** properties literally named `$ref` or `definitions` must remain data-property names; they are not metadata/reference keywords merely because of their position.
6. **Legacy separation:** construct a Gemini selection and a simulated unsupported legacy selection. Assert the Gemini declaration uses only `parametersJsonSchema`, while the latter is rejected by capability/profile policy and never emits a broadened schema.

## Fail-closed and hostile-value boundaries

The new compatibility profile must reject locally, before fetch, with a safe declaration/path error for all of the following:

- external, URI, fragment-only-nonlocal, missing, malformed, or unresolved `$ref` values;
- direct JavaScript object cycles, `$ref` cycles, recursive reference expansion, excessive depth, excessive node count, per-schema byte overflow, and aggregate byte overflow;
- getters/accessors, inherited values, symbols, sparse arrays, class instances, functions, `undefined`, `bigint`, and non-finite numeric values;
- malformed pointer escapes or invalid array indexes;
- an invalid `$ref` sibling merge that cannot produce a safe JSON schema object;
- unsupported backend route/profile selection.

A resolver should validate every value copied to output through the existing canonical JSON primitive/object contract, use a current-object ancestor set and a reference-chain set, and use a request-local expansion counter. It must never execute getters, mutate the input, or expose schema values/descriptions in diagnostic messages. Existing schema limits (depth 32, nodes 2,048, per declaration 256 KiB, aggregate 1 MiB) are conservative defaults; retain them unless implementation evidence demonstrates a necessary bounded adjustment. If reference expansion needs a different explicit node allowance, specify and test it rather than inheriting the reference's 10,000-node value.

## Affected files and expected work units

| Area | Change | Notes |
|---|---|---|
| `packages/pi/src/tool-schema.ts` | Replace narrow keyword rejection with typed Gemini profile, safe local `$ref` inlining, metadata stripping, canonical output, and bound enforcement | Primary production surface. |
| `packages/pi/src/tool-schema.test.ts` | Replace obsolete constraint rejection and add TypeBox/regression/hostile/boundary tests | Tests remain with the behavior. |
| `packages/pi/fixtures/tools/` | Add synthetic TypeBox-equivalent acceptance/rejection fixtures if they improve readability | No user values or credentials. |
| `packages/pi/src/context.ts` and possibly `catalog.ts` | Thread/assert explicit schema backend profile only if required to prevent future legacy crossover | Keep minimal; no change to request field placement. |
| `packages/pi/src/context.test.ts` | Assert full request preserves `parametersJsonSchema` parity through the existing enabled route | Do not broaden disabled routes. |
| `packages/pi/README.md` | Replace the obsolete strict-subset statement with the actual Gemini-compatible boundary and route gate | Must not claim unproven live parity. |
| `scripts/pi-tool-loop-probe.test.ts` | Optional static declaration normalization regression only | The live probe and existing evidence JSON should remain unchanged unless separately authorized. |

`tool-context.ts`, `response.ts`, `stream.ts`, `provider.ts`, root `src/`, and `packages/core/` are inspected compatibility surfaces and should not change for this defect unless implementation discovers that schema-profile selection cannot be made safely without a minimal interface adjustment.

## Verification plan

### Hermetic tests (required)

- Targeted `tool-schema.test.ts` acceptance goldens for the representative schemas above, exact serialized shape/order, deep immutability/frozen output, and all fail-closed cases.
- `context.test.ts` golden for `ask_user_choice` proving it reaches `functionDeclarations[*].parametersJsonSchema`, retains `additionalProperties`/array bounds, and does not add legacy `parameters`.
- A transport-spy preflight test proving invalid reference/cycle/limit/profile cases call `fetch` zero times.
- Existing `tool-context`, `response`, and `stream` focused suites to prove declaration acceptance did not affect call replay/lifecycle behavior.
- Existing probe-test suite must continue to validate the static evidence contract and redaction rules.

### Required commands after implementation

```text
npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts scripts/pi-tool-loop-probe.test.ts
npm run typecheck:pi
npm run build:pi
npm run typecheck
npm run build
npm run test:pack
npm test
```

The archived verification report documents two inherited release-manifest failures in a historical worktree; a new implementation must establish current-baseline causality rather than treating that report as a green result.

### Live evidence

No live evidence is authorized in this phase. A later separately authorized direct probe may add a new redacted, representative TypeBox tool declaration to prove backend acceptance. That evidence must be route-scoped to Gemini 3.8 Flash `off`, must retain the current deterministic loop assertions, and must not replace the hermetic hostile-input suite.

## Review forecast and delivery gate

A coherent rewrite of the normalizer plus safety/TypeBox regressions and README is estimated at **400–550 changed lines**. The likely shape is one behavior unit, but its safety tests cannot honestly be split away from the resolver. With session strategy `ask-on-risk` and a 400-line budget, proposal/tasks must pause for a human delivery decision if its refined estimate remains above 400; no chain strategy or `size:exception` is selected here.

## Decisions and open gates

### Resolved by repository/reference evidence

- The report is a Gemini `parametersJsonSchema` parity defect, not a request-envelope defect.
- Local reference inlining plus metadata stripping is the compatibility direction for Gemini.
- Lossy legacy Claude/GPT conversion is not the model for this change.
- Invalid input must fail closed for this package rather than being silently omitted as in the reference.
- Current Gemini 3.8 Flash `off` capability remains the only enabled route.

### Requires later human control or implementation confirmation

1. **Delivery decision:** choose a chain strategy or explicitly accept a size exception only if the refined cohesive estimate exceeds 400 lines.
2. **Live validation:** authorize an exact-route, redacted TypeBox schema probe before expanding any live-support claim; not needed to implement or hermetically verify the fix.
3. **Schema-vocabulary boundary:** implementation/spec must enumerate the metadata to strip and choose whether all structurally valid ordinary JSON Schema JSON is preserved or a named Gemini-compatible vocabulary is accepted. It must not silently fall back to the old allowlist or to legacy behavior.

## Recommended next phase

Produce proposal/spec/design for the bounded Gemini schema-profile change, preserving the explicit fail-closed resolver contract, exact route gate, representative TypeBox fixtures, and review-budget decision gate. Do not implement until the delivery decision is resolved if the detailed estimate remains over budget.
