# Apply Progress: Align Pi Tool Schema Parity

## Status

**In progress — Unit A implementation is partially complete.** No persisted task checkbox has been marked complete because the Unit A RED/TRIANGULATE coverage required by its task rows is not yet complete. Units B and C have not started.

## Structured status consumed

- Change: `align-pi-tool-schema-parity`
- Action context: `repo-local`; authoritative workspace and all edits remain under `C:\Github\Ordico\opencode-antigravity-guard`.
- Delivery: user-selected `feature-branch-chain`; no branch, commit, PR, push, publication, credential access, live call, or evidence JSON rewrite was performed.
- Review budget: 400 changed lines per work unit. Current Unit A diff: 29 additions + 23 deletions = **52 changed lines**, below budget.
- Strict TDD: active from `openspec/config.yaml` and the global strict-TDD guidance.

## Unit A progress

### Implemented seam

- Added the `gemini-parameters-json-schema` profile literal and `ToolSchemaProfile` to the enabled catalog capability only.
- Threaded the selected profile through `serializeContext` to `prepareToolContext`.
- Added runtime profile validation before declaration normalization, preserving capability rejection before profile validation in `serializeContext`.
- Kept text-only serialization and all disabled route capability data unchanged.

### TDD Cycle Evidence

| Task | Test files | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Unit A profile boundary (partial) | `catalog.test.ts`, `context.test.ts`, `tool-context.test.ts` | Unit/integration seam | 81 focused tests passed before edits | Focused command failed with catalog assertion: expected `undefined` to equal `gemini-parameters-json-schema`; this is the intended missing-profile failure | Focused command passed: 81/81 after catalog/context/tool-context threading | Not complete; required disabled-route, forged-selection, source-order cases remain | Not complete; defer until required triangulation is present |

### Commands run

1. `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts` — baseline: 3 files passed, 81 tests passed.
2. Same focused command after RED — failed: 1 catalog test, expected missing profile (`undefined`).
3. Same focused command after GREEN — passed: 3 files, 81 tests.
4. `npm run typecheck:pi` — passed after the Unit A implementation.
5. `git diff --check -- [Unit A files]` — passed.

Runtime harness: N/A; this is the authorized hermetic catalog/context seam. No live probe or credential access occurred.

## Files changed

- `packages/pi/src/catalog.ts`
- `packages/pi/src/catalog.test.ts`
- `packages/pi/src/context.ts`
- `packages/pi/src/context.test.ts`
- `packages/pi/src/tool-context.ts`
- `packages/pi/src/tool-context.test.ts`

## Deviations

- The fixture-only `createEnabledToolCapability` currently supplies the admitted profile by default so untouched later-unit stream tests retain their existing fixture call shape. Runtime route admission has no inferred profile: `serializeContext` reads only the enabled capability field and `prepareToolContext` rejects a missing/forged profile.
- Unit A does not yet satisfy all its test-task rows, so no checkbox was changed.

## Remaining tasks

All implementation-owned rows remain unchecked, including the exact Unit A rows:

- [ ] **RED:** In `packages/pi/src/catalog.test.ts`, `packages/pi/src/tool-context.test.ts`, and `packages/pi/src/context.test.ts`, add failing cases for exact enabled-route profile ownership, absent profiles on disabled routes, missing/forged profile rejection before a getter-backed declaration is read, and unchanged disabled-route/text-only behavior; run the focused command and record the expected failures. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** In the Unit A allowed production surfaces, introduce the required `ToolSchemaProfile` literal, attach it only to the enabled capability, thread it through selection/context/preparation/normalization, and preserve capability-before-profile error precedence; run the focused command and record passing results. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Extend the same focused tests to cover another disabled Gemini row plus Claude and GPT-OSS rows, injected enabled selections with invalid profiles, and source-order-preserving valid declarations; run the focused command and record passing results. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Reduce only duplication introduced in Unit A while retaining runtime `unknown` validation and frozen capability fixtures; rerun the focused command and `npm run typecheck:pi`, recording exact results. <!-- sdd-owner: implementation -->

Unit B, Unit C, and whole-change verification rows are also unchanged.

## Workload / PR boundary

Feature-branch-chain plan: Unit A is the first intended PR boundary and is currently 52 changed lines. Its rollback boundary is the profile literal/capability field plus context/tool-context threading in the six Unit A files. No branch or PR was created by instruction.

## Automatic corrective rerun — Unit A completed

