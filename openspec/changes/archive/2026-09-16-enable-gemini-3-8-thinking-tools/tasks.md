# Tasks: Enable Gemini 3.8 Flash Thinking Tool Loops

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 45–100 for the authorized medium-only tolerance slice; prior hermetic routing/sequencing and later admissions remain separate work units |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | stacked PR 1 static suffix/budget contract → stacked PR 2 profile/receipt sequencing → stacked PR 3 medium empty-trailing-text tolerance → later route-local admission slices |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

Each stacked-to-main work unit MUST remain at or below 400 changed lines, retain its tests, and have an independently reversible boundary. If an actual work unit exceeds the budget, pause under `ask-on-risk` rather than infer an exception or alter the stack strategy.

## Negative-closure reconciliation

This archived harness closes with all visible routes disabled, no visible evidence retention, and no future live sequence. Every formerly unchecked implementation row below is checked as a **negative-closure decision**, not as a claim that its described admission, evidence, or publication action passed or ran. The static-routing and hermetic rows are superseded by recorded historical work and current closure verification; live-pass, evidence-retention, catalog-admission, README, PR, and publication actions are canceled/not applicable. No admission, PR, commit, push, or publish occurred.

## Historical completed work (preserved; not proof for the amended route hypothesis)

The following completed tasks and their apply-progress evidence remain historical. The former formal focused and repository verification is **superseded for suffix+budget routing**: it verified the prior tiered/native disabled-route and probe state, not the amended wire models, budget serialization, profile identities, or two-pass sequence. It must not be used to admit a visible route.

- [x] **RED:** In `scripts/pi-tool-loop-probe.test.ts`, added closed selector, literal route, implicit `off`, zero-runner refusal, and visible-chain contract tests. <!-- sdd-owner: implementation -->
- [x] **GREEN:** In `scripts/pi-tool-loop-probe.ts`, added the immutable four-route registry, strict parser, route-specific arguments, injectable seams, and sanitized evidence builder while preserving `off`. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** Added hostile visible-route event, disabled-control, clean-exit, and raw-value-canary coverage in `scripts/pi-tool-loop-probe.test.ts`. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Kept the probe runner, fixed `off` output identity, and bounded failure summaries probe-local. <!-- sdd-owner: implementation -->
- [x] **CHARACTERIZATION / GREEN:** Recorded existing exact-candidate coverage in `packages/pi/src/catalog.test.ts`, `context.test.ts`, `response.test.ts`, `stream.test.ts`, and `tool-context.test.ts` while production visible routes remained disabled. <!-- sdd-owner: implementation -->
- [x] **CHARACTERIZATION / TRIANGULATE:** Recorded existing malformed, replay, parallel, interrupted-history, and text-only isolation coverage. <!-- sdd-owner: implementation -->
- [x] **CHARACTERIZATION / REFACTOR:** Retained existing candidate fixtures without changing shared production compatibility surfaces. <!-- sdd-owner: implementation -->
- [x] **Historical formal focused verification (superseded by routing amendment):** Ran the focused Pi/probe gate, Pi typecheck, and Pi build for the prior route hypothesis. <!-- sdd-owner: implementation -->
- [x] **Historical formal repository verification (superseded by routing amendment):** Ran root typecheck/build, pack tests, and the full suite for the prior route hypothesis. <!-- sdd-owner: implementation -->
- [x] **Verifier correction:** Enforced ordered visible execution lifecycle and terminal/history correlation in `scripts/pi-tool-loop-probe.ts` and its tests. <!-- sdd-owner: implementation -->
- [x] **Hermetic low prompt refinement:** Required visible pre-call thinking and recorded the non-admission shape without retaining evidence. <!-- sdd-owner: implementation -->
- [x] **Hermetic high bounded-text refinement:** Allowed only the constrained signed-thinking, optional pre-call-text, and call sequence in the validator. <!-- sdd-owner: implementation -->
- [x] **Hermetic high UTF-8 remediation:** Restricted optional normal pre-call text to `high` and to 256 UTF-8 bytes. <!-- sdd-owner: implementation -->

## Stack PR 1 — Static suffix-and-budget route contract (hermetic)

**Start:** `low`, `medium`, and `high` use the superseded tiered/native literals and remain disabled.  
**Finish:** only those three literals use the specified suffixed wire models and integer-budget policies, still disabled, with no evidence or README change.  
**Verification:** focused catalog/context tests, then the PR 1 verification commands below.  
**Rollback:** revert only `packages/pi/src/catalog.ts`, its route/request tests, and this work-unit bookkeeping; retain `off` and all visible routes disabled.

