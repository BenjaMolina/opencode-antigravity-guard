# Delta for Pi Provider Adapter

## ADDED Requirements

### Requirement: Gemini 3.8 Flash visible-thinking tool routes use exact suffix-and-budget profiles

For public model `antigravity-gemini-3.8-flash`, visible-thinking tool candidates MUST be a static, closed set of the following exact profiles:

| Reasoning | Wire model | Outbound `thinkingConfig` |
|---|---|---|
| `low` | `gemini-3.8-flash-low` | `{ thinkingBudget: 1000, includeThoughts: true }` |
| `medium` | `gemini-3.8-flash-medium` | `{ thinkingBudget: 4000, includeThoughts: true }` |
| `high` | `gemini-3.8-flash-high` | `{ thinkingBudget: -1, includeThoughts: true }` |

Each visible profile MUST use the integer-budget thinking policy corresponding to its listed `thinkingBudget`; it MUST NOT serialize `thinkingLevel`. No other suffix, budget, tiered-budget, suffix-native, alias, or runtime-selected combination MAY exist. The existing `off` route MUST remain behaviorally, evidentially, and byte-for-byte configuration unchanged: it uses wire model `gemini-3.8-flash-tiered`, native thinking level `low`, and `includeThoughts: false`.

Each visible candidate MUST remain `disabled` unless its exact public model, reasoning key, wire model, integer budget, `includeThoughts` value, profile fingerprint, validator revision, and source state have passing hermetic qualification and satisfy the two-pass direct-evidence gate. An enabled candidate MUST have an exact-route catalog literal and matching route-scoped evidence; a JSON file or observed backend response MUST NOT discover, activate, or mutate a route.

#### Scenario: Visible routes serialize their exact static profiles

- GIVEN Pi selects `low`, `medium`, or `high` for `antigravity-gemini-3.8-flash`
- WHEN the provider serializes a text-only request
- THEN it MUST use only the corresponding listed suffixed wire model and exact `thinkingBudget` with `includeThoughts: true`, and MUST NOT emit `thinkingLevel`

#### Scenario: Off serialization remains unchanged

- GIVEN Pi omits the selector or explicitly selects `off` for Gemini 3.8 Flash
- WHEN the provider or probe resolves the route
- THEN it MUST retain the existing tiered/native/invisible configuration, zero-selector probe behavior, evidence path and revision, and existing assertions

#### Scenario: Non-selected profiles cannot be inferred

- GIVEN a visible candidate is unavailable, fails qualification, or receives an unexpected backend response
- WHEN the provider evaluates that candidate
- THEN it MUST NOT attempt, select, infer, or retain an alternative suffix, budget, native level, tiered route, sibling level, model, account, or quota pool

### Requirement: Visible-thinking evidence requires two consecutive exact-profile passes

Before success evidence may be retained or a visible-thinking candidate may be admitted, that candidate MUST complete two consecutive, separately authorized direct passes for the same exact profile. A complete pass MUST have clean child termination and all fixed visible-chain assertions passing, including the ordered chain `visible signed thinking -> tool call -> Pi tool result -> signed replay/continuation`, with no timeout, credential, quota, access, transport, signature, replay, result, diagnostic, marker, or terminal failure.

The first complete pass MUST produce only a sanitized, route-bound receipt and MUST NOT write route evidence, enable a capability, or imply admission. The second pass MUST consume the first receipt and prove the identical public model, reasoning, wire model, budget, `includeThoughts` value, profile fingerprint, validator revision, and source state. Only after the second complete pass MAY a pure aggregation step retain one redacted evidence record with `completePassCount: 2` and the two allowlisted receipt hashes and timestamps. Admission remains a separate explicit exact-route action after that retained evidence exists.

Any failed, incomplete, stale, duplicate, intervening, mismatched, or profile- or source-changed attempt MUST reset only the affected route's candidate sequence. After a reset, the route MUST retain no success evidence or failed-pass evidence and a previous first-pass receipt MUST NOT be paired with a later attempt. A failure for one route MUST NOT reset, enable, disable, block, substitute for, or imply evidence for a sibling route. The provider MUST NOT retry automatically, fall back, rotate accounts or quota pools, perform discovery, or use hidden routing.

