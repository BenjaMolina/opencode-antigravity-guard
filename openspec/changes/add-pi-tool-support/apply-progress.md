# Apply Progress: add-pi-tool-support

## Status

Work unit A implementation and verification are complete. The rerun focused suite and Pi typecheck pass. The full suite has exactly the two independently established inherited release-manifest failures and no additional failures, so Unit A's verification checkbox is complete.

## Structured status consumed

- Change: `add-pi-tool-support`
- Apply state: `ready` (provided by the parent)
- Action context: `repo-local`; allowed edit root: `C:/Github/Ordico/opencode-antigravity-guard-pi-tools`
- Delivery: `auto-chain` / `feature-branch-chain`; current work unit: A
- Strict TDD: active; test runner: `npm test`
- Produced readiness for handoff: Unit A is complete and its next recommendation is `sdd-verify`; the overall change remains incomplete because Units B–H are unchecked. Action context warning: the injected native status named a different worktree and had no active change, so this run used the user's explicit `add-pi-tool-support` change, explicit branch, and explicit allowed root. No unsafe edit root was used.

## Safety-net and verification evidence

| Command | Result | Evidence |
|---|---|---|
| Prior attempt: `npm test -- --run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` | Blocked | `tsc` was unavailable before Vitest; zero implementation lines were authored. |
| Rerun safety net: `npm test -- --run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` | Passed | 3 files, 61 tests before edits; `tsc` now ran from restored workspace dependencies. |
| Focused RED | Failed as expected | 2 new tests failed: missing `resolveGenerationSelection()` and transport returned generic `transport` instead of capability rejection. |
| Focused GREEN/TRIANGULATE/REFACTOR: `npm test -- --run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` | Passed | 3 files, 63 tests. |
| `npm run typecheck:pi` | Passed | Pi workspace `tsc -p tsconfig.json --noEmit` completed. |
| Prior `npm test` | Blocked by unrelated failures | 55 test files passed; 1 failed with 2 failures in `scripts/release-manifest-check.test.ts` because expected release workflow sections were absent. Unit A catalog/context/stream tests passed. |
| Verification rerun: `npm test -- --run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/stream.test.ts` | Passed | 3 files, 63 tests passed: catalog 9, context 32, stream 22. |
| Verification rerun: `npm run typecheck:pi` | Passed | `tsc -p tsconfig.json --noEmit` completed for `@benjamolina/pi-antigravity-guard`. |
| Verification rerun: `npm test` | Accepted with inherited base failures only | 55/56 files passed; 1,277 tests passed, 25 todo, and exactly 2 failures in `scripts/release-manifest-check.test.ts`: lines 76 (`publishScript`, publish-step regex capture) and 103 (`expectRepositoryLocalTagIdentity`, tag-script regex capture), both `expected undefined to be defined`. No other failures occurred. |
| Base causality check | Confirmed | `git diff --quiet df3c629 -- scripts/release-manifest-check.test.ts .github/workflows/release.yml` exited 0: both out-of-scope files are byte-identical to published base `df3c629`. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| A | `packages/pi/src/catalog.test.ts`, `packages/pi/src/stream.test.ts` | Unit/integration | 61/61 passed | 2 focused failures recorded | 63/63 focused passed | declaration, historical call, and historical result contexts plus per-route/family capability checks | Capability resolution centralized and literal catalog data deeply frozen; focused tests still pass |

## Completed tasks and persisted checkbox updates

- [x] RED
- [x] GREEN
- [x] TRIANGULATE
- [x] REFACTOR
- [x] Verify this unit with `npm test -- --run packages/pi/src/catalog.test.ts`, the affected context/stream tests, `npm run typecheck:pi`, and `npm test`; record the candidate commit only if the complete unit remains within budget. Persisted checkbox updated in `tasks.md`.

## Files changed

- `packages/pi/src/catalog.ts`
- `packages/pi/src/catalog.test.ts`
- `packages/pi/src/context.ts`
- `packages/pi/src/stream.ts`
- `packages/pi/src/stream.test.ts`
- `openspec/changes/add-pi-tool-support/tasks.md`
- `openspec/changes/add-pi-tool-support/apply-progress.md`

## Implementation notes

- Every concrete catalog route now carries frozen, disabled capability data; Claude routes retain `claude-continuity-unproven`.
- `resolveGenerationSelection()` provides one route/capability selection while `resolveGenerationRoute()` remains compatible.
- Tool-bearing declarations, assistant calls, and results reject with safe `PI_TOOL_CAPABILITY_NOT_ENABLED` metadata before `fetch`; no-tool serialization retains its existing path.
- Stale or route-mismatched evidence resolves fail-closed to disabled. No capability was enabled and no live calls were made.

## Remaining tasks

- Unit A has no remaining implementation-owned tasks. Units B–H remain intentionally unchecked and out of scope for this work unit.

## Workload / PR boundary

Feature-branch-chain child A only. Authored implementation/test diff is **167 changed lines** (138 additions, 29 deletions), under the 400-line budget; no commit was created. Artifact updates are excluded from this code-review count. This verification bookkeeping is the child A PR boundary; B–H were not changed.

## Deviation / risk

No design deviation and no Unit A behavior changed during verification. The initial environmental blocker was remediated by the restored `tsc` dependency and is separately evidenced above. The two full-suite release-manifest failures are known inherited base failures, not Unit A blockers: their only failing assertions are the publish-step and tag-script regex captures at lines 76 and 103, and both implicated out-of-scope files are byte-identical to published base `df3c629`. No commits, branch operations, live calls, publishing, or B–H work occurred.

