# Amended Design: Enable Gemini 3.8 Flash Thinking Tool Loops

## Status and authority

**Design status:** amended after sanitized direct evidence invalidated the original `gemini-3.8-flash-tiered` plus native `thinkingLevel` hypothesis.

**Selected route hypothesis:** `suffix + budget primero`. This remains one combined, bounded route hypothesis, not a full attribution matrix.

**Authorized response-shape amendment:** only `medium` gains a narrowly bounded tolerance for one exactly empty trailing normal-text block after the sole correlated signed tool call. This design amendment does not authorize implementation, a live call, capability staging, evidence retention, admission, commit, push, or publication.

**Skill resolution:** `paths-injected` (`gentle-ai`, `cognitive-doc-design`).

All production-visible `low`, `medium`, and `high` tool routes remain `disabled("missing-direct-evidence")`. No low, medium, or high evidence file exists. The existing `off` route remains the sole enabled Gemini 3.8 Flash tool route.

The formal verification recorded in `verify-report.md` is **superseded for this amended design**. It remains historical evidence that the former hermetic probe and strict validators passed, but it does not verify the amended wire routes, budget serialization, route/evidence identities, or two-pass admission gate. A new verification result is required after any authorized implementation of this amendment.

## Direct evidence that changed the design

Sanitized outcomes in `apply-progress.md` establish:

- `low` on `gemini-3.8-flash-tiered` with native low thinking completed signed tool replay twice but exposed no visible thinking.
- `medium` on the same tiered/native family completed signed tool replay but exposed no visible thinking.
- `high` first exposed visible thinking plus bounded pre-call text and signed continuation, then a refined retry exposed no visible thinking.
- Therefore the shared tiered/native route did not reliably satisfy the visible-thinking admission contract, and high was specifically nondeterministic.

These outcomes invalidate the prior assumption that native levels on the tiered wire model are suitable admission candidates. They do not identify whether the wire suffix or integer budget is independently causal. The user selected only the combined suffix-plus-budget route next, so this design must not implement or probe the other cells of an attribution matrix.

Later sanitized, user-authorized direct evidence for the exact medium suffix-plus-budget profile established the authoritative pre-call content shape `thinking -> toolCall -> text`. The sole normal-text block was the final content block and encoded to exactly `0` UTF-8 bytes, while signed replay completed. No raw thought, text, signature, identifier, argument, result, or event was retained. This observation authorizes only the contract design below: it is not a complete pass, receipt, evidence record, or admission claim.

## Goals

- Replace only the three visible Gemini 3.8 Flash route hypotheses with exact suffixed wire models and exact integer budgets.
- Keep static, literal route selection with no discovery, fallback, substitution, account rotation, or quota-pool rotation.
- Preserve all strict signed-chain, history, schema, lifecycle, and redaction validators while adding only the medium-specific empty trailing-text grammar.
- Keep `low` at zero normal-text blocks and preserve `high`'s separate optional one-nonempty-block, at-most-256-UTF-8-byte tolerance between signed thinking and the call.
- Require two consecutive complete direct passes for the same exact level/profile and amended validator contract before retaining success evidence or enabling that route.
- Keep `off` behavior, request bytes, route identity, capability, probe default, evidence, and documentation unchanged.
- Keep each visible level independently admissible and independently reversible.

## Non-goals

- No full suffix/native/budget/tiered attribution matrix.
- No `gemini-3.8-flash-tiered` route combined with `thinkingBudget` for low, medium, or high.
- No suffixed Gemini 3.8 Flash route combined with native `thinkingLevel`.
- No route fallback to tiered, `off`, a sibling level, another model, account, or quota pool.
- No dynamic model discovery, availability probing, retry-driven route selection, or hidden aliases.
- No response-shape relaxation beyond the exact medium trailing-empty grammar; no relaxation of tool schema, signature, replay, result association, history, lifecycle, redaction, or terminal validation.
- No production changes outside `packages/pi` and the bounded probe unless new evidence requires a separately approved design decision.
- No direct call under this amendment. Every future live pass remains separately human-authorized.

## Exact amended route contract

The catalog remains a static literal map. The selected visible routes are exactly:

| Public model | Pi reasoning | Wire model | Catalog thinking policy | Outbound `thinkingConfig` | Tool state during hermetic work |
|---|---|---|---|---|---|
| `antigravity-gemini-3.8-flash` | `low` | `gemini-3.8-flash-low` | `{ kind: "budget", budget: 1000, includeThoughts: true }` | `{ thinkingBudget: 1000, includeThoughts: true }` | `disabled("missing-direct-evidence")` |
| `antigravity-gemini-3.8-flash` | `medium` | `gemini-3.8-flash-medium` | `{ kind: "budget", budget: 4000, includeThoughts: true }` | `{ thinkingBudget: 4000, includeThoughts: true }` | `disabled("missing-direct-evidence")` |
| `antigravity-gemini-3.8-flash` | `high` | `gemini-3.8-flash-high` | `{ kind: "budget", budget: -1, includeThoughts: true }` | `{ thinkingBudget: -1, includeThoughts: true }` | `disabled("missing-direct-evidence")` |

No alternative combination is present in code or selected at runtime. A failure or unavailable wire model is non-admission for that exact route; it does not trigger another route.

### Existing `off` route

`off` is outside the amended hypothesis and must remain exact:

```text
wireModel: gemini-3.8-flash-tiered
thinking: { kind: "native-level", thinkingLevel: "low", includeThoughts: false }
tools: existing enabled capability
```

Its zero-selector probe behavior, five labels, evidence path, revision `gemini-3.8-flash-off-v1`, README claim, and request serialization must not change.

## Architecture

### 1. Static catalog routing

`packages/pi/src/catalog.ts` changes only the `low`, `medium`, and `high` route literals shown above. The existing `IntegerBudgetRoute` and `serializeThinkingConfig()` paths already serialize `kind: "budget"` as `thinkingBudget`; no new route type, resolver branch, runtime option, or serializer implementation is planned.

The three capability literals remain disabled during all hermetic work. This means tool-bearing contexts continue to fail before hooks and fetch, while text-only requests for the selected visible levels use the amended static wire model and budget. The descriptor, exposed Pi reasoning names, replay policy, response family, schema profile rules, and route order remain unchanged.

The implementation must not add tiered-budget or suffix-native entries, even as dormant alternatives. It must not inspect failures to choose a route.

### 2. Probe route and profile registry

`scripts/pi-tool-loop-probe.ts` retains a closed four-entry registry, but each visible entry becomes an explicit literal rather than inheriting the tiered wire model from one route factory. Each entry binds:

- public model;
- reasoning level;
- exact suffixed wire model;
- exact budget and `includeThoughts: true` profile;
- evidence path;
- profile-specific evidence revision;
- a deterministic profile fingerprint derived only from those allowlisted fields and the validator contract revision.

`off` retains its current registry values and one-pass evidence behavior. The CLI still accepts only `off`, `low`, `medium`, and `high`; omission still selects `off`. Route metadata is not imported from discovery or inferred from a wire-model string.

The visible profile revisions are new identities so the superseded tiered/native qualification cannot be mistaken for suffix/budget evidence:

| Level | New revision | Evidence path |
|---|---|---|
| `low` | `gemini-3.8-flash-low-suffix-budget-tool-loop-v1` | `packages/pi/evidence/gemini-3.8-flash-low-tool-loop.json` |
| `medium` | `gemini-3.8-flash-medium-suffix-budget-tool-loop-v1` | `packages/pi/evidence/gemini-3.8-flash-medium-tool-loop.json` |
| `high` | `gemini-3.8-flash-high-suffix-budget-tool-loop-v1` | `packages/pi/evidence/gemini-3.8-flash-high-tool-loop.json` |

The paths may remain level-local because no visible evidence files currently exist. The old reserved `gemini-3.8-flash-<level>-tool-loop-v1` revisions are not valid for the amended routes and must never be referenced by an enabled suffix/budget capability.

### 3. Two-consecutive-pass gate

A visible route requires **two consecutive complete live passes** for the same exact public model, reasoning level, wire model, budget, `includeThoughts` value, profile fingerprint, validator revision, and source state.

A complete pass means the visible validator returns all eight fixed labels under the route-specific content grammar, the child terminates cleanly, and no timeout, credential, quota, access, transport, signature, replay, result, diagnostic, marker, or terminal failure occurs. The amended validator contract revision participates in the profile fingerprint, so every pre-amendment medium observation or receipt is ineligible for pairing.

The sequence contract is:

1. A parent obtains explicit authorization for pass 1 of one exact level/profile.
2. Pass 1 runs once and emits only a sanitized allowlisted receipt. It writes no route evidence and cannot enable a capability.
3. The sequence pauses. The first receipt does not authorize pass 2.
4. A parent obtains separate explicit authorization for pass 2 of that same exact profile.
5. Pass 2 must consume the pass-1 receipt, bind to its profile fingerprint, and pass completely on unchanged source/profile state.
6. Only then may a pure aggregator build one sanitized evidence record with `completePassCount: 2` and the two allowlisted pass receipt hashes/timestamps. No raw event enters the aggregator or writer.
7. Admission remains a later explicit catalog/README action for that exact level only.

The pass-1 receipt is not a success evidence file or admission claim. It contains only route/profile identity, fixed passed labels, clean-exit state, timestamp, sequence nonce/digest, and `rawResponseStored: false`. It may be carried in parent-controlled apply progress or command output. If continuity cannot be established across sessions, the sequence resets to pass 1.

Any failed, incomplete, mismatched, stale, intervening, or profile-changed attempt resets the sequence. A previous first pass cannot be paired after a failure or after any route, budget, validator, prompt, build, or source change. The sequence token is an integrity/correlation mechanism, not authorization; human authorization remains external and mandatory for each live child invocation.

Hermetic orchestration tests must prove that the evidence writer receives nothing after one pass, on any failed second pass, or for mismatched/stale receipts. `off` must retain its existing single-pass writer contract.

### 4. Route-specific visible content grammar

`validateVisibleProbeEvents()` is an implementation target only for the medium-specific grammar below. All execution, replay, correlation, terminal, and redaction checks remain authoritative and unchanged.

After one or more contiguous nonempty signed `thinking` blocks, the first assistant content MUST match exactly one of these complete grammars:

| Reasoning | Admissible content grammar | Normal-text rule |
|---|---|---|
| `low` | `thinking+ -> toolCall` | No `text` block. |
| `medium` | `thinking+ -> toolCall` **or** `thinking+ -> toolCall -> text` | In the second form, there is exactly one `text` block; it is the final block, its value is exactly the empty string, and its encoded length is exactly `0` UTF-8 bytes. |
| `high` | `thinking+ -> toolCall` **or** `thinking+ -> text -> toolCall` | In the second form, there is exactly one nonempty `text` block of at most 256 UTF-8 bytes between the thinking prefix and call. |

For every route, the content contains exactly one expected `pi_evidence_echo` tool call. It remains signed and correlated with the sole successful execution, matching tool result, signed function-response replay diagnostic, and terminal history. The grammar consumes the entire content array; no unclassified or extra block is tolerated.

The medium exception is exact, not a trim or blankness rule. Nonempty text, spaces, tabs, newlines, zero-width characters, or any other nonzero UTF-8 encoding are rejected. Medium also rejects text before thinking, between thinking and the call, duplicate text, text that is not final, a second call, and any extra block before or after the call. Low continues to reject every text block. High continues to reject empty text, post-call text, duplicate text, or text outside its existing bounded between-thinking-and-call position.

The accepted signed-chain labels, tool execution ordering, result identity and content, replay mode, diagnostic cardinality, completion marker, terminal ordering, and structural turn/history equality remain unchanged. Every existing malformed, ambiguous, unsigned, reordered, duplicate, recovery, fallback, or redaction case remains non-admission.

The validator contract revision and deterministic profile fingerprints MUST change when this grammar is implemented. The route wire models, budgets, evidence paths, and profile revision names do not change; no success evidence currently exists. Any pre-amendment receipt or diagnostic observation is stale and cannot count as pass 1.

### Medium failed-probe diagnostic

A failed enabled `medium` probe MAY emit `visiblePreCallAssistant` only when the first `turn_end` message is structurally identical to the pre-call assistant message in the sole four-message `agent_end` history. The diagnostic contains only ordered allowlisted content block kinds (`thinking`, `text`, `toolCall`), UTF-8 byte lengths for its normal text blocks, and zero-based positions of those text blocks in the ordered content array. It MUST NOT include text, thinking, signatures, IDs, arguments, results, errors, hashes of content, raw events, or any unallowlisted block kind. It is absent for uncorrelated, malformed, non-medium, disabled, and successful paths; it neither changes validator acceptance nor writes evidence.