#### Scenario: One complete pass cannot retain evidence

- GIVEN an authorized direct pass for one exact visible profile completes with every fixed assertion passing
- WHEN the pass is recorded
- THEN the route MUST produce only its sanitized first-pass receipt, MUST write no evidence record, and MUST remain disabled

#### Scenario: Two consecutive matching passes retain one evidence record

- GIVEN a route has one complete first-pass receipt and receives separate authorization for a second pass with unchanged exact profile and source state
- WHEN the second pass completes with every fixed assertion passing
- THEN the aggregator MAY retain exactly one redacted record bound to that profile with `completePassCount: 2`, and no sibling route MAY be admitted by that record

#### Scenario: An intervening failure resets the candidate sequence

- GIVEN a route has a complete first-pass receipt
- WHEN a later attempt for that route fails, is incomplete, or mismatches the receipt or exact profile
- THEN the candidate sequence MUST reset, no evidence record or failed-pass evidence MUST be retained, and a subsequent successful pass MUST begin a new first-pass sequence

### Requirement: Visible signed tool continuity remains strict and redacted

For visible-route admission, each accepted chain MUST begin with a contiguous prefix of signed thinking blocks and contain exactly one signed `pi_evidence_echo` call. `low` MUST accept only the strict shape `signed thinking -> sole call` and MUST contain zero normal `text` blocks. `medium` MUST accept only either that strict shape or `signed thinking -> sole call -> exactly one final normal text block` whose UTF-8 byte length is exactly zero. `high` MAY contain exactly one nonempty normal `text` block only immediately after the contiguous signed-thinking prefix and immediately before the sole signed `pi_evidence_echo` call; that block MUST be no larger than 256 UTF-8 bytes.

For every level, a normal text block that is whitespace-only, nonempty where the applicable shape permits only an empty block, empty where `high` permits its pre-call block, misplaced, duplicated, or accompanied by any extra normal text block MUST be non-admission. A text block before thinking or after the call is non-admission except for medium's one exactly-zero-byte final text block. A second call, any extra call, a call outside the applicable shape, or any extra thinking or content block outside the applicable shape MUST be non-admission. The exact visible-route suffix-and-budget identity, including public model, reasoning key, wire model, integer budget, `includeThoughts` value, profile fingerprint, validator revision, and source state, MUST remain unchanged throughout qualification and each of the two consecutive future authorized direct passes; a passing shape for one profile MUST NOT satisfy another profile's admission.

Hermetic qualification and each complete direct pass MUST preserve strict declaration preflight, signed replay and continuation, exact call/result association, assistant source ordering, parallel replay, interrupted or reconstructed-history handling, one-terminal lifecycle, and rejection of malformed, unsigned, invalid-signature, duplicate, foreign, separated, mismatched, media-bearing, deferred-tool, fallback, or ambiguous inputs. Evidence, receipts, and diagnostics MUST contain only allowlisted route/profile identity, fixed assertion labels, clean-exit state, timestamps, receipt hashes, and boolean structural outcomes. They MUST NOT persist or print prompt text, thought or normal text, signatures, call IDs, arguments, tool-result content, credentials, headers, raw events, raw provider output, account data, or quota data.

#### Scenario: Low accepts only strict zero-text continuity

- GIVEN a `low` visible signed tool chain contains a contiguous signed-thinking prefix followed by one signed `pi_evidence_echo` call
- WHEN the chain contains no normal text, no extra call, and no extra content block
- THEN it MUST be admissible only if its exact suffix-and-budget identity matches the `low` profile

#### Scenario: Medium accepts an empty trailing text block

- GIVEN a `medium` visible signed tool chain contains a contiguous signed-thinking prefix followed by one signed `pi_evidence_echo` call and exactly one final normal text block
- WHEN that final text block has UTF-8 byte length of exactly zero and the exact suffix-and-budget identity matches the `medium` profile
- THEN the chain MUST be admissible for that `medium` pass

#### Scenario: Medium also accepts the strict shape

- GIVEN a `medium` visible signed tool chain contains a contiguous signed-thinking prefix followed directly by one signed `pi_evidence_echo` call
- WHEN the chain contains no normal text, extra call, or extra content block and its exact suffix-and-budget identity matches the `medium` profile
- THEN the chain MUST be admissible for that `medium` pass