- [x] **Negative-closure decision (completed; not performed):** **RED:** Add failing table-driven assertions in `packages/pi/src/catalog.test.ts` and `packages/pi/src/context.test.ts` for exact `low`/`medium`/`high` public-model, suffixed wire-model, and `{ thinkingBudget: 1000|4000|-1, includeThoughts: true }` serialization; require no visible `thinkingLevel`, unchanged tiered/native invisible `off`, disabled visible capabilities, unchanged max-token/reserve behavior, and no transport for disabled tool contexts. Run `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` and record the expected failures. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** **GREEN:** Replace only the three visible literals in `packages/pi/src/catalog.ts` with the exact suffix-plus-budget policies, reusing `IntegerBudgetRoute` and `serializeThinkingConfig()` without a serializer branch, fallback, discovery, rotation, or capability enablement. Run `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` and record the passing result. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** **TRIANGULATE:** Extend `packages/pi/src/catalog.test.ts` and `packages/pi/src/context.test.ts` with a literal negative matrix rejecting tiered-budget, suffix-native, wrong-suffix, wrong-budget, cross-level, and old visible-revision fixtures; preserve `parametersJsonSchema` and disabled preflight isolation. Run the focused catalog/context suites and record the passing result. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** **REFACTOR:** Consolidate only route-contract test tables in `packages/pi/src/catalog.test.ts` and `packages/pi/src/context.test.ts`; do not alter `context.ts`, `response.ts`, `stream.ts`, `tool-context.ts`, `tool-schema.ts`, or `tool-contract.ts`. Run `npm run build:core && npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts && npm run typecheck:pi && npm run build:pi` and record exact results. <!-- sdd-owner: implementation -->

## Stack PR 2 — Profile identity and two-pass retention contract (hermetic)

**Depends on:** Stack PR 1.  
**Start:** exact suffix/budget literals are disabled and no visible evidence file exists.  
**Finish:** the closed probe binds each visible profile to its new revision/fingerprint and cannot retain evidence until two matching complete receipts are aggregated; strict validators remain unchanged.  
**Verification:** focused probe tests plus the independent verification work unit below.  
**Rollback:** revert only `scripts/pi-tool-loop-probe.ts`, `scripts/pi-tool-loop-probe.test.ts`, and this work-unit bookkeeping; remove no historical `off` evidence.

- [x] **Negative-closure decision (completed; not performed):** **RED:** Add failing tests in `scripts/pi-tool-loop-probe.test.ts` for literal visible profile metadata and revisions (`gemini-3.8-flash-{low,medium,high}-suffix-budget-tool-loop-v1`), deterministic allowlisted profile fingerprints, pass-1 receipt/no evidence write, matching pass-2 aggregation, and exact receipt identity over route, wire model, budget, `includeThoughts`, validator revision, and source state. Preserve implicit/explicit one-pass `off`. Run `npx vitest run scripts/pi-tool-loop-probe.test.ts` and record expected failures. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** **GREEN:** Replace visible-route inherited metadata with explicit suffix/budget profile entries and add probe-local pure receipt, matching, reset, and aggregation helpers. Ensure one visible pass writes no evidence, matching pass 2 writes exactly one redacted record with `completePassCount: 2`, and visible capabilities remain disabled. Run `npx vitest run scripts/pi-tool-loop-probe.test.ts` and record the passing result. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** **TRIANGULATE:** Add hostile tests in `scripts/pi-tool-loop-probe.test.ts` for failed/incomplete second pass, stale or duplicate receipt, changed source/profile/validator/prompt state, wrong level/wire/budget, cross-profile pairing, old tiered/native revisions, and raw-data canaries; prove zero writes and route-local reset. Characterize the existing `validateVisibleProbeEvents()` ordering, signed replay, high-only text bound, diagnostics, terminal, redaction, parallel, and interrupted-history behavior unchanged; if amended serialization exposes a validator incompatibility, stop for a new design decision rather than relax it. Run the probe suite and record the passing result. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** **REFACTOR:** Keep sequencing and fingerprints probe-local, use literal tables and pure helpers only, and preserve the closed selector, runner timeout, `off` writer contract, and existing validator behavior. Run `npm run build:core && npx vitest run scripts/pi-tool-loop-probe.test.ts && npm run typecheck:pi && npm run build:pi` and record exact results. <!-- sdd-owner: implementation -->

## Independent amended hermetic verification