---

## Unit B completion

### Structured status consumed

- Change: `add-pi-tool-support`; explicit parent selection; status `ready`.
- Action context: `repo-local`; sole allowed edit root: `C:/Github/Ordico/opencode-antigravity-guard-pi-tools`; no warnings.
- Delivery: `auto-chain` / `feature-branch-chain`; child slice B on `feat/pi-tool-support-b-schema`, based on Unit A `ea1af21`.
- Strict TDD: active; test runner: `npm test`. No live calls, commits, branch switching, push, publish, or work outside Unit B occurred.

### Completed tasks and persisted checkbox updates

The five Unit B implementation-owned rows are visibly marked `[x]` in `tasks.md`: RED, GREEN, TRIANGULATE, REFACTOR, and Verify. No Unit C–H checkbox was changed.

### Files changed

- `packages/pi/src/tool-contract.ts`
- `packages/pi/src/tool-schema.ts`
- `packages/pi/src/tool-schema.test.ts`
- `packages/pi/fixtures/tools/schema-rejections.json`
- `openspec/changes/add-pi-tool-support/tasks.md`
- `openspec/changes/add-pi-tool-support/apply-progress.md`

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| B | `packages/pi/src/tool-schema.test.ts` | Unit | N/A (new modules) | Failed as expected: missing `./tool-schema.ts` | 1/1 focused passed after minimum normalizer | 10/10 focused passed: fixture rejections, malformed values, constraints, limits, and declaration choice | Recursive normalization and resource accounting remain consolidated; focused test and Pi typecheck pass |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/tool-schema.test.ts` (RED) | Failed as expected | Module `./tool-schema.ts` did not exist. |
| `npm test -- --run packages/pi/src/tool-schema.test.ts` (GREEN) | Passed | 1/1 test passed. |
| `npm test -- --run packages/pi/src/tool-schema.test.ts` (TRIANGULATE/REFACTOR) | Passed | 10/10 tests passed. |
| `npm run typecheck:pi` | Passed | Pi workspace TypeScript check completed. |
| `npm test` | Accepted with known inherited baseline only | 56/57 files passed, 1,287 tests passed, 25 todo, and exactly the two known failures in `scripts/release-manifest-check.test.ts` lines 76 and 103; no additional failures. |

### Implementation notes and deviation

- Added a dependency-neutral typed JSON contract with safe own-data/plain-object checks, canonical key ordering, deep freezing, and stable declaration/path errors.
- Added immutable allowlist normalization for the admitted object, array, and primitive schema grammar, including `const` to singleton `enum`, declaration ordering/validation, duplicate rejection, constrained-sampling rejection, and schema depth/node/size limits.
- Added only synthetic rejection fixtures. No root `src/plugin` import, text serializer change, capability activation, or design deviation occurred.

### Remaining tasks

Unit B has no unchecked implementation-owned rows. Units C–H remain intentionally unchecked and out of scope; their exact unchecked `- [ ]` rows remain unchanged in `tasks.md` under those units.

### Workload / PR boundary

Feature-branch-chain child B only. Exact authored code/test/fixture change count is **298 additions, 0 deletions, 298 total**: code **169** (`tool-contract.ts` 62 + `tool-schema.ts` 107), tests **111**, fixtures **18**. This is under the 400-line budget. OpenSpec bookkeeping is excluded. No commit was created.

### Risk

The full-suite release-manifest failures are inherited under the provided baseline and do not block Unit B: they remain only the expected undefined regex captures at lines 76 and 103. Unit B does not enable any route; C–H are required before tool-bearing request/response capability can be exercised.

---

## Unit B verifier correction: aggregate normalized schema size

### Scope and structured status

- Correction scope: `packages/pi/src/tool-schema.ts` and `packages/pi/src/tool-schema.test.ts`, plus this OpenSpec evidence and the existing Unit B Verify checkbox annotation.
- Explicit selection: `add-pi-tool-support` on `feat/pi-tool-support-b-schema` in `C:/Github/Ordico/opencode-antigravity-guard-pi-tools`.
- Action context: `repo-local`; all edits stayed within the user-authorized surfaces and root. The injected native status named no change and a different worktree; the explicit user selection resolved that ambiguity.
- Delivery: existing `feature-branch-chain`, child B. This correction remains part of B; no Unit C–H file, release file, commit, branch operation, publish, or live call occurred.

### Correction

`normalizeToolDeclarations()` now totals UTF-8 byte lengths of each normalized declaration `parameters` object and raises `PI_TOOL_SCHEMA_LIMIT` once the aggregate exceeds `1 MiB`. The existing `256 KiB` per-declaration check is unchanged. The total intentionally counts normalized schemas only, not declaration metadata.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| B aggregate schema-size correction | `packages/pi/src/tool-schema.test.ts` | Unit | 10/10 focused passed | 11-test run failed exactly because five individually valid 220 KiB normalized schemas did not throw | Added 1 MiB aggregate accounting; 11/11 focused passed | Added the declaration-metadata case; 12/12 focused passed | Named the aggregate bound and retained the existing per-declaration accounting; 12/12 focused passed |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/tool-schema.test.ts` (safety net) | Passed | 10/10 existing focused tests passed before correction. |
| `npm test -- --run packages/pi/src/tool-schema.test.ts` (RED) | Failed as expected | 10 passed, 1 failed: five individually valid 220 KiB normalized schemas did not throw `PI_TOOL_SCHEMA_LIMIT`. |
| `npm test -- --run packages/pi/src/tool-schema.test.ts` (GREEN) | Passed | 11/11 tests passed after aggregate accounting. |
| `npm test -- --run packages/pi/src/tool-schema.test.ts` (TRIANGULATE/REFACTOR) | Passed | 12/12 tests passed, including oversized aggregate rejection and large declaration metadata acceptance. |
| `npm run typecheck:pi` | Passed | Pi workspace `tsc -p tsconfig.json --noEmit` completed. |
| `npm test` | Accepted with known inherited baseline only | 56/57 files passed, 1,289 tests passed, 25 todo, and exactly the two known failures in `scripts/release-manifest-check.test.ts` at lines 76 and 103; no other failure occurred. |