The persisted Unit A implementation rows were marked `[x]` after re-reading the artifact.

- Triangulation added disabled Gemini 3.7, Claude Sonnet, and GPT-OSS profile-absence checks, plus missing/forged profile getter-safety and forged injected-selection coverage.
- Refactor outcome: retained the small explicit boundary; no safe duplication remained to remove.
- Focused verification: `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts` passed **84/84**.
- Type verification: `npm run typecheck:pi` passed.
- Unit A remains under budget; no branch, commit, PR, live call, credential access, publication, or evidence rewrite occurred.

### TDD Cycle Evidence (completed Unit A)

| Task | Test file(s) | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Unit A RED | catalog/context/tool-context | Unit/integration seam | 81/81 passing | Expected missing-profile assertion failed before code | 81/81 passed after profile wiring | 84/84 passed | Focused suite passed after review |
| Unit A GREEN | catalog/context/tool-context | Unit/integration seam | 81/81 passing | Same profile-boundary RED | 81/81 passed | 84/84 passed | Focused suite passed after review |
| Unit A TRIANGULATE | catalog/context/tool-context | Unit/integration seam | 81/81 passing | N/A; behavior already green | N/A | 84/84 passed across disabled families and forged profiles | Focused suite passed after review |
| Unit A REFACTOR | catalog/context/tool-context | Unit/integration seam | 84/84 passing | N/A | N/A | N/A | `npm run typecheck:pi` passed; no additional refactor was needed |

## Remaining work

Units B and C plus both whole-change verification rows remain unchecked. Unit B has not started in this corrective rerun.

## Unit B completed — non-reference Gemini normalization

### Structured status consumed

- Change: `align-pi-tool-schema-parity`; user explicitly selected Unit B on `feat/pi-tool-schema-parity-02-normalization`, based on Unit A commit `b7a2016`.
- Action context: `repo-local`; all writes remained within the supplied allowed edit surfaces under `C:\Github\Ordico\opencode-antigravity-guard`.
- Delivery: authorized Feature Branch Chain; this is Unit B only. Unit C and whole-change verification are out of scope.
- Review budget: against `b7a2016`, Unit B is **132 additions + 76 deletions = 208 changed lines**, below the 400-line budget.
- Strict TDD: active from `openspec/config.yaml` and the strict-TDD guidance.

### Completed implementation tasks and checkbox evidence

- Marked the four Unit B implementation rows (`RED`, `GREEN`, `TRIANGULATE`, and `REFACTOR`) `[x]` in `tasks.md` immediately after the focused suite and Pi typecheck passed.
- Re-read `tasks.md` after updating it and confirmed all four Unit B rows are visibly `[x]`.

### TDD Cycle Evidence

| Task | Test file(s) | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Unit B RED | `tool-schema.test.ts`, `context.test.ts` | Unit/integration serialization seam | 55/55 focused tests passed before edits | Focused command failed as expected: `ask_user_choice` failed with `PI_TOOL_SCHEMA_UNSUPPORTED` at `$.additionalProperties`; old `const` expectation also exposed the lossy enum conversion | 52/52 passed after canonical non-reference traversal and context golden updates | 54/54 passed after hostile/runtime and limit cases | 54/54 passed after fixture consolidation and README update |
| Unit B GREEN | `tool-schema.test.ts`, `context.test.ts` | Unit/integration serialization seam | Same 55/55 baseline | Same schema-preservation RED | 52/52 focused tests passed | 54/54 focused tests passed | `npm run typecheck:pi` passed |
| Unit B TRIANGULATE | `tool-schema.test.ts` | Unit | 52/52 after GREEN | Added an accessor-backed array-index test that failed with `CANARY-index`, proving the first traversal still invoked it | Replaced `Array.map` access with own-descriptor reads; 54/54 passed | Covers accessor/inherited/class/symbol/function/undefined/bigint/non-finite/sparse/cycle values, `__proto__`, deterministic lexical error precedence, depth/source-node/per-declaration bytes, and aggregate rejection | No unrelated behavior refactor |
| Unit B REFACTOR | `tool-schema.test.ts`, fixture, README | Unit/documentation | 54/54 focused tests | N/A | N/A | N/A | Removed obsolete constraint rejection fixture row; retained only reference rejection as the single rejection expectation source; documented exact hermetic non-reference boundary |

### Files changed

