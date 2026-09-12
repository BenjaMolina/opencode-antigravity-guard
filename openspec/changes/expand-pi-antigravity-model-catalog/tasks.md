# Implementation Tasks: Expand Pi Antigravity Model Catalog

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,140–1,610 total; 100–390 per work unit |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Unit A → Units B/C/D (independent after A) → Unit E |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

The total change cannot honestly fit one review budget. Before **any** apply work, pause for the human to choose scope reduction, a `size:exception`, or chaining; if chaining is chosen, obtain `stacked-to-main` or `feature-branch-chain` separately. Do not make live calls, commit, open a PR, publish, or infer either decision while executing this task set.

## Boundaries and evidence gate

Allowed implementation surfaces are `packages/pi/src/catalog.ts`, `packages/pi/src/catalog.test.ts`, `packages/pi/src/provider.ts`, `packages/pi/src/provider.test.ts`, `packages/pi/src/context.ts`, `packages/pi/src/context.test.ts`, `packages/pi/src/stream.ts`, `packages/pi/src/stream.test.ts`, `packages/pi/src/response.test.ts`, `packages/pi/src/response.ts` only if a strict fixture contradicts the design after spec/design correction, `packages/pi/README.md`, and the change OpenSpec artifacts. Do not change root OpenCode catalogs/resolvers, core, OAuth, credentials, project resolution, endpoints, quota/recovery, manifests, or extension behavior.

Admission evidence is already recorded in `evidence.md`; implementation MUST verify the four-source, per-model **and per-level** record (pinned `Rahularya01/pi-antigravity` revision, authorized OAuth-path discovery, strict redacted fixtures, and bounded text-only smoke results) before entering a row or exposed level in `catalog.ts`. No implementation verification uses live discovery or smoke calls. Gemini 3.5 remains absent because its HTTP-200 records lack strict normal terminal metadata; a future admission requires new evidence, not a substitute route.

For every behavior increment, record apply evidence for the focused command, exit code, and assertion: RED test observed failing for the new behavior; minimum GREEN implementation; TRIANGULATE boundary case; and REFACTOR only while green. Existing passing Gemini 3.8 characterization is baseline evidence, not fabricated RED.

## Unit A — 3.8-compatible catalog foundation (260–360 lines)

**Start:** three independent hard-coded 3.8 seams. **Finish:** one immutable typed catalog still registering only unchanged Gemini 3.8. **Dependencies:** none. **Rollback:** restore the provider/context/stream 3.8 checks together if this foundation regresses, never separately.

- [x] **RED:** In `packages/pi/src/catalog.test.ts`, add failing catalog-contract tests for ordered lookup, duplicate public-ID rejection, fresh immutable descriptor projection, invalid-level rejection, and the exact released `antigravity-gemini-3.8-flash` descriptor/routes: wire `gemini-3.8-flash-tiered`, omitted/off → native `low` with `includeThoughts: false`, and low/medium/high → matching native levels with visible thoughts. <!-- sdd-owner: implementation -->
- [x] **GREEN:** Add `packages/pi/src/catalog.ts` with literal `as const satisfies` 3.8 data, duplicate/invariant validation, derived public/wire types, lookup/list/descriptor/route helpers, native-level and integer-budget discriminants, response/replay policy types, and no string-derived identities. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE/REFACTOR:** Add boundary coverage for unsupported `minimal`, `xhigh`, `max`, and unknown values, intentional repeated wire IDs, and host mutation of a returned descriptor; refactor only to retain literal route inference and immutable internal policy. <!-- sdd-owner: implementation -->
- [x] **RED → GREEN → TRIANGULATE → REFACTOR:** Update `packages/pi/src/provider.test.ts`, `packages/pi/src/context.test.ts`, and `packages/pi/src/stream.test.ts` in sequence to characterize then preserve 3.8 registration, tiered envelope, hidden off thoughts, same-public-model signature replay, strict text-only pre-fetch rejection, SSE/usage/event lifecycle, endpoint, headers, cancellation, and zero-cost behavior while wiring all three seams through the catalog. <!-- sdd-owner: implementation -->
- [x] Run `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/provider.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts`, then `npm run typecheck:pi` and `npm run build:pi`; record RED/GREEN/TRIANGULATE/REFACTOR evidence and rollback scope for Unit A. <!-- sdd-owner: implementation -->

