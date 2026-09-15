```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d89485edbb853bb5766430cb73b5bc24965395664cab4929ef1aae182be8110c
verdict: pass
blockers: 0
critical_findings: 0
requirements: 3/3
scenarios: 9/9
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:5f94ebb7c535fb60ba3b8360608e09ae13c37b732294db54aef560de3ca9a61c
build_command: npm run build && npm run build:pi
build_exit_code: 0
build_output_hash: sha256:aa92d18d188ed1f81982f903d0e2441fc72b8e3883f6d2746808dcc78b1e98d9
```

# Verification Report: Align Pi Tool Schema Parity

## Status

**PASS — archive-ready from verification.** All 3 requirements and 9 scenarios are complete, all 16 task rows are checked and substantiated, strict-TDD GREEN is current, and no blocker remains.

## Relation to the previous failed report

This report replaces the previous FAIL at `openspec/changes/align-pi-tool-schema-parity/verify-report.md` (content digest `sha256:019e60986246bd3e8e23180c3358472f938cbb620f9e3ef06b43a45fd9de94c5`; prior envelope evidence revision `sha256:0d341964d7c391723483021e1deabbcca107c8e774d6d8b8e18be0ce083b9e26`). The two prior blockers were independently rechecked:

1. **Safe diagnostic paths — resolved.** `pathSegment()` uses identifier-dot notation only for safe ASCII identifiers and JSON-escaped bracket notation otherwise. The hostile newline and quote/bracket regressions assert the exact escaped path and prove `String(error)` contains no injected newline.
2. **Incomplete Unit C evidence — resolved.** Checked-in tests now cover `~0`, malformed percent decoding, alias/two-node cycles, the 2,048 expanded-node pass boundary and rejection on the next attempted node, exact aggregate-byte pass/overflow boundaries, malformed unreachable definitions, and five malformed-reference/cycle/expansion-limit/aggregate-limit/forged-profile transport rows with zero payload-hook and zero `fetch` calls.

## Scope, structured status, and action context

- Change selection is unambiguous by explicit user authority: `align-pi-tool-schema-parity`.
- Verified branch: `feat/pi-tool-schema-parity-03-references`; HEAD: `72d926947e481c9b55846c0b50bdce9a218f6e17` plus the bounded uncommitted remediation in the three authorized production/test files.
- Parent native status was stale and listed multiple active changes, but the user explicitly selected this exact change and authorized `verification-after-remediation`; no dependency blocker remained.
- Action context is `repo-local`; implementation ownership and all target files are proven under `C:/Github/Ordico/opencode-antigravity-guard`.
- The only repository write made by verification is this report. Ambient `.atl/*`, `.gitignore`, `.pi/`, source/test remediation, tasks, and apply-progress state were preserved.
- Strict TDD is active from `openspec/config.yaml` and the global verification guidance.

## Spec and scenario coverage

| Requirement | Result | Scenario coverage and evidence |
|---|---|---|
| Explicit isolated Gemini profile | Complete | Catalog/context/tool-context tests prove only `antigravity-gemini-3.8-flash/off` is enabled with the named profile; disabled Gemini, Claude, and GPT-OSS tool routes reject before transport; text-only serialization remains unchanged; declarations use `parametersJsonSchema` only. |
| Explicit evidence boundary | Complete | README limits support to Gemini 3.8 Flash `off`, distinguishes hermetic serialization/safety from live backend acceptance, and does not repurpose simple echo evidence as broad schema proof. |
| Bounded immutable normalization | Complete | Exact normalizer and transport tests cover ordinary constraints, `ask_user_choice`, canonical immutable output, local references, sibling conjunction, safe diagnostics, hostile values, all limits, malformed unreachable definitions, and all-or-nothing zero-transport failure. |

Scenarios complete: enabled profile; disabled isolation; accurate documentation; no implied live claim; preserved `const` and immutability; safe lossy-input rejection; complete `ask_user_choice`; local-reference expansion; and one-invalid-declaration all-or-nothing rejection. **Total: 3/3 requirements and 9/9 scenarios.**

