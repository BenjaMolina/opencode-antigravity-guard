# Tasks: Align Pi Tool Schema Parity

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 800–1,050 authored additions + deletions; no generated artifacts planned |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: profile boundary (170–240) → PR 2: non-reference Gemini normalization and regression/docs (300–390) → PR 3: local-reference resolver and safety/transport coverage (330–420) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

## Delivery gate

The complete change is estimated at 800–1,050 authored changed lines and cannot proceed as one within the 400-line budget. The smallest honest candidate unit that may itself exceed the budget is **PR 3 / Unit C (330–420)**: its resolver implementation cannot be separated from reference-safety, limit, and zero-fetch tests without breaking its review and rollback boundary.

Before apply, a human must select a chain strategy, reduce Unit C scope to a demonstrably ≤400-line autonomous unit, or explicitly authorize `size:exception` for that unit. This plan does **not** select a chain strategy or exception. Do not run a live model probe, use credentials, rewrite evidence JSON, publish, or enable another route; those actions are N/A and separately authorized.

## Unit A — Explicit profile ownership and route isolation (170–240 lines)

**Start:** The enabled Gemini route reaches the profile-agnostic normalizer; no capability carries a schema-profile literal.
**Allowed edit surfaces:** `packages/pi/src/catalog.ts`, `packages/pi/src/catalog.test.ts`, `packages/pi/src/context.ts`, `packages/pi/src/context.test.ts`, `packages/pi/src/tool-context.ts`, `packages/pi/src/tool-context.test.ts`. Mechanical helper-call updates are allowed only in these tests.
**Excluded surfaces:** `packages/pi/src/tool-schema.ts`, `packages/pi/src/stream.ts`, `packages/pi/README.md`, `scripts/`, root `src/`, `packages/core/`, evidence JSON.
**Finish:** Only `antigravity-gemini-3.8-flash/off` owns the literal `gemini-parameters-json-schema`; tool-disabled routes remain capability-rejected before declaration inspection and text-only serialization remains byte-for-byte unchanged.
**Focused command:** `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts`.

- [x] **RED:** In `packages/pi/src/catalog.test.ts`, `packages/pi/src/tool-context.test.ts`, and `packages/pi/src/context.test.ts`, add failing cases for exact enabled-route profile ownership, absent profiles on disabled routes, missing/forged profile rejection before a getter-backed declaration is read, and unchanged disabled-route/text-only behavior; run the focused command and record the expected failures. <!-- sdd-owner: implementation -->
- [x] **GREEN:** In the Unit A allowed production surfaces, introduce the required `ToolSchemaProfile` literal, attach it only to the enabled capability, thread it through selection/context/preparation/normalization, and preserve capability-before-profile error precedence; run the focused command and record passing results. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Extend the same focused tests to cover another disabled Gemini row plus Claude and GPT-OSS rows, injected enabled selections with invalid profiles, and source-order-preserving valid declarations; run the focused command and record passing results. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Reduce only duplication introduced in Unit A while retaining runtime `unknown` validation and frozen capability fixtures; rerun the focused command and `npm run typecheck:pi`, recording exact results. <!-- sdd-owner: implementation -->

**Runtime-harness boundary:** N/A—this is a hermetic catalog/context admission seam; live probing and credential access are not authorized.
**Rollback boundary:** Revert the profile type/literal, capability field, and argument threading in Unit A allowed surfaces together; this restores existing capability admission without changing schema semantics, transport, or text-only behavior.

## Unit B — Lossless non-reference Gemini normalization and request regression (300–390 lines)

