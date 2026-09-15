# Technical Design: Align Pi Tool Schema Parity

## Status and authority

This design implements the approved proposal and the normative delta at `specs/pi-provider-adapter/spec.md`. It uses the completed exploration and the cached `Rahularya01/pi-antigravity` implementation as behavioral reference evidence, while intentionally retaining this package's stricter all-or-nothing, fail-before-fetch contract.

The design authorizes architecture and task planning only. It does not authorize implementation, live model calls, credential access, evidence rewriting, publication, route enablement, root OpenCode changes, or a review-budget exception.

The implementation remains centered on `packages/pi`. Root `src/`, `packages/core/`, OAuth, quota, account, response parsing, replay, recovery, and provider registration are compatibility surfaces, not implementation targets.

## Goals

1. Give the enabled Gemini 3.8 Flash `off` tool route an explicit `parametersJsonSchema` profile.
2. Preserve ordinary JSON Schema assertions and JSON values instead of applying the legacy protobuf-style allowlist.
3. Safely inline local RFC 6901 references against an immutable snapshot of the original declaration.
4. Preserve deterministic bytes, source declaration order, source immutability, deep output immutability, and existing conservative limits.
5. Reject every invalid declaration set as one request before `fetch`; never copy the reference implementation's declaration skipping.
6. Prove the published `ask_user_choice` shape and representative TypeBox-compatible schemas at the normalizer, serializer, and transport boundaries.

## Non-goals

- No Claude/GPT legacy `parameters` conversion or route enablement.
- No new Gemini row, reasoning level, model substitution, fallback, retry, or dynamic profile discovery.
- No schema repair, lossy keyword conversion, constraint-to-description translation, or per-tool compatibility list.
- No changes to tool-call parsing, result replay, orphan recovery, stream lifecycle, OAuth, transport headers, package identity, or persisted state.
- No root OpenCode schema-cleaner reuse or modification.
- No live probe or broader backend-support claim.

## Architectural decisions

| Decision | Choice and rationale |
|---|---|
| Profile ownership | Put a literal schema profile on the route's enabled `ToolCapability`. Capability and wire-schema format then change together, and a future capability flip cannot inherit a family-wide Gemini default. |
| Profile name | Use the single literal `"gemini-parameters-json-schema"`. There is no default profile and no legacy profile in this change. |
| Normalization boundary | Keep `normalizeToolDeclarations` as the pure Pi-local TDD seam and require the profile as an argument. `prepareToolContext` only threads the selected profile. |
| Schema vocabulary | Accept boolean or plain-object schemas at nested schema positions and preserve every structurally safe ordinary keyword/value. Interpret only standard schema-bearing positions needed for reference traversal; unknown keyword values remain canonical JSON data and are not rewritten. |
| Root policy | A tool parameter root remains a plain object schema with own `type: "object"`. Nested schemas may omit `type`, use union arrays, or be empty/boolean schemas. |
| `const` | Preserve `const` exactly. Do not convert it to `enum`, and do not reject a schema that also has `enum`; both are valid conjunctive assertions. |
| Reference source | Resolve against a complete canonical immutable snapshot made before metadata or definition containers are removed. This avoids mutation/TOCTOU behavior and keeps pointer lookup independent of output construction. |
| Reference siblings | Preserve sibling conjunction exactly. With effective siblings, emit `allOf: [resolvedTarget, normalizedSiblingSchema]`; simplify only `true && S` to `S` and `false && S` to `false`. Never overwrite target keys with sibling keys. |
| Metadata | Strip only `$schema`, `$id`, `$anchor`, `$dynamicAnchor`, `$vocabulary`, and `$comment` at schema-keyword positions. Validate then omit `$defs` and `definitions` containers after all references succeed. |
| Canonical form | Sort every object key by JavaScript's default UTF-16 lexical order and preserve every array's source order. Do not sort `required`, `enum`, combinator arrays, or tuple arrays. |
| Limits | Keep depth 32, source-node 2,048, expanded-node 2,048, 256 KiB canonical output per declaration, and 1 MiB aggregate. There is no 10,000-node reference budget. |
| Failure model | Throw the first deterministic safe `ToolPreflightError`; declaration processing is source ordered, but object-member processing is canonical-key ordered. No partial result is returned and no declaration is omitted. |
| Reference implementation | Reuse its proven profile separation and local-pointer coverage as behavior, not code. Reject its warning-and-skip policy, overwrite merge, permissive object access, root repair, and 10,000-node allowance. |