**Depends on:** Stack PRs 1–2.  
**Start:** both amended hermetic work units are green; all visible routes are disabled and no visible evidence files exist.  
**Finish:** independent checks establish the amended local contract only, not backend acceptance or admission.  
**Rollback:** revert the failing amended work unit; do not make a live call or modify route admission.

- [x] **Negative-closure decision (completed; not performed):** Run `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts packages/pi/src/tool-context.test.ts scripts/pi-tool-loop-probe.test.ts`, `npm run typecheck:pi`, and `npm run build:pi`; confirm the validator stability sequence is green, every visible capability is disabled, and no low/medium/high evidence file exists. Record exact results as the new amended focused verification evidence. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** Run `npm run typecheck`, `npm run build`, `npm run test:pack`, `npm test`, and `git diff --check`; record exact results and the changed-line count for each stacked work unit, confirming each remains at or below 400 changed lines. Record this as the new amended repository verification evidence, replacing—not deleting—the superseded historical verification claim. <!-- sdd-owner: implementation -->

## Stack PR 3 — Authorized medium-only empty trailing-text tolerance (hermetic; ≤400 lines)

**Depends on:** Stack PRs 1–2.  
**Start:** the suffix/budget profiles and two-pass sequencing are present; `medium` accepts only zero normal text blocks; all visible production routes remain `disabled("missing-direct-evidence")` and no visible evidence files exist.  
**Finish:** only the `medium` validator accepts the complete `thinking+ -> sole signed pi_evidence_echo toolCall -> final text("")` grammar in addition to its existing zero-text grammar; its validator revision and profile fingerprint reject every pre-amendment receipt. Low and high behavior remain unchanged.  
**Verification:** complete the independent medium verification tasks below before any future medium live pass.  
**Rollback:** revert only the medium grammar predicate/revision/fingerprint, its tests, and reconciled SDD artifacts; retain all visible production routes disabled and retain no medium evidence.

- [x] **RED:** In `scripts/pi-tool-loop-probe.test.ts`, add a failing complete correlated `medium` fixture with `thinking -> toolCall -> text` where the final `text` is exactly `""` and encodes to zero UTF-8 bytes; require all eight existing visible-chain labels, no evidence write before the two-pass gate, and rejection by the current validator. <!-- sdd-owner: implementation -->
- [x] **GREEN:** In `scripts/pi-tool-loop-probe.ts`, change only `validateVisibleProbeEvents()` (or a probe-local helper it owns) to accept for `medium` either `thinking+ -> sole signed toolCall` or `thinking+ -> sole signed toolCall -> final text("")`; require exactly one final string text block with `TextEncoder` byte length `0`, preserve every existing chain/correlation/terminal/redaction check, and bump the validator contract revision/profile fingerprint so prior receipts cannot pair. <!-- sdd-owner: implementation -->
- [x] **TRIANGULATE:** In `scripts/pi-tool-loop-probe.test.ts`, add hostile matrices proving medium rejects nonempty, space/tab/newline, multibyte, zero-width, pre-thinking, between-thinking-and-call, duplicate, non-final, and extra-block text plus extra calls; prove low rejects the empty trailing block and high rejects it while retaining only its existing nonempty ≤256-byte pre-call tolerance. <!-- sdd-owner: implementation -->
- [x] **REFACTOR:** Keep the route grammar literal, probe-local, and table-driven in `scripts/pi-tool-loop-probe.ts` and `scripts/pi-tool-loop-probe.test.ts`; do not trim text, introduce a generic blank-text rule, alter prompts, enable a capability, or modify `packages/pi/src/context.ts`, `response.ts`, `stream.ts`, `tool-context.ts`, `tool-schema.ts`, `tool-contract.ts`, root `src/`, or `packages/core/`. Run `npm run build:core && npx vitest run scripts/pi-tool-loop-probe.test.ts && npm run typecheck:pi && npm run build:pi`, and record the result and ≤400 changed-line count. <!-- sdd-owner: implementation -->

## Independent medium-tolerance verification (hermetic; required before medium pass 1)

**Depends on:** Stack PR 3.  
**Start:** the medium-only implementation TDD cycle is green; `low`, `medium`, and `high` production capabilities remain disabled and their evidence files are absent.  
**Finish:** independent local evidence proves the amended medium grammar and preserved low/high boundaries, without a live call, credential access, temporary capability stage, evidence write, or admission claim.  
**Rollback:** revert Stack PR 3 if either independent gate fails; do not alter disabled production route state.