## Unit B — Evidence-admitted Gemini routes (300–390 lines)

**Start:** catalog foundation with 3.8 only. **Finish:** 3.7, 3.6, and 3.1 Pro are registered only at evidenced levels; 3.5 is explicitly absent. **Dependencies:** Unit A. **Rollback:** remove only these rows, tests/fixtures, and related README claims, retaining Unit A and 3.8.

- [ ] Reconcile `evidence.md` against the pinned reference before coding and encode only the admitted rows: 3.7 off/low/medium/high with literal low/medium/high wires and budgets 0/1000/4000/-1; 3.6 off omission and low/medium/high budgets 1000/4000/-1; and 3.1 Pro off omission, low `gemini-3.1-pro-low`/1001, high `gemini-pro-agent`/10001. <!-- sdd-owner: implementation -->
- [ ] **RED:** Add exact route-matrix failures in `catalog.test.ts` and `context.test.ts` for every admitted Gemini public ID/level, descriptor limits/maps, no generic suffix parsing, off omission versus zero-budget distinction, and direct unsupported-level rejection before transport. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Add the three literal catalog rows and make `context.ts` resolve the selected route, emit only the route discriminant’s `thinkingConfig`, use the route wire ID, and strip historical thought markers/signatures for all new Gemini rows while preserving text. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE/REFACTOR:** Add 3.1 high explicit-output `<=10001` rejection, omitted-output safe default selection, dynamic `-1`/zero/omission boundaries, cross-public-model replay stripping, and all-model tool/tool-history/image failures before `fetch`; refactor table-driven tests without weakening existing defensive serialization. <!-- sdd-owner: implementation -->
- [ ] **RED → GREEN → TRIANGULATE → REFACTOR:** Extend `provider.test.ts`, `stream.test.ts`, and `response.test.ts` with redacted strict Gemini fixtures for normal signed text/usage and a 3.5 HTTP-200-without-finish/model-version/usage fixture that must fail terminal semantics; assert 3.5 is neither registered nor resolved. <!-- sdd-owner: implementation -->
- [ ] Run focused catalog/context/response/stream Gemini tests, then `npm run typecheck:pi` and `npm run build:pi`; record that this unit used stored redacted evidence only and made no live/account request. <!-- sdd-owner: implementation -->

## Unit C — Evidence-admitted Claude policies (260–360 lines)

**Start:** Unit A catalog with no Claude rows. **Finish:** Sonnet and Opus expose only off/high with proven integer budgets and strict shared-envelope compatibility. **Dependencies:** Unit A. **Rollback:** remove only Claude rows, fixtures/tests, and documentation claims without altering Gemini routes.

- [ ] Reconfirm the per-level evidence record in `evidence.md` for `claude-sonnet-4-6` and `claude-opus-4-6-thinking`, including 250,000/64,000 limits, off budget 0 hidden thoughts, high budget 1024 visible thoughts, strict `STOP`/usage/model-version fixture shape, and strip-only replay policy. <!-- sdd-owner: implementation -->
- [ ] **RED:** Add catalog/context failures for the two exact Claude descriptors, off/high only, rejected minimal/low/medium, integer rather than native-string thinking configuration, and explicit `maxTokens <= 1024` local rejection. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Add literal Claude integer-budget entries and route-aware output-budget validation in `catalog.ts`/`context.ts`: preserve valid explicit limits, choose the specified default answer reserve only when output is omitted, and omit no fields by post-construction deletion. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE/REFACTOR:** Add tests for explicit output above budget, no caller mutation, omitted output, cross-model signature stripping, and strict text-only rejection; refactor shared integer-budget paths while retaining discriminated serialization and 3.8 behavior. <!-- sdd-owner: implementation -->
- [ ] **RED → GREEN → TRIANGULATE → REFACTOR:** Add redacted Claude interleaved thought/text/signature fixtures to `response.test.ts` and representative fixed-endpoint stream tests to `stream.test.ts`; prove ordered Pi lifecycle and usage parsing remain strict, and stop for spec/design correction rather than broadening `response.ts` if fixture transcription contradicts the parser. <!-- sdd-owner: implementation -->
- [ ] Run `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts`, then `npm run typecheck:pi`; record focused evidence and the Claude-only rollback boundary. <!-- sdd-owner: implementation -->