## Module and file boundaries

### Production changes

| Path | Change |
|---|---|
| `packages/pi/src/catalog.ts` | Add `ToolSchemaProfile`, the Gemini profile literal, and `schemaProfile` to enabled tool capabilities. Assign it only to Gemini 3.8 Flash `off`; require it in the fixture helper. |
| `packages/pi/src/context.ts` | After exact selection/capability admission, pass the enabled capability's profile to `prepareToolContext`. Keep `parametersJsonSchema` placement and all text-only behavior unchanged. |
| `packages/pi/src/tool-context.ts` | Add the required profile parameter and forward it to declaration normalization. Replay and recovery code do not change. |
| `packages/pi/src/tool-schema.ts` | Replace the keyword allowlist with bounded canonical snapshotting, schema-position-aware traversal, local-reference resolution, metadata removal, immutable output, and profile validation. |
| `packages/pi/README.md` | Replace the obsolete strict-subset statement with the route-scoped Gemini profile and explicit hermetic/live-evidence boundary. |

`packages/pi/src/tool-contract.ts` should remain unchanged unless implementation proves a tiny path helper must be shared. Its existing `ToolPreflightError`, `plainObject`, `denseArray`, `ownData`, `freeze`, and JSON types are sufficient. There is no reason to touch root `src/` or `packages/core/`.

### Test changes

| Path | Coverage |
|---|---|
| `packages/pi/src/tool-schema.test.ts` | Main profile, canonicalization, constraints, reference, hostile-value, immutability, error-precedence, and boundary matrix. |
| `packages/pi/src/catalog.test.ts` | Exact route/profile ownership, frozen enabled capability, and absence of a profile on disabled routes. |
| `packages/pi/src/tool-context.test.ts` | Required profile threading and unsupported-profile rejection. Replay tests remain unchanged except helper arguments. |
| `packages/pi/src/context.test.ts` | Full `ask_user_choice` `parametersJsonSchema` golden, no legacy field, source order, and disabled/injected-profile isolation. |
| `packages/pi/src/stream.test.ts` | Invalid reference/profile/all-declaration/limit preflight produces safe diagnostics and zero `fetch` calls. Existing transport/lifecycle tests remain unchanged except profile fixture construction. |
| `packages/pi/fixtures/tools/schema-rejections.json` | Either replace obsolete `$ref`/`pattern` rows with compact malformed-reference rows or remove the fixture in favor of typed table cases. Do not add a second parallel source of expected schema truth. |

`scripts/pi-tool-loop-probe.test.ts` is verification-only. The existing probe and evidence JSON are not changed because context and stream tests already cover declaration wiring without overstating live evidence.

## Concrete interfaces

The catalog owns the only admitted profile:

```ts
export const GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE = "gemini-parameters-json-schema" as const
export type ToolSchemaProfile = typeof GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE

export type ToolCapability =
  | DisabledToolCapability
  | FixtureQualifiedToolCapability
  | {
      readonly state: "enabled"
      readonly contractRevision: 1
      readonly schemaProfile: ToolSchemaProfile
      readonly fixtureEvidence: ToolEvidenceRef
      readonly directEvidence: ToolEvidenceRef
    }
```

The existing helpers become explicit:

```ts
function enabled(
  evidence: ToolEvidenceRef,
  schemaProfile: ToolSchemaProfile,
): Extract<ToolCapability, { readonly state: "enabled" }>

export function createEnabledToolCapability(
  evidence: ToolEvidenceRef,
  schemaProfile: ToolSchemaProfile,
): Extract<ToolCapability, { readonly state: "enabled" }>
```

The preparation seam is profile-required:

```ts
export function prepareToolContext(
  tools: unknown,
  choice: unknown,
  schemaProfile: unknown,
): PreparedToolContext | undefined

export function normalizeToolDeclarations(
  value: unknown,
  schemaProfile: unknown,
): readonly ToolDeclaration[]
```

`unknown` at the runtime boundary is intentional. Even forged JavaScript or test-injected selections must fail locally rather than relying on TypeScript.

Private normalizer state is request/declaration local:

```ts
interface SchemaLimits {
  readonly maxDepth: 32
  readonly maxSourceNodes: 2048
  readonly maxExpandedNodes: 2048
  readonly maxDeclarationBytes: 262144
  readonly maxAggregateBytes: 1048576
}

interface SourceState {
  readonly ancestors: Set<object>
  nodes: number
}

interface ExpansionState {
  readonly referenceTargets: Set<object>
  nodes: number
}

type SchemaValue = boolean | JsonObject
```

Limits remain private constants, not caller-configurable options. Tests drive real boundaries through the pure normalizer instead of adding a production escape hatch.

## Request data flow

```text
Pi Context
  -> serializeContext
  -> exact catalog row/reasoning selection identity check
  -> capability state check (must be enabled)
  -> schema profile check (must be gemini-parameters-json-schema)
  -> prepareToolContext(tools, choice, profile)
  -> normalizeToolDeclarations(all declarations, profile)
       -> declaration envelope validation in source order
       -> immutable canonical source snapshot
       -> schema-position-aware expansion from snapshot
       -> local pointer resolution and sibling conjunction
       -> metadata/definition omission only after successful traversal
       -> per-declaration bytes
       -> aggregate bytes after all declarations
  -> map every normalized declaration, still in source order,
       to functionDeclarations[*].parametersJsonSchema
  -> replay existing tool history unchanged
  -> payload hook unchanged
  -> fetch
```

Any exception before the mapping completes unwinds the whole serializer. `executeStreamTransport` already calls `serializeContext` before its payload hook and `fetch`, so all schema/profile failures retain the existing zero-network-call property.

## Canonical immutable normalization

### Phase 1: declaration envelope

For each declaration in source order:

1. Validate the tools value as a dense array.
2. Validate the declaration as a plain object containing only own data properties and no symbols/accessors.
3. Validate name syntax and duplicates using existing rules.
4. Validate a nonblank string description without including it in diagnostics.
5. Accept `constrainedSampling` only when absent or exactly `false`.
6. Validate `parameters` as a plain object with own `type: "object"` before traversing descendants.

The declaration object may retain unrelated Pi fields; only fields consumed by this adapter are read. The parameter schema itself is preserved broadly.

### Phase 2: safe canonical source snapshot

`snapshotJson(value, declaration, path, depth, state)` walks the entire original parameter schema, including unreachable definitions and metadata values.

For every value it:

- checks depth before descent and source-node budget before processing;
- accepts only `null`, strings, booleans, and finite numbers as primitives;
- validates arrays with a Pi-schema-local strict array helper: exact `Array.prototype`, no symbols or extra own names, an own data descriptor for every index, and no holes/accessors; it then preserves indexes and freezes the copied array;
- validates objects with `plainObject`, rejects a source ancestor cycle, visits keys in lexical order, and freezes a fresh copied object;
- creates object members with `Object.defineProperty` (or an equivalent own-data-property primitive), never assignment, so a valid user key such as `__proto__` cannot mutate the output prototype;
- builds paths with identifier-dot notation where safe and JSON-escaped bracket notation otherwise;
- never reads a child through ordinary property access until its own property descriptor has been verified as a data descriptor;
- never mutates or freezes the caller's values.

The output is a detached, deeply frozen, key-sorted snapshot. All later pointer lookup and expansion use this snapshot, never the caller's graph.

### Phase 3: schema-position-aware expansion

`emitSchema(snapshotNode, rootSnapshot, path, depth, state)` accepts only boolean schemas or plain-object schemas. It distinguishes schema positions from arbitrary JSON-valued keyword positions.

Schema-bearing positions are:

- map of schemas: `properties`, `patternProperties`, `dependentSchemas`, `$defs`, `definitions`;
- schema or boolean: `additionalItems`, `additionalProperties`, `contains`, `contentSchema`, `else`, `if`, `items`, `not`, `propertyNames`, `then`, `unevaluatedItems`, `unevaluatedProperties`;
- arrays of schemas: `allOf`, `anyOf`, `oneOf`, `prefixItems`;
- Draft-07 `dependencies`: each map value is either a dense string array or a schema.

For Draft-07 tuple form, `items` may also be a dense array of schemas. User names inside schema maps are copied as names and their values are traversed as schemas; therefore a property named `$ref` or `definitions` is not interpreted as a keyword.

Known schema containers must have their required structural shape. Every unknown keyword value is emitted through bounded canonical JSON traversal without guessing that its nested objects are schemas. This preserves extension/annotation data and prevents `$ref`, `$id`, or `definitions` strings inside `default`, `examples`, or custom data from being interpreted or stripped.

