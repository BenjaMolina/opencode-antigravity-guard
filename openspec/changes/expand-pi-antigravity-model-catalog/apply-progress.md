# Apply Progress: Expand Pi Antigravity Model Catalog

## Unit A — 3.8-compatible catalog foundation

**Status:** complete

### Completed implementation tasks

All five Unit A implementation checkboxes are marked `- [x]` in `tasks.md`.

- Added the typed, literal 3.8-only catalog and descriptor/route helpers.
- Routed provider registration, context serialization, and stream membership validation through the catalog.
- Preserved the released public ID, tiered wire ID, native-low hidden `off` request behavior, text-only serialization, same-model signature replay, fixed transport, and SSE lifecycle.
- No Unit B/C/D/E models, response parser changes, or README claims were added.

### Files changed

- `packages/pi/src/catalog.ts`
- `packages/pi/src/catalog.test.ts`
- `packages/pi/src/provider.ts`
- `packages/pi/src/context.ts`
- `packages/pi/src/stream.ts`
- `openspec/changes/expand-pi-antigravity-model-catalog/tasks.md`
- `openspec/changes/expand-pi-antigravity-model-catalog/apply-progress.md`

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Catalog contract and invariants | `packages/pi/src/catalog.test.ts` | Unit | New file; existing seam baseline was 47/47 | `npx vitest run packages/pi/src/catalog.test.ts` exit 1: missing `./catalog.ts`; later exit 1: catalog entry/routes were not frozen | Same command exit 0: 3/3 after catalog creation and deep freeze | Invalid `minimal`, `xhigh`, `max`, unknown; duplicate public IDs; empty routes; repeated wire IDs; descriptor mutation | Catalog helpers retain literal route data, deep-frozen internal policy, and fresh descriptor projection; focused suite 50/50 |
| Provider/context/stream catalog seam extraction | Existing `provider.test.ts`, `context.test.ts`, `stream.test.ts` | Unit/integration seam | `npx vitest run packages/pi/src/provider.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` exit 0: 47/47 | Existing passing 3.8 characterizations are baseline approval evidence, not fabricated RED | Focused four-file suite exit 0: 50/50 | Existing tests cover visible/off reasoning, signature replay, text-only pre-fetch failure, headers, cancellation, usage, and ordered events | A leaked internal route discriminant caused 5 context assertions to fail; serialization was narrowed to the released wire shape, then focused suite passed 50/50 |

### Verification

| Command | Exit | Result |
|---|---:|---|
| `npx vitest run packages/pi/src/provider.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` | 0 | 47 passed baseline tests |
| `npx vitest run packages/pi/src/catalog.test.ts` | 1 | Expected RED: catalog module did not exist |
| `npx vitest run packages/pi/src/catalog.test.ts` | 0 | 3 catalog tests passed after GREEN |
| `npx vitest run packages/pi/src/catalog.test.ts` | 1 | Expected RED: catalog entry/routes were not frozen |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/provider.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` | 1 | 5 context assertions caught leaked internal route discriminant |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/provider.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` | 0 | 50 tests passed after serialization correction and refactor |
| `npm run typecheck:pi` | 0 | Pi package typecheck passed |
| `npm run build:pi` | 0 | Pi package build passed |
| `git diff --check` | 0 | No whitespace errors |

### Deviations and risks

- No design deviation. The route discriminant remains catalog-internal and is not emitted in the released Gemini generation envelope.
- No live, OAuth, network, install, commit, staging, push, PR, publish, tag, or release action occurred.
- Internal route data is deep-frozen and TypeScript-readonly; descriptors projected to Pi are fresh mutable copies so host mutation cannot change subsequent registration data.

### Workload and PR boundary

- Delivery path: chained PRs, `stacked-to-main`.
- Current boundary: Unit A only — catalog foundation and 3.8 compatibility preservation.
- Follow-up boundaries: Unit B/C/D are independent after Unit A; Unit E depends on B/C/D.
- Source/test diff is 206 changed lines (169 additions, 37 deletions), within the 400-line budget; OpenSpec planning artifacts are excluded from this workload count.

### Structured status consumed

The parent supplied the selected change, authoritative worktree, allowed edit roots, strict-TDD mode, and resolved delivery path. The earlier native status from the primary worktree had ambiguous selection and was superseded for this scoped Unit A execution by the parent instruction naming `expand-pi-antigravity-model-catalog` and worktree `C:/Github/Ordico/opencode-antigravity-guard-release`.

### Remaining tasks

All Unit A implementation rows are complete. Unit B, Unit C, Unit D, and Unit E rows remain unchecked and out of scope for this apply slice.

### Attempt evidence

- Authority token consumed by parent only: `sha256:dbf39a4ffb8829aea1e241225f966108e5b77eaf0b1cecf2abc10290bda99001`
- Attempt action: Unit A apply in `feat/pi-catalog-foundation`.
- Base revision for parent settlement: `31f104a2ae9102b097395d13e82e046ef825dc86`; no commit was created.