- `packages/pi/src/tool-schema.ts` — replaces the legacy allowlist with detached canonical JSON snapshots and schema-position-aware non-reference emission; preserves ordinary JSON Schema values, strips only schema-position metadata, rejects `$ref`/definition controls until Unit C, and preserves deep-frozen safe output.
- `packages/pi/src/tool-schema.test.ts` — adds `ask_user_choice`, schema preservation, canonicalization, immutability, hostile runtime, deterministic ordering, accessor, and limit coverage.
- `packages/pi/src/context.test.ts` — adds complete `ask_user_choice` `parametersJsonSchema` serialization with no legacy `parameters` field and updates canonical-order expectations.
- `packages/pi/fixtures/tools/schema-rejections.json` — removes the obsolete ordinary-constraint rejection row while retaining reference rejection.
- `packages/pi/README.md` — limits the non-reference profile statement to Gemini 3.8 Flash `off` and distinguishes hermetic evidence from live acceptance.
- `openspec/changes/align-pi-tool-schema-parity/tasks.md` — marks Unit B implementation tasks complete.

### Commands run

1. `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/context.test.ts` — baseline passed: 2 files, 55 tests.
2. Same focused command after RED — failed as expected: 3 tests failed, including `PI_TOOL_SCHEMA_UNSUPPORTED: declaration ask_user_choice at $.additionalProperties`.
3. Same focused command after GREEN — passed: 2 files, 52 tests.
4. Same focused command after TRIANGULATE accessor RED — failed as expected: `CANARY-index` showed an array getter had been invoked.
5. Same focused command after TRIANGULATE GREEN/REFACTOR — passed: 2 files, 54 tests.
6. `npm run typecheck:pi` — passed.
7. `git diff --check` — passed before and after the persisted OpenSpec artifact updates.

Runtime harness: N/A. Unit B is a hermetic normalization/serialization seam; no live probe, credential access, evidence rewrite, publication, branch/PR creation, commit, push, or network call occurred.

### Deviations and remaining work

- No design deviation: profile admission remains at the Unit A context/tool-context boundary; Unit B normalizes only after that admitted profile path.
- `$ref`, `$defs`, and `definitions` are explicitly fail-closed in Unit B; local-reference resolution remains Unit C work.
- Remaining implementation-owned rows are Unit C plus whole-change verification, all intentionally unchecked and out of this authorized slice.

### Workload / rollback boundary

- PR boundary: Feature Branch Chain Unit B, directly dependent on Unit A (`b7a2016`), with Unit C as the next follow-up boundary.
- Rollback: revert the Unit B normalizer, paired tests/fixture update, context golden, and README statement together; Unit A route/profile isolation remains intact.

## Unit C completed — local reference resolver

### Structured status consumed

- Change: `align-pi-tool-schema-parity`; Unit C was explicitly authorized on `feat/pi-tool-schema-parity-03-references`, based directly on Unit B commit `4c8a9a0`.
- Action context: `repo-local`; all edits stayed within the supplied Unit C edit surfaces. No action-context warnings applied.
- Delivery: Feature Branch Chain. Unit C is the current PR boundary; no branch, commit, PR, push, publication, credential access, live call, or evidence rewrite was performed.
- Strict TDD: active from `openspec/config.yaml` and the global strict-TDD guidance.
- Review budget: against `4c8a9a0`, Unit C is **176 additions + 12 deletions = 188 changed lines**, below the 400-line budget.

### Completed tasks and persisted checkbox evidence

- Marked all four Unit C implementation rows (`RED`, `GREEN`, `TRIANGULATE`, and `REFACTOR`) `[x]` in `tasks.md` after focused-test and typecheck evidence.
- Re-read `tasks.md` after the update and confirmed the four Unit C rows are visibly checked.

### TDD Cycle Evidence

| Task | Test file(s) | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Unit C RED | `tool-schema.test.ts` | Unit | 84/84 focused tests passed | New local-reference test failed with `PI_TOOL_SCHEMA_REFERENCE_INVALID` at `$.$defs` | 85/85 passed after resolver implementation | 87/87 passed after pointer, sibling, cycle, and limit coverage | 88/88 passed after integration/doc review |
| Unit C GREEN | `tool-schema.test.ts` | Unit | 84/84 focused tests passed | Same reference-expansion RED | 85/85 passed | 87/87 passed | Focused suite and typecheck passed |
| Unit C TRIANGULATE | `tool-schema.test.ts`, `stream.test.ts` | Unit/integration preflight seam | 85/85 after GREEN | Added pointer variants, sibling conjunction, boolean simplification, dependency/tuple positions, unsafe-reference, cycle, chain, and repeated-expansion cases | Existing generalized resolver passed 87/87 | Mixed valid/invalid transport case passed with zero payload-hook and fetch calls | Focused suite and typecheck passed |
| Unit C REFACTOR | `tool-schema.ts`, `README.md` | Unit/documentation | 88/88 focused tests | N/A | N/A | N/A | Kept resolver helpers small and auditable; documented route-scoped local-reference boundary; focused suite and Pi typecheck passed |