The prior observed medium two-normal-text-block shape remains non-admission. The later exact `thinking -> toolCall -> empty text` observation becomes admissible only after this amendment is implemented and hermetically verified; the historical observation itself remains non-admission and cannot be replayed as a receipt.

Any medium live attempt is a future, separately human-authorized pass-1 attempt under the existing route-local two-pass gate. The diagnostic does not authorize a retry, capability staging, evidence retention, or admission. If later direct evidence exposes any shape beyond the exact medium grammar above, stop and request a new decision rather than broadening the tolerance.

### 5. Evidence and catalog admission identity

A retained visible evidence record binds the exact route and profile, not merely the Pi reasoning label. Its allowlisted structure includes:

- existing schema and record kind;
- the new profile-specific revision;
- public model, reasoning, and exact suffixed wire model;
- `thinking: { kind: "budget", thinkingBudget, includeThoughts: true }`;
- profile fingerprint and validator contract revision;
- `completePassCount: 2`;
- two sanitized pass receipt hashes/timestamps;
- the fixed eight assertion labels;
- clean-exit, sanitized, and no-raw-response booleans.

It excludes prompts, thought or normal text, signatures, call IDs, arguments, results, credentials, headers, raw events, provider responses, and account/quota data.

An enabled catalog literal must reference the new revision and exact suffixed wire model. The route's literal budget is verified alongside that evidence identity in catalog tests. Existing `ToolEvidenceRef` does not need a global type expansion: the new revision names the profile lineage, the evidence record carries the allowlisted profile, and the containing catalog route supplies the exact budget checked by tests.

A JSON file never activates a route by discovery. Catalog activation remains a literal source edit after two passing live receipts and successful hermetic verification.

## Data flow

### Hermetic route qualification

```text
Pi reasoning literal
  -> static catalog entry
  -> exact suffixed wire model + integer budget
  -> existing serializeThinkingConfig()
  -> exact request model + thinkingBudget + includeThoughts
  -> disabled tool boundary or test-only exact enabled capability
  -> existing schema/replay/response/stream validators
```

No network transport is used.

### Future direct sequence

```text
explicit level/profile
  -> human authorization for pass 1
  -> temporary one-route capability stage
  -> one bounded live child
  -> exact route-specific amended validator
  -> sanitized pass-1 receipt; no evidence write
  -> separate human authorization for pass 2
  -> same exact source/profile + pass-1 receipt
  -> one bounded live child
  -> exact route-specific amended validator
  -> two-receipt aggregation
  -> sanitized route evidence
  -> separate exact-route admission and README update
```

No call is automatically retried. No sibling or fallback route is attempted.

## Hermetic RED/GREEN plan

### RED 1 — exact static route bytes

Add or amend failing tests before catalog changes:

- `catalog.test.ts` expects the exact three suffixed wire models and budget policies, and proves `off` remains tiered/native/invisible.
- `context.test.ts` expects the exact outbound model plus `thinkingBudget: 1000`, `4000`, or `-1` with `includeThoughts: true`; it rejects the old visible `thinkingLevel` expectation.
- Tests prove positive finite budgets retain the existing answer-reserve behavior, high `-1` does not add a finite reserve, and explicit `maxTokens` checks remain unchanged.
- A literal negative matrix rejects accidental tiered-budget and suffix-native route fixtures without exercising those combinations live.
- Existing disabled tool preflight and text-only behavior remain covered.

Expected RED is the current catalog's tiered/native low/medium/high output. Do not manufacture failures in response, replay, or schema code.

### GREEN 1 — minimal route replacement

Change only the three catalog route literals. Reuse `IntegerBudgetRoute` and the current serializer. Do not add fallback logic, a new serializer branch, environment override, discovery, rotation, or production validator change.

### RED 2 — amended probe/evidence identity and two-pass retention

In `scripts/pi-tool-loop-probe.test.ts`, add failing tests that require:

- exact visible route wire/budget/profile metadata and new revisions;
- unchanged implicit/explicit `off` metadata, arguments, labels, and evidence behavior;
- visible pass 1 returns a sanitized receipt and performs zero writes;
- matching complete pass 2 permits exactly one sanitized evidence write with `completePassCount: 2`;
- failure, timeout, malformed receipt, stale fingerprint, wrong route/level/wire/budget, changed validator revision, changed source state, duplicate receipt, or failed pass 2 performs zero writes;
- a first receipt cannot authorize or trigger the runner and does not bypass the second human gate;
- canaries remain absent from receipts, output, and evidence.