## Corrective-code verification

- `packages/pi/src/tool-schema.ts`: every arbitrary schema-key path construction now goes through `pathSegment()` in snapshot traversal, schema maps, definition maps, dependency maps, and `$ref` diagnostics.
- Local pointer decoding accepts `~0` and `~1`, rejects malformed percent and tilde escapes, supports strict array indexes, and detects reference-target identity cycles including aliases and two-node cycles.
- Definition containers are fully traversed before omission, so malformed unreachable definitions fail closed.
- Expansion counting rejects the first attempted node beyond 2,048; aggregate bytes accept exactly 1 MiB and reject one additional byte.
- `packages/pi/src/stream.test.ts` exercises malformed percent, two-node cycle, expansion overflow, aggregate overflow, and forged profile rows. Every row asserts a schema preflight error and zero payload-hook/`fetch` calls.

## Task completion

No unchecked implementation marker matching `^\s*- \[ \]` remains. All 16 rows are visibly `[x]`: 12 Unit A/B/C implementation rows, 2 bounded-remediation rows, and 2 whole-change verification rows. Apply-progress contains current remediation evidence and exact command outcomes. No stale-checkbox exception is needed.

## Strict TDD compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | Apply-progress contains Unit A, Unit B, Unit C, whole-change, and remediation `TDD Cycle Evidence` tables. |
| All behavior tasks have tests | ✅ | 14/14 implementation/remediation behavior rows identify existing test files; the remaining 2 rows are verification-only command tasks. |
| RED evidence cross-checked | ✅ | Historical failing assertions are recorded; test files exist. RED was not replayed because checkout mutation was prohibited. |
| GREEN confirmed | ✅ | Focused suite passed 178/178 and full suite passed 1,387/1,387 executed tests. |
| Triangulation adequate | ✅ | The prior Unit C gaps are represented by successful/reference/error/limit/transport variants rather than one happy path. |
| Safety nets for modified files | ✅ | Unit safety nets are recorded, and all five changed test files pass in the focused/full runs. |

**TDD compliance: 6/6 checks passed.**

### Test layer distribution for changed test files

| Layer | Tests | Files | Tool |
|---|---:|---:|---|
| Unit | 58 | 3 | Vitest (`catalog`, `tool-context`, `tool-schema`) |
| Integration | 75 | 2 | Vitest (`context`, `stream`) |
| E2E/live | 0 | 0 | Not authorized or required |
| **Total** | **133** | **5** | |

The unchanged static probe-contract suite contributed another 25 focused tests. No live model, browser, credential, or external-backend test was run.

### Changed production-file coverage

`npm run test:coverage` passed. V8 reported:

| File | Line % | Branch % | Uncovered lines | Rating |
|---|---:|---:|---|---|
| `packages/pi/src/catalog.ts` | 100 | 96.07 | — | ✅ Excellent |
| `packages/pi/src/context.ts` | 100 | 87.44 | — | ✅ Excellent |
| `packages/pi/src/tool-context.ts` | 100 | 88.81 | — | ✅ Excellent |
| `packages/pi/src/tool-schema.ts` | 99.37 | 92.36 | 175 | ✅ Excellent |

**Average changed production-file line coverage: 99.84%.** Coverage threshold is 0; no coverage warning applies.

### Assertion quality

The five changed test files were audited. The fixed-size/table loops cannot be empty, every remediation assertion invokes production code, transport call-count assertions prove the normative no-hook/no-fetch boundary, and value/path/error assertions accompany shape checks.

**Assertion quality: ✅ No tautologies, ghost loops, type-only standalone assertions, smoke-only tests, CSS assertions, or mock-heavy imbalance found.**

### Quality metrics

- **Linter:** ➖ Not available.
- **Type checker:** ✅ `npm run typecheck:pi` passed with zero diagnostics.
- **Diff hygiene:** ✅ `git diff --check` passed.