### Persisted task status and workload

All five Unit B implementation-owned rows remain visibly `[x]` in `tasks.md`; the Verify row now records that the aggregate correction was verified. Unit C–H rows remain unchanged and unchecked.

The correction is **29 additions, 0 deletions, 29 changed lines**: implementation **7** and tests **22**. Current complete Unit B authored code/test/fixture count is **327 additions, 0 deletions, 327 total** (`tool-contract.ts` 62, `tool-schema.ts` 114, `tool-schema.test.ts` 133, fixture 18), excluding OpenSpec evidence. It remains below the 400-line Unit B budget.

### Deviation and risk

No design deviation occurred: the correction implements the design-required 1 MiB aggregate normalized schema bound that the previous Unit B implementation omitted. The only full-suite failures are the user-confirmed inherited release-manifest failures; release files were not changed.

---

## Unit C blocked: no authorized enabled-route test seam

### Structured status consumed

- Change: `add-pi-tool-support`; explicit parent selection; apply `ready`; 10/40 complete and 30 remaining.
- Action context: `repo-local`; sole allowed edit root: `C:/Github/Ordico/opencode-antigravity-guard-pi-tools`; no warnings.
- Delivery: `auto-chain` / `feature-branch-chain`; Unit C on `feat/pi-tool-support-c-request`, based on `b6ef74e`.
- Strict TDD: active; test runner: `npm test`. No production, test, fixture, catalog, task-checkbox, commit, branch, push, publication, or live-call change was made.

### Blocker

Unit C requires tests that serialize declarations through an **enabled** exact route. The inherited catalog capability foundation intentionally leaves every route disabled, and the Unit C allowlist excludes `packages/pi/src/catalog.ts` and `catalog.test.ts`. Enabling even a narrow test-only route capability would require the catalog test seam that the parent explicitly instructed this unit to stop and report. Implementing a dispatcher without this enabled-route proof would violate Unit C's RED/GREEN requirements and the fail-closed admission design.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| C | `packages/pi/src/context.test.ts`, planned `packages/pi/src/tool-context.test.ts` | Unit | 32/32 passed | Not started: enabled-route seam is unauthorized | Not started | Not started | Not started |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/context.test.ts` | Passed | 1 file, 32 tests passed before edits. |

### Persisted task status and workload

No Unit C task was completed or checked. The exact Unit C implementation-owned rows remain unchecked in `tasks.md`: RED, GREEN, TRIANGULATE, REFACTOR, and Verify. Authored Unit C code/test/fixture lines: **0 additions, 0 deletions, 0 total**. OpenSpec progress bookkeeping only is outside the code-review budget.

### Required resolution

Authorize a narrow catalog test seam (for example, an injected/test-only exact route capability) within the Unit C allowed surfaces, or provide an already-enabled exact test route. No capability should be enabled for production behavior.

---

## Unit C completion

### Structured status consumed

- Change: `add-pi-tool-support`; explicit parent selection; apply `ready`; 10/40 complete before this unit.
- Action context: `repo-local`; sole allowed edit root: `C:/Github/Ordico/opencode-antigravity-guard-pi-tools`; no unsafe-root warning.
- Delivery: `auto-chain` / `feature-branch-chain`; child slice C on `feat/pi-tool-support-c-request`; strict TDD active with `npm test`.
- Parent-authorized correction added only a deterministic catalog capability construction/injection seam for hermetic tests. Production catalog literals remain disabled, and no route, environment flag, mutable global, live call, commit, push, or publication was used.

### Completed tasks and persisted checkbox updates

The five Unit C implementation-owned rows (RED, GREEN, TRIANGULATE, REFACTOR, Verify) are visibly marked `[x]` in `tasks.md`. No Unit D–H checkbox changed.

### Files changed

- `packages/pi/src/catalog.ts`
- `packages/pi/src/catalog.test.ts`
- `packages/pi/src/context.ts`
- `packages/pi/src/context.test.ts`
- `packages/pi/src/tool-context.ts`
- `packages/pi/src/tool-context.test.ts`
- `packages/pi/fixtures/tools/declarations.json`
- `openspec/changes/add-pi-tool-support/tasks.md`
- `openspec/changes/add-pi-tool-support/apply-progress.md`

### TDD Cycle Evidence

