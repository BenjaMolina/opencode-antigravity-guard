# Design: Typed Pi Antigravity model catalog

Replace the three independent Gemini 3.8 allowlists with one immutable Pi-local catalog. Each catalog row carries an exact Pi descriptor, exact per-level wire route, a discriminated thinking policy, and a replay policy. Registration, serialization, and transport all resolve that same row. The existing 3.8 row remains first and byte-for-byte equivalent at its public descriptor and request-policy boundaries.

This is a design artifact only. It authorizes no implementation, test execution, external request, credential access, commit, delivery chain, or publication.

## Readiness and authority

- Inputs read directly: `explore.md`, `proposal.md`, `evidence.md`, `specs/pi-provider-adapter/spec.md`, `../../config.yaml`, current `packages/pi` provider/context/stream/response sources and tests, extension wiring, manifests, Pi README, and Pi 0.85.1 thinking-level documentation.
- Scope is explicitly `packages/pi` plus this change's OpenSpec artifacts. Root OpenCode runtime behavior, `packages/core`, OAuth, project persistence, endpoint selection, and account/quota behavior do not change.
- Evidence admits 3.7, 3.6, 3.1 Pro, Claude Sonnet, Claude Opus Thinking, and GPT-OSS at only the levels recorded below. Gemini 3.5 remains absent from the runtime catalog because its HTTP-200 response never reached a strict normal terminal state.
- Strict TDD remains required. No tests or builds were run in this phase.
- The complete implementation is forecast above 400 changed lines. Under `ask-on-risk`, the work units below are candidate chain slices only; the parent must ask for a delivery decision after `sdd-tasks` and before apply. No chain strategy or `size:exception` is selected here.

## 1. Catalog boundary

Add `packages/pi/src/catalog.ts` as the only model registry. Keep host constants (`antigravity-guard`, `antigravity-guard-sse`, daily endpoint) in their current owners; the catalog describes models, not authentication or transport origins.

### Public contracts

```ts
type StandardReasoningLevel = "off" | "minimal" | "low" | "medium" | "high"

type NativeLevelPolicy = {
  kind: "native-level"
  routes: Readonly<Record<"off" | "low" | "medium" | "high", {
    wireModel: string
    thinkingLevel: "low" | "medium" | "high"
    includeThoughts: boolean
  }>>
}

type IntegerBudgetRoute =
  | { wireModel: string, thinking: { kind: "omit" } }
  | { wireModel: string, thinking: { kind: "budget", budget: number, includeThoughts: boolean } }

type IntegerBudgetPolicy<L extends StandardReasoningLevel> = {
  kind: "integer-budget"
  routes: Readonly<Record<L, IntegerBudgetRoute>>
}

type ReplayPolicy =
  | { kind: "same-public-model" }
  | { kind: "strip" }

type ResponsePolicy =
  | { kind: "gemini-envelope", family: "gemini" }
  | { kind: "gemini-envelope", family: "claude" }
  | { kind: "gemini-envelope", family: "gpt-oss" }
```

The concrete `CATALOG` is declared `as const satisfies readonly CatalogEntry[]`. Literal public IDs and literal wire IDs are inferred from the data; no public ID, display label, family prefix, level suffix, or wire ID is generated with string replacement. A `defineCatalog()` initializer builds a private read-only lookup map and fails on duplicate public IDs, an empty route set, a route outside the descriptor's Pi level map, or a route whose output/budget invariant can never be satisfied. Repeated wire IDs inside one evidenced model are intentional and must not be rejected.

Expose only narrow functions and derived types:

- `listCatalogEntries()` returns registration order without allowing mutation.
- `getCatalogEntry(publicId: unknown)` returns the exact entry or `undefined`.
- `resolveGenerationRoute(entry, reasoning)` normalizes omitted reasoning to `off`, rejects unsupported levels, and returns one literal route.
- `toPiModelDescriptor(entry)` returns a fresh Pi descriptor so host-side mutation cannot change catalog policy.
- `AntigravityPublicModelId`, `AntigravityWireModelId`, and `GenerationRoute` are derived from the catalog literals rather than maintained as parallel string unions.

`thinkingLevelMap` is descriptor/UI metadata, not the serializer. Pi uses omitted standard keys as its normal mapping, `null` to hide unsupported standard levels, and omission for unsupported extended `xhigh`/`max`. The serializer independently validates the resolved catalog route so direct API callers cannot bypass UI restrictions.

### Static rows and Pi maps

