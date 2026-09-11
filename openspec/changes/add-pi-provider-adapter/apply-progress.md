# Apply Progress: Add Pi Provider Adapter

## Status

- Change: `add-pi-provider-adapter`
- Applied work unit: `A-workspace-distribution-foundation` only.
- Parent status consumed: `gentle-pi.sdd-status@2`; hybrid artifacts complete, apply ready, `0/8` at start.
- Action context: `repo-local`, workspace and only allowed edit root `C:\Github\Ordico\opencode-antigravity-guard`; no warnings.
- Delivery boundary: feature-branch-chain, work unit A, no commit/PR/push/publish.

## Completed task and checkbox evidence

- [x] `A — Establish workspace and packed-distribution foundation`: marked complete in `tasks.md` after the final build, typecheck, test, and pack evidence.

## Files changed

- `package.json`
- `package-lock.json`
- `vitest.config.ts`
- `README.md`
- `scripts/pack-consumer.ts`
- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/README.md`
- `packages/core/src/index.ts`
- `packages/core/src/index.test.ts`
- `packages/pi/package.json`
- `packages/pi/tsconfig.json`
- `packages/pi/README.md`
- `openspec/changes/add-pi-provider-adapter/tasks.md`
- `openspec/changes/add-pi-provider-adapter/apply-progress.md`

## TDD Cycle Evidence

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| RED | `npx vitest run packages/core/src/index.test.ts` | 1 | Vitest reported `No test files found` because the root discovery rule included only `src/**/*.test.ts`; the new workspace fixture was not discoverable. |
| GREEN | `npm test -- --run` | 0 | The core package now exports `CORE_PACKAGE_NAME`, workspace discovery includes `packages/*/src/**/*.test.ts`, and 39 files / 1,105 tests passed. |
| TRIANGULATE | `npm run test:pack` | 0 | Isolated archives installed with lifecycle scripts disabled: root/core imported under Node 20.19.5, while Pi installed with exact 0.85.1 host peers under Node 22.22.2. The harness also asserted required root/core JS and declarations and no repository-relative package imports. |
| REFACTOR | `npm run build`; `npm run typecheck`; `npm test`; `npm run build:all`; `npm run typecheck:all`; `npm run test:pack` | 0 each | Final suite passed: 39 files / 1,105 tests (25 todo); all explicit root/core/Pi build/typecheck and packed-consumer commands passed. |

The initial packed-consumer harness iterations exposed Windows command invocation, lifecycle output parsing, root-package packing, and consumer dependency retention issues; each was corrected before the passing TRIANGULATE evidence.

## Verification

- `npm run build` — exit 0.
- `npm run typecheck` — exit 0.
- `npm test` — exit 0; 39 test files, 1,105 passed, 25 todo.
- `npm run build:all` — exit 0.
- `npm run typecheck:all` — exit 0.
- `npm run test:pack` — exit 0.

Runtime harness: `npm run test:pack` used separate temporary production-only consumers, disabled install lifecycle scripts, imported packed root/core under Node 20.19.5, and installed Pi with exact `@earendil-works/pi-ai@0.85.1` and `@earendil-works/pi-coding-agent@0.85.1` under Node 22.22.2. Pi has no extension resource yet by unit-A scope; extension-resource loading is deferred to unit H.

## Design deviation and constraints

The Pi workspace is intentionally a metadata/distribution skeleton in this unit: it declares the exact core dependency, wildcard Pi host peers, Node 22.19+ engine, ESM package type, allowlist, and `prepack`, but contains no extension resource or provider implementation. This honors the unit-A allowed surfaces and defers registration/resource loading to H. Root production dependencies remain unchanged; Pi host packages are root development-only dependencies.

## Workload and rollback

- PR boundary: feature-branch-chain unit A only; starts with the root package and ends with workspace distribution/pack validation.
- Authored implementation change count: 279 additions plus deletions across implementation/test/docs/harness surfaces; 354 including the initial OpenSpec evidence and checkbox update. Generated lockfile churn is 5,368 additions and 1,467 deletions, reported separately. The implementation count is within the 400-line work-unit budget.
- Maintainer decision: Molina Ordico explicitly accepted `size:exception` for the generated `package-lock.json` churn before committing unit A. The exception applies only to generated lockfile lines; it does not relax the 400-line authored-code budget for this or later units.
- Rollback boundary: revert only workspace manifests, tsconfigs, test/build/pack wiring, package READMEs/core surface, root Pi link, and the corresponding lockfile entries. Do not reset unrelated `.atl/*`, `.gitignore`, `.pi/*`, or root `src/**` changes.

## Remaining implementation tasks

- [ ] Characterize existing OpenCode OAuth URL/form, refresh-form, deterministic header, and expiry behavior, then move only the neutral contracts into core while retaining equivalent root reexports/wrappers and all host-owned side effects. <!-- sdd-owner: implementation -->
- [ ] Add Pi-local, abort-aware OAuth exchange/refresh and per-access-token project resolution that validate responses, redact diagnostics, and return neutral/Pi credential data without accessing OpenCode account state. <!-- sdd-owner: implementation -->
- [ ] Implement a single-attempt callback receiver that binds `127.0.0.1:51121`, validates one complete callback URL and state, offers safe manual fallback conditions, and closes every owned resource on all terminal paths. <!-- sdd-owner: implementation -->
- [ ] Compose browser/loopback and manual callback-URL login, token/project completion, refresh, cancellation, single-attempt coordination, and Pi credential mapping through Pi’s OAuth lifecycle only. <!-- sdd-owner: implementation -->
- [ ] Implement immutable text-only context serialization with explicit unsupported-content errors and a bounded incremental UTF-8 SSE framer that preserves records across arbitrary byte boundaries. <!-- sdd-owner: implementation -->
- [ ] Implement the fixed-origin Antigravity HTTP/SSE consumer that validates response/usage semantics and emits ordered Pi partial text events with exactly one success, error, or aborted terminal outcome. <!-- sdd-owner: implementation -->
- [ ] Register exactly `antigravity-guard` with one public model `antigravity-gemini-3.8-flash`, wire it to `gemini-3.8-flash`, connect the completed OAuth and stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->

## Authorized work-unit A correction: distribution safeguards

- Runtime authority: `acquire state: proceed`; active change and correction slice explicitly selected as `add-pi-provider-adapter` / `A-workspace-distribution-foundation-corrections`. The earlier native status had an ambiguous change selection, but this bounded runtime authority resolves the target for this correction only.
- Action context remains `repo-local` under `C:\Github\Ordico\opencode-antigravity-guard`; all edits are confined to the authorized correction surfaces. Feature-branch-chain delivery remains unchanged; no task checkbox, commit, push, publication, or PR action occurred.
- Added package-local copies of the root MIT license and explicit `LICENSE` entries in both workspace `files` allowlists. The pack harness now requires `LICENSE` in both core and Pi archive inventories.
- Generalized the pack harness's repository-path scan to every emitted `.js`, `.d.ts`, and `.d.ts.map` file under the root and core `dist` directories, so declaration imports and declaration-map sources receive the same independence check as runtime JavaScript.

### TDD Cycle Evidence — authorized correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npm test -- --run` | 0 | Baseline before correction: 39 files / 1,105 passed, 25 todo. This is baseline evidence, not RED. |
| RED | `npm run test:pack` | 1 | New archive-inventory assertion failed as intended: `benjamolina-antigravity-guard-core-0.1.0.tgz omits LICENSE`. |
| GREEN | `npm run test:pack` | 0 | Package-local MIT licenses, manifest allowlists, and emitted JS/declaration/declaration-map scans passed through clean packed consumers. |
| TRIANGULATE | `for workspace in @benjamolina/antigravity-guard-core @benjamolina/pi-antigravity-guard; do npm pack --dry-run --json --workspace="$workspace"; done` | 0 | Independent dry-run inventories listed `LICENSE` for both packages; core also listed `dist/index.js` and `dist/index.d.ts`. |
| REFACTOR | `npm run test:pack` | 0 | Recursive emitted-file checker remained green after consolidating JavaScript, declarations, and declaration-map validation. |

## Correction verification and rollback

- `npm run test:pack` passed after the final refactor: packed root/core imported under Node 20 and Pi installed in a clean Node 22 consumer with lifecycle scripts disabled.
- The correction adds 84 lines and deletes 8 lines across the authorized files, below the 150-line correction limit; the existing unit-A task remains checked and unchanged.
- Rollback boundary: remove only `packages/core/LICENSE`, `packages/pi/LICENSE`, the two manifest allowlist entries, and the pack-harness inventory/declaration checks; retain all original unit-A workspace work and unrelated dirty files.
- Remaining implementation tasks are unchanged and remain the seven unchecked implementation-owned rows above.