### GREEN 2 — minimal profile-aware sequencing

Replace the visible route factory with explicit closed metadata, add pure sanitized receipt/fingerprint/aggregation helpers, and modify only visible-route orchestration so one pass cannot write evidence. Preserve the runner, timeout, prompt, disabled control, and `off` path.

### RED 3 — medium-only empty trailing text

In `scripts/pi-tool-loop-probe.test.ts`, first add a failing exact-shape fixture for a complete correlated medium chain whose first assistant content is `thinking -> toolCall -> text`, with the final text value `""` and UTF-8 byte length `0`. Require all eight existing labels and no evidence write until the separate two-pass gate is satisfied.

Add failing or preserving hostile cases that prove:

- low rejects the empty trailing text and still admits only zero text;
- high retains only its optional nonempty, at-most-256-byte text between thinking and call and rejects medium's trailing-empty form;
- medium rejects nonempty text, whitespace-only text, multibyte or zero-width text, text before thinking, text between thinking and call, duplicate text, non-final text, extra blocks, and extra calls;
- the tolerated medium call remains the sole signed expected call and remains correlated with execution start/end, tool result, signed replay diagnostic, both assistant terminals, and sole agent end;
- the sanitized diagnostic and evidence/receipt outputs contain no raw-content canary.

Expected RED is the current `content.at(-1)` call assumption and zero-text medium predicate rejecting the exact trailing-empty fixture. Existing low, high, malformed-input, ordering, replay, and redaction tests must remain green in the same RED run.

### GREEN 3 — exact route grammar

Make the smallest probe-local validator change that parses exactly one call and applies the literal low/medium/high grammars above. Do not trim text, treat generic blank text as empty, add a shared permissive optional-text rule, change the prompt, or alter response/provider production code. Bump the validator contract revision and resulting profile fingerprints so no pre-amendment receipt can pair with a later pass.

### TRIANGULATE and REFACTOR

- Retain every validator outside the route-specific content grammar and preserve the high-only 256-byte boundary regressions unchanged.
- Add hostile cross-profile receipt pairing, old validator/tiered/native revisions, replay fallback, incomplete labels, duplicate terminal, medium whitespace/placement/cardinality variants, and raw-value canaries.
- Prefer literal tables and pure helpers; do not generalize into a model discovery or arbitrary profile framework.
- If the two-pass seam cannot remain probe-local, stop for a scope decision rather than changing shared provider lifecycle code.

## Planned implementation files

| Path | Amended responsibility |
|---|---|
| `packages/pi/src/catalog.ts` | Replace only visible low/medium/high tiered/native literals with the exact suffix/budget literals; keep capabilities disabled. |
| `packages/pi/src/catalog.test.ts` | Prove exact static routing, disabled states, new evidence identities, stale old identities, and unchanged `off`. |
| `packages/pi/src/context.test.ts` | Prove exact request model and `thinkingBudget` bytes plus output-token behavior and `off` preservation. |
| `scripts/pi-tool-loop-probe.ts` | Bind explicit visible route/profile metadata, enforce two-pass evidence retention, and implement only the exact medium trailing-empty grammar while preserving low/high. |
| `scripts/pi-tool-loop-probe.test.ts` | RED/GREEN coverage for identities, receipts, two-pass writes, mismatch/reset, redaction, exact medium acceptance/rejections, and preserved low/high validators. |
| `openspec/changes/enable-gemini-3-8-thinking-tools/specs/pi-provider-adapter/spec.md` | Later SDD reconciliation: add the exact medium trailing-empty grammar beside the suffix/budget and two-pass contract before apply. |
| `openspec/changes/enable-gemini-3-8-thinking-tools/tasks.md` | Later SDD reconciliation: add an unchecked bounded medium-validator TDD and verification work unit. |
| `packages/pi/evidence/gemini-3.8-flash-{low,medium,high}-tool-loop.json` | Later only after two consecutive authorized complete passes for that exact profile. |
| `packages/pi/README.md` | Later only after exact route admission; pending routes remain disabled. |

No change is planned to `context.ts`, `response.ts`, `stream.ts`, `tool-context.ts`, `tool-schema.ts`, `tool-contract.ts`, root `src/`, or `packages/core`.