Registration order keeps 3.8 first, then 3.7, 3.6, 3.1 Pro, Sonnet, Opus, and GPT-OSS. All descriptors remain `input: ["text"]`, zero subscription cost, and `reasoning: true` because every registered row exposes at least one visible reasoning level.

| Public ID | Pi `thinkingLevelMap` | Context / output descriptor | Replay |
|---|---|---:|---|
| `antigravity-gemini-3.8-flash` | exactly `{ minimal: null, low: "low", medium: "medium", high: "high" }` | 1,048,576 / 65,536 | same exact public model |
| `antigravity-gemini-3.7-flash` | `{ minimal: null, low: "low", medium: "medium", high: "high" }` | 1,048,576 / 65,536 | strip |
| `antigravity-gemini-3.6-flash` | `{ minimal: null, low: "low", medium: "medium", high: "high" }` | 1,048,576 / 65,536 | strip |
| `antigravity-gemini-3.1-pro` | `{ minimal: null, low: "low", medium: null, high: "high" }` | 1,048,576 / 65,535 | strip |
| `antigravity-claude-sonnet-4.6` | `{ minimal: null, low: null, medium: null, high: "high" }` | 250,000 / 64,000 | strip |
| `antigravity-claude-opus-4.6-thinking` | `{ minimal: null, low: null, medium: null, high: "high" }` | 250,000 / 64,000 | strip |
| `antigravity-gpt-oss-120b` | `{ minimal: null, low: null, medium: "medium", high: null }` | 131,072 / 32,768 | strip |

Do not include an `off` map property: in Pi 0.85.1, an omitted standard key keeps the normal `off` choice, while `off: null` would hide it. Explicit `null` values prevent Pi from presenting unsupported standard levels. Omitted `xhigh` and `max` remain unsupported. `minimal` remains unavailable for 3.8 and every new row.

Only 3.8 has replay evidence established by the released adapter. Observing a signature in a one-turn fixture is not evidence that replay is accepted. New Gemini, Claude, and GPT-OSS rows therefore strip signatures and thought markers on historical assistant content while preserving the text itself. A later replay expansion requires a separate evidence record and catalog-policy change; family membership alone never enables replay.

### Exact generation routes

| Public model / Pi choice | Exact wire model | Exact `thinkingConfig` |
|---|---|---|
| 3.8 off | `gemini-3.8-flash-tiered` | `{ thinkingLevel: "low", includeThoughts: false }` |
| 3.8 low/medium/high | `gemini-3.8-flash-tiered` | matching native string level, `includeThoughts: true` |
| 3.7 off | `gemini-3.7-flash-low` | `{ thinkingBudget: 0, includeThoughts: false }` |
| 3.7 low | `gemini-3.7-flash-low` | `{ thinkingBudget: 1000, includeThoughts: true }` |
| 3.7 medium | `gemini-3.7-flash-medium` | `{ thinkingBudget: 4000, includeThoughts: true }` |
| 3.7 high | `gemini-3.7-flash-high` | `{ thinkingBudget: -1, includeThoughts: true }` |
| 3.6 off | `gemini-3.6-flash-low` | omitted |
| 3.6 low | `gemini-3.6-flash-low` | `{ thinkingBudget: 1000, includeThoughts: true }` |
| 3.6 medium | `gemini-3.6-flash-medium` | `{ thinkingBudget: 4000, includeThoughts: true }` |
| 3.6 high | `gemini-3.6-flash-high` | `{ thinkingBudget: -1, includeThoughts: true }` |
| 3.1 Pro off | `gemini-3.1-pro-low` | omitted |
| 3.1 Pro low | `gemini-3.1-pro-low` | `{ thinkingBudget: 1001, includeThoughts: true }` |
| 3.1 Pro high | `gemini-pro-agent` | `{ thinkingBudget: 10001, includeThoughts: true }` |
| Sonnet off | `claude-sonnet-4-6` | `{ thinkingBudget: 0, includeThoughts: false }` |
| Sonnet high | `claude-sonnet-4-6` | `{ thinkingBudget: 1024, includeThoughts: true }` |
| Opus off | `claude-opus-4-6-thinking` | `{ thinkingBudget: 0, includeThoughts: false }` |
| Opus high | `claude-opus-4-6-thinking` | `{ thinkingBudget: 1024, includeThoughts: true }` |
| GPT-OSS off | `gpt-oss-120b-medium` | omitted |
| GPT-OSS medium | `gpt-oss-120b-medium` | `{ thinkingBudget: 8192, includeThoughts: true }` |