### Files changed

- `packages/pi/src/tool-schema.ts` — resolves local `#`/`#/...` pointers from the immutable snapshot, validates unreachable definition containers, supports RFC 6901 escapes/percent decoding and array indexes, preserves siblings as `allOf`, removes successfully traversed definition containers, and applies reference-chain/expanded-node limits.
- `packages/pi/src/tool-schema.test.ts` — covers definitions, nested/repeated/combinator references, escaped and encoded tokens, tuple/dependency positions, sibling/boolean semantics, invalid pointers, cycles, chain depth, and repeated expansion limits.
- `packages/pi/src/stream.test.ts` — proves a mixed valid/invalid declaration set reaches neither payload hook nor fetch and produces safe schema preflight diagnostics.
- `packages/pi/README.md` — documents local-reference support only for Gemini 3.8 Flash `off` and distinguishes hermetic safety coverage from live acceptance.
- `openspec/changes/align-pi-tool-schema-parity/tasks.md` — records all four completed Unit C task rows.

### Commands run

1. `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` — safety net: 3 files, 84/84 tests passed.
2. Same focused command after RED — failed as intended: `PI_TOOL_SCHEMA_REFERENCE_INVALID: declaration tool at $.$defs`.
3. Same focused command after GREEN — passed: 3 files, 85/85 tests.
4. Same focused command after triangulation — passed: 3 files, 87/87 tests.
5. Same focused command after integration test and refactor review — passed: 3 files, 88/88 tests.
6. `npm run typecheck:pi` — passed.
7. `git diff --check 4c8a9a0 -- [Unit C surfaces]` — passed.

Runtime harness: N/A. The authorized transport-spy boundary proves preflight fails before both payload hooks and `fetch`; no live probe, credential access, evidence rewrite, publication, commit, branch, PR, or push occurred.

### Deviations and remaining work

- No design deviation: reference expansion remains local-only and operates on the pre-emission immutable snapshot; external and unsafe references remain fail-closed.
- The optional fixture and `context.test.ts` were not changed because the compact normalizer and transport coverage kept a single source of rejection behavior and existing context serialization remained applicable.
- The two whole-change verification rows remain intentionally unchecked and are reserved for `sdd-verify`.

### Workload / rollback boundary

- PR boundary: Feature Branch Chain Unit C, dependent on Unit B commit `4c8a9a0`; this is the final implementation unit before whole-change verification.
- Rollback: revert the Unit C resolver, its paired normalizer/transport tests, and README reference wording together; this restores Unit B's reference rejection without changing profile isolation or lifecycle code.

## Whole-change verification completed

### Structured status and baseline

- Change: `align-pi-tool-schema-parity`; user authorized only the two implementation-owned whole-change verification rows on `feat/pi-tool-schema-parity-03-references` at `72d926947e481c9b55846c0b50bdce9a218f6e17`.
- Action context: `repo-local`; only `tasks.md` and this `apply-progress.md` were written. No production, test, documentation, credential, evidence, package-version, branch, commit, PR, push, or publication change was made.
- Strict TDD: active. This verification-only task added no behavior, so RED/GREEN/TRIANGULATE/REFACTOR code cycles were not applicable; the required checks are the completion evidence.
- Baseline `git status --short`: modified `.atl/.skill-registry.cache.json`, `.atl/skill-registry.md`, `.gitignore`; untracked `.pi/` and `openspec/changes/align-pi-tool-schema-parity/`. These were ambient and untouched. The checked-out branch and commit matched the authorization. No inherited command failure was found.

### Exact verification outcomes