**Start:** Unit A has landed; the selected profile is explicit, while the normalizer still enforces the obsolete keyword allowlist.
**Allowed edit surfaces:** `packages/pi/src/tool-schema.ts`, `packages/pi/src/tool-schema.test.ts`, `packages/pi/src/context.test.ts`, `packages/pi/README.md`; optionally replace or remove obsolete rows in `packages/pi/fixtures/tools/schema-rejections.json` rather than creating a parallel expectation source.
**Excluded surfaces:** `packages/pi/src/catalog.ts`, `packages/pi/src/context.ts`, `packages/pi/src/tool-context.ts`, `packages/pi/src/stream.ts`, `scripts/`, root `src/`, `packages/core/`, and evidence JSON.
**Finish:** The Gemini profile preserves structurally safe ordinary JSON Schema and canonical immutable output without reference expansion; `$ref` remains explicitly fail-closed until Unit C. `ask_user_choice` serializes only through `parametersJsonSchema`, and README wording remains limited to hermetic non-reference evidence at this stage.
**Focused command:** `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/context.test.ts`.

- [x] **RED:** Replace obsolete strict-subset rejection expectations in `packages/pi/src/tool-schema.test.ts` with failing exact-output cases for `ask_user_choice`, scalar/array/object constraints, open and schema-valued `additionalProperties`, `patternProperties`, `const`, combinators, defaults, boolean/empty nested schemas, keyword-like `properties` names, canonical ordering, source immutability, deep freezing, and explicit nonlocal/reference rejection; add the failing `ask_user_choice` `parametersJsonSchema` context golden with no legacy `parameters`, then run the focused command and record expected failures. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Replace the legacy allowlist in `packages/pi/src/tool-schema.ts` with profile-gated, schema-position-aware canonical snapshot/emission for non-reference schemas; preserve only safe JSON values and ordinary assertions, strip only listed metadata at schema-keyword positions, retain root-object policy and existing declaration checks/limits, and make source/output immutability explicit; run the focused command and record passing results. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Add boundary tests in `packages/pi/src/tool-schema.test.ts` for getters without invocation, inherited/class/symbol/function/undefined/bigint/non-finite/sparse values, direct cycles, `__proto__` own keys, deterministic first-error ordering, depth/source-node/per-declaration-byte limits, and all-declaration aggregate failure without omission; run the focused command and record passing results. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Consolidate test builders or the single rejection fixture only where it leaves one source of schema expectations; update `packages/pi/README.md` with the exact Gemini 3.8 Flash `off` non-reference profile boundary and no live-acceptance claim; rerun the focused command and `npm run typecheck:pi`, recording exact results. <!-- sdd-owner: implementation -->

**Runtime-harness boundary:** N/A—normalization and request serialization are hermetically tested; the live probe, credentials, evidence record, publication, and any route enablement are not authorized.
**Rollback boundary:** Revert Unit B normalizer traversal, its paired tests/fixture rows, the context golden, and the staged README statement together; Unit A profile isolation remains and `$ref` returns to rejection.

## Unit C — Local-reference resolver, expansion safety, and prefetch integration (330–420 lines; may exceed budget)

**Start:** Units A and B have landed; ordinary non-reference schemas are preserved under the route-scoped profile and references fail closed.
**Allowed edit surfaces:** `packages/pi/src/tool-schema.ts`, `packages/pi/src/tool-schema.test.ts`, `packages/pi/src/stream.test.ts`, `packages/pi/src/context.test.ts`, `packages/pi/README.md`; optionally update `packages/pi/fixtures/tools/schema-rejections.json` only as the single existing compact rejection-data source.
**Excluded surfaces:** `packages/pi/src/catalog.ts`, `packages/pi/src/context.ts`, `packages/pi/src/tool-context.ts`, production `packages/pi/src/stream.ts`, `scripts/`, root `src/`, `packages/core/`, evidence JSON, OAuth, transport headers, replay/recovery code.
**Finish:** Local RFC 6901 references are safely expanded against the frozen original schema; output removes resolved control containers but preserves sibling conjunction and user property names. Invalid references, expansion limits, and mixed declaration sets fail before payload hook/fetch.
**Focused command:** `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts`.