The `medium` suffix in `gpt-oss-120b-medium` is literal identity data in both GPT-OSS routes. It is never parsed as a level. Gemini suffix changes are likewise literal route entries, not derived names. The descriptor limits and routes above follow the current account discovery record: Sonnet and Opus use 250,000 context / 64,000 output with high budget 1024, while GPT-OSS uses 131,072 context / 32,768 output with medium budget 8192.

## 2. Request serialization and output-budget safety

Refactor `packages/pi/src/context.ts` around the selected catalog entry while retaining its defensive plain-object, dense-array, getter, byte-bound, header, and text-only checks.

1. Resolve `model.id` with `getCatalogEntry()` before walking context.
2. Normalize absent reasoning and explicit `off` to the catalog's `off` route. Reject `minimal`, unsupported standard levels, `xhigh`, `max`, and unknown runtime values before transport.
3. Continue rejecting caller `thinkingBudgets`; callers select Pi levels, while the catalog owns exact numeric budgets.
4. Serialize the route's literal wire ID into `GenerationRequest.model`.
5. Emit a native string `thinkingConfig`, an integer-budget `thinkingConfig`, or no `thinkingConfig` according to the route discriminant. Never construct the object and delete fields afterward.
6. Preserve system/user/assistant ordering and all existing tool, tool-result, tool-call, image, unknown-role, deferred, sampling, protected-header, and oversized-context failures.

`GenerationRequest.request.generationConfig` becomes a union with optional `thinkingConfig`:

- native level: `{ thinkingLevel, includeThoughts }`;
- integer budget: `{ thinkingBudget, includeThoughts }`;
- omission route: no `thinkingConfig` property at all.

Output safety distinguishes explicit caller intent from provider defaults:

- An explicit `options.maxTokens` remains a positive integer no greater than the selected descriptor's `maxTokens`.
- For a positive finite thinking budget, explicit `maxTokens` must be strictly greater than the budget. Reject equality or a lower value locally with `ContextSerializationError`; never send a known-invalid request and never silently raise an explicit user limit.
- If `maxTokens` is omitted, retain 4,096 exactly for 3.8 and any route whose budget fits while leaving answer room. For a larger positive budget, choose `budget + 1,024`, bounded by the descriptor maximum. This follows Pi's existing 1,024-token answer reserve and makes 3.1 high and GPT-OSS medium usable without overriding caller intent.
- Budget `0`, dynamic budget `-1`, and omitted thinking config do not participate in the positive-budget comparison. They keep the normal 4,096 default.
- `defineCatalog()` rejects any finite budget for which `budget + 1,024` exceeds that model's descriptor maximum.

The descriptor context window remains host metadata; this adapter has no tokenizer and must not pretend its existing 8 MiB byte bound is an exact token-window check.

### Replay serialization

Change `messageParts()` to receive the target entry and source assistant metadata rather than a `sameProviderAndModel` boolean.

- `same-public-model`: only when source provider is `antigravity-guard` and source model equals the target public ID, retain current 3.8 thought/text marker and valid base64 signature behavior.
- `strip`: serialize historical thinking as ordinary text and text as text, omitting all signatures. This also applies across every public-model and family boundary.
- Empty content remains invalid after stripping. Invalid signatures are never forwarded.

This keeps 3.8 unchanged while avoiding a broad `startsWith("gemini-")` or family-derived replay rule.

## 3. Provider, stream, response, and usage integration

### `provider.ts`

Replace the single `MODEL` constant and inline descriptor with `listCatalogEntries().map(toPiModelDescriptor)`. Keep provider name, API, daily base URL, OAuth lifecycle, credential parsing, stream callback, endpoint, headers, and zero-cost semantics unchanged. Registration remains synchronous and performs no discovery or network work.

Provider tests assert the complete ordered descriptor array, exact maps, exact limits, text-only input, zero costs, 3.8 first and unchanged, and complete absence of Gemini 3.5. The existing login/refresh/stream vertical test continues to select 3.8 and assert its exact tiered route.

### `stream.ts`

Remove the one-model constant. `validateInput()` requires the existing API and successful catalog lookup; it returns the entry instead of only throwing. Pass that entry to serialization, or resolve through the same catalog in serialization and assert identity. Do not trust a caller-supplied descriptor's name, limits, map, provider, or base URL for routing.

Everything after payload creation remains common: one fixed daily Antigravity OAuth endpoint, protected headers, payload/response hooks, timeout/cancellation, SSE framing, semantic delivery, safe HTTP errors, and no retry/fallback/rotation. Tests iterate one representative route per policy family and prove unsupported IDs/APIs fail before `fetch`.

