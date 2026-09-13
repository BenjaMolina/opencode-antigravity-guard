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

## Unit C — Evidence-admitted Claude policies

**Status:** complete

### Completed implementation tasks

All six Unit C implementation checkboxes are marked `- [x]` in `tasks.md`.

- Reconfirmed stored four-source per-level evidence for Sonnet and Opus: literal Claude wire IDs, 250,000/64,000 descriptor limits, integer budget `0` hidden for `off`, integer budget `1024` visible for `high`, strict terminal metadata/usage fixtures, and strip-only replay.
- Added only the two literal Claude rows. They expose `off` and `high`; `minimal`, `low`, and `medium` fail before transport.
- Covered equal/lower high-budget output rejection, a valid explicit reserve, omitted-output defaults, no caller mutation, text-only rejection, cross-model signature stripping, strict interleaved response semantics, and the fixed OAuth SSE endpoint.
- The existing discriminated serializer already applies the required output-budget safety and omits no configuration by post-construction deletion; no `context.ts`, `response.ts`, provider, Gemini, GPT-OSS, or README production changes were needed.

### Files changed

- `packages/pi/src/catalog.ts`
- `packages/pi/src/catalog.test.ts`
- `packages/pi/src/context.test.ts`
- `packages/pi/src/response.test.ts`
- `packages/pi/src/stream.test.ts`
- `openspec/changes/expand-pi-antigravity-model-catalog/tasks.md`
- `openspec/changes/expand-pi-antigravity-model-catalog/apply-progress.md`

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Claude literal catalog/routes and output safety | `catalog.test.ts`, `context.test.ts` | Unit | Focused four-file suite: 60/60 | Focused catalog/context run exit 1: both Claude IDs unregistered | Literal rows added; focused catalog/context run reached 34/34 after updating the prior ordered-list expectation | Both models, all rejected levels, `1000`/`1024` rejection, `1025` acceptance, omitted off/high defaults, signature stripping, no caller mutation, and tools rejection | Existing discriminated integer-budget serializer met the design; no production refactor was needed |
| Claude strict response and fixed-endpoint streaming | `response.test.ts`, `stream.test.ts` | Unit/integration seam | Focused four-file suite: 60/60 | Existing strict parser and lifecycle were baseline characterization, not fabricated RED; new catalog admission RED above blocked the Claude transport path | Redacted Sonnet/Opus interleaved `thought`/text/signature plus `STOP`, model-version, and usage fixtures passed without parser changes | Fixed-endpoint Sonnet SSE fixture asserted exact wire ID and ordered thought/text/finish/usage semantics; both response model fixtures passed | No `response.ts` change: the strict fixture matched the specified envelope |

### Verification

| Command | Exit | Result |
|---|---:|---|
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts` | 0 | 60 baseline focused tests passed before edits |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` | 1 | Expected RED: both Claude IDs were absent and context rejected them (2 failed, 32 passed) |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` | 1 | Expected intermediate failure: prior catalog ordering assertion needed its newly admitted Claude IDs (1 failed, 33 passed) |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` | 0 | GREEN: 34 tests passed |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts` | 0 | TRIANGULATE: 66 tests passed |
| `npm run typecheck:pi` | 0 | Pi package typecheck passed |
| `git diff --check` | 0 | No whitespace errors |

### Deviations and risks

- No design deviation and no `response.ts` edit: redacted strict Claude fixtures fit the existing parser exactly.
- No live, OAuth, network, installation, staging, commit, push, PR, publish, or release action occurred.
- CodeGraph returned the primary checkout's stale stream source despite the explicit worktree; after confirming the worktree-specific `.codegraph/` presence, targeted file reads were used for the explicit workspace only.

### Workload and PR boundary

- Delivery path: chained PRs, `stacked-to-main`.
- Current boundary: Unit C only — Claude Sonnet/Opus catalog admission, request policy coverage, and strict shared-envelope fixtures; no GPT-OSS, Gemini 3.5 admission, or README work.
- Source/test delta: 140 changed lines (140 additions, 0 deletions), excluding OpenSpec artifacts; within the 400-line budget.
- Rollback: remove only the two Claude rows and Unit C tests, retaining Units A/B Gemini behavior.

### Structured status consumed

```yaml
schemaName: spec-driven
changeName: expand-pi-antigravity-model-catalog
artifactStore: openspec
planningHome:
  root: C:/Github/Ordico/opencode-antigravity-guard-release
  changesDir: C:/Github/Ordico/opencode-antigravity-guard-release/openspec/changes
changeRoot: C:/Github/Ordico/opencode-antigravity-guard-release/openspec/changes/expand-pi-antigravity-model-catalog
artifacts: { proposal: done, specs: done, design: done, tasks: done, applyProgress: done }
taskProgress: { total: 27, complete: 17, remaining: 10 }
applyState: ready
actionContext:
  mode: repo-local
  workspaceRoot: C:/Github/Ordico/opencode-antigravity-guard-release
  allowedEditRoots: [C:/Github/Ordico/opencode-antigravity-guard-release/packages/pi, C:/Github/Ordico/opencode-antigravity-guard-release/openspec/changes/expand-pi-antigravity-model-catalog]
  warnings: ["Parent-owned native attempt token was consumed but not acquired, reset, or settled by this executor."]