1. `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts scripts/pi-tool-loop-probe.test.ts` — **passed**, 7/7 files and 175/175 tests; 0 failures.
2. `npm run typecheck:pi` — **passed**; Pi workspace TypeScript check completed with 0 diagnostics.
3. `npm run build:pi` — **passed**; Pi workspace TypeScript build completed with 0 diagnostics.
4. `npm run typecheck` — **passed**; core build and root TypeScript check completed with 0 diagnostics.
5. `npm run build` — **passed**; core and root builds completed with 0 diagnostics.
6. `npm run test:pack` — **passed**; root/core Node 20 and Pi Node 22 packed-consumer checks passed. npm emitted dependency deprecation warnings only; no test or command failure occurred.
7. `npm test` — **passed**, 60/60 files and 1,384 tests passed (25 todo; 0 failures). Existing Gemini invalid-aspect-ratio stderr output was expected test logging, not a failure.

### TDD Cycle Evidence

| Task | Test file(s) | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Whole-change focused verification | 7 specified Pi/probe suites | Unit/integration | 175/175 passed | N/A—verification-only | 175/175 passed | N/A—no behavior change | N/A—no code changed |
| Whole-change type/build/package/full verification | Pi/root workspace and full Vitest suite | Integration | Baseline repository state captured | N/A—verification-only | All six commands passed; full suite 1,384/1,384 | N/A—no behavior change | N/A—no code changed |

### Persisted task and workspace evidence

- Marked both whole-change verification rows `[x]` immediately after their complete command groups passed.
- Builds created ignored `dist/`, `packages/core/dist/`, and `packages/pi/dist/` directories; these known disposable outputs were removed. Final Git status matches the ambient baseline except for the permitted OpenSpec artifact updates within the already-untracked change directory.
- All implementation-owned rows are now checked. Workload/PR boundary: verification-only, 0 authored production/test/documentation lines; no delivery action was taken.

## Verification remediation completed

### Structured status and scope

- Consumed parent authority for `align-pi-tool-schema-parity` at `72d9269` on `feat/pi-tool-schema-parity-03-references`; `repo-local` action context and the five supplied edit surfaces were respected.
- This bounded correction is **85 authored lines** (74 additions, 11 deletions) across production/tests, below the explicit 200-line correction maximum and 400-line review budget; no delivery action, live call, credential access, evidence rewrite, commit, push, PR, or publication occurred.
- The initial focused safety net had 57 passing schema/context tests, while `stream.test.ts` could not resolve the missing built core package. `npm run build` restored only ignored build artifacts without source changes, after which the stream suite passed. `npm run build:pi` had the same pre-build resolution failure.

### Completed persisted tasks

- Marked both verification-remediation implementation rows `[x]` in `tasks.md` after the focused suite and Pi typecheck passed.
- Re-read `tasks.md` and confirmed both remediation rows are visibly `[x]`; there are no remaining unchecked implementation-owned rows.

### TDD Cycle Evidence

| Task | Test file(s) | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Safe diagnostic paths | `tool-schema.test.ts` | Unit | 14/14 passed | Hostile newline key failed with an injected second diagnostic line | 15/15 passed after the reusable formatter | Quote/bracket key also passed with JSON-escaped bracket notation | Reused formatter for snapshots, schema maps, dependency maps, and `$ref` paths |
| Missing Unit C matrix | `tool-schema.test.ts`, `stream.test.ts` | Unit/integration | 15/15 schema; 31/31 stream after build restoration | N/A—coverage remediation against verified behavior | N/A | 16/16 schema and 32/32 stream cover `~0`, malformed percent, alias cycle, 2,048/2,049 expanded nodes, aggregate bytes, unreachable malformed definitions, and five zero-hook/zero-fetch rows | Consolidated rows with local builders; no production semantic change beyond safe paths |

### Files changed

- `packages/pi/src/tool-schema.ts` — adds one safe path-segment formatter and applies it to snapshot, schema-map, dependency-map, and `$ref` diagnostics.
- `packages/pi/src/tool-schema.test.ts` — adds hostile-key and reference/limit boundary coverage.
- `packages/pi/src/stream.test.ts` — adds malformed-ref, cycle, expansion-limit, aggregate-limit, and forged-profile pre-transport rows.
- `openspec/changes/align-pi-tool-schema-parity/tasks.md` — records both completed remediation tasks.

### Verification

1. `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` — passed, **3/3 files and 91/91 tests**.
2. `npm run typecheck:pi` — passed with zero diagnostics.
3. `git diff --check -- [allowed production/test surfaces]` — passed.

Runtime-harness boundary: N/A; hermetic pre-transport spies confirmed every invalid transport row made zero payload-hook and `fetch` calls. Rollback boundary: revert the formatter and its paired schema/stream coverage together, retaining the original Unit C resolver behavior.