| Task | Test file | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| C | `context.test.ts`, `tool-context.test.ts`, `catalog.test.ts` | Focused run failed as expected: missing `tool-context.ts` and `createEnabledToolCapability()` | 38/38 `context` and `tool-context` tests passed after the dispatcher and request-local preparation landed | 48/48 focused catalog/context/tool-context tests passed, covering immutable enabled test data, declaration order, AUTO/NONE, forced/named rejection, and auto-without-declarations | Pi typecheck passed and the focused suite remained 48/48; production catalog routes still resolve disabled |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts` (RED) | Failed as expected | 32 existing tests passed; the new context test failed because `createEnabledToolCapability` was absent and the new module could not be loaded. |
| Same focused command (GREEN) | Passed | 38/38 tests passed. |
| `npm test -- --run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts` | Passed | 3 files, 48/48 tests passed. |
| `npm run typecheck:pi` | Passed | `tsc -p tsconfig.json --noEmit` completed for the Pi workspace. |
| `npm test` | Accepted with known inherited baseline only | 57/58 files passed, 1,296 tests passed, 25 todo, and exactly two release-manifest failures: `scripts/release-manifest-check.test.ts` lines 76 and 103, both `expected undefined to be defined`. |

### Implementation notes and deviation

- `serializeContext()` preserves `serializeTextContext()` as the no-tool fast path, reconstructing the request only for prepared declarations and placing `tools` then `toolConfig` before `generationConfig`.
- `prepareToolContext()` is request-local, retains normalized declaration order, maps omitted/`auto` to `AUTO` and `none` to `NONE`, and rejects forced/named choices and `auto` without declarations.
- `createEnabledToolCapability()` constructs frozen matching evidence only for hermetic injection; all literal catalog routes remain disabled. This is the authorized correction, not a production capability activation.
- The existing Unit A gate continues to prove disabled/fixture-qualified contexts fail before transport; C did not alter transport or make a route enabled.

### Remaining tasks and workload boundary

Unit C has no unchecked implementation-owned rows. Units D–H remain intentionally unchecked and out of scope. This feature-branch-chain child C change is **123 additions, 4 deletions, 127 total changed code/test/fixture lines** (excluding OpenSpec bookkeeping), below the 400-line budget. No commit was created.

### Risk

The full-suite release-manifest failures match the supplied inherited baseline and are out of scope. The request dispatcher is not yet wired into transport and replay/lifecycle support remains Units D–G; production tool-bearing requests therefore remain fail-closed.

---

## Unit C correction: history-only tool dispatch

### Structured status consumed

- Change: `add-pi-tool-support`; explicit parent selection; apply `ready`; 15/40 complete.
- Action context: `repo-local`; sole allowed edit root: `C:/Github/Ordico/opencode-antigravity-guard-pi-tools`; no warnings.
- Delivery: confirmed `feature-branch-chain`, Unit C correction. The bounded correction is authorized at 100 lines maximum and keeps the cumulative Unit C work under 400 lines.
- Strict TDD is active with `npm test`. No production capability was enabled, no Unit D replay was implemented, and no commit, branch, push, publication, or live call occurred.

### Correction

`serializeContext()` now classifies declarations, assistant `toolCall` blocks, and `toolResult` messages before choosing the no-tool fast path. For every tool-bearing context it resolves and validates the injected exact selection before dispatch. An injected enabled selection with history only now rejects locally with `PI_TOOL_HISTORY_REPLAY_PENDING: replay awaits Unit D.` instead of falling through to the production-disabled selection. Disabled production routes remain fail-closed with their existing capability error.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| C history-only dispatch correction | `packages/pi/src/context.test.ts`, `packages/pi/src/tool-context.ts` | Unit | 48/48 focused catalog/context/tool-context tests passed | New enabled assistant-call history test failed with `PI_TOOL_CAPABILITY_NOT_ENABLED` from the production-disabled selection | The dispatcher classified history before the declaration fast path and the new test passed | Added an enabled `toolResult`-only context test; both history forms receive the stable Unit D preflight | Extracted safe request-local tool-context classification; focused tests and Pi typecheck remain green |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts` (safety net) | Passed | 3 files, 48 tests. |
| `npm test -- --run packages/pi/src/context.test.ts` (RED) | Failed as expected | 33 passed, 1 failed: injected enabled assistant history instead used the production-disabled capability error. |
| `npm test -- --run packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts` (GREEN) | Passed | 39 tests. |
| `npm test -- --run packages/pi/src/catalog.test.ts packages/pi/src/context.test.ts packages/pi/src/tool-context.test.ts` (TRIANGULATE/REFACTOR) | Passed | 3 files, 50 tests. |
| `npm run typecheck:pi` | Passed | Pi workspace TypeScript check completed. |
| `npm test` | Accepted with known inherited baseline only | 57/58 files passed, 1,298 tests passed, 25 todo, and exactly two failures in `scripts/release-manifest-check.test.ts` at lines 76 and 103 (`expected undefined to be defined`). |

### Persisted task status and workload

The existing five Unit C implementation-owned rows remain visibly `[x]` in `tasks.md`; its Verify row now records this history-only dispatch correction. Unit D-H rows remain unchanged and unchecked.

The corrective code/test delta is under the parent-authorized 100-line ceiling, and Unit C remains under its 400-line review budget. The correction changes only `packages/pi/src/context.ts`, `packages/pi/src/context.test.ts`, and `packages/pi/src/tool-context.ts`, plus OpenSpec evidence.

### Deviation and risk

No design deviation occurred. This correction deliberately stops before history replay: it does not serialize, discard, repair, or recover tool-call/result history. Production routes remain disabled; the only full-suite failures are the supplied inherited release-manifest baseline failures.

---

## Unit D blocked: bounded replay implementation was not complete

### Structured status consumed