`$defs` and `definitions` entries are still traversed and validated, including their references, even when unreachable. Their containers are omitted from emitted output only after the complete declaration expansion succeeds. This preserves the fail-closed statement that one malformed reference anywhere in a declaration invalidates that declaration set.

### Metadata handling

At schema-object key positions only, omit:

```text
$schema, $id, $anchor, $dynamicAnchor, $vocabulary, $comment
```

Do not inspect or remove those names when they are property names or keys inside arbitrary JSON annotation/default data. Do not strip any assertion keyword, including `format`, `pattern`, bounds, defaults, combinators, `additionalProperties`, `patternProperties`, or custom JSON-compatible keywords.

### Canonical and immutable output invariants

1. Every emitted object is newly created with lexical key insertion order, owns every copied key as a data property, is immune to `__proto__` setter effects, and is frozen.
2. Every emitted array has no custom prototype, holes, symbols, accessors, or extra own properties; it preserves input order and is frozen.
3. Shared input objects do not create mutable aliases; repeated references produce semantically independent immutable occurrences.
4. `JSON.stringify` of normalized output is independent of source object insertion order.
5. Array order is never canonicalized away because it can be semantic.
6. Declaration order remains Pi source order.
7. No input object or array is written to, sorted in place, or frozen.

## Safe local RFC 6901 resolver

### Accepted syntax

Only these reference strings are accepted:

- `#`, meaning the original declaration root;
- a string beginning `#/`, meaning an RFC 6901 JSON Pointer in the local URI fragment.

Everything else, including absolute/relative URIs, nonempty resource prefixes, anchors such as `#name`, and non-string `$ref` values, fails with `PI_TOOL_SCHEMA_REFERENCE_INVALID`.

For `#/...`:

1. Percent-decode the fragment's pointer text with `decodeURIComponent`; malformed percent encoding fails.
2. Split the decoded pointer on `/` after its initial slash.
3. Decode each token in one strict pass: `~0` becomes `~`, `~1` becomes `/`, and any other or trailing `~` escape fails.
4. On an object, require an own data property for the exact decoded token.
5. On an array, require `0` or a nonzero decimal without a leading zero, require a safe integer, require `index < length`, and reject `-`.
6. Reject traversal through primitives or a missing member.

The resolver returns both the target and a canonical token identity. It never includes the reference string or target value in an error.

### Cycle and repeated-reference handling

The expansion state tracks the identities of resolved target schema objects on the current reference chain, not a global visited set and not only raw `$ref` strings. This catches aliases and percent-encoding variants that resolve to the same recursive target while allowing the same definition to be expanded repeatedly in independent branches.

A direct JavaScript cycle is already rejected during snapshotting. A target already in the current reference chain fails with `PI_TOOL_SCHEMA_REFERENCE_CYCLE` at the calling schema's `$ref` path. Structural and reference descent both consume the depth budget, so a long acyclic reference chain cannot bypass depth 32.

### Reference siblings

At a schema object containing `$ref`:

1. Resolve and recursively emit the target.
2. Recursively emit a sibling schema made from all non-`$ref` members, applying normal metadata/definition handling.
3. If no effective sibling remains, emit the resolved target.
4. If the target is `true`, emit the sibling schema.
5. If the target is `false`, emit `false`.
6. Otherwise emit frozen canonical `{ allOf: [resolvedTarget, siblingSchema] }`.

This is deliberately stricter and more semantic than the reference repository's object spread. Object spread can overwrite a target assertion such as `type`, `required`, or `properties`; `allOf` preserves both sides of the conjunction. An invalid target shape, invalid sibling schema/container, cycle, or limit overflow is an unsafe sibling combination and fails the whole request. There is no overwrite, repair, or sibling omission.

## Limits and accounting

