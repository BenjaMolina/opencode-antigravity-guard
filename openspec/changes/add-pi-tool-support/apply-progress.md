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