- Change: `add-pi-tool-support`; explicit parent selection; apply ready; Unit D only on `feat/pi-tool-support-d-replay`, based on Unit C `541115b`.
- Action context: repo-local; the sole authorized edit root was `C:/Github/Ordico/opencode-antigravity-guard-pi-tools`.
- Delivery: `auto-chain` / `feature-branch-chain`; strict TDD active with `npm test`; no commit, branch operation, push, publish, or live call occurred.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| D replay | `packages/pi/src/context.test.ts`, `packages/pi/src/tool-context.test.ts` | Unit | 40/40 focused tests passed | Failed as expected when exact parallel replay encountered Unit C's `PI_TOOL_HISTORY_REPLAY_PENDING` seam | A provisional implementation passed 44 focused tests and Pi typecheck | Added success/error/empty result and fail-closed identity/media tests | Not accepted: it did not yet meet all D scenarios, so all provisional source, test, and fixture edits were reverted |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/tool-context.test.ts packages/pi/src/context.test.ts` (safety net) | Passed | 2 files, 40 tests. |
| Same focused context command (RED) | Failed as expected | New reverse-completion replay expectation received `PI_TOOL_HISTORY_REPLAY_PENDING`. |
| Same focused command (provisional GREEN/TRIANGULATE) | Passed | 2 files, 44 tests. |
| `npm run typecheck:pi` (provisional) | Passed | Pi workspace TypeScript check completed. |
| `npm test` | Accepted inherited baseline only | 57/58 files passed, 1,302 tests passed, 25 todo; exactly the known release-manifest failures at lines 76 and 103. |

### Blocker and persisted task status

The provisional replay did not yet cover all required Unit D invalid-history and reconstructed-context cases within the 400-line child boundary, and it risked overlapping Unit E orphan synthesis. To avoid leaving a partial pairing implementation, all provisional code/test/fixture edits were reverted. **No Unit D checkbox was marked complete**; the five exact Unit D `- [ ]` rows remain unchecked in `tasks.md`.

### Remaining tasks and workload boundary

- [ ] **RED:** Add replay tests for one and same-name parallel calls, reverse result completion ordering, exact `functionCall` and `functionResponse` field order, success/error/multiple/empty text encodings, and preserved text/thinking ordering. <!-- sdd-owner: implementation -->
- [ ] **GREEN:** Implement request-local call-group validation and exact result association by `(toolCallId, toolName)`; emit grouped responses in assistant source-call order and reject no IDs, mismatches, duplicates, foreign/separated results, invalid call terminal state, media, and deferred added-tool names. <!-- sdd-owner: implementation -->
- [ ] **TRIANGULATE:** Add reconstructed-context cases for resume/fork/compaction/model handoff, noncontiguous history, mixed image/text result content, and concurrent serializations to prove there is no global state or FIFO/name fallback. <!-- sdd-owner: implementation -->
- [ ] **REFACTOR:** Isolate pending-group finalization from wire encoding and retain deterministic JSON insertion order without mutating Pi messages. <!-- sdd-owner: implementation -->
- [ ] Verify this unit with focused `tool-context.test.ts` and `context.test.ts`, `npm run typecheck:pi`, and `npm test`; rollback by removing replay serialization as one unit so request emission cannot retain half a pairing implementation. <!-- sdd-owner: implementation -->

No Unit D code/test/fixture diff remains. OpenSpec progress records the blocked attempt only; no size exception is requested.

---

## Unit D completion: deterministic actual-result replay

### Structured status consumed

- Change: `add-pi-tool-support`; parent-explicit Unit D on `feat/pi-tool-support-d-replay`; apply ready.
- Action context: `repo-local`; all edits stayed under `C:/Github/Ordico/opencode-antigravity-guard-pi-tools` and the user-authorized surfaces.
- Delivery: confirmed `feature-branch-chain`, child D; strict TDD with `npm test`; no Unit E–H work, commit, branch operation, push, publication, or live call.

### Completed tasks and persisted checkbox updates

All five Unit D implementation-owned rows are visibly `[x]` in `tasks.md`: RED, GREEN, TRIANGULATE, REFACTOR, and Verify. Unit E–H rows remain unchanged and unchecked.

### Files changed