| Limit | Accounting rule | Failure |
|---|---|---|
| Depth 32 | Enforced independently while snapshotting and while emitting. Root is depth 0; any attempted node at depth 33 fails. A `$ref` hop consumes one expansion depth. | `PI_TOOL_SCHEMA_LIMIT` at the attempted node/callsite path. |
| Source nodes 2,048 | Every primitive, array, and object visited in the complete canonical source snapshot counts once per occurrence. | `PI_TOOL_SCHEMA_LIMIT`. |
| Expanded nodes 2,048 | Every logical emitted/validated primitive, array, and object counts per occurrence, including repeated reference expansion and definitions traversed before omission. Reused immutable snapshot subtrees still count at every logical emitted occurrence. | `PI_TOOL_SCHEMA_LIMIT`. |
| Per declaration 256 KiB | UTF-8 bytes of `JSON.stringify(normalized.parameters)` after expansion and stripping. | `PI_TOOL_SCHEMA_LIMIT` for that declaration at `$`. |
| Aggregate 1 MiB | Sum of canonical parameter-schema bytes in declaration source order; names/descriptions do not count, preserving current behavior. | `PI_TOOL_SCHEMA_LIMIT` naming the declaration that crosses the boundary at `$`. |

Using separate source and expanded counters prevents a safe no-reference schema from losing half the existing node budget merely because validation and emission are separate passes, while still capping both hostile input size and reference fan-out at 2,048. Neither counter is configurable or raised to the reference implementation's 10,000-node policy.

Byte checks are terminal safeguards, not substitutes for in-walk depth/node checks. No content is truncated.

## Error contract and deterministic precedence

### Stable errors

| Code | Meaning |
|---|---|
| `PI_TOOL_SCHEMA_PROFILE_UNSUPPORTED` | Missing, unknown, or forged enabled schema profile. |
| `PI_TOOL_SCHEMA_REFERENCE_INVALID` | Nonlocal/non-string/malformed/missing pointer, invalid index, non-schema target, or invalid sibling structure. |
| `PI_TOOL_SCHEMA_REFERENCE_CYCLE` | A local reference resolves into the current target chain. |
| `PI_TOOL_SCHEMA_INVALID` | Invalid root/schema container or hostile/non-JSON runtime representation. |
| `PI_TOOL_SCHEMA_LIMIT` | Depth, source-node, expanded-node, per-declaration byte, or aggregate byte limit. |

Existing declaration, duplicate, constrained-sampling, choice, and capability errors remain unchanged. All new codes include `SCHEMA`, so existing stream diagnostics continue to categorize them as `schema` without production diagnostic churn.

Messages remain exactly the `ToolPreflightError` shape:

```text
<CODE>: declaration <validated-safe-name> at <safe-structural-path>
```

They do not include reference text, schema values, descriptions, defaults, prompts, arguments, credentials, or upstream bodies.

### Precedence

The first error is deterministic in this order:

1. Context/selection identity mismatch.
2. Existing capability state rejection for disabled or fixture-qualified routes.
3. Missing or unsupported schema profile on an otherwise enabled selection.
4. Tool-array representation.
5. Declaration envelope in source order: object shape, name, duplicate name, description, constrained sampling, parameter-root object/type.
6. Source snapshot: depth, then source-node budget, then current value representation/cycle, with object children in canonical-key order and arrays in index order.
7. Schema expansion: depth, then expanded-node budget, then schema/container shape. At a `$ref` node, reference syntax/lookup/target/cycle precedes sibling expansion.
8. Per-declaration byte limit.
9. Next declaration.
10. Aggregate byte limit, checked after each completed declaration in source order.

A duplicate name therefore continues to outrank schema errors in the duplicate declaration. Capability/profile rejection always happens before inspecting user declaration values. Error precedence is testable and independent of object insertion order.

## All-or-nothing request invariant

`normalizeToolDeclarations` may allocate private normalized values while iterating, but it returns only after every declaration and aggregate bytes pass. On any error:

- no declaration array is returned;
- `prepareToolContext` returns nothing;
- `serializeContext` constructs no partial tools payload;
- the payload hook is not called;
- `fetch` is not called;
- no warning-and-skip diagnostic is emitted.

This is the principal intentional divergence from `Rahularya01/pi-antigravity`.

## Profile selection and compatibility isolation

Only this literal catalog route receives the profile:

```text
public ID:  antigravity-gemini-3.8-flash
reasoning:  off
wire model: gemini-3.8-flash-tiered
capability: enabled
profile:    gemini-parameters-json-schema
wire field: parametersJsonSchema
```

Every disabled capability has no schema profile. `serializeContext` checks capability before profile, preserving existing disabled-route diagnostics and preventing declaration normalization on another Gemini row, Claude, or GPT-OSS. A forged enabled selection with an absent/unknown profile reaches the explicit profile error and still fails before transport.

The request mapping remains:

```ts
prepared.declarations.map(({ name, description, parameters }) => ({
  name,
  description,
  parametersJsonSchema: parameters,
}))
```

No `parameters` property is added anywhere. Text-only contexts still bypass tool preparation and use `serializeTextContext` byte-for-byte.

## Strict TDD seam and test strategy

Implementation follows RED, GREEN, TRIANGULATE, REFACTOR. Tests stay in the same work unit as the behavior they prove.

### 1. Profile and route boundary

- RED: enabled capability requires the exact profile and disabled capabilities expose none.
- RED: `prepareToolContext`/normalizer reject missing and forged profiles before reading a getter-backed tool value.
- RED: disabled Gemini, Claude, and GPT-OSS tool contexts retain capability errors and zero fetch; their text-only goldens remain exact.
- GREEN: thread the literal through catalog -> selection -> context -> tool preparation.

### 2. Canonical Gemini preservation

Exact normalizer goldens cover:

- published `ask_user_choice` with root/nested `additionalProperties: false` and options `minItems`/`maxItems`;
- string, numeric, array, nested object, open object, schema-valued `additionalProperties`, and `patternProperties` constraints;
- defaults, combinators, nullable/union types, empty nested schemas, boolean nested schemas, and unchanged `const`;
- keyword-like property names;
- equivalent objects with different insertion order producing identical JSON bytes;
- preserved array order, declaration order, complete source equality, and recursive `Object.isFrozen` output checks.

### 3. Local reference resolver

Table-driven tests cover:

- `#`, `$defs`, Draft-07 `definitions`, repeated references, nested references, combinator references, Draft-07 dependencies, tuple/items references, escaped `~0`/`~1`, percent-decoded fragments, and valid array indexes;
- keyword-like user property names surviving while control containers disappear;
- sibling references represented conjunctively without overwriting target assertions;
- target `true`/`false` simplifications;
- external/resource/anchor refs, non-string refs, malformed percent or tilde escapes, missing members, leading-zero/negative/`-`/out-of-range indexes, primitive traversal, primitive targets, direct cycles, alias reference cycles, and long reference chains.

Assertions inspect exact canonical output and prove no emitted schema-position `$ref`, `$defs`, or `definitions` remains. A helper that searches schema positions, not arbitrary default data, avoids falsely treating user data as a control keyword.

### 4. Hostile runtime and limits

Use constructor helpers, not giant checked-in files, for:

- getters/accessors with a canary proving they were never invoked, including accessor-backed array indexes;
- inherited objects, symbols, class instances, array subclasses/custom prototypes, array symbols/extra properties, functions, `undefined`, `bigint`, sparse arrays, non-finite numbers, and direct object cycles;
- `__proto__` and other special own keys proving canonical output uses safe data-property creation without prototype mutation;
- depth 32 pass / 33 fail;
- source and expanded node 2,048 pass / 2,049 fail;
- repeated-reference fan-out;
- exact per-declaration and aggregate byte boundaries;
- insertion-order-independent first error.

The limit constants remain private. Tests construct real boundary inputs so production cannot expose a limit override.

### 5. Serializer and transport regressions

- Replace the simple context declaration golden with the complete `ask_user_choice` shape and assert `parametersJsonSchema` exactly, no `parameters`, unchanged context, and source declaration order.
- Add a mixed valid/invalid declaration transport test where the invalid declaration is second; assert `fetch` has zero calls and no accepted tool diagnostic is delivered.
- Add invalid profile, malformed reference, reference cycle, expansion limit, and aggregate limit transport rows; assert safe schema category/path and zero fetch.
- Keep current replay, response, stream, and probe tests green to prove lifecycle compatibility.

### Required verification

```text
npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts scripts/pi-tool-loop-probe.test.ts
npm run typecheck:pi
npm run build:pi
npm run typecheck
npm run build
npm run test:pack
npm test
```

No live call is required or authorized. Any baseline failure must be reproduced before attribution.

## Rollout

There is no feature flag, migration, state change, or runtime discovery.

1. Implement behind the existing exact route capability and explicit profile literal.
2. Land tests and documentation with each behavior unit.
3. Run the full hermetic verification and packed-consumer check.
4. Publish only through a separately authorized release action.
5. Continue to describe broader constrained/reference schema support as hermetically verified, not live-proven.

The catalog profile is the kill boundary. No other route becomes reachable as a side effect.

## Rollback