- [x] Run `npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts packages/pi/src/tool-context.test.ts scripts/pi-tool-loop-probe.test.ts`, `npm run typecheck:pi`, and `npm run build:pi`; independently confirm the exact medium empty-trailing-text matrix is green, low/high remain unchanged, all visible capabilities are disabled, and no low/medium/high evidence file exists. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** Run `npm run typecheck`, `npm run build`, `npm run test:pack`, `npm test`, and `git diff --check`; record exact results and Stack PR 3 additions plus deletions, confirming the standalone stacked-to-main slice remains at or below 400 changed lines without a size exception. <!-- sdd-owner: implementation -->

## Later route-local live gates — separately authorized; do not execute during hermetic apply

Each row below is a future task, not authorization to run it now. A human must separately authorize every individual live child invocation. No task may retry automatically, use a sibling route, fallback, discovery, account rotation, or quota-pool rotation. The disabled control is optional only when separately authorized and must remain local/no-fetch. A failed, incomplete, mismatched, or intervening attempt resets that level only, retains no success evidence, and requires a new pass-1 authorization.

### Low admission slice (future; ≤400 lines)

- [x] **Negative-closure decision (completed; not performed):** After amended hermetic verification and explicit authorization for **low pass 1**, stage only the exact low capability, run one bounded low live pass, validate the full strict chain, emit only its sanitized first-pass receipt, restore disabled state on pause/failure, and write no evidence or README claim. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** After separate explicit authorization for **low pass 2**, consume the matching low pass-1 receipt on unchanged source/profile state, run exactly one bounded pass, and retain one redacted low evidence record only if both consecutive passes completely satisfy the contract; otherwise reset low with no evidence. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** Only after the two consecutive matching low passes and a separate explicit admission authorization, enable only the exact low catalog literal, reference its suffix/budget revision, update only the low status in `packages/pi/README.md`, and rerun both amended verification gates. <!-- sdd-owner: implementation -->

### Medium admission slice (future; ≤400 lines)

**Depends on:** completed Stack PR 3 and both independent medium-tolerance verification tasks. The historical `thinking -> toolCall -> text("")` observation is not pass 1 and cannot be replayed as a receipt. Production `medium` remains disabled until the separately authorized admission task below.

- [x] **Negative-closure decision (completed; not performed):** After explicit authorization for **medium pass 1**, temporarily stage only the exact `gemini-3.8-flash-medium` / `thinkingBudget: 4000` / `includeThoughts: true` capability with the amended validator fingerprint, run exactly one bounded medium live pass, require the full strict chain including only the permitted final zero-byte empty-text form when text is present, emit only its sanitized first-pass receipt, restore disabled state on pause/failure, and write no evidence or README claim. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** After separate explicit authorization for **medium pass 2**, consume the matching medium pass-1 receipt on unchanged source/profile/validator state, temporarily stage only that exact medium capability, run exactly one bounded pass, and retain one redacted medium evidence record only if both consecutive passes completely satisfy the contract; otherwise restore disabled state, reset medium with no evidence, and require new pass-1 authorization. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** Only after the two consecutive matching medium passes and a separate explicit admission authorization, enable only the exact medium catalog literal, reference its suffix/budget revision and amended validator identity, update only the medium status in `packages/pi/README.md`, and rerun both amended verification gates. <!-- sdd-owner: implementation -->

### High admission slice (future; ≤400 lines)

- [x] **Negative-closure decision (completed; not performed):** After amended hermetic verification and explicit authorization for **high pass 1**, stage only the exact high capability, run one bounded high live pass, validate the strict high-only bounded-text chain, emit only its sanitized first-pass receipt, restore disabled state on pause/failure, and write no evidence or README claim. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** After separate explicit authorization for **high pass 2**, consume the matching high pass-1 receipt on unchanged source/profile state, run exactly one bounded pass, and retain one redacted high evidence record only if both consecutive passes completely satisfy the contract; otherwise reset high with no evidence. <!-- sdd-owner: implementation -->
- [x] **Negative-closure decision (completed; not performed):** Only after the two consecutive matching high passes and a separate explicit admission authorization, enable only the exact high catalog literal, reference its suffix/budget revision, update only the high status in `packages/pi/README.md`, and rerun both amended verification gates. <!-- sdd-owner: implementation -->

## Authorized suffix-and-budget routing slice

- [x] **RED / GREEN / TRIANGULATE / REFACTOR:** Replace the static `low`/`medium`/`high` Gemini 3.8 Flash routes with their exact suffix-and-budget profiles; prove request serialization, preserve the exact `off` route and five-label probe contract, and retain `disabled("missing-direct-evidence")` production capability states. Keep only the existing test-only capability characterization path and bind visible probe metadata to the exact suffix, budget, and profile-specific revision. <!-- sdd-owner: implementation -->
- [x] **Hermetic verification:** Run focused Pi/probe tests, Pi/root typecheck and builds, pack verification, full-suite attempts, `git diff --check`, generated-output cleanup, and visible-evidence absence checks; record the known full-suite quota-fallback timeout truthfully. <!-- sdd-owner: implementation -->