- `packages/pi/src/tool-context.ts`
- `packages/pi/src/tool-context.test.ts`
- `packages/pi/src/context.ts`
- `packages/pi/src/context.test.ts`
- `openspec/changes/add-pi-tool-support/tasks.md`
- `openspec/changes/add-pi-tool-support/apply-progress.md`

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| D | `tool-context.test.ts`, `context.test.ts` | Unit/integration | 40/40 focused passed | 9 replay assertions failed because `replayToolHistory()` did not exist | 14 tool-context tests passed after request-local grouping | 56 focused tests cover error/empty values, invalid identity/media/deferred names, resume/fork/compaction/model-handoff labels, immutability, and concurrent calls | Pending-group finalization is separate from wire-part encoding; focused tests and Pi typecheck remain green |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/tool-context.test.ts packages/pi/src/context.test.ts` (safety net) | Passed | 2 files, 40 tests before edits. |
| Same focused command (RED) | Failed as expected | 9 failures: `replayToolHistory` was not a function. |
| Same focused command (GREEN/TRIANGULATE/REFACTOR) | Passed | 2 files, 56 tests passed. |
| `npm run typecheck:pi` | Passed | Pi workspace TypeScript check completed after final refactor. |
| `npm test` | Accepted with known inherited baseline only | 57/58 files passed, 1,314 tests passed, 25 todo, and exactly the known release-manifest failures at lines 76 and 103; no additional failures. |

### Implementation notes, remaining work, and workload

- `replayToolHistory()` is request-local and pure: it validates terminal assistant call groups, canonicalizes call arguments, pairs actual contiguous results by exact ID and name, and emits source-call-ordered responses with deterministic field order.
- Incomplete zero/partial groups retain `PI_TOOL_HISTORY_REPLAY_PENDING`; Unit E remains solely responsible for synthetic missing responses. Foreign, separated, duplicate, mismatched, media-bearing, and deferred-tool histories fail locally.
- `serializeContext()` uses this same serializer for reconstructed replay while retaining the no-tool text fast path; no Pi history is mutated.
- Unit D has no remaining unchecked implementation-owned rows. Units E–H remain out of scope and their existing unchecked rows are unchanged.
- Unit D authored code/test delta is **191 additions and 36 deletions (227 changed lines)**, excluding OpenSpec bookkeeping, under the 400-line child budget. No fixture was necessary because compact parameterized cases exercise the required replay invariants.

### Deviation and risk

No design deviation occurred. The inherited full-suite failures remain limited to the supplied release-manifest baseline; Unit D does not alter those files. Production tool capability remains disabled, and no missing tool result is synthesized.


---

## Unit E completion: context-derived orphan-call recovery

### Structured status consumed

- Change: `add-pi-tool-support`; user-authoritative status: apply ready, 20/40 complete, Unit E next, based on D `c496466`.
- Action context: `repo-local`; all edits remained inside `C:/Github/Ordico/opencode-antigravity-guard-pi-tools` and the explicit allowed surfaces.
- Delivery: `auto-chain` / `feature-branch-chain`; child E only. Strict TDD was active with `npm test`. No Unit F�H work, commit, branch operation, push, publish, live call, persistence, cache, lock, retry, route change, or history mutation occurred.

### Completed tasks and persisted checkbox updates

All five Unit E implementation-owned rows are visibly marked `[x]` in `tasks.md`: RED, GREEN, TRIANGULATE, REFACTOR, and Verify. Unit F�H rows remain unchecked and unchanged.

### Files changed

- `packages/pi/src/tool-context.ts`
- `packages/pi/src/tool-context.test.ts`
- `packages/pi/src/context.test.ts`
- `openspec/changes/add-pi-tool-support/tasks.md`
- `openspec/changes/add-pi-tool-support/apply-progress.md`

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| E | `tool-context.test.ts`, `context.test.ts` | Unit/integration | 56 focused tests passed before E production edits | 1 new exact all-orphan/partial-parallel test failed with `PI_TOOL_HISTORY_REPLAY_PENDING` | 57 focused tests passed after fixed synthetic finalization | 59 focused tests passed for supplied-later real result, delayed separated result rejection, repeated/concurrent reconstruction, and invalid non-terminal assistant calls | Extracted the fixed-order local synthetic factory and exposed a request-scoped recovery-count callback; focused tests and Pi typecheck remained green |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/tool-context.test.ts packages/pi/src/context.test.ts` (safety net) | Passed | 56 tests: 20 `tool-context`, 36 `context` before the E test was added. |
| Same focused command (RED) | Failed as expected | 56 passed, 1 failed: all-orphan group raised `PI_TOOL_HISTORY_REPLAY_PENDING`. |
| Same focused command (GREEN) | Passed | 57 focused tests after synthetic group finalization; the stale Unit D expectation was updated to the approved E behavior. |
| `npm test -- --run packages/pi/src/tool-context.test.ts` (recovery-count RED) | Failed as expected | 21 passed, 1 failed because the request-scoped callback was not yet invoked. |
| `npm test -- --run packages/pi/src/tool-context.test.ts packages/pi/src/context.test.ts` (TRIANGULATE/REFACTOR) | Passed | 59 focused tests: 22 `tool-context`, 37 `context`. |
| `npm run typecheck:pi` | Passed | Pi workspace `tsc -p tsconfig.json --noEmit` completed. |
| `npm test` | Accepted with known inherited baseline only | 57/58 files passed, 1,317 tests passed, 25 todo, and exactly the two supplied release-manifest failures in `scripts/release-manifest-check.test.ts` lines 76 and 103 (`expected undefined to be defined`). |

### Implementation notes and deviation

- Pending terminal call groups now emit one adjacent synthetic `functionResponse` per missing exact result, with fixed `error`, `code`, then `message` insertion order and the required `PI_TOOL_RESULT_MISSING` payload.
- Actual and synthetic responses are mixed in original assistant source-call order; a supplied contiguous real result wins because each reconstruction derives only from its supplied context.
- Separated delayed results remain rejected, non-terminal assistant call messages remain invalid, and replay has no cache, persistence, lock, retry, route change, or history mutation.
- `replayToolHistory()` exposes an optional request-scoped recovery-count callback as a safe diagnostics seam. No deviation from the design occurred.

### Remaining tasks and workload / PR boundary

Unit E has no remaining unchecked implementation-owned rows. Units F�H remain intentionally unchecked and out of scope.

Feature-branch-chain child E only: the authored production/test change is **74 additions, 5 deletions, 79 changed lines** (`tool-context.ts`: 24/3; `tool-context.test.ts`: 42/0; `context.test.ts`: 8/2), excluding OpenSpec bookkeeping. This is below the 400-line budget. No commit was created.

### Risk

The two full-suite release-manifest failures are the user-confirmed inherited baseline and did not involve any edited file. Production capability remains disabled; no live calls, publication, or Unit F�H behavior was introduced.