nextRecommended: sdd-verify
```

### Remaining tasks

Unit D (six unchecked implementation rows) and Unit E (four unchecked implementation rows) remain out of scope. Unit C has no unchecked implementation rows.

## Unit C corrective retry - provider registration expectation

**Status:** complete

- Corrected `provider.test.ts` from four to the six Unit C-admitted descriptors in catalog order: 3.8, 3.7, 3.6, 3.1 Pro, Sonnet, Opus.
- No production code or task checkbox changed; all six Unit C rows remain visibly `- [x]`.

### TDD Cycle Evidence

| Task | RED | GREEN | TRIANGULATE/REFACTOR |
|---|---|---|---|
| Stale provider registration expectation | Parent observed expected 4, received 6 | `provider.test.ts`: 5/5 | Exact ordered Sonnet/Opus IDs asserted; no refactor needed |

### Verification

- `npx vitest run packages/pi/src/provider.test.ts`: exit 0 (5 passed).
- `npx vitest run packages/pi/src`: exit 0 (11 files, 138 passed).
- `npm run typecheck:pi`: exit 0.
- `git diff --check`: exit 0.

### Boundary and remaining work

- Corrective scope: 4 changed test lines; allowed roots respected; no live/network/install/commit/stage/push/PR/subagent action occurred.
- Parent token `sha256:241586c8407153059158bfdb5ec52e3c4e8671cf647361c116e2f28a6d38f1ba` was not acquired, reset, or settled.
- Unit D and Unit E's ten implementation rows remain unchecked and out of scope.


## Unit D — GPT-OSS admission and blocked-3.5 regression

**Status:** complete

### Completed implementation tasks

All six Unit D implementation checkboxes are marked `- [x]` in `tasks.md`.

- Reconfirmed the stored, redacted four-source evidence record: GPT-OSS uses literal `gpt-oss-120b-medium` for off and medium, limits of 131,072/32,768, off omission, medium budget 8192, strict thought/text/usage compatibility, and strip-only replay.
- Added the literal `antigravity-gpt-oss-120b` catalog row only. It exposes off and medium, rejects unsupported levels, omits `thinkingConfig` for off, and sends the visible integer budget 8192 for medium.
- Covered safe default output (9216 for medium), explicit equal-budget rejection, valid 8193 output, signature stripping, strict GPT-OSS response/usage/finish semantics, fixed OAuth SSE routing, provider registration, and preserved Gemini 3.5 absence/nonterminal rejection.

### Files changed

- `packages/pi/src/catalog.ts`
- `packages/pi/src/catalog.test.ts`
- `packages/pi/src/context.test.ts`
- `packages/pi/src/provider.test.ts`
- `packages/pi/src/response.test.ts`
- `packages/pi/src/stream.test.ts`
- `openspec/changes/expand-pi-antigravity-model-catalog/tasks.md`
- `openspec/changes/expand-pi-antigravity-model-catalog/apply-progress.md`

### TDD Cycle Evidence

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| GPT-OSS catalog and context policy | `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` exit 1: GPT entry was absent and context rejected its public ID | Literal catalog row added; focused command first exposed the stale six-ID ordering expectation, then exit 0 with 37 tests after registration-order assertion was extended | Off omission, medium 8192, default 9216, explicit 8192 rejection, 8193 acceptance, unsupported levels, and strip replay are asserted | Reused the existing discriminated integer-budget serializer; no production serializer refactor was needed |
| Strict response and stream fixture coverage | Existing shared parser/lifecycle was characterization evidence; admission RED above prevented GPT transport | Redacted GPT thought/text/usage `STOP` fixtures passed in `response.test.ts` and `stream.test.ts` without parser change | Fixed endpoint, literal wire ID, ordered thought/text/finish/usage semantics, 3.5 absent catalog lookup, and the existing 3.5 nonterminal HTTP-200 rejection remain covered | No `response.ts` change: the strict fixture matched the designed envelope |

### Verification

| Command | Exit | Result |
|---|---:|---|
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` | 1 | Expected RED: missing GPT-OSS catalog identity and context routing |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` | 1 | Expected intermediate stale ordered-registration assertion after the literal row was added |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts` | 0 | GREEN: 37 tests passed |
| `npx vitest run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/provider.test.ts packages/pi/src/response.test.ts packages/pi/src/stream.test.ts` | 0 | 75 focused tests passed |
| `npm run typecheck:pi` | 0 | Pi typecheck passed |
| `npm run build:pi` | 0 | Pi build passed |
| `npm test` | 0 | 56 files passed; 1,273 tests passed and 25 todo |
| `git diff --check` | 0 | No whitespace errors |

### Deviations and risks

- No design deviation and no `response.ts` edit: the strict GPT-OSS fixture fit the existing parser.
- No live, OAuth, network, install, staging, commit, push, PR, publish, or release action occurred.

### Workload and PR boundary

- Delivery path: stacked-to-main.
- Current boundary: Unit D only — GPT-OSS admission, exact routes, strict fixtures, and Gemini 3.5 regression preservation; no README work.
- Source/test delta: 101 changed lines (98 additions, 3 deletions), excluding OpenSpec artifacts; within the 400-line budget.
- Rollback: remove only the GPT-OSS row and Unit D tests, retaining Units A–C and the blocked-3.5 regression.

### Structured status consumed

The parent supplied authoritative apply-ready status for `expand-pi-antigravity-model-catalog`, explicit workspace `C:/Github/Ordico/opencode-antigravity-guard-release`, `feat/pi-catalog-gpt` based on `00f3ccb`, allowed roots `packages/pi` and the change artifacts, strict TDD, and the resolved stacked delivery slice. Parent-owned native token `sha256:483fc021ee45456361d272a046f5cf18c6beb71c05ec190bf558b18134fd24d5` was neither acquired, reset, nor settled.

### Remaining tasks

Unit E's four implementation rows remain unchecked and out of scope. Unit D has no unchecked implementation rows.