## Authorized medium diagnostic slice

- [x] **RED / GREEN / TRIANGULATE / REFACTOR:** Add a failed-`medium`-only `visiblePreCallAssistant` diagnostic with only ordered allowlisted block kinds and normal-text UTF-8 byte lengths, derived solely from a structurally correlated authoritative pre-call assistant message. Prove exact multibyte lengths, sensitive/raw-field absence, and no diagnostic for uncorrelated or malformed input; preserve all validator/admission/evidence behavior and disabled production capability states. A future medium retry remains separately human-gated. <!-- sdd-owner: implementation -->

## Explicit non-goals

- Do not run live probes, access credentials, stage capabilities, retain evidence, admit routes, commit, push, publish, or modify README status during this reconciliation or either hermetic stack slice.
- Do not add a suffix/native, tiered/budget, alternate-budget, fallback, discovery, alias, account-rotation, or quota-pool-rotation path.
- Do not change `off`, `packages/pi/evidence/gemini-3.8-flash-off-tool-loop.json`, shared serializer/validator compatibility surfaces, root `src/`, or `packages/core/` without a separately approved design decision.
- Do not treat one pass, historical tiered/native evidence, or hermetic verification as visible-route admission evidence.

## Authorized medium diagnostic and evidence-shape remediation

- [x] **RED / GREEN / TRIANGULATE:** Emit medium-only redacted pre-call metadata only from a structurally correlated authoritative assistant pre-call message containing exactly one trailing `pi_evidence_echo` call with strict ID/name/argument and matching tool-result correlation; reject empty, call-less, mismatched-ID, or wrong-name shapes. Restore the prior successful evidence object shape by omitting `cleanExit`. Run focused, build/typecheck, pack, full-suite, and diff gates; remove generated outputs without live execution or admission changes. <!-- sdd-owner: implementation -->

## Authorized medium diagnostic placement remediation

- [x] **RED / GREEN / TRIANGULATE:** Add only zero-based normal-text positions to the existing redacted, failed-`medium` `visiblePreCallAssistant` diagnostic, preserving its strict authoritative-message/call correlation, existing block-kind and UTF-8-length fields, and all admission/evidence behavior. Prove the two observed normal text blocks report positions `[1, 2]`; run focused/build/typecheck/pack/full/diff gates with no live activity. <!-- sdd-owner: implementation -->

## Authorized UTF-8 boundary fixture encoding repair

- [x] **RED / GREEN / CHARACTERIZATION:** Replace encoding-corrupted multibyte literals in the high 256-byte acceptance/overflow fixtures and nearby medium nonempty-text fixture with encoding-stable `\u00e9` escapes. Preserve production behavior and every assertion; run probe, focused seven-file, full-suite retry, diff, and generated-output cleanup with no live activity. <!-- sdd-owner: implementation -->

## Authorized redacted medium validator failure codes

- [x] **RED / GREEN / TRIANGULATE / REFACTOR:** For failed enabled `medium` probes only, emit `failedValidatorChecks` as an ordered fixed-literal allowlist covering event topology/order, pre-call terminal correlation, thinking signatures, call signature/identity, execution event correlation, tool-result exact shape, final terminal correlation/marker, and strict tool diagnostic. Refactor these checks into pure shared validator/projection logic; prove one failure per code, malformed/uncorrelated failure behavior, raw-value canaries, and absence from successful, disabled, and non-medium outcomes. Preserve the existing shape diagnostic, success evidence schema, admission behavior, disabled production routes, and no-live boundary. <!-- sdd-owner: implementation -->

## Authorized diagnostic-only content-grammar split

- [x] **RED / GREEN / TRIANGULATE / REFACTOR:** Split failed enabled `medium` failure projection into fixed `content-grammar` and `thinking-signatures` checks without changing admission: `content-grammar` owns route-specific block cardinality/order/text bounds, including the medium zero-byte trailer and high bounded pre-call text, while `thinking-signatures` owns only one or more nonempty signed thinking blocks. Prove grammar-only, signature-only, and combined failures project independently; preserve previously admitted/rejected fixtures, fixed-code redaction, and omission outside failed enabled medium. <!-- sdd-owner: implementation -->