---

## Unit F blocked: allowed-surface terminal handoff conflict

### Structured status consumed

- Change: `add-pi-tool-support`; user-authoritative status: apply ready, 25/40 complete, Unit F next, on `feat/pi-tool-support-f-response` based on `4262d40`.
- Action context: `repo-local`; allowed root: `C:/Github/Ordico/opencode-antigravity-guard-pi-tools`.
- Delivery: `auto-chain` / `feature-branch-chain`; strict TDD active with `npm test`. No Unit G/H, commit, branch operation, push, publication, live call, or out-of-root edit occurred.

### Blocker

The required F contract makes `ResponseSemantics.finish()` return `{ type: "finish", reason: "toolUse" }` only after clean EOF or `[DONE]`. The excluded `packages/pi/src/stream.ts` ignores the return from `finish()` and narrows accepted finish reasons to `"stop" | "length" | "error" | "aborted"`. Pi typecheck consequently fails when the required `"toolUse"` semantic is introduced. A bounded stream handoff is necessary but is assigned to Unit G and outside the explicit F allowed surfaces. The implementation and RED tests were restored before stopping, so no partial F diff remains.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| F terminal semantics spike | `packages/pi/src/response.test.ts` | Unit | 12/12 focused tests passed | 6 expected failures after specifying deferred STOP/MAX_TOKENS and declared calls | 11/11 focused tests passed for the response-only implementation | A 65-level canonical-argument test failed as expected and then 13/13 focused tests passed | Not retained: Pi typecheck exposed the prohibited stream handoff and all F source/test edits were restored |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/response.test.ts packages/pi/src/tool-contract.test.ts` | Passed | Safety net: `response.test.ts` 12/12 passed; no `tool-contract.test.ts` exists in this checkout. |
| `npm test -- --run packages/pi/src/response.test.ts` (RED) | Failed as expected | 6 failures: current parser emitted STOP/MAX_TOKENS in `push()` and rejected function calls. |
| Same focused command (response-only GREEN) | Passed | 11/11 tests passed. |
| Same focused command (depth RED) | Failed as expected | 12 passed and the new 65-level argument object did not reject. |
| Same focused command (triangulation GREEN) | Passed | 13/13 tests passed. |
| `npm run typecheck:pi` | Blocked by scope conflict | Required semantic changes fail at excluded `stream.ts`: `"toolUse"` is not accepted by its terminal reason type; its consumer also ignores `ResponseSemantics.finish()` return. |

### Persisted task status and workload

No Unit F checkbox was marked complete; the five Unit F implementation-owned rows remain exactly unchecked in `tasks.md`. No F code, test, or fixture diff remains after restoration; OpenSpec progress only was appended.

### Required resolution

Authorize a narrow cross-unit handoff edit to `packages/pi/src/stream.ts` that delivers the returned `finish()` semantic and extends only the terminal reason typing/handling required for `toolUse`, or move this terminal handoff into Unit G and authorize F to retain a response-only API change that temporarily cannot satisfy the full Pi typecheck. The first option keeps behavior and its terminal integration cohesive.

### Post-blocker verification

| Command | Result | Evidence |
|---|---|---|
| `npm test` | Accepted inherited baseline only | 57/58 files passed, 1,317 tests passed, 25 todo, and exactly the two known `scripts/release-manifest-check.test.ts` failures at lines 76 and 103 (`expected undefined to be defined`). The restored response suite passed 12/12. |

---

## Unit F completion: atomic response semantics and terminal handoff

### Structured status consumed

- Change: `add-pi-tool-support`; user-authoritative apply status `ready`; Unit F only on `feat/pi-tool-support-f-response`.
- Action context: `repo-local`; all edits remained under `C:/Github/Ordico/opencode-antigravity-guard-pi-tools` and the explicitly allowed F surfaces.
- Delivery: `auto-chain` / `feature-branch-chain`; strict TDD active. The user explicitly authorized the minimal `stream.ts`/`stream.test.ts` terminal handoff required for `finish()` to deliver `toolUse`; no Unit G tool-call lifecycle event implementation was added.

### Completed tasks and persisted checkbox updates

All five Unit F implementation-owned rows are visibly `[x]` in `tasks.md`: RED, GREEN, TRIANGULATE, REFACTOR, and Verify. Units G–H remain unchecked and unchanged.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| F | `response.test.ts`, `stream.test.ts` | Unit/integration | 34 focused tests passed | 2 new response tests failed because calls were rejected and finishes were emitted in `push()` | 37 focused tests passed after response semantics and terminal handoff | 38 focused tests passed for late `[DONE]` data and incomplete terminal rejection | Canonical arguments now use Pi-local `canonicalJson`; focused tests and Pi typecheck remain green |

### Verification evidence

| Command | Result | Evidence |
|---|---|---|
| `npm test -- --run packages/pi/src/response.test.ts packages/pi/src/stream.test.ts` (safety net) | Passed | 34 tests: 12 response and 22 stream before F edits. |
| Same focused command (RED) | Failed as expected | New function-call policy/canonicalization assertions failed because calls remained unsupported and finishes were emitted early. |
| Same focused command (GREEN) | Passed | 37 tests passed after the response semantic and minimal terminal handoff implementation. |
| Same focused command (TRIANGULATE/REFACTOR) | Passed | 38 tests passed, including transactional malformed calls, terminal matrix, late data, and toolUse terminal delivery. |
| `npm run typecheck:pi` | Passed | Pi workspace `tsc -p tsconfig.json --noEmit` completed. |
| `npm test` | Accepted with known inherited baseline only | 57/58 files passed, 1,321 passed, 25 todo; exactly the two supplied `scripts/release-manifest-check.test.ts` failures at lines 76 and 103 (`expected undefined to be defined`). |

### Files changed

- `packages/pi/src/response.ts`
- `packages/pi/src/response.test.ts`
- `packages/pi/src/stream.ts` (minimal terminal semantic handoff only)
- `packages/pi/src/stream.test.ts` (terminal handoff proof and deferred-finish ordering)
- `openspec/changes/add-pi-tool-support/tasks.md`
- `openspec/changes/add-pi-tool-support/apply-progress.md`

### Implementation notes and remaining work

- `ResponseSemantics` accepts only declared, complete function calls under an explicit `accept` policy, canonicalizes object arguments once, assigns source call ordinals, and rejects duplicate IDs, malformed shapes, unknown names, invalid arguments, and incompatible finishes transactionally.
- Finish semantics are retained until clean EOF or `[DONE]`; late records after a finish or `[DONE]`, empty/truncated streams, and `OTHER` without a valid call fail closed.
- The narrow stream handoff delivers `semantics.finish()` after framing and accepts `toolUse` as a successful terminal reason. It does not emit `toolcall_start`, `toolcall_delta`, `toolcall_end`, diagnostics, or call scrubbing; those remain Unit G.
- Unit F has no unchecked implementation-owned rows. Remaining implementation-owned rows are exactly:
  - [ ] **RED:** Add lifecycle tests for exact `start → toolcall_start → toolcall_delta → toolcall_end → done(toolUse)`, shared partial identity, complete canonical argument delta including `{}`, real content indexes versus call indexes, interleaved text/thinking, and multiple calls. <!-- sdd-owner: implementation -->
  - [ ] **GREEN:** Extend `stream.ts` to map validated tool-call semantics into indexed Pi blocks/events, set `stopReason: "toolUse"` only on committed success, attach safe tool-only diagnostics, and centralize `open | succeeded | failed` finalization. <!-- sdd-owner: implementation -->
  - [ ] **TRIANGULATE:** Add abort, timeout, malformed/late stream, callback failure, post-call response error, and concurrent-stream tests proving calls are scrubbed on failure and exactly one `done` or `error` occurs. <!-- sdd-owner: implementation -->
  - [ ] **REFACTOR:** Consolidate block-closing and terminal guards while preserving existing cancellation, body cancellation, HTTP/quota error, and no-tool terminal behavior. <!-- sdd-owner: implementation -->
  - [ ] Verify this unit with `npm test -- --run packages/pi/src/stream.test.ts`, `npm run typecheck:pi`, `npm test`, and `npm run build:pi`; rollback by reverting lifecycle and F response admission in dependency order. <!-- sdd-owner: implementation -->
  - [ ] **RED:** Add provider and pack-consumer tests asserting the legacy two-argument registration, unchanged seven descriptors/OAuth hooks, emitted runtime module availability, clean production install/load, and absence of source/tests/fixtures or repository-relative runtime imports from the archive. <!-- sdd-owner: implementation -->
  - [ ] **GREEN:** Update only necessary provider imports, pack assertions, and README/package wording; document route-level states, text-versus-tool distinction, preflight boundaries, `AUTO`/`NONE`, schema/result limits, and Claude’s disabled status without claiming enabled tools. <!-- sdd-owner: implementation -->
  - [ ] **TRIANGULATE:** Add documentation-to-catalog consistency assertions for disabled and fixture-qualified routes and run the full no-tool plus tool preflight/regression matrix against all seven text registrations. <!-- sdd-owner: implementation -->
  - [ ] **REFACTOR:** Remove duplicated status literals by deriving documentation test data from catalog-facing data where package boundaries permit, while keeping OpenSpec evidence out of runtime loading. <!-- sdd-owner: implementation -->
  - [ ] Verify this unit and the complete accepted change with `npm test`, `npm run typecheck:pi`, `npm run build:pi`, `npm run typecheck`, `npm run build`, and `npm run test:pack`; report any environment-dependent direct-validation gap as a blocker rather than enabling a route. <!-- sdd-owner: implementation -->

### Workload / PR boundary

Feature-branch-chain child F only. Authored production/test delta is **224 additions, 63 deletions, 287 changed lines** (`response.ts` 93/50, `response.test.ts` 51/8, `stream.ts` 3/3, `stream.test.ts` 14/2), excluding OpenSpec bookkeeping; this is below the 400-line budget. No fixture was needed because the parser tests use synthetic records. No commit, branch operation, push, publication, or live call occurred.

### Deviation and risk

No design deviation occurred. The user-authorized terminal handoff is deliberately limited and leaves Unit G lifecycle integration pending. The two release-manifest failures are inherited and unchanged; no additional full-suite failure occurred.

---

## Unit F authorized fallback correction

This explicitly authorized fallback adds the missing transactional `MAX_TOKENS` declared-call proof because the SDD apply actor ignored the parent worktree and status. No SDD status was queried or reconstructed here.

- Test correction: 7 additions, 0 deletions, 7 changed code/test lines.
- Complete Unit F code/test working diff: 168 additions, 63 deletions, 231 changed lines across `response.ts`, `response.test.ts`, `stream.ts`, and `stream.test.ts`.
- Focused Unit F response coverage now has 16 tests; response plus stream has 38 tests.