- [x] **RED:** Add failing table-driven normalizer tests for `#`, `$defs`, Draft-07 `definitions`, repeated/nested/combinator references, escaped and percent-decoded tokens, valid array indexes, tuple/items and dependencies positions, sibling conjunction, and true/false target simplification; add failing safe-error rows for all invalid/external/malformed/missing/primitive/cyclic references and invalid indexes, then run the focused command and record expected failures. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Implement the local-only RFC 6901 resolver and schema-position-aware expansion in `packages/pi/src/tool-schema.ts` against the immutable original snapshot; remove only successfully resolved `$ref`, `$defs`, and `definitions` control containers, retain reference siblings through canonical `allOf`, and preserve all-or-nothing declaration order; run the focused command and record passing results. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Add failing-then-passing boundary cases for alias/reference-chain cycles, depth through hops, repeated-reference expanded-node accounting at 2,048/2,049, exact aggregate bytes, invalid unreachable definition content, keyword-like property names, and insertion-order-independent diagnostics; in `packages/pi/src/stream.test.ts`, add mixed valid/invalid, malformed-reference, cycle, expansion-limit, aggregate-limit, and forged-profile rows proving safe schema category/path plus zero payload-hook and `fetch` calls; run the focused command and record passing results. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Refactor only resolver/test helpers needed to make pointer decoding, safe descriptor access, accounting, and error precedence auditable; finalize `packages/pi/README.md` with local-reference support limited to Gemini 3.8 Flash `off` and an explicit hermetic-versus-live-evidence distinction; rerun the focused command and `npm run typecheck:pi`, recording exact results. <!-- sdd-owner: implementation -->

**Runtime-harness boundary:** N/A—zero-fetch transport-spy coverage is the authorized runtime boundary. Do not execute `npm run probe:pi-tool-loop`, access credentials, alter evidence, publish, or claim direct backend acceptance.
**Rollback boundary:** Revert the resolver, reference-specific normalizer logic, paired schema/context/stream tests, fixture rows, and README reference wording as one unit; this returns to Unit B’s explicit reference rejection without changing Unit A isolation or tool lifecycle code.

## Verification remediation — Safe diagnostics and complete Unit C evidence

**Allowed edit surfaces:** `packages/pi/src/tool-schema.ts`, `packages/pi/src/tool-schema.test.ts`, `packages/pi/src/stream.test.ts`, `openspec/changes/align-pi-tool-schema-parity/tasks.md`, and `openspec/changes/align-pi-tool-schema-parity/apply-progress.md`.

- [x] **RED/GREEN:** Escape hostile schema-key path segments with safe identifier-dot or JSON-escaped bracket notation, and prove control characters cannot inject diagnostic lines. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE/REFACTOR:** Add the missing Unit C reference-boundary and zero-hook/zero-fetch transport matrix identified by failed verification revision `sha256:019e60986246bd3e8e23180c3358472f938cbb620f9e3ef06b43a45fd9de94c5`; reconcile apply evidence and rerun the focused suite plus `npm run typecheck:pi`. <!-- sdd-owner: implementation -->

**Runtime-harness boundary:** Hermetic pre-transport tests only; no live model call, credentials, evidence rewrite, or publication.
**Rollback boundary:** Revert the safe-path formatter and its paired missing-coverage tests together, preserving the original Unit C resolver behavior.

## Whole-change verification after an authorized delivery decision

**Allowed edit surfaces:** None; verification must not create source, evidence, credential, or publication changes.
**Required commands:**

- [x] Establish any inherited failure on the implementation baseline, then run `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts scripts/pi-tool-loop-probe.test.ts` and record exact results. <!-- sdd-owner: implementation -->
- [x] Run `npm run typecheck:pi`, `npm run build:pi`, `npm run typecheck`, `npm run build`, `npm run test:pack`, and `npm test`; record exact results and attribute any baseline failure rather than treating it as a pass. <!-- sdd-owner: implementation -->

**Runtime-harness boundary:** N/A—these are hermetic type/build/package/test checks; no live model call, credentials, evidence rewrite, publication, or route-enable action is authorized.
**Rollback boundary:** No verification-only rollback is required; if a behavioral regression appears, revert only the corresponding completed Unit A, B, or C boundary above.