### `response.ts`

No production parser broadening is designed. The admitted captures fit the existing strict Gemini envelope: one candidate, text/thought parts, optional valid signature, `STOP`/`MAX_TOKENS`, nonempty metadata strings, and cumulative prompt/cache/candidate/thought usage. `stream.ts` continues to create one `ResponseSemantics` instance per request.

Family labels in `ResponsePolicy` are fixture/audit identities, not permission for permissive parsing. Keep rejecting function calls/responses, images, unknown part keys, `OTHER`, malformed usage, post-finish data, `[DONE]` before finish, empty content, and EOF without finish. If strict fixture transcription reveals an additional key, implementation must stop and update the design/spec rather than add a generic unknown-field bypass.

Usage remains shared and cumulative:

- `input = promptTokenCount - cachedContentTokenCount`;
- `cacheRead = cachedContentTokenCount`;
- `reasoning = thoughtsTokenCount`;
- `output = candidatesTokenCount + thoughtsTokenCount`;
- `cacheWrite = 0`;
- total and reported-total consistency retain current validation;
- Pi lifecycle continues to call `calculateCost` against zero rates and emit ordered thinking/text blocks.

No tools or images are admitted in descriptors, requests, responses, or documentation.

## 4. Strict fixture and test design

Keep fixtures redacted and deterministic inside test-only TypeScript modules whose emitted names contain `.test.` so package allowlists exclude them. Do not store raw prompts, thoughts, account IDs, projects, response IDs, credentials, or complete discovery output. Placeholder text and base64 signatures must still exercise exact schema keys.

| Fixture family | Required assertions |
|---|---|
| Released 3.8 | Existing descriptor object, tiered wire ID, native low hidden off, three visible native levels, signed same-model replay, exact events and usage remain unchanged. |
| New Gemini | Table-driven exact 3.7/3.6/3.1 routes; zero-budget versus omission off; suffix identities; signed text; normal finish and usage; new-entry replay stripping. |
| Claude | Sonnet and Opus off/high requests; budget 1024; explicit output `<= 1024` rejection; default output safety; interleaved thought/text/signature lifecycle; replay stripping. |
| GPT-OSS | Literal `gpt-oss-120b-medium` for off/medium; omission versus 8192; default and explicit output safety; thought/text and usage; no suffix parsing; replay stripping. |
| Blocked Gemini 3.5 | HTTP-200-shaped records with content but no finish/model-version/usage must fail `ResponseSemantics.finish()`; catalog lookup and provider registration remain absent. |
| Text-only matrix | For every registered public ID, nonempty tools, tool history/calls, images, and unknown content fail before `fetch`. |

Test responsibilities:

- `catalog.test.ts`: exact ordered rows, public-ID uniqueness, descriptor maps, route literals, invalid level rejection, duplicate-definition failure, immutable copies, and 3.5 absence.
- `provider.test.ts`: exact registration projection and unchanged 3.8 OAuth-stream bridge.
- `context.test.ts`: exact request matrix, off semantics, unsupported/direct level rejection, budget/output rules, signature policy, no caller mutation, and all current defensive validation.
- `stream.test.ts`: shared membership/API validation, exact payloads through the fixed endpoint, one representative response per family, pre-fetch rejection, cancellation, errors, and concurrency.
- `response.test.ts`: strict redacted family fixtures, usage and lifecycle semantics, malformed/unsupported records, and the nonterminal 3.5 rejection.
- `extension.test.ts`: remains a synchronous one-provider assertion; no new behavior is needed.

For every behavior increment: add/adjust the focused test and observe RED, implement minimum GREEN, add a boundary TRIANGULATE case, then refactor under green. Characterization tests that already pass are baseline evidence, not fabricated RED. Record command, exit code, and assertion result in apply evidence.

Focused verification order:

1. `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/provider.test.ts`
2. `npx vitest run packages/pi/src/context.test.ts`
3. `npx vitest run packages/pi/src/response.test.ts packages/pi/src/stream.test.ts`
4. `npm run typecheck:pi`
5. `npm run build:pi`
6. `npm test`
7. `npm run typecheck`

No environment-backed model command belongs in implementation verification: the admitted evidence is already recorded, and this phase authorizes no live call.

## 5. File changes

