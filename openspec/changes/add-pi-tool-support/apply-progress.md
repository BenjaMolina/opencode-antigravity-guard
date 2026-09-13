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