## Hermetic verification

Focused gate after an authorized implementation:

```text
npm run build:core
npx vitest run packages/pi/src/tool-schema.test.ts packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts packages/pi/src/tool-context.test.ts scripts/pi-tool-loop-probe.test.ts
npm run typecheck:pi
npm run build:pi
```

Repository/distribution gate:

```text
npm run typecheck
npm run build
npm run test:pack
npm test
```

Also require `git diff --check`, confirmation that no low/medium/high evidence file exists, and confirmation that all three visible capabilities remain disabled. The focused probe assertions must prove the exact medium trailing-empty acceptance matrix, low's zero-text rule, high's separate nonempty 256-byte tolerance, stale pre-amendment fingerprint rejection, and zero evidence writes before two complete passes. These commands are hermetic and do not authorize a live call.

After any later two-pass admission, rerun both gates and issue a new formal verification report. The prior report cannot be reused as the amended verification receipt.

## Future live-validation gate

For one level only:

1. Confirm hermetic gates pass, the amended validator revision/profile fingerprint is active, and the exact route is disabled with no evidence file. For medium, the historical `thinking -> toolCall -> empty text` diagnostic run does not count as pass 1.
2. Run the explicit disabled control if separately authorized; it must reject locally with zero tool execution.
3. Obtain pass-1 authorization, temporarily stage only that exact capability, build, run exactly one live pass, restore disabled state if the bounded workflow pauses, and retain no evidence file.
4. Record only the sanitized pass-1 receipt and pause.
5. Obtain separate pass-2 authorization. Restage the identical route/profile on unchanged source and run exactly one live pass using the matching receipt.
6. On any mismatch or failure, restore disabled state, discard the sequence, retain no evidence, and restart from pass 1 only under new authorization.
7. After two complete consecutive passes, retain the sanitized evidence, enable only the exact route, update only its catalog expectation and README status, and run all verification gates.

Authorization for one pass or one level never covers the next pass, a retry, or a sibling.

## Rollback

### Before live validation

Revert the three visible catalog literals and probe profile/sequencing changes as one route-hypothesis work unit. The existing `off` route and evidence remain untouched. Because tools remain disabled, no capability claim or visible evidence file needs withdrawal.

### Medium tolerance rollback

Before live validation, revert only the medium grammar helper/predicate, its validator revision/fingerprint update, its tests, and reconciled SDD wording. Keep all visible routes disabled and retain no medium evidence. Any receipt created under the amended validator becomes invalid after rollback.

After a later medium admission, first disable only medium, remove its README enabled claim, withdraw its evidence record, and invalidate its receipts; then restore the prior medium zero-text grammar and validator identity. Low, high, and `off` remain unchanged unless an independently demonstrated shared defect requires otherwise.

### During the two-pass sequence

- Pass 1 failure: restore the staged literal, discard the receipt, retain no evidence.
- Pass 1 success followed by pause: keep production disabled and retain no evidence file.
- Pass 2 failure or mismatch: restore disabled state, invalidate the pass-1 receipt, retain no evidence, and do not retry automatically.
- Any source/profile/validator change between passes: reset to pass 1.

### After admission

Disable only the affected exact suffix/budget route, remove its README enabled claim, and withdraw its profile-specific evidence record. Independently admitted siblings remain unchanged unless the demonstrated defect applies to their exact profile. `off` remains unchanged in every rollback.

If all three suffix/budget candidates fail or remain nondeterministic, stop. Do not try tiered-budget, suffix-native, altered budgets, fallback, rotation, or discovery without a new human decision.

## Stacked-to-main review slice

The medium tolerance is a separate focused hermetic slice after the suffix/budget routing work; direct admissions remain later route-local slices.

```text
main
  -> prior probe/qualification stack
    -> suffix-budget-route-hypothesis (hermetic only)
      -> 📍 medium-empty-trailing-text-tolerance (hermetic only)
        -> future low admission (only after two authorized passes)
        -> future medium admission (only after two authorized passes)
        -> future high admission (only after two authorized passes)
```

**Current amendment start:** exact suffix/budget routes with medium still requiring zero text; all visible capabilities disabled and no visible evidence files present.

**Current amendment end:** the exact route-specific grammar, changed validator identity/fingerprints, and hostile hermetic tests; all visible capabilities still disabled and no visible evidence files created.