#### Scenario: Invalid medium trailing text is rejected

- GIVEN a `medium` visible signed tool chain contains whitespace-only, nonempty, misplaced, duplicate, or additional normal text blocks, or an extra call or content block
- WHEN the chain is validated
- THEN it MUST be non-admission even if its route identity otherwise matches the `medium` profile

#### Scenario: High-only optional text is bounded

- GIVEN a visible signed tool chain contains normal pre-call text
- WHEN the chain is validated
- THEN it MUST be admissible only for `high` when exactly one nonempty block occurs immediately after the contiguous signed-thinking prefix and immediately before the sole signed `pi_evidence_echo` call, is at most 256 UTF-8 bytes, and matches the exact `high` suffix-and-budget identity

#### Scenario: Two future direct passes retain identity

- GIVEN a visible profile completes a first authorized direct pass with its applicable accepted chain shape
- WHEN a second separately authorized direct pass is evaluated for evidence retention
- THEN both passes MUST have identical exact suffix-and-budget identity and satisfy the applicable shape, or the route MUST not retain success evidence or be admitted

#### Scenario: Parallel and interrupted histories retain strict continuity

- GIVEN an enabled exact profile reconstructs parallel calls, reverse-completion results, or a partially interrupted call group
- WHEN the next context is validated and serialized
- THEN exact ID/name association, assistant source order, signed replay rules, and existing synthetic missing-result behavior MUST be preserved, while invalid history MUST fail before transport

#### Scenario: Sensitive content is absent from retained artifacts

- GIVEN a live pass or hermetic test contains prompt, thought, signature, call, argument, result, credential, header, or raw-output canaries
- WHEN it emits a receipt, diagnostic, or evidence record
- THEN none of those canaries MUST appear in the emitted or retained artifact

## MODIFIED Requirements

### Requirement: Gemini schema-profile routing is explicit and isolated

The provider MUST select the named Gemini `parametersJsonSchema` schema profile for the already-enabled `antigravity-gemini-3.8-flash` route at reasoning level `off`. It MUST select that same profile for reasoning level `low`, `medium`, or `high` only when that exact suffix-and-budget profile is independently `enabled` under the visible-thinking tool-route admission requirements. An enabled visible route MUST retain its exact static profile: `low` MUST use wire model `gemini-3.8-flash-low` with `thinkingBudget: 1000` and `includeThoughts: true`; `medium` MUST use wire model `gemini-3.8-flash-medium` with `thinkingBudget: 4000` and `includeThoughts: true`; and `high` MUST use wire model `gemini-3.8-flash-high` with `thinkingBudget: -1` and `includeThoughts: true`. The profile MUST serialize declarations only as `functionDeclarations[*].parametersJsonSchema` and MUST NOT emit a legacy `parameters` field. The provider MUST NOT apply this profile to a disabled target route, another Gemini row, Claude, GPT-OSS, or any future route merely because that route becomes otherwise reachable.

A tool-bearing context for every tool-disabled row/route MUST continue to fail before transport through its capability policy, without schema normalization that broadens its behavior, declaration omission, fallback, model substitution, account or quota-pool rotation, or a network request. Text-only behavior on those rows/routes MUST remain unchanged.

(Previously: The named Gemini schema profile was limited to the enabled Gemini 3.8 Flash `off` route and could not apply to the visible-thinking routes.)

#### Scenario: Enabled Gemini off route uses the named profile

- GIVEN `antigravity-gemini-3.8-flash` at reasoning level `off` receives valid Pi tool declarations
- WHEN the provider serializes the context
- THEN every declaration MUST be serialized in source order under `functionDeclarations[*].parametersJsonSchema` and no declaration MUST contain a legacy `parameters` field

#### Scenario: Independently admitted visible route uses the named profile

- GIVEN `antigravity-gemini-3.8-flash` at `low`, `medium`, or `high` is independently enabled and receives valid Pi tool declarations
- WHEN the provider serializes the context
- THEN it MUST use only that level's exact suffix-and-budget profile and serialize every declaration in source order under `functionDeclarations[*].parametersJsonSchema` without a legacy `parameters` field