## Unit D — GPT-OSS admission and blocked-3.5 regression (220–320 lines)

**Start:** Unit A catalog with no GPT-OSS row and Gemini 3.5 blocked. **Finish:** GPT-OSS has literal off/medium behavior; 3.5 remains strictly rejected/unregistered. **Dependencies:** Unit A. **Rollback:** remove the GPT-OSS row, tests/fixture, and documentation claim only.

- [ ] Reconfirm in `evidence.md` that `gpt-oss-120b-medium` is literal identity data for both routes, with 131,072/32,768 limits, off omission, medium budget 8192, strict text/thought/usage fixture compatibility, and strip-only replay. <!-- sdd-owner: implementation -->
- [ ] **RED:** Add catalog/context failures for the exact GPT-OSS descriptor/map, literal wire identity for off and medium, omission versus 8192 budget, rejected unsupported levels, and explicit `maxTokens <=8192` rejection. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Add the GPT-OSS catalog row and use the existing discriminated integer-budget serializer/output safety without suffix parsing, family inference, native Gemini `thinkingLevel`, fallback, or alternate routing. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE/REFACTOR:** Add default-output reserve, valid explicit-output, signature stripping, and text-only pre-fetch boundary tests, then refactor only duplicated table-driven assertions under green. <!-- sdd-owner: implementation -->
- [ ] **RED → GREEN → TRIANGULATE → REFACTOR:** Add redacted GPT-OSS response/stream fixture coverage for thought/text ordering, strict usage/finish behavior, fixed OAuth endpoint, and terminal lifecycle; retain the 3.5 nonterminal HTTP-200 rejection and registration absence as a regression fixture. <!-- sdd-owner: implementation -->
- [ ] Run focused GPT-OSS and blocked-3.5 catalog/context/response/stream tests, `npm run typecheck:pi`, and `npm run build:pi`; record no live calls and the isolated rollback scope. <!-- sdd-owner: implementation -->

## Unit E — Documentation and whole-workspace verification (100–180 lines)

**Start:** all admitted rows are tested. **Finish:** README claims exactly match the static catalog and full/pack verification is recorded. **Dependencies:** Units B, C, and D. **Rollback:** revert documentation and final verification-only changes; candidate rollback remains owned by its originating unit.

- [ ] **RED:** Add failing `provider.test.ts`/`catalog.test.ts` assertions that the final ordered registration is 3.8, 3.7, 3.6, 3.1 Pro, Sonnet, Opus, and GPT-OSS; verify every descriptor is text-only/zero-cost, 3.8 stays first and exact, and Gemini 3.5 is absent. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Update `packages/pi/README.md` with only the evidenced public IDs, exact exposed Pi levels and off semantics, limits/output-budget rule, literal 3.8 compatibility mapping, 3.5 exclusion, text-only/no-tools/no-images boundary, static/no-discovery behavior, and unchanged Pi OAuth/quota boundary. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE/REFACTOR:** Cross-check README tables against `catalog.ts` test data and add a boundary assertion that unsupported levels and unregistered 3.5 are not advertised; simplify duplicated test descriptions only while all assertions remain green. <!-- sdd-owner: implementation -->
- [ ] Run the full verification pack in this order: focused Pi tests; `npm run typecheck:pi`; `npm run build:pi`; `npm test`; `npm run typecheck`; and `npm run test:pack`. Record command, exit code, final catalog assertion results, package contents/load result, and any environment-independent failure; do not substitute environment-backed e2e/live calls. <!-- sdd-owner: implementation -->

## Separately authorized version and release preparation

Version changes, changelog/release-note preparation, package publication, tags, pushes, commits, PR creation, and release actions are outside this change’s current authorization. After all Unit E verification is green, perform any version or release preparation only under separate explicit human authorization, with its own scoped forecast and no implication that publication is approved.