| Path | Designed change |
|---|---|
| `packages/pi/src/catalog.ts` | New immutable catalog, discriminated policies, descriptor projection, lookup, route resolution, and duplicate/invariant checks. |
| `packages/pi/src/catalog.test.ts` | Exact registry and type/runtime invariants. |
| `packages/pi/src/provider.ts` / `.test.ts` | Register the projected ordered catalog; preserve OAuth and 3.8 vertical behavior. |
| `packages/pi/src/context.ts` / `.test.ts` | Catalog resolution, route-specific generation config, output-budget safety, and per-entry replay. |
| `packages/pi/src/stream.ts` / `.test.ts` | Shared catalog membership/API validation and family transport fixtures; transport remains fixed. |
| `packages/pi/src/response.test.ts` | Strict Gemini/Claude/GPT fixtures and abnormal 3.5 terminal rejection. |
| `packages/pi/src/response.ts` | No planned production change; edit only if a strict fixture contradicts this design, after stopping for design/spec correction. |
| `packages/pi/README.md` | Ordered supported IDs, exact exposed Pi levels, off behavior, output-budget rule, text-only/no-tools/no-images, 3.5 exclusion, and unchanged auth/quota boundary. |

No manifest, OAuth, project, core, root OpenCode, storage, quota, recovery, or endpoint file is designed to change.

## 6. Reviewable work units and delivery gate

These estimates count authored additions and deletions, including tests and docs. They are forecasts, not verified diffs, and must not be met by compressing code or separating tests from behavior.

| Unit | Start → finished behavior | Forecast | Same-unit verification |
|---|---|---:|---|
| A: catalog foundation | Three hard-coded allowlists → one typed catalog still registering only unchanged 3.8 | 260–360 | Catalog/provider/context/stream 3.8 characterization, Pi typecheck/build |
| B: admitted Gemini | 3.8-only catalog → 3.7, 3.6, and 3.1 exact budget routes and replay stripping | 300–390 | Catalog/context/stream Gemini matrix, all text-only failures |
| C: Claude policies | No Claude entries → Sonnet and Opus off/high with 1024 budget/output safety and strict fixture lifecycle | 260–360 | Catalog/context/response/stream Claude tests, Pi typecheck |
| D: GPT and blocked 3.5 | No GPT entry/blocked regression → literal GPT off/medium route plus strict nonterminal 3.5 rejection | 220–320 | GPT request/response/usage tests and 3.5 absence/failure |
| E: catalog docs and final regression | Internal support → exact user-facing catalog and repository regression evidence | 100–180 | Pi tests/build/typecheck, root test/typecheck |

Dependency order is A → B; A → C; A → D; B/C/D → E. Each unit keeps behavior, tests, and its user-facing documentation together where practical; E consolidates the final catalog table and cross-package verification rather than postponing missing behavior tests.

Total forecast is 1,140–1,610 changed lines, so a single review unit cannot honestly fit the 400-line budget. Chained delivery is needed unless the human reduces scope or explicitly accepts `size:exception`. Because delivery strategy is `ask-on-risk`, stop after `sdd-tasks` presents the formal forecast and ask the human to choose chaining, scope reduction, or explicit exception. If chaining is chosen, ask separately for `stacked-to-main` versus `feature-branch-chain`; do not infer either here.

## 7. Rollout and rollback

There is no runtime migration, persistence change, lock, cache, dynamic discovery, or account mutation. Catalog rows become visible only when the package version containing them is installed and Pi reloads the extension.

Before release, remove a faulty candidate as one work unit: its catalog row, policy fixtures/tests, and README row. Keep the catalog foundation and unchanged 3.8 entry. If the foundation regresses 3.8, restore the provider/context/stream hard-coded 3.8 checks together; never leave the three seams on divergent sources.

After release, withdraw a failing candidate in a corrective release without remapping it, substituting another model, changing quota paths, deleting credentials, or hiding fallback. Keep the redacted evidence as historical admission/withdrawal evidence. Publishing and destructive account actions remain separately authorized human controls.

## Residual risks

- New-model captures observed signatures but did not record successful multi-turn replay, so replay remains disabled for every new row.
- The current response parser is shared only because the recorded key shapes fit it. Exact fixture transcription remains the gate against accidental permissiveness.
- CodeGraph was initialized, but no CodeGraph MCP or command runner was exposed in this phase. Targeted reads were used; implementation should restore CodeGraph impact analysis before edits.

## Next step

Run `sdd-tasks` against this design and the delta spec. Preserve Units A–E as vertical, test-bearing work units, produce the formal Review Workload Forecast, then stop at the `ask-on-risk` delivery decision before any apply work.