**Included together:** the probe validator change, its TDD coverage, and spec/task reconciliation. **Excluded:** live calls, temporary capability staging, evidence JSON, README enablement, commits, pushes, and publication.

Estimated implementation review load:

| Area | Forecast changed lines |
|---|---:|
| Catalog and exact route/request tests | 45–80 |
| Probe profile/two-pass orchestration | 55–95 |
| Probe receipt, mismatch, and redaction tests | 80–135 |
| SDD task/spec reconciliation | 25–45 |
| **Total** | **205–355** |

The medium-only validator amendment is a separate hermetic work unit forecast at 45–100 changed source/test/spec/task lines. It must keep its tests with the validator change, remain below 400 changed lines, and precede any new medium pass 1. If its actual work unit exceeds 400 lines, pause under `ask-on-risk`; do not combine it with admission, compress tests/docs, or infer `size:exception`.

The original suffix/budget slice remains forecast below the 400-line budget and should remain reviewable within about 60 minutes. If that work exceeds 400, make one honest split into (A) static route/request contract and (B) probe two-pass evidence contract, both stacked to main with tests kept beside behavior.

## Acceptance criteria

- The only selected visible hypothesis is exactly suffix wire model plus integer budget for low, medium, and high as listed.
- No tiered-budget, suffix-native, fallback, rotation, or discovery path exists.
- `off` remains exact and unchanged.
- Production low/medium/high remain disabled throughout hermetic implementation.
- The only response-shape change is medium's optional one exactly empty, zero-UTF-8-byte final text block after the sole correlated signed call.
- Low permits zero text blocks; high preserves only its separate optional one nonempty, at-most-256-UTF-8-byte block between thinking and call.
- Medium rejects nonempty or whitespace text, text before or between thinking and call, duplicate or non-final text, extra blocks, and extra calls.
- Every execution, signature, result, replay, diagnostic, marker, terminal, lifecycle, and redaction validator remains unchanged and green.
- One complete visible live pass cannot create evidence or admit a route.
- Two separately authorized, consecutive, complete passes for the identical level/profile and amended validator fingerprint are required before evidence retention; the diagnostic run that motivated this amendment counts as neither pass.
- All low/medium/high routes remain disabled with no visible evidence until that route completes the gate and receives separate admission authorization.
- Evidence and catalog identity bind the exact suffixed wire model, budget profile, validator contract, and new revision.
- Any failure or mismatch resets only that route's sequence and leaves siblings unchanged.
- A new formal verification report replaces the superseded prior report before this amended design can be considered verified.

## Archived negative closure

This design is closed as an archived harness outcome. `low`, `medium`, and `high` remain disabled and no longer have a future live-validation sequence under this change. A synthetically or live-successful visible probe MUST return non-admission and MUST NOT call the evidence writer, retain a receipt, aggregate evidence, or enable a route. The existing `off` control remains the sole writer-enabled route with its unchanged evidence contract. Terminal diagnostics retain only their existing fixed allowlisted categories, counts, and codes; arbitrary `preflightPath` strings are excluded. No visible admission, evidence file, README enablement, PR, commit, push, or publication is authorized by this archived closure.


## Authorized redacted medium validator failure-code projection

For a failed enabled `medium` probe only, the probe output MAY include `failedValidatorChecks`: an ordered array selected only from these fixed literals: `event-topology-order`, `pre-call-terminal-correlation`, `content-grammar`, `thinking-signatures`, `call-signature-identity`, `execution-event-correlation`, `tool-result-exact-shape`, `final-terminal-correlation-marker`, and `strict-tool-diagnostic`. `content-grammar` owns only route-specific content-block cardinality, order, and text bounds, including the medium final zero-byte trailer and high bounded pre-call text; `thinking-signatures` owns only the required nonempty signed thinking blocks. The validator and projection MUST share pure boolean checks, so projection cannot relax or reinterpret admission, and both checks remain required for admission. The array contains no values, counts, IDs, signatures, text, arguments, results, errors, hashes, or events; malformed and uncorrelated inputs fail closed to codes only. The existing `visiblePreCallAssistant` diagnostic remains unchanged. Successful enabled probes, disabled controls, `off`, `low`, and `high` MUST omit this property, and success evidence/admission bytes and behavior remain unchanged.