## Unit B — Evidence-admitted Gemini routes

**Status:** complete

### Completed implementation tasks

All six Unit B implementation checkboxes are marked `- [x]` in `tasks.md`.

- Reconciled only the stored four-source evidence record and encoded literal 3.7, 3.6, and 3.1 Pro route data; Gemini 3.5 remains unregistered.
- Added route-aware integer-budget/omission serialization and local explicit output-budget validation, including the 3.1 high safe default of 11,025.
- Preserved 3.8 native-level behavior, while new Gemini rows strip historical thought markers and signatures.
- Added catalog, provider, context, stream, and strict terminal-fixture coverage for route matrices, text-only rejection, transport invariance, and 3.5 nonterminal rejection.

### Files changed

- `packages/pi/src/catalog.ts`
- `packages/pi/src/catalog.test.ts`
- `packages/pi/src/context.ts`
- `packages/pi/src/context.test.ts`
- `packages/pi/src/provider.test.ts`
- `packages/pi/src/stream.test.ts`
- `packages/pi/src/response.test.ts`
- `openspec/changes/expand-pi-antigravity-model-catalog/tasks.md`
- `openspec/changes/expand-pi-antigravity-model-catalog/apply-progress.md`

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Literal Gemini catalog and serializer | `catalog.test.ts`, `context.test.ts` | Unit | 58 focused tests passed | Focused command exit 1: missing three registered IDs and context rejected their IDs | Focused command exit 0: 29 tests passed after literal rows and discriminated serialization | Added 3.6 omission, 3.7 zero/dynamic budgets, 3.1 high default/explicit boundary, descriptor map/limit, and all-new-row text-only cases | Kept existing defensive serializers; route data remains literal and table-driven only where it improves coverage |
| Registration and fixed transport | `provider.test.ts`, `stream.test.ts` | Unit/integration seam | 58 focused tests passed | `provider.test.ts` exit 1 after the expected registration count was raised to four | Focused provider/catalog/context command exit 0: 34 tests passed | Omission-policy 3.6 fixed-endpoint payload verifies no `thinkingConfig` is serialized | No production refactor beyond route-discriminated configuration |
| Blocked Gemini 3.5 fixture | `response.test.ts` | Unit | Existing strict response suite passed | Existing incomplete-terminal behavior was baseline evidence; no fabricated RED | New redacted HTTP-200-shaped no-terminal fixture passes by rejecting `finish()` | Catalog lookup remains absent alongside terminal rejection | No `response.ts` change; fixture matched the designed strict parser |

### Verification

| Command | Exit | Result |
|---|---:|---|
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` | 1 | Expected RED: catalog only contained 3.8 and new IDs were rejected |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` | 0 | 29 tests passed after GREEN |
| `npx vitest run packages/pi/src/provider.test.ts` | 1 | Expected RED: registration assertion required four models |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/provider.test.ts` | 0 | 34 tests passed after registration projection assertion update |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/provider.test.ts packages/pi/src/stream.test.ts packages/pi/src/response.test.ts` | 0 | 65 tests passed |
| `npm run typecheck:pi` | 0 | Pi typecheck passed |
| `npm run build:pi` | 0 | Pi package build passed |
| `git diff --check` | 0 | No whitespace errors |

### Deviations and risks

- No design deviation and no `response.ts` change: the strict Gemini 3.5 fixture is rejected by the existing terminal-semantics parser.
- Stored redacted evidence only was consumed; no live, OAuth, account, network, install, commit, staging, push, PR, publish, or release action occurred.
- Generated ignored output from the Pi build is permitted and was not included in authored scope.

### Workload and PR boundary

- Delivery path: chained PRs, `stacked-to-main`.
- Current boundary: Unit B only — Gemini 3.7/3.6/3.1 catalog admission, route serialization, and strict fixtures; no Claude, GPT-OSS, or documentation work.
- Source/test delta: 198 changed lines (179 additions, 19 deletions) excluding OpenSpec artifacts; within the 400-line budget.
- Rollback: remove only Unit B rows and Unit B tests, retaining Unit A and released 3.8 behavior.

### Structured status consumed

The parent supplied authoritative ready status for `expand-pi-antigravity-model-catalog`, explicit workspace `C:/Github/Ordico/opencode-antigravity-guard-release`, strict TDD, Unit B scope, allowed edit roots, and the resolved `stacked-to-main` delivery path. Native attempt token `sha256:43556a6072ff0e462d1f25303d9a2ab2cf24f9d9e3c4aedbdbfe498fdd46a5bc` remains parent-owned and was neither acquired, reset, nor settled.

### Remaining tasks

Unit C, Unit D, and Unit E implementation rows remain unchecked and out of scope. Unit B has no unchecked implementation rows.