#### Scenario: Disabled routes remain isolated

- GIVEN a disabled Gemini 3.8 Flash visible-thinking route, a Gemini route other than Gemini 3.8 Flash, or a Claude or GPT-OSS route receives a tool-bearing context
- WHEN it is validated
- THEN the provider MUST fail through the existing capability boundary before transport and MUST preserve that route's text-only behavior

### Requirement: Schema-profile claims and verification have an explicit evidence boundary

The Pi package README MUST describe the Gemini schema profile as available to the evidence-enabled Gemini 3.8 Flash `off` route and only to each of `low`, `medium`, and `high` after that exact suffix-and-budget profile has completed hermetic qualification and two consecutive, separately authorized, complete direct passes and has been explicitly admitted. It MUST distinguish hermetic preservation and preflight verification from direct live backend acceptance, MUST NOT claim support for a disabled, pending, failed, untested, or inconclusive route, and MUST NOT represent the existing `off` simple echo evidence as proof of visible-thinking continuity or the broader constrained or reference-based schema set.

The change MUST have hermetic verification covering schema-profile normalization, exact request serialization, static-profile isolation, fail-closed preflight, visible signed-thinking/tool-loop ordering, signed continuation, parallel and interrupted-history replay, probe selection, two-pass evidence retention, sequence reset, and redaction. Required verification MUST include the focused Pi schema, context, tool-context, response, stream, catalog, and probe-test suites; Pi and root typecheck/build checks; packed-package installation verification; and the full test suite. A live model call, credential access, evidence-record rewrite, or publication MUST NOT be required to satisfy hermetic qualification. Any later live claim for a visible-thinking route or broader schemas MUST require separately authorized, route-scoped, redacted direct evidence and MUST NOT replace hermetic hostile-input, interruption, or parallel-history coverage.

(Previously: The README named Gemini 3.8 Flash `off` as the only evidence-enabled schema-profile tool route and did not define the independent visible-thinking admission boundary.)

#### Scenario: Documentation does not overstate support

- GIVEN a reader consults the Pi package README after this change
- WHEN the reader determines which Gemini 3.8 Flash tool routes are supported
- THEN the README MUST identify `off` as retained support and identify each of `low`, `medium`, and `high` as enabled only after its own exact-profile two-pass admission evidence and explicit admission exist

#### Scenario: Hermetic verification does not imply a live claim

- GIVEN the required hermetic checks pass without a live model call
- WHEN the change is evaluated for correctness
- THEN the checks MUST establish the local serialization and safety contract without asserting direct backend acceptance or enabled status for any visible-thinking route

#### Scenario: Direct evidence remains individually scoped

- GIVEN two complete authorized direct passes succeed for one visible-thinking reasoning level
- WHEN documentation or an evidence record is updated
- THEN it MUST make no enabled claim for either sibling level unless that sibling has its own matching exact-profile two-pass evidence and explicit admission

### Requirement: Archived visible probes retain no evidence

When this change is closed as an archived negative harness, `low`, `medium`, and `high` MUST remain disabled and MUST NOT retain evidence from any successful visible probe. A visible probe that otherwise completes every validator check MUST NOT call an evidence writer, create a receipt, aggregate a record, admit a capability, or make a support claim. The `off` control MUST retain its existing successful writer and evidence behavior unchanged. Terminal summaries MUST exclude arbitrary `preflightPath` strings while preserving their fixed allowlisted categories and codes.

#### Scenario: Successful visible probe stays closed

- GIVEN a synthetic or live `low`, `medium`, or `high` probe completes its visible validator checks
- WHEN the archived harness emits its terminal outcome
- THEN it MUST report non-admission, write no evidence, and retain no visible-route receipt or aggregate record

#### Scenario: Off evidence control remains unchanged

- GIVEN the `off` probe completes its existing successful control assertions
- WHEN it emits its terminal outcome
- THEN it MUST preserve its existing writer call, evidence path, revision, and fixed assertions

#### Scenario: Arbitrary preflight paths are redacted

- GIVEN a terminal diagnostic contains a `preflightPath` canary string
- WHEN the archived harness summarizes the terminal
- THEN the summary MUST omit that string while retaining only fixed allowlisted diagnostic fields