### Fast corrective rollback after publication

Set Gemini 3.8 Flash `off` tool capability to `disabled` and update its README status in one corrective release. This blocks tool-bearing requests before schema processing while preserving every text-only route. Do not skip declarations, route to another model, erase evidence, modify credentials, or unpublish without separate authorization.

### Full pre-publication rollback

Revert the profile field/threading, normalizer/resolver, associated tests/fixtures, and README wording as one behavior change. This restores the known 0.4.1 strict-subset limitation without touching tool lifecycle code, transport, OAuth, persisted state, evidence JSON, or root OpenCode behavior.

Because no durable state is added, no data migration or cleanup is needed.

## Changed-line forecast and cohesive work units

The proposal's 400-550 estimate is too optimistic once exact RFC 6901 behavior, sibling semantics, hostile-value boundaries, deterministic precedence, and zero-fetch integration coverage are kept with their tests. The honest forecast is **800-1,050 authored changed lines** (additions plus deletions, excluding no generated files because none are planned).

Approximate area forecast:

| Area | Changed lines |
|---|---:|
| `tool-schema.ts` replacement/extension | 260-340 |
| `tool-schema.test.ts` and optional compact fixture changes | 300-390 |
| catalog/context/tool-context profile wiring and focused tests | 110-150 |
| context/stream integration regressions | 90-125 |
| README | 15-25 |
| **Total** | **800-1,030**, rounded risk range **800-1,050** |

One PR would materially exceed the 400-line review budget. Under `ask-on-risk`, this forecast is a human-control gate before implementation; it is not approval for `size:exception` and does not select a chain strategy.

Candidate work units for a later user-selected chain are:

| Unit | Cohesive behavior and finished state | Likely files | Forecast | Rollback boundary |
|---|---|---|---:|---|
| A | Exact enabled route owns a required Gemini schema profile; all other routes remain isolated and old schema behavior still applies. | `catalog.ts`, `context.ts`, `tool-context.ts`, their focused tests, mechanical fixture-helper updates | 170-240 | Remove profile field/arguments and restore current calls; no schema behavior changed. |
| B | Gemini profile preserves canonical ordinary JSON Schema without references; `$ref` remains explicitly fail-closed until Unit C. Includes `ask_user_choice` request golden and truthful non-reference README wording. | `tool-schema.ts`, `tool-schema.test.ts`, `context.test.ts`, `README.md` | 300-390 | Revert broad profile traversal and its tests/docs to the old allowlist while retaining Unit A profile plumbing. |
| C | Local RFC 6901 references, definition removal, sibling conjunction, expansion limits, and zero-fetch reference failures are complete. README gains the reference contract. | `tool-schema.ts`, `tool-schema.test.ts`, `stream.test.ts`, optional fixture, `README.md` | 330-420 | Revert resolver behavior/tests and return to Unit B's explicit local-reference rejection. |

Unit C is near or potentially above the review budget even after one honest slicing pass; splitting resolver production from its safety tests is not acceptable. If task planning cannot keep it at or below 400 without code-golf or test separation, the smallest honest unit must be reported and the user must choose a chain adjustment or explicitly approve `size:exception` before apply.

These units are candidate review boundaries only. No chain strategy is selected by this design.

## Resolved questions and remaining gates

### Resolved

- The profile is explicit on enabled capability data, not inferred from model family.
- `const`, unions, empty nested schemas, and ordinary constraints are preserved rather than repaired.
- Metadata stripping is schema-position-aware and does not rewrite annotation/default data.
- Local pointers use strict RFC 6901 token handling against a frozen original snapshot.
- Reference sibling semantics use conjunction, never object overwrite.
- Repeated refs are allowed; current-chain target identity detects recursion.
- Source and expanded node budgets are each 2,048; no 10,000-node policy is adopted.
- Errors are deterministic, safe, all-or-nothing, and pre-fetch.
- No root OpenCode file or live evidence artifact changes.

### Human-control gates

1. **Delivery strategy:** the forecast exceeds 400 lines. Before implementation, the user must choose a chain strategy, reduce scope, or explicitly approve `size:exception` for the smallest cohesive over-budget unit.
2. **Publication:** any package release remains separately authorized.
3. **Live evidence:** any direct constrained/reference schema probe remains separately authorized and route-scoped.

No unresolved architecture question blocks task planning, but apply is blocked by the review-budget delivery decision.