## Route isolation, serialization, and compatibility

- `ask_user_choice` reaches `functionDeclarations[*].parametersJsonSchema` with root/nested `additionalProperties: false` and options bounds intact; no legacy `parameters` field is emitted.
- Capability admission precedes profile/schema inspection. Disabled Gemini, Claude, and GPT-OSS tool contexts remain rejected, while text-only paths retain their existing serialization.
- Ordinary JSON Schema values, local RFC 6901 references, repeated references, array segments, combinators, definitions, keyword-like property names, deterministic ordering, source immutability, and deep output freezing are covered.
- Root `src/`, `packages/core/src`, scripts, evidence JSON, OAuth, credentials, transport headers, replay/recovery production, and live-support claims are unchanged.
- No model call, credential access, evidence rewrite, commit, push, PR creation, package publication, or route enablement occurred.

## Review workload and PR boundary

| Slice | Parent | Authored changed lines | Result |
|---|---|---:|---|
| Unit A profile | `a9c3434` | 76 | Within 400 |
| Unit B normalization | `b7a2016` | 208 | Within 400 |
| Unit C plus bounded remediation | `4c8a9a0` | 254 (241 additions, 13 deletions) | Within 400 |

The Feature Branch Chain matches the planned A → B → C strategy, the current branch contains only Unit C plus its bounded correction, and no `size:exception` was used. The remediation itself is 85 changed lines and remains inside Unit C's cohesive resolver/safety boundary.

## Design coherence

The implementation satisfies the normative route/profile isolation and fail-closed semantics. One non-blocking design variance remains from the prior report: `catalog.ts` fixture/internal constructors default the profile, and `normalizeToolDeclarations` does not itself accept a profile argument even though the design's concrete interface proposed an explicit parameter. Runtime `serializeContext` still checks exact route capability and passes the admitted profile to `prepareToolContext` before normalization, so this variance does not broaden any route or invalidate a requirement/scenario. It should be reconciled in design or code during a later maintenance change, not treated as an archive blocker for this delta.

## Exact verification commands

1. `npm run build && npm run build:pi` — exit 0; output `sha256:aa92d18d188ed1f81982f903d0e2441fc72b8e3883f6d2746808dcc78b1e98d9`.
2. `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts scripts/pi-tool-loop-probe.test.ts` — exit 0; 7/7 files and 178/178 tests; output `sha256:e1a7fa47e1705e1a67ecd3567505b31f21a628ef1f786e4150e09c5048f1646c`.
3. `npm run typecheck:pi` — exit 0; output `sha256:baa4f09ff1bdab701c3f13783311decebf916421e066eee5cb8104ef887527d2`.
4. `npm run test:pack` — exit 0; packed root/core Node 20 and Pi Node 22 consumers passed; output `sha256:1a6792e43cd1829c43e83a492e6d234ee3e69f7d366dbe680b42848abbc3e978`.
5. `npm test` — exit 0; 60/60 files, 1,387 executed tests passed, 25 todo; output `sha256:5f94ebb7c535fb60ba3b8360608e09ae13c37b732294db54aef560de3ca9a61c`.
6. `npm run test:coverage` — exit 0; 60/60 files and 1,387 executed tests passed; output `sha256:cd419ea5c657dac7ecf1e3078541e1c1ac0d8e672178ec7c6abda71e432fe486`.
7. `git diff --check` — exit 0.

The previous root-only `npm run typecheck` evidence remains applicable because remediation changed only Pi source/tests; Pi typecheck, combined root/Pi builds, packed-consumer installation, and the full suite were rerun. Expected Gemini invalid-aspect-ratio stderr and npm dependency deprecation warnings were non-failing test/install output.

Build and coverage commands created ignored `dist/`, `packages/core/dist/`, `packages/pi/dist/`, and `coverage/`; all were removed. Final Git status returned to the pre-verification ambient state.

## Exact blockers

None.
