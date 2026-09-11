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

## Authorized B neutral-core compatibility corrections

- Runtime correction authority: `acquire state: proceed` for `B-neutral-core-compatibility-corrections`; parent retains its token. Native status supplied by the gatekeeper selects `add-pi-provider-adapter`, reports `2/8`, `applyState: ready`, `nextRecommended: apply`, and permits only the repo-local workspace root. No task checkbox, commit, push, PR, publish, or C–H work occurred.
- Root compatibility restored: `ANTIGRAVITY_SCOPES` and `GEMINI_CLI_HEADERS` are mutable root-owned copies, while `getAntigravityHeaders()` returns a new mutable copy on every call. Core remains immutable and is not exposed by those root values.
- Root characterization added: OAuth code exchange asserts the existing token endpoint, content type, form field order/wire values, and successful legacy token shape; `src/plugin/auth.ts` re-export asserts the established expiry behavior. No core immutability test was added because the correction is strictly root compatibility, not a new core contract.
- No root OAuth, auth, or token production change was necessary: the compatibility gap was resolved entirely at the authorized `src/constants.ts` wrapper seam.

### TDD Cycle Evidence — B compatibility correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run src/constants.test.ts src/antigravity/oauth.test.ts src/plugin/auth.test.ts` | 0 | 4 files / 31 tests passed before correction. |
| RED | `npx vitest run src/constants.test.ts` | 1 | New root compatibility characterizations failed: frozen scopes could not be extended and a frozen header result could not be assigned. |
| GREEN | `npx vitest run src/constants.test.ts` | 0 | 2 files / 13 tests passed after mutable root copies and per-call header copies. |
| TRIANGULATE | `npx vitest run src/constants.test.ts src/antigravity/oauth.test.ts src/plugin/auth.test.ts` | 0 | 4 files / 36 tests passed, covering copy isolation plus root code-exchange and expiry re-export behavior. |
| REFACTOR | `npx vitest run src/constants.test.ts src/antigravity/oauth.test.ts src/plugin/auth.test.ts` | 0 | 4 files / 35 tests passed after combining duplicate mutable-root assertions without changing coverage. |

## Correction verification, workload, and rollback

- `npm run typecheck` — exit 0.
- `npm test` — exit 0; 44 files, 1,119 passed, 25 todo.
- `git diff --check -- src/constants.ts src/constants.test.ts src/plugin/auth.test.ts openspec/changes/add-pi-provider-adapter/apply-progress.md` — exit 0.
- Runtime harness: N/A; these are pure root compatibility wrappers and mocked OAuth characterization, with no authorized live-account operation.
- Corrected B arithmetic: the prior `430` figure incorrectly included OpenSpec persistence in the unit-B review count. The pre-correction B implementation/test delta was 326 additions + 68 deletions = 394; this correction is 95 additions + 4 deletions = 99; total B implementation/test delta is 421 additions + 72 deletions = 493. The maintainer explicitly authorized `size:exception` up to 500 total unit-B lines, so the corrected total is within the authorization. OpenSpec evidence is tracked separately and does not expand that delivery boundary.
- Rollback boundary: revert only the mutable root wrappers and their root characterizations in `src/constants.ts`, `src/constants.test.ts`, `src/antigravity/oauth.test.ts`, and `src/plugin/auth.test.ts`; retain B core extraction, A, and unrelated dirty files.

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

## Work unit B — neutral core extraction

- Runtime authority: `acquire state: proceed`; work unit `B-neutral-core-extraction`; parent retains the opaque settle token. Status/action context consumed: `gentle-ai.sdd-status@2`, hybrid, repo-local, `C:\Github\Ordico\opencode-antigravity-guard` is the only allowed root, with no warnings.
- Completed and persisted: B's implementation-owned checkbox is now `[x]` in `tasks.md`.
- Files changed: `package.json`, `package-lock.json`, core `constants.ts`, `headers.ts`, `oauth.ts`, `expiry.ts`, `index.ts` and their tests; root `constants.ts`, `antigravity/oauth.ts`, `plugin/auth.ts`, `plugin/token.ts`, and their characterized tests.
- Compatibility: root wrappers preserve OAuth state encoding, token-form field order and values, expiry fallback/invalid values, version locking, cache/error/persistence ownership, and deterministic headers. Core production imports only its local OAuth type and imports no host SDK, filesystem, persistence, account, quota, or recovery code.

### TDD Cycle Evidence — B

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/core/src/index.test.ts src/constants.test.ts src/plugin/auth.test.ts src/plugin/token.test.ts` | 0 | 4 files, 32 tests passed before edits. |
| RED | `npx vitest run packages/core/src/oauth.test.ts`; `npx vitest run packages/core/src/headers.test.ts packages/core/src/expiry.test.ts packages/core/src/constants.test.ts` | 1 each | Missing `./oauth.ts`, then missing `./headers.ts`, `./expiry.ts`, and `./constants.ts`; no tests executed. |
| GREEN | `npx vitest run packages/core/src/oauth.test.ts` | 0 | 1 authorization-URL test passed after the minimum OAuth builder. |
| TRIANGULATE | `npx vitest run packages/core/src/oauth.test.ts packages/core/src/headers.test.ts packages/core/src/expiry.test.ts packages/core/src/constants.test.ts` | 0 | 4 files, 7 tests passed for distinct forms/PKCE-state, Windows/macOS headers, expiry boundaries, and endpoints. |
| REFACTOR | `npx vitest run packages/core/src/oauth.test.ts packages/core/src/headers.test.ts packages/core/src/expiry.test.ts packages/core/src/constants.test.ts src/antigravity/oauth.test.ts src/plugin/token.test.ts src/plugin/auth.test.ts src/constants.test.ts` | 0 | 8 files, 41 tests passed after root wrappers adopted core. |

## Verification — B

- `npm run typecheck` — exit 0.
- `npm test` — exit 0; 44 files, 1,115 passed, 25 todo.
- Runtime harness: N/A; this unit is pure core extraction with mocked OAuth wrapper characterization and no authorized live-account operation.
- PR boundary: feature-branch-chain child B, dependent on committed A; no commit, push, PR, publish, or C–H implementation.
- Rollback boundary: core primitives/tests plus the root constants, OAuth, auth, and token wrapper seams and their tests; leave unit A and unrelated dirty `.atl/*`, `.gitignore`, and `.pi/*` intact.
- Workload at initial B completion: implementation/test/package changes were 326 additions and 68 deletions (394 total); the former `430` figure included mandatory SDD persistence and is superseded by the authorized B compatibility-correction arithmetic above. This cohesive extraction cannot shrink without omitting required contract coverage or evidence.

## Remaining implementation tasks

- [ ] Add Pi-local, abort-aware OAuth exchange/refresh and per-access-token project resolution that validate responses, redact diagnostics, and return neutral/Pi credential data without accessing OpenCode account state. <!-- sdd-owner: implementation -->
- [ ] Implement a single-attempt callback receiver that binds `127.0.0.1:51121`, validates one complete callback URL and state, offers safe manual fallback conditions, and closes every owned resource on all terminal paths. <!-- sdd-owner: implementation -->
- [ ] Compose browser/loopback and manual callback-URL login, token/project completion, refresh, cancellation, single-attempt coordination, and Pi credential mapping through Pi’s OAuth lifecycle only. <!-- sdd-owner: implementation -->
- [ ] Implement immutable text-only context serialization with explicit unsupported-content errors and a bounded incremental UTF-8 SSE framer that preserves records across arbitrary byte boundaries. <!-- sdd-owner: implementation -->
- [ ] Implement the fixed-origin Antigravity HTTP/SSE consumer that validates response/usage semantics and emits ordered Pi partial text events with exactly one success, error, or aborted terminal outcome. <!-- sdd-owner: implementation -->
- [ ] Register exactly `antigravity-guard` with one public model `antigravity-gemini-3.8-flash`, wire it to `gemini-3.8-flash`, connect the completed OAuth and stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->

## Work unit C — blocked before completion

- Runtime authority consumed: `C-pi-auth-http-project`, `feature-branch-chain` child of B, repo-local root only; no commit, push, PR, publish, or C–H work occurred.
- Strict-TDD probes used new Pi-local tests only. RED: `npx vitest run packages/pi/src/auth-http.test.ts` exited 1 because `auth-http.ts` did not exist; `npx vitest run packages/pi/src/project.test.ts` exited 1 because `project.ts` did not exist. GREEN probes then passed (4 and 3 tests respectively), and `npx tsc -p packages/pi/tsconfig.json --noEmit` exited 0.
- The minimal in-progress source/tests already measured 372 added lines before required triage cases (rotated tokens, bounded oversized bodies, in-flight body abort, redirect rejection, malformed project shapes, and canary-redaction assertions) and before mandatory cumulative evidence. Completing the specified behavior honestly would exceed the explicit 400-line maximum, so the temporary uncommitted files were removed and no task checkbox was changed.
- Runtime harness: N/A; C is injected-fetch/clock unit coverage only, and live external requests are unauthorized. Rollback: none required because temporary C files were removed.
- Remaining C task is unchanged and unchecked: `- [ ] Add Pi-local, abort-aware OAuth exchange/refresh and per-access-token project resolution that validate responses, redact diagnostics, and return neutral/Pi credential data without accessing OpenCode account state. <!-- sdd-owner: implementation -->`

## Work unit C1 — Pi token exchange and refresh HTTP

- Runtime authority consumed: `C1-pi-token-http`; parent retains its token. The supplied hybrid repo-local status selected `add-pi-provider-adapter`, `applyState: ready`, and `2/9` complete. The only edit root is `C:\Github\Ordico\opencode-antigravity-guard`; no action-context warnings were supplied.
- Completed and persisted: C1's implementation-owned checkbox is `[x]` in `tasks.md`; C2/D1–H, commits, pushes, PRs, publication, project lookup, persistence, OpenCode imports, filesystem access, and live requests remain out of scope.
- Files changed: `packages/pi/src/auth-http.ts`, `packages/pi/src/auth-http.test.ts`, `packages/pi/src/types.ts`, plus this progress artifact and C1 checkbox.
- C1 uses core OAuth forms/config and expiry only, injected fetch/clock, `redirect: "error"`, a ten-second/remaining-deadline signal, 64-KiB body bound, opaque allowlisted errors, and exact `{ refresh, access, expires }` credentials. Refresh retains the old refresh token unless the response rotates it.

### TDD Cycle Evidence — C1 remediation

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| RED | `npx vitest run packages/pi/src/auth-http.test.ts` | 1 | New exchange behavior could not load because `auth-http.ts` did not exist. |
| GREEN | `npx vitest run packages/pi/src/auth-http.test.ts` | 0 | Minimal exchange implementation passed 1 test. |
| TRIANGULATE | same focused command | 1 then 0 | New invalid-grant, transport, blank-token, and malformed-500 boundary tests each failed before their safe handling was added; final focused suite passed 11 tests. |
| REFACTOR | `npx vitest run packages/pi/src/auth-http.test.ts` | 0 | Renamed the non-throwing JSON helper to clarify its safe HTTP-error path; 11 tests passed. |

## Verification and failed-evidence remediation

- Distinct replacement for failed evidence `sha256:80e925562b95051e2fec52016dfc219d20f0fd60226b7772b5267721d3ece35c`: `npx vitest run packages/pi/src/auth-http.test.ts` exited 0 with 1 file / 11 tests, and `npm test` exited 0 with 45 files / 1,130 passed / 25 todo. This is C1-only evidence rather than the former incomplete combined C probe.
- `npm run build --workspace=@benjamolina/antigravity-guard-core` — exit 0.
- `npx tsc -p packages/pi/tsconfig.json --noEmit` — exit 0; `npm run typecheck --workspace=@benjamolina/pi-antigravity-guard` — exit 0 (the current workspace script is a no-op, so the direct `tsc` command is the substantive Pi typecheck).
- `git diff --check -- packages/pi/src/auth-http.ts packages/pi/src/auth-http.test.ts packages/pi/src/types.ts` — exit 0.
- Runtime harness: N/A. C1 is a deterministic injected-fetch/clock boundary; live OAuth is unauthorized.
- Review boundary: feature-branch-chain child C1 of B. New implementation/test/type lines are 315 additions, below 400; artifact evidence is tracked separately and no `size:exception` is needed.
- Rollback boundary: remove only C1's auth HTTP, its focused tests, and C1-specific credential/dependency types; retain A/B and unrelated dirty files.

## Remaining implementation tasks

- [ ] Add Pi-local, abort-aware `loadCodeAssist` project resolution that sends exact Antigravity metadata and headers for each access token, accepts only supported project shapes, and redacts failures. <!-- sdd-owner: implementation -->
- [ ] Implement a single-attempt callback receiver that binds `127.0.0.1:51121`, validates one complete callback URL and state, offers safe manual fallback conditions, and closes every owned resource on all terminal paths. <!-- sdd-owner: implementation -->
- [ ] Compose browser/loopback and manual callback-URL login, token/project completion, refresh, cancellation, single-attempt coordination, and Pi credential mapping through Pi’s OAuth lifecycle only. <!-- sdd-owner: implementation -->
- [ ] Implement immutable text-only context serialization with explicit unsupported-content errors and a bounded incremental UTF-8 SSE framer that preserves records across arbitrary byte boundaries. <!-- sdd-owner: implementation -->
- [ ] Implement the fixed-origin Antigravity HTTP/SSE consumer that validates response/usage semantics and emits ordered Pi partial text events with exactly one success, error, or aborted terminal outcome. <!-- sdd-owner: implementation -->
- [ ] Register exactly `antigravity-guard` with one public model `antigravity-gemini-3.8-flash`, wire it to `gemini-3.8-flash`, connect the completed OAuth and stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->

## Authorized C1 correction -- token HTTP

- Runtime authority: `C1-token-http-corrections`, native acquire `proceed`; parent retains the token. The supplied correction authority resolves `add-pi-provider-adapter` despite the stale ambiguous status, with repo-local action context and `C:\Github\Ordico\opencode-antigravity-guard` as the only edit root; no warnings.
- Scope remained `packages/pi/src/auth-http.ts`, `packages/pi/src/auth-http.test.ts`, and this progress artifact. C1 remains visibly checked in `tasks.md`; C2/D1-H, commits, pushes, PRs, publishing, and live OAuth calls remain out of scope.
- Cleanup now initiates and rejection-handles `reader.cancel()` without awaiting it, so abort/error settlement cannot hang. Non-aborted body-reader failures are classified as opaque transport errors.
- A present `refresh_token` must be a nonblank string; only an absent field preserves the prior token. Calculated expiry must be finite before Pi credentials are returned.

### TDD Cycle Evidence -- C1 correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/auth-http.test.ts` | 0 | 1 file / 11 tests passed before correction. |
| RED | same focused command | 1 | 19 tests ran: 12 passed and 7 failed as expected for hanging cancellation, four malformed rotations, expiry overflow, and non-aborted body transport failure. |
| GREEN | same focused command | 0 | 1 file / 19 tests passed after the minimum cleanup, validation, expiry, and error-classification changes. |
| TRIANGULATE | same focused command | 0 | Four malformed rotation shapes, absent-rotation preservation, overflow, hanging cancellation, body transport failure, and expired remaining-deadline cases passed. |
| REFACTOR | same focused command | 0 | 1 file / 19 tests passed; no further refactor was justified beyond the minimal correction. |

## Correction verification, workload, and rollback

- `npm run build --workspace=@benjamolina/antigravity-guard-core` -- exit 0.
- `npx tsc -p packages/pi/tsconfig.json --noEmit` -- exit 0.
- `npm test` -- exit 0; 45 files / 1,138 passed / 25 todo. Expected existing Gemini invalid-aspect-ratio diagnostics appeared on stderr without failures.
- Runtime harness: N/A; deterministic injected fetch/clock and `ReadableStream` fixtures cover this HTTP boundary without authorized external requests.
- The prior C1 snapshot was 315 code/test/type lines; the current C1 snapshot is 389, a 74-line correction delta. This 26-line evidence appendix makes the exact correction delta 100 lines. The maintainer explicitly authorized a C1 `size:exception` up to 500 lines; 389 remains within that boundary and 100 remains below the 150-line correction limit.
- Rollback boundary: revert only the nonblocking cancellation/error branch, refresh/expiry validation, and their new C1 tests; retain original C1 behavior, A/B, and unrelated dirty files.

## C1 timeout-test correction

- Added a pending-fetch regression with `deadlineMs: 1_010` from `now: 1_000`; it races a 100-ms watchdog and requires the allowlisted `aborted` settlement.

### TDD Cycle Evidence

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/auth-http.test.ts` | 0 | 19 tests passed before the correction. |
| RED | same focused command | 0 | The new test passed immediately, proving existing production timeout behavior; no production change was necessary. |
| GREEN | N/A | N/A | No production code was changed. |
| TRIANGULATE / REFACTOR | same focused command | 0 | Positive pending deadline and existing already-expired boundary both pass; 20 tests total. |

## Verification

- `npx vitest run packages/pi/src/auth-http.test.ts` -- exit 0; 1 file / 20 tests.
- `npx tsc -p packages/pi/tsconfig.json --noEmit` -- exit 0.
- C1 inclusive count: 451 + 17 test lines + 20 evidence lines = 488, within the authorized inclusive cap of 500; correction is 37/60 lines.
- Rollback boundary: remove only the positive-deadline pending-fetch regression and this evidence appendix.

## Work unit C2 — Pi project-resolution HTTP

- Runtime authority: `C2-pi-project-resolution` acquired `proceed`; parent retains its token. Fresh parent status selected `add-pi-provider-adapter`, apply ready at 3/9, repo-local root `C:\Github\Ordico\opencode-antigravity-guard`, with no action-context warnings.
- Completed and persisted: C2's implementation-owned checkbox is `[x]` in `tasks.md`; completion is now 4/9. No C1 invocation, OpenCode import, project cache, filesystem access, credential persistence, retry, fallback, live request, commit, push, PR, publish, or D1–H work occurred.
- Files changed: `packages/pi/src/project.ts`, `packages/pi/src/project.test.ts`, `tasks.md`, and this cumulative progress artifact. `types.ts` was not needed.
- The resolver uses injected fetch/clock, core production endpoint/header primitives, a fresh request per access token, ten-second/deadline-bounded signals across fetch/body reads, redirect rejection, 64-KiB bodies, strict unknown JSON, and opaque actionable errors. It accepts only nonblank project strings or object IDs.

### TDD Cycle Evidence — C2

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| RED | `npx vitest run packages/pi/src/project.test.ts` | 1 | The new test could not import absent `project.ts`. |
| GREEN | same focused command | 0 | The minimum exact Windows request and string-project behavior passed: 1 test. |
| TRIANGULATE | same focused command | 1 then 0 | Object-ID/macOS, invalid payload, token isolation, canary-redaction, redirect/status, and fetch/body abort/deadline cases initially produced 9 failures; generalized handling passed 12 tests. |
| REFACTOR | core build, focused test, Pi typecheck, and `npm test` | 0 each | Extracted pure metadata mapping; focused suite remained 12/12. |

## C2 verification, workload, and rollback

- `npm run build --workspace=@benjamolina/antigravity-guard-core`, `npx vitest run packages/pi/src/project.test.ts`, and `npx tsc -p packages/pi/tsconfig.json --noEmit` — exit 0.
- `npm test` — exit 0; 46 files / 1,152 passed / 25 todo. Existing invalid-aspect-ratio diagnostics appeared on stderr without failures.
- Final focused verification passed 13 tests after adding a transport regression that passed immediately; it is verification coverage, not claimed as a new TDD RED cycle.
- C2 is the feature-branch-chain child of C1. It adds 291 source/test lines plus 2 task-checkbox lines and 25 progress-evidence lines (318 total), below the 400-line limit.
- Rollback boundary: remove only C2's resolver/tests and its checkbox/progress evidence; retain A, B, C1, and unrelated dirty files.
- Remaining implementation rows: D1 callback receiver, E OAuth lifecycle, F context/SSE framing, G response/native stream, and H registration/docs.

## C2 remediation — dependency-error normalization

- Authority: active `C2-pi-project-resolution` remediation proceeded under the same repo-local root and allowed surfaces; the persisted C2 checkbox remains `[x]`.
- Fetch rejections, reader rejections, and synchronous `getReader()` failures now normalize to the fixed transport error unless the composed signal is aborted. Exported forged `ProjectHttpError` instances cannot carry dependency messages/statuses through the boundary.
- The resolver retains its internally generated oversized-response error only after trusted local processing completes; no dependency callback can select that path.

### TDD Cycle Evidence — C2 remediation

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/project.test.ts` | 0 | 13 tests passed before remediation. |
| RED | same focused command | 1 | New regressions covered forged fetch/body errors and synchronous `getReader()`; the first forged-fetch case confirmed unsafe rethrow. |
| GREEN | same focused command | 0 | 14 tests passed after normalizing callback errors and moving reader acquisition inside the protected boundary. |
| TRIANGULATE | same focused command | 0 | A 64-KiB overflow fixture proved the trusted local response-limit error remains a safe `response` result; 15 tests passed. |
| REFACTOR | focused test, Pi typecheck, and `npm test` | 0 each | Removed unused caught values; final focused suite remained 15/15. |

## C2 remediation verification and rollback

- `npx vitest run packages/pi/src/project.test.ts`, `npx tsc -p packages/pi/tsconfig.json --noEmit`, and `npm test` — exit 0; full suite: 46 files / 1,154 passed / 25 todo.
- C2 now totals 320 source/test lines, 2 checkbox lines, and 47 progress-evidence lines: 369 changed lines, leaving 31 below the 400-line ceiling.
- Rollback boundary: revert only the dependency-normalization/reader-guard changes and their remediation tests/evidence; retain the original C2 resolver behavior and prior A/B/C1 work.

## Work unit D1 — secure loopback receiver

- Authority consumed: fresh parent status selected `add-pi-provider-adapter`, repo-local root `C:\Github\Ordico\opencode-antigravity-guard`, apply ready at 4/9 with `nextRecommended: apply`; runtime token `D1-secure-loopback-receiver` is held by the parent. No action-context warnings, commit, push, PR, publication, Google call, root OAuth, or E–H work occurred.
- Completed and persisted: D1's implementation-owned checkbox is `[x]`; progress is now 5/9.
- Files changed: `packages/pi/src/loopback.ts`, `packages/pi/src/loopback.test.ts`, `tasks.md`, and this cumulative progress artifact. `types.ts` and test helpers were not needed.
- The receiver binds only `127.0.0.1:51121`, validates GET/host/path/remote address, URL size and singleton OAuth parameters, uses length-first timing-safe state comparison, and synchronously claims one terminal result. It bounds the 30-second callback window by a five-minute maximum, returns safe manual fallback signals, and idempotently closes timers, listeners, and tracked sockets.

### TDD Cycle Evidence — D1

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| RED | `npx vitest run packages/pi/src/loopback.test.ts` | 1 | The new receiver contract could not import absent `loopback.ts`. |
| GREEN | same focused command | 0 | 4 tests passed after the minimum listener, validator, winner, response, and cleanup implementation. |
| TRIANGULATE | same focused command | 0 | 5 tests cover malformed/duplicate callbacks, denial, occupied port, timeout fallback, manual mode, accepted/rebind, malformed closure, cancellation, late arrival, and socket cleanup. |
| REFACTOR | same focused command; Pi `tsc` | 0 each | Response completion was made graceful before owned socket destruction; 5 focused tests and typecheck passed. |

## D1 verification, workload, and rollback

- `npx vitest run packages/pi/src/loopback.test.ts` — exit 0; 1 file / 5 tests. The focused suite is the real local loopback fixture; it uses readiness and port rebinding rather than wall-clock waits.
- `npx tsc -p packages/pi/tsconfig.json --noEmit` and `git diff --check -- packages/pi/src/loopback.ts packages/pi/src/loopback.test.ts` — exit 0.
- `npm test` — exit 0; 47 files / 1,159 passed / 25 todo. Existing invalid-aspect-ratio diagnostics appeared on stderr without failures.
- D1 is the feature-branch-chain child after C2. Its implementation/test delta is 263 additions; task/progress persistence is within the 400-line work-unit cap.
- Design deviation: none. Manual completion parsing and token exchange remain E-owned, so D1 opens no socket in manual mode and returns only safe terminal signals.
- Rollback boundary: remove only D1 receiver/tests and its checkbox/progress evidence; retain A, B, C1, C2, and unrelated dirty files.

## Remaining implementation tasks

- [ ] Compose browser/loopback and manual callback-URL login, token/project completion, refresh, cancellation, single-attempt coordination, and Pi credential mapping through Pi’s OAuth lifecycle only. <!-- sdd-owner: implementation -->
- [ ] Implement immutable text-only context serialization with explicit unsupported-content errors and a bounded incremental UTF-8 SSE framer that preserves records across arbitrary byte boundaries. <!-- sdd-owner: implementation -->
- [ ] Implement the fixed-origin Antigravity HTTP/SSE consumer that validates response/usage semantics and emits ordered Pi partial text events with exactly one success, error, or aborted terminal outcome. <!-- sdd-owner: implementation -->
- [ ] Register exactly `antigravity-guard` with one public model `antigravity-gemini-3.8-flash`, wire it to `gemini-3.8-flash`, connect the completed OAuth and stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->

## D1 hostile-input correction

- Authority: the parent confirmed D1 remains the selected repo-local work unit; scope stayed limited to its receiver, test, and progress artifact. The persisted D1 checkbox remains `[x]`.
- Raw origin-form validation now rejects network-path, dot-segment/encoded path, fragment, malformed-percent, and non-exact callback targets before query parsing. The 8-KiB cap uses UTF-8 encoded bytes and allows the exact boundary only.
- State validation first rejects malformed surrogate Unicode, then compares UTF-8 byte lengths before `timingSafeEqual`. Validator and HTTP handler both contain defensive error-to-rejection boundaries.

### TDD Cycle Evidence — D1 hostile correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/loopback.test.ts` | 0 | 5 tests passed before correction. |
| RED | same focused command | 1 | New hostile target test accepted a fragment-bearing callback. |
| GREEN / TRIANGULATE | same focused command | 0 | 6 tests passed for Unicode state, raw-target normalization, malformed escapes, and exact byte cap. |
| REFACTOR | focused test and Pi `tsc` | 0 | Parser-free raw-path validation retained graceful winner response cleanup. |

- Verification: focused suite and `npx tsc -p packages/pi/tsconfig.json --noEmit` passed; `npm test` passed with 47 files / 1,160 tests / 25 todo.
- Cumulative D1 diff is 366 changed lines: 313 source/test additions, 51 progress additions, and the existing checkbox replacement (1 addition, 1 deletion). This correction adds 69 changed lines and remains 34 below the 400-line cap.
- Rollback boundary: revert only the hostile-input validation/helpers, their tests, and this evidence appendix; retain original D1 behavior and prior work units.

## D1 final winner-claim correction

- Parent reacquired `proceed` for the same D1 objective after the authorized ledger reset and 450-line exception. Scope remained receiver, test, and progress only.
- Fragments are rejected before raw-path branching. The winning acknowledgement defers terminal cleanup by one event-loop turn, allowing an already-buffered losing callback to receive deterministic 409 before its socket is destroyed.

### TDD Cycle Evidence — D1 final correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/loopback.test.ts` | 0 | 6 tests passed. |
| RED | same focused command | 1 | Fragment-before-query returned 404 and the pipelined second callback was truncated. |
| GREEN / TRIANGULATE | same focused command | 0 | 7 tests passed, including two live callbacks with 200/409, closed socket, and port rebind. |
| REFACTOR | Pi `tsc` and focused suite | 0 | Deferred cleanup retains bounded resource destruction after acknowledgement. |

- Verification: Pi typecheck and `npm test` passed; full suite is 47 files / 1,161 passed / 25 todo. Cumulative D1 is 403 changed lines; this correction adds 37 and remains within the 450-line exception. Rollback removes only this fragment/winner cleanup adjustment and fixture.

## Work unit E — Pi OAuth lifecycle

- Authority/status: user-selected `add-pi-provider-adapter` E at `5/9`, `acquire proceed` held by parent; repo-local `C:\Github\Ordico\opencode-antigravity-guard` is the only edit root, with no action-context warnings. Feature-branch-chain E only; no commit, push, PR, publish, live call, or F–H work.
- Completed/persisted: E's implementation-owned task is visibly `[x]` in `tasks.md`.
- Files: `packages/pi/src/oauth.ts`, `packages/pi/src/oauth.test.ts`, `tasks.md`, and this progress artifact; `types.ts` and test helpers were not needed.
- Behavior: isolated Pi lifecycle uses fresh state/verifier/S256 challenge, browser loopback or full-URL manual fallback without state regeneration, C1/C2 completion, Pi-only credential mapping/refresh, composed deadline/signals, busy rejection, and safe terminal cleanup/diagnostics.

### TDD Cycle Evidence — E

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| RED | `npx vitest run packages/pi/src/oauth.test.ts` | 1 | New lifecycle test could not import absent `oauth.ts`. |
| GREEN | same | 0 | Minimum manual full-callback token/project path passed: 1 test. |
| TRIANGULATE | same | 1 then 0 | Browser/manual fallback, denial/state rejection, cancellation races, refresh rotation, project failure, and installed-Pi callback fixture failed before lifecycle support, then 8 tests passed. |
| REFACTOR | same; Pi `tsc --skipLibCheck` | 0 | Centralized abort race, credential mapping, and safe terminal handling retained 8/8 coverage. |

- Verification: core workspace build and focused OAuth/installed-Pi compatibility fixture passed; direct `npx tsc -p packages/pi/tsconfig.json --noEmit` is blocked by existing `@google/genai` declaration errors for missing MCP client/ErrorEvent, while the direct source check with `--skipLibCheck` passed. Final `npm test` passed: 48 files, 1,169 passed, 25 todo.
- Design deviation: none; compatibility fixture uses installed `OAuthLoginCallbacks` and injected loopback only, with no browser or account access.
- Workload: E is the feature-branch-chain child after D1; the initial source/test delta was 336 additions, plus 2 task-checkbox lines and this 25-line evidence appendix, totalling 363 under the 400-line inclusive cap.
- Rollback: remove only E lifecycle/tests and its task/progress evidence; retain C1/C2/D1 and unrelated dirty files.
- Remaining implementation rows:
  - [ ] Implement immutable text-only context serialization with explicit unsupported-content errors and a bounded incremental UTF-8 SSE framer that preserves records across arbitrary byte boundaries. <!-- sdd-owner: implementation -->
  - [ ] Implement the fixed-origin Antigravity HTTP/SSE consumer that validates response/usage semantics and emits ordered Pi partial text events with exactly one success, error, or aborted terminal outcome. <!-- sdd-owner: implementation -->
  - [ ] Register exactly `antigravity-guard` with one public model `antigravity-gemini-3.8-flash`, wire it to `gemini-3.8-flash`, connect the completed OAuth and stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->

## E remaining-cap safety correction

- Authority: one original <=400 E attempt remained; this bounded correction adds narrow Pi OAuth type imports and protects synchronous setup/cleanup from leaking or wedging the busy slot.
| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/oauth.test.ts` | 0 | 8 tests passed. |
| RED | same | 1 | Synchronous setup leaked `CANARY-setup`; rejected cleanup also became an unhandled `CANARY-cleanup`. |
| GREEN/TRIANGULATE | same | 0 | 10 tests pass; setup and rejected cleanup are normalized, and a second login is cancelled, not busy. |
| REFACTOR | raw Pi `tsc` | 2 | The narrow `@earendil-works/pi-ai/oauth` imports compile to the same external `@google/genai` MCP-client/ErrorEvent declaration blocker. |
- Final E ledger: 353 source/test additions + 2 checkbox lines + 36 progress lines = 391 changed lines, within the original 400-line cap. Roll back only this import/setup/cleanup guard and its regression/evidence.

## E remediation — trusted dependency errors and Pi declaration compatibility

- Authority: user-selected `E-pi-oauth-lifecycle` remediation, bound to failed evidence `sha256:6d3264633169dd3dc0f795726c8206e35560f391923b873f04c90fe5a5b52286`; repo-local root only, with the approved cumulative 500-line E exception. No commit, push, PR, publication, live call, or F–H work occurred.
- Completed/persisted: the E implementation-owned row remains visibly `[x]` in `tasks.md` after this remediation.
- Dependency callbacks for exchange, project resolution, and refresh now discard every rejection value and recreate fixed lifecycle errors; empty or rejected manual prompts resolve as fixed cancellation, and matching-state `access_denied` resolves as fixed authorization denial.
- Pi's compiler now explicitly includes `DOM` and the exact `@modelcontextprotocol/sdk@1.25.2` development dependency required by the installed `@google/genai` declarations. The resulting lockfile wiring is generated dependency churn, not authored E implementation.

### TDD Cycle Evidence — E remediation

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| RED | `npx vitest run packages/pi/src/oauth.test.ts` | 1 | 11 tests ran; empty prompt returned callback instructions and forged lifecycle errors from injected dependencies bypassed redaction. |
| GREEN | same focused command | 0 | All 11 tests passed after normalizing dependency failures and manual denial/cancellation branches. |
| TRIANGULATE | `npx tsc -p packages/pi/tsconfig.json --noEmit`; focused OAuth test | 2 then 0 | The raw compiler first exposed missing MCP declarations and `ErrorEvent`; adding DOM plus the exact SDK dependency made it pass without `skipLibCheck`. |
| REFACTOR | focused OAuth test; raw Pi `tsc`; core build; `npm run build:all`; `npm test` | 0 each | Fixed-message helper retained redaction and final verification passed 48 files / 1,172 tests / 25 todo. |

## E remediation verification, workload, and rollback

- `npx vitest run packages/pi/src/oauth.test.ts`, raw Pi `tsc --noEmit`, `npm run build --workspace=@benjamolina/antigravity-guard-core`, `npm run build:all`, `npm test`, and `git diff --check` passed; no `skipLibCheck`, ambient module, or live OAuth workaround was used.
- E's source/test snapshot is now 401 lines versus the prior 353, a 48-line substantive increase. Including the 3-line manifest addition and 2-line tsconfig replacement, the cumulative authored E count is 444 before this 22-line evidence appendix and 466 including it, within the explicitly authorized 500-line cap. Generated `package-lock.json` churn is 1,147 additions and 8 deletions, reported separately.
- Rollback: revert only `oauth.ts`/`oauth.test.ts` trusted-boundary and manual-result changes, Pi DOM/SDK declaration wiring, and this appendix; retain C1/C2/D1, prior E behavior, and unrelated dirty files.

## E final receiver and SDK correction
- Authority/status: user-bound final failed-evidence remediation proceeded for E; produced status is `repo-local` at the sole workspace root with no action-context warnings, and the E checkbox remains `[x]`.
- Loopback boundaries normalize errors; trusted marks are consumed on delivery, while direct busy delivery uses an ordinary fixed Error. The dev-only SDK is exact `1.30.0`.
| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| RED | `npx vitest run packages/pi/src/oauth.test.ts` | 1 | Replayed receiver/`onSelect` cancellation and direct busy error leaked canaries. |
| GREEN | same | 0 | 12 tests cover receiver paths, one-shot replay, and direct-busy replay. |
| TRIANGULATE | raw Pi `tsc`; `npm audit --omit=dev` | 0 | SDK 1.30.0 compiles and production audit has zero vulnerabilities. |
| REFACTOR | `npm test`; `npm pack --dry-run --json` | 0 | 48 files/1,173 tests pass; pack has no bundled dependencies. |
- E is **495/500** authored lines: prior 466 + 18 source/test + 11 evidence. Generated lockfile delta is **+1,165/-12** total (**+18/-4** this correction); rollback restores error provenance, SDK pin/lock wiring, and this evidence only.

## Work unit F — text context and SSE framing

- Authority/status: parent-selected `add-pi-provider-adapter` at 6/9, repo-local sole edit root, and `F-text-context-sse-framing` runtime acquire `proceed`; parent retains its token. Feature-branch-chain F only; no commit, push, PR, publish, live request, or G–H work.
- Completed/persisted: F's implementation-owned task is visibly `[x]` in `tasks.md`.
- Files: `packages/pi/src/context.ts`, `context.test.ts`, `sse.ts`, `sse.test.ts`, plus this progress artifact and F checkbox.
- Behavior: immutable system/user/assistant text serialization maps the sole public model to `gemini-3.8-flash`, preserves whitespace/repeated text, validates fixed defaults, and rejects unsupported context/options before HTTP. The framer incrementally decodes fatal UTF-8 and preserves records across BOM, newline, and arbitrary byte boundaries under 1-MiB record and 8-MiB text bounds.

### TDD Cycle Evidence — F

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| RED | `npx vitest run packages/pi/src/context.test.ts packages/pi/src/sse.test.ts` | 1 | Both suites failed to load their absent production modules. |
| GREEN | same focused command | 0 | 15 tests passed after the serializer and framer were added. |
| TRIANGULATE | focused command; raw Pi `tsc` | 0; 2 then 0 | 17 tests cover tool-call/unknown blocks and every split of the Unicode fixture; a readonly fixture cast failed typecheck, then the explicit runtime cast passed. |
| REFACTOR | focused command; raw Pi `tsc` | 0 | Shared UTF-8 encoder extraction retained 17/17 tests and type safety. |

## F verification, workload, and rollback

- `npx vitest run packages/pi/src/context.test.ts packages/pi/src/sse.test.ts` — exit 0; 2 files / 17 tests.
- `npx tsc -p packages/pi/tsconfig.json --noEmit` — exit 0.
- `npm test` — exit 0; 50 files / 1,190 passed / 25 todo. Existing invalid-aspect-ratio diagnostics appeared on stderr without failures.
- F is the feature-branch-chain child after E. Rollback removes only F serializer/framer and tests plus its checkbox/progress evidence; retain A–E and unrelated dirt.
- Remaining implementation rows: G response/native stream and H registration/docs.

## F correction — hostile context and raw SSE limits

- Status consumed: parent-selected `add-pi-provider-adapter`, apply ready at 7/9; repo-local sole edit root with no warnings. Parent retains the existing F token; no acquire, settle, commit, push, PR, publish, live request, or G/H work occurred.
- Scope: only the four F files and this artifact changed; pre-existing unrelated `.atl/*`, `.gitignore`, and `.pi/*` dirt was preserved. The F checkbox was already `[x]` and remains unchanged.
- Context now reads only own data descriptors from plain records, requires dense nonempty text arrays, rejects malformed options and numeric values, and converts hostile getter/prototype failures to fixed `ContextSerializationError` values without canary text.
- SSE now counts raw bytes before retaining each decoded segment, including split LF/CRLF/bare-CR delimiters, and stores decoded line chunks rather than repeatedly concatenating an unbounded line.

### TDD Cycle Evidence — F correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/context.test.ts packages/pi/src/sse.test.ts` | 1 | Existing F regression exposed empty context text; this was the pre-change failing correction state. |
| RED | same focused command | 1 | New empty-part, malformed/prototype/getter, multibyte, exact CRLF, and unterminated-line cases failed before the guards. |
| GREEN | same focused command; raw Pi `tsc` | 0 | 20 focused tests and the Pi typecheck passed after minimum descriptor and byte-framing guards. |
| TRIANGULATE | same focused command; raw Pi `tsc` | 0 | Sparse/non-array/accessor context, NaN/fractional options, 8-MiB multibyte text, CRLF split, and LF/bare-CR framing pass. |
| REFACTOR | same focused command; raw Pi `tsc` | 0 | Removed the obsolete encoder while retaining 20 focused tests and type safety. |

## F correction verification and rollback

- Focused Vitest: exit 0, 2 files / 20 tests.
- Raw Pi typecheck: `npx tsc -p packages/pi/tsconfig.json --noEmit` exit 0.
- Full suite: `npm test` exit 0, 50 files / 1,193 passed / 25 todo; expected invalid-aspect-ratio diagnostics remained non-failing.
- `git diff --check` on the four F files exit 0.
- Workload: 89 F source/test lines plus 29 evidence lines were added to the stated 278-line candidate: **118 incremental, 396/400 cumulative**, leaving 4 lines; no exception is required.
- Rollback boundary: revert only the descriptor-validation/text guards, incremental raw-byte framer, their F regressions, and this correction appendix; retain A–E and unrelated dirt.
- Remaining unchecked implementation rows:
  - [ ] Implement the fixed-origin Antigravity HTTP/SSE consumer that validates response/usage semantics and emits ordered Pi partial text events with exactly one success, error, or aborted terminal outcome. <!-- sdd-owner: implementation -->
  - [ ] Register exactly `antigravity-guard` with one public model `antigravity-gemini-3.8-flash`, wire it to `gemini-3.8-flash`, connect the completed OAuth and stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->

## Work unit G — blocked by review-budget gate

## Maintainer-approved G split and revised work-unit boundary

- The maintainer explicitly selected a chained split, not a `size:exception`, after the settled failed original G attempt. Delivery remains `ask-on-risk` with `feature-branch-chain`; no source or tests were created by the failed attempt.
- Former G is replaced by sequential G1 then G2. G1 owns only pure Antigravity SSE response/event semantic validation: candidate/text/finish/usage mapping and its colocated tests. It has no fetch, project resolution, or Pi stream lifecycle responsibility.
- G2 depends on C2, F, and G1. It owns fixed-origin HTTP/SSE execution and exactly-once Pi-native stream lifecycle, consuming G1 and F with its colocated tests. H now depends on G2.
- The preserved combined G contract remains fixed-origin validation, safe HTTP guidance, framed SSE consumption, semantic candidate/text/finish/usage handling, ordered mutable Pi partials, and exactly one success, error, or aborted terminal with settled `stream.result`.
- Revised task progress is 7/10 complete: A, B, C1, C2, D1, E, and F are complete; G1, G2, and H remain unchecked. Each G work unit is forecast at or below 400 authored changed lines, with independent focused verification and rollback boundaries.

- Status consumed: parent-selected `add-pi-provider-adapter`, hybrid/apply-ready at `7/9`, repo-local sole edit root with no warnings; runtime attempt `G-response-native-stream` is `proceed` and remains owned by the parent. No acquire or settle occurred.
- No G production or test file was created, so the G checkbox remains unchecked. Existing response/stream files are absent; `git diff --check` over all allowed G surfaces exited 0 before this evidence update.
- Strict TDD status: no RED was written because the mandatory workload gate stopped the cohesive unit before any source edit; GREEN, TRIANGULATE, and REFACTOR are N/A.
- One honest slicing pass estimates at least 660 changed lines: response-schema/usage validation (~140), fixed-origin HTTP/SSE Pi event lifecycle (~190), real-stream focused RED/TRIANGULATE tests (~300), and required task/progress persistence (~30). Compressing or separating the tests from their behavior would violate the strict-TDD and work-unit contracts.
- Decision needed: explicit `size:exception` for at least 660 lines, or a new approved split that keeps each response/stream behavior and its tests cohesive. No tests, typecheck, full suite, runtime harness, live request, commit, push, PR, publish, or H work ran.
- Rollback boundary: only this truthful blocking evidence; no implementation rollback is needed. The remaining G row is exactly: `- [ ] Implement the fixed-origin Antigravity HTTP/SSE consumer that validates response/usage semantics and emits ordered Pi partial text events with exactly one success, error, or aborted terminal outcome. <!-- sdd-owner: implementation -->`

## Work unit G1 — Antigravity SSE response semantics

- Authority: parent-selected `G1-response-semantics` proceeded under the supplied hybrid repo-local status; `C:\Github\Ordico\opencode-antigravity-guard` is the sole allowed root, with no warnings. The parent retains the runtime token; this worker neither acquired nor settled it.
- Completed and persisted: G1's implementation-owned checkbox is visibly `[x]` in `tasks.md`. G2 and H remain untouched and unchecked.
- Files: `packages/pi/src/response.ts`, `packages/pi/src/response.test.ts`, `tasks.md`, and this cumulative progress artifact. No fetch, project resolution, Pi event emission, stream finalization, types change, or live call occurred.
- Behavior: pure semantic mapping parses each framed record once; accepts one candidate with text deltas, maps STOP/MAX_TOKENS, normalizes cumulative usage snapshots, validates metadata, rejects errors/prompt blocks/unsupported parts/malformed usage, and requires nonempty text plus a finish before success.

### TDD Cycle Evidence — G1

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| RED | `npx vitest run packages/pi/src/response.test.ts` | 1 | The new pure-response contract could not import absent `response.ts`. |
| GREEN | same focused command | 0 | The minimal candidate text and usage mapping passed 1 test. |
| TRIANGULATE | same focused command | 1 then 0 | Metadata validation and then cumulative-usage omission tests failed before implementation; final focused suite passed 4 tests for repeated/whitespace deltas, MAX_TOKENS, `[DONE]`, errors, forbidden parts, invalid usage, and terminal ordering. |
| REFACTOR | focused test and raw Pi typecheck | 0 | Stateful cumulative usage normalization retained 4/4 behavior tests; no broader refactor was needed. |

## G1 verification, workload, and rollback

- `npm run build --workspace=@benjamolina/antigravity-guard-core`, `npx vitest run packages/pi/src/response.test.ts`, and `npx tsc -p packages/pi/tsconfig.json --noEmit` — exit 0.
- `npm test` — exit 0; 51 files / 1,197 passed / 25 todo. Existing invalid-aspect-ratio diagnostics were non-failing.
- Runtime harness: N/A; G1 is deterministic pure parsing/mapping over framed fixtures and makes no external requests.
- Workload arithmetic: pre-existing G-split planning is 17 progress additions plus tasks 25 additions/13 deletions = 55 changed lines. G1 adds 119 source + 58 test + 25 progress = 202 changed lines, for 257 cumulative changed lines, below 400; the persisted checkbox is already part of the pre-existing modified revised-G row and adds no further net diff line. No code was compressed to reach the cap.
- Rollback boundary: remove only G1 response semantics/tests and this G1 checkbox/progress evidence; retain F, the approved split history, and all unrelated dirty files.
- Remaining implementation-owned rows: G2 fixed-origin stream lifecycle and H registration/docs.

## G1 correction — reject present empty candidate lists

- Authority/status consumed: the parent-supplied `gentle-ai.sdd-status@2` selects `add-pi-provider-adapter`, hybrid artifacts, apply ready at 8/10, repo-local sole edit root `C:/Github/Ordico/opencode-antigravity-guard`, and no action-context warnings. The parent reacquired `proceed` for `G1-response-semantics`; this correction neither acquired nor settled an attempt.
- Scope: only `packages/pi/src/response.ts`, `packages/pi/src/response.test.ts`, and this append were changed. G2/H, task checkboxes, network calls, commits, pushes, PRs, publishing, and live calls remain untouched.
- Correction: candidate absence still permits metadata-only records, while a present `candidates` field must now contain exactly one candidate. Empty and multiple candidate arrays are rejected.

### TDD Cycle Evidence — G1 correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/response.test.ts` | 0 | Pre-change focused suite: 4 tests passed. |
| RED | same focused command | 1 | The new metadata-only/empty-list regression failed because `candidates: []` was accepted; 4 passed, 1 failed. |
| GREEN | same focused command | 0 | The minimum `value.length !== 1` guard passed all 5 tests. |
| TRIANGULATE / REFACTOR | same focused command | 0 | A distinct multiple-candidate regression passed with 6 tests; no further refactor was warranted. |

## G1 correction verification, workload, and rollback

- `npx vitest run packages/pi/src/response.test.ts` — exit 0; 1 file / 6 tests. `npx tsc -p packages/pi/tsconfig.json --noEmit` — exit 0.
- `npm test` — exit 0; 51 files / 1,199 passed / 25 todo. The pre-existing invalid-aspect-ratio diagnostics remained non-failing.
- `git diff --check -- packages/pi/src/response.ts packages/pi/src/response.test.ts openspec/changes/add-pi-provider-adapter/apply-progress.md` — exit 0.
- Exact correction source/test diff from the prior G1 snapshot is +14/-1 (15 changed lines): +13 test lines and one production-line replacement. This 22-line evidence appendix raises the G1 review unit from 257 to 294/400 changed lines; no exception is needed.
- Rollback boundary: revert only the exact-one candidate guard, the empty/multiple candidate regressions, and this correction appendix; retain prior G1, F, and unrelated dirty files.

## G2 — blocked by the 400-line workload cap

- Authority consumed: parent-selected `G2-pi-stream-lifecycle` was `proceed`; the parent retains its token. The supplied `gentle-ai.sdd-status@2` selected `add-pi-provider-adapter`, reported apply-ready at 8/10, and permits only `C:/Github/Ordico/opencode-antigravity-guard` with no action-context warnings.
- A single honest sizing pass found the full revised G2 contract cannot fit the hard inclusive 400-line cap: minimally 270 lines of lifecycle execution (fixed-origin validation, protected headers, project lookup, hooks/timeouts, HTTP guidance, reader cleanup, F/G1 consumption, usage/cost updates, and exactly-once finalization), 160 lines of deterministic real-Pi-stream fixture coverage, plus task/progress persistence exceeds 450 lines. Omitting cases or separating tests would violate the requested strict-TDD and cohesive-unit contracts.
- No RED test, production source, task checkbox, live request, commit, push, PR, or publish was made; GREEN, TRIANGULATE, REFACTOR, core build, focused test, raw Pi typecheck, and full suite are N/A. G2 remains visibly unchecked in `tasks.md`.
- Decision required: authorize a G2 `size:exception` of at least 460 changed lines, or approve a further cohesive split with tests retained with each behavior. Rollback boundary: remove only this blocking evidence; unrelated `.atl/*`, `.gitignore`, and `.pi/*` remain untouched.

## G2 native-authorized narrower successor split

- The native authority refused the maintainer's initial 500-line G2 budget expansion; no effective `size:exception` was granted.
- The maintainer then explicitly authorized a cohesive successor split. Native `sdd-attempt rescope` committed objective `G2a-http-sse-transport` with a maximum of 400 changed lines and the evidence goal of fixed-origin Antigravity HTTP request validation plus bounded SSE transport consumption, without Pi terminal lifecycle ownership.
- G2a is sequentially first and owns fixed-origin request/API/model/header/status/content-type validation, per-generation project resolution, bounded HTTP/SSE byte transport through F, and G1 semantic consumption through a framework-neutral injected callback boundary. Its behavior and tests remain together; it does not own Pi event-stream terminal lifecycle behavior.
- G2b depends on G2a and owns Pi-native partial-event ordering, mutable snapshots, usage/cost propagation, abort/error/done exactly-once finalization, result settlement, and race/concurrency cleanup, with its tests kept with that behavior. H now depends on G2b.
- G1 remains complete and committed. Revised progress is exactly 8/11: A, B, C1, C2, D1, E, F, and G1 are complete; G2a, G2b, and H remain unchecked. Delivery remains `ask-on-risk` with `feature-branch-chain`.

## Work unit G2a — fixed-origin HTTP/SSE transport

- Authority/status: parent-selected `G2a-http-sse-transport` proceeded under the supplied hybrid repo-local status. The sole allowed root is `C:/Github/Ordico/opencode-antigravity-guard`; no action-context warnings. The parent retains the runtime token; no acquire or settle occurred.
- Completed and persisted: G2a is visibly `[x]` in `tasks.md`. G2b/H, Pi events, assistant snapshots, terminal/result ownership, provider registration, live calls, commits, pushes, PRs, and publication remain out of scope.
- Files: `packages/pi/src/stream.ts`, `packages/pi/src/stream.test.ts`, `tasks.md`, and this progress artifact.
- Behavior: fixed daily Antigravity origin, public-to-wire serializer boundary, protected headers, per-generation injected project lookup, 120-second total and 30-second read-inactivity bounds, bounded HTTP inspection/guidance, F framing, G1 semantic validation, and injected semantic callback delivery only.

### TDD Cycle Evidence — G2a

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | N/A | N/A | `stream.ts` and `stream.test.ts` did not exist before this unit. |
| RED | `npx vitest run packages/pi/src/stream.test.ts` | 1 | The new transport test could not import absent `stream.ts`. |
| GREEN | same focused command | 0 | One deterministic injected stream test passed after minimum fixed request, F/G1 consumption, and neutral callback delivery. |
| TRIANGULATE | same focused command | 1 then 0 | Resource-exhausted HTTP guidance initially returned generic response handling; 401/403/404/429, RESOURCE_EXHAUSTED, and protected-header cases then passed in 2 tests. |
| REFACTOR | core build, focused test, raw Pi `tsc`, and `npm test` | 0 each | The bounded HTTP-body helper retained the focused behavior without introducing Pi lifecycle ownership. |

## G2a verification, workload, and rollback

- `npm run build --workspace=@benjamolina/antigravity-guard-core`, `npx vitest run packages/pi/src/stream.test.ts`, `npx tsc -p packages/pi/tsconfig.json --noEmit`, and `npm test` all exited 0; full suite: 52 files / 1,201 passed / 25 todo.
- `git diff --check -- packages/pi/src/stream.ts packages/pi/src/stream.test.ts` exited 0. The runtime harness is deterministic injected fetch/project/callback plus `ReadableStream`; live transport is unauthorized and N/A.
- Passing settle remediation: this focused and full-suite evidence replaces failed evidence `sha256:56c88e0e7287c34e6cdba28558aa3e0087ade0d7a5c36e8897797c2d35c42d51` for this G2a boundary.
- Workload / PR boundary: feature-branch-chain G2a only. Source and tests are 225 lines; task/progress persistence remains below the hard 400-line unit cap. No code was compressed to fit.
- Rollback boundary: remove only G2a transport/callback behavior, its tests, G2a checkbox, and this evidence; retain C2/F/G1 and unrelated dirt.
- Remaining implementation rows:
  - [ ] Implement and verify the behavior in `packages/pi/src/stream.ts`: consume G2a semantic delivery to emit ordered Pi partial text events, maintain mutable snapshots and usage/cost, and finalize done, error, or aborted outcomes exactly once with settled results and cleanup. <!-- sdd-owner: implementation -->
  - [ ] Register exactly `antigravity-guard` with one public model `antigravity-gemini-3.8-flash`, wire it to `gemini-3.8-flash`, connect the completed OAuth and G2b stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->

## G2a correction — blocked by the remaining review budget

- Fresh parent authority selected `add-pi-provider-adapter` G2a, repo-local sole root, and `proceed`; this correction did not acquire or settle an attempt. Only the G2a transport files and this correction evidence were authorized. No checkbox, lifecycle, live call, commit, push, PR, or publication action occurred.
- The current conservative G2a ledger is 310/400, leaving 90 lines inclusive of correction evidence. The verifier requires three new observable contracts (hook replacement/response normalization, fixed API validation, and bounded non-SSE success-body consumption) plus tests for public/wire/API misuse, arbitrary safe headers, repeated lookup, timeouts, non-SSE bounds, abort/reader cleanup, callbacks/late errors, no Pi lifecycle, canary redaction, and concurrency.
- A strict-TDD correction cannot honestly fit that remainder: the test matrix needs distinct injected-stream fixtures and assertions, while the hook and bounded-body branches require production changes and final evidence. Writing a partial RED suite would leave the focused suite intentionally failing and silently omit the other required cases, so no source/test edit was started.
- Smallest honest additional requirement: raise this exact G2a correction boundary by at least 60 lines (to 460 inclusive) or authorize a further cohesive correction slice with its tests. Rollback boundary: remove only this blocked-correction evidence; existing G2a behavior and all task checkboxes remain unchanged.

## G2a remediation — fixed input, hooks, and non-SSE bounds

- Authority: parent supplied `proceed` for `G2a-http-sse-transport`; only `stream.ts`, `stream.test.ts`, and this evidence append changed. No checkbox, G2b/H, lifecycle ownership, live request, commit, push, PR, or publication action occurred.
- The transport now rejects a non-selected public model or API before project lookup/fetch, accepts arbitrary non-protected request headers, invokes Pi payload and response hooks, and converts hook failures to fixed callback errors without callback text.
- A successful non-SSE body is bounded and cancelled before the fixed content-type error. Existing total/inactivity signals, project-per-call resolution, semantic callback normalization, late reader failure propagation, and reader release/cancellation remain transport-only behavior.

### TDD Cycle Evidence — G2a remediation

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/stream.test.ts` | 0 | Existing focused suite passed: 2 tests. |
| RED | same focused command | 1 | New hook, fixed-API, and bounded non-SSE assertions failed: 3 tests failed. |
| GREEN | same focused command | 0 | Three focused tests passed after input guards, normalized hooks, and bounded non-SSE consumption. |
| TRIANGULATE / REFACTOR | same focused command; raw Pi `tsc` | 0 | Safe header forwarding plus payload/response canary failures pass; no lifecycle code was added. |

- Verification: focused stream test (3/3), raw Pi typecheck, `npm test` (52 files / 1,202 passed / 25 todo), and authorized `git diff --check` all exited 0.
- Arithmetic correction: G2a is now 175 stream + 97 test + 42 task + 68 progress lines = **383/400**. This remediation adds 27 production, 20 test, and 18 evidence lines (65 total); no exception is required.
- Runtime rationale: all coverage uses injected fetch/project/callback and `ReadableStream` fixtures; live Antigravity access remains unauthorized. Rollback removes only the fixed API/hook/non-SSE branches, their regressions, and this appendix.

## Authorized final G2a correction — total-stage deadline

- Authority: parent supplied the final G2a correction and maintainer-approved cumulative maximum of 500; scope remained `stream.ts`, `stream.test.ts`, and this evidence only. G2b/H, task checkboxes, Pi lifecycle ownership, and live/delivery actions remain untouched.
- `loadProject` now races the same total signal as fetch, both hooks, body reads, and the SSE reader, so a hung resolver cannot exceed the generation deadline. Transport still returns `void` and delivers only injected G1 semantics; it owns no Pi event/result lifecycle.

### TDD Cycle Evidence — final G2a correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/stream.test.ts` | 0 | 6 focused tests passed. |
| RED | same | 1 | A hanging project resolver escaped the ten-millisecond total deadline and the watchdog rejected. |
| GREEN | same | 0 | Wrapping project resolution in the shared abort race made resolver, payload hook, and response hook all settle as `aborted`. |
| TRIANGULATE / REFACTOR | focused test; raw Pi `tsc` | 0 | Repeated/concurrent isolated lookups, wire-model body mapping, F CRLF byte framing, reader cancel/late failure, semantic redaction, inactivity/total aborts, and neutral callback-only delivery remain covered. |

- Verification: core build, focused stream test (6/6), raw Pi `tsc`, full `npm test` (52 files / 1,205 passed / 25 todo), and `git diff --check` each exited 0. Failed evidence `sha256:a8c1b822d9765177ecd6d630dd81a24494808aa755a340d5c377178b7faf4b0a` is remediated.
- Workload / rollback: verified baseline corrected from 382 to 383; this small source/test/evidence correction remains below the authorized 500-line cumulative maximum. Roll back only the project-resolution abort race, its deadline/repeat-lookup regressions, and this appendix.

## G2a final correction attempt — blocked by the 500-line cap

- Authority consumed: the parent explicitly selected `add-pi-provider-adapter` / final G2a correction as repo-local and apply-ready at 9/11. The sole allowed root is `C:/Github/Ordico/opencode-antigravity-guard`; no action-context warnings were supplied. Per parent instruction, no status, acquire, or settle action was performed.
- Independent conservative baseline is **473/500**, leaving 27 lines. The required trusted-error provenance change alone needs 43 changed source lines: a module-local safe-error marker/factory, replacement of all 18 local `StreamTransportError` constructions, and the catch-boundary provenance check. A dependency-forged exported `StreamTransportError` therefore cannot be safely preserved within the remaining allowance.
- The mandatory strict-TDD coverage needs a minimum 61 changed test lines for forged project/fetch/payload/response/semantic-callback errors, stalled-reader inactivity, pending-fetch deadline/abort, reader lock release after cancellation, and an explicit neutral/no-Pi-result-lifecycle assertion. The required correction-evidence budget is 13 lines, bringing the minimum correction to 117 lines.
- The smallest honest cumulative cap is therefore **590 lines** (`473 + 117`), exceeding the authorized cap by 90. No RED test, production edit, checkbox update, lifecycle ownership change, live call, commit, push, PR, or publication was made. Strict-TDD stages and verification commands are N/A because the workload gate stopped work before RED.
- Rollback boundary: remove only this truthful blocking evidence; no implementation rollback is required.

## G2a final correction — trusted transport boundaries and deadlines

- Parent authority selected `add-pi-provider-adapter` G2a at 9/11 with repo-local allowed root only, retained the runtime token, and explicitly accepted the cumulative 590-line `size:exception`; no status/acquire/settle, task, G2b/H, lifecycle, live, or delivery action occurred.
- Local transport errors are now provenance-marked in a module-private `WeakSet`; forged exported `StreamTransportError` values from project lookup, fetch, payload/response hooks, and semantic callbacks are normalized to fixed safe classifications with no canary or forged status.
- An injected inactivity timeout makes the fixed 30-second production reader deadline deterministically testable; stalled reads settle aborted, cancel the reader, and release its lock. Pending fetches now share the existing total deadline proof.
- `executeStreamTransport()` remains `Promise<void>` and the explicit neutral-callback fixture proves it returns no Pi event stream or result lifecycle while delivering only G1 semantics.

### TDD Cycle Evidence — G2a final correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/stream.test.ts` | 0 | 6 focused transport tests passed before correction. |
| RED | same focused command | 1 | Forged dependency errors retained the attacker-controlled `418` status and message; stalled reader test also hung because its deadline was not injectable. |
| GREEN | same focused command | 0 | 9 tests passed after local provenance, bounded inactivity, abort, cancellation, and lock-release handling. |
| TRIANGULATE / REFACTOR | same focused command | 0 | 10 tests cover project/fetch/hook/semantic canaries, pending fetch, stalled reader cleanup, and neutral-only delivery; no further refactor was needed. |

## Final correction verification and rollback

- Passed: core workspace build, focused stream suite (10/10), raw Pi `tsc --noEmit`, full `npm test` (52 files, 1,209 passed, 25 todo), and scoped `git diff --check`.
- Passing evidence remediates `sha256:54757c7b4fda7ca0ac3c677d72bc58f86726ba02a7ef38aa4054f13be8677e4d`.
- Exact conservative cumulative ledger: 473 baseline + 117 final-correction changed lines = **590/590 changed lines**; no task artifact changed because G2a was already persisted `[x]` and this is correction-only evidence.
- Rollback: revert only local-error provenance/inactivity injection, the final transport regressions, and this appendix; retain prior G2a behavior and all unrelated worktree changes.

## Work unit G2b � Pi-native stream lifecycle

- Authority/status: parent-selected `add-pi-provider-adapter` G2b at 9/11, hybrid repo-local with `C:/Github/Ordico/opencode-antigravity-guard` as the sole edit root and no action-context warnings. Runtime `G2b-pi-stream-lifecycle` was `proceed`; its token remains with the parent. No status, acquire, or settle action occurred.
- Completed and persisted: G2b is visibly `[x]` in `tasks.md`; H is the only unchecked implementation-owned row.
- Files: `packages/pi/src/stream.ts`, `packages/pi/src/stream.test.ts`, `tasks.md`, and this cumulative progress artifact.
- Behavior: G2b adapts injected G2a semantic callbacks into a real Pi `AssistantMessageEventStream`; it synchronously emits `start`, then ordered text events over one mutable assistant snapshot, replaces cumulative usage and recalculates zero/unpriced cost, maps stop/length, and guards terminal settlement, `stream.end`, cleanup, and post-terminal mutation. Caller abort settles an in-flight ignored transport once as `aborted`; concurrent streams retain independent output. G2a HTTP/project/framing/semantic behavior is unchanged.

### TDD Cycle Evidence � G2b

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/stream.test.ts` | 0 | Existing G2a transport suite passed: 1 file / 10 tests. |
| RED | same focused command | 1 | The new real Pi event-stream lifecycle test failed because `createPiLifecycleStream` did not exist. |
| GREEN | focused test; raw Pi `tsc --noEmit` | 0 | Minimal G2a callback adaptation passed 11 tests with ordered start/text/done, a shared partial, cumulative usage, and zero cost. |
| TRIANGULATE | focused test | 1 then 0 | An aborted hanging transport timed out before settlement; the external-abort finalizer then passed 12 tests, including isolated concurrent length completion. A distinct setup-error/late-rejection terminal test raised final coverage to 13. |
| REFACTOR | focused test; raw Pi `tsc --noEmit` | 0 | The centralized guarded finalizer retained all 13 focused tests; no further structural refactor was justified. |

## G2b verification, workload, and rollback

- Passed: core workspace build, focused stream suite (1 file / 13 tests), raw Pi typecheck, and `npm test` (52 files / 1,212 passed / 25 todo). Existing invalid-aspect-ratio diagnostics were non-failing.
- `git diff --check` passed for the G2b source/test/type surfaces before artifact persistence and is rerun with the final artifact diff below.
- Runtime harness: real Pi `AssistantMessageEventStream` iteration/result settlement over injected G2a semantic callbacks; external Antigravity transport is intentionally N/A because live access is unauthorized.
- Workload / PR boundary: feature-branch-chain G2b only, 145 source/test changed lines before task/progress persistence; 173 changed lines including the persisted checkbox and this evidence. No code was compressed to meet the 400-line cap.
- Rollback boundary: remove only the G2b lifecycle adapter/tests and this checkbox/progress evidence; retain G2a transport, G1/F/C2, and unrelated worktree dirt.
- Remaining implementation-owned row: `- [ ] Register exactly \`antigravity-guard\` with one public model \`antigravity-gemini-3.8-flash\`, wire it to \`gemini-3.8-flash\`, connect the completed OAuth and G2b stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->`


## G2b correction � synchronous setup containment and host-supported cancellation

- Authority/status consumed: the parent expressly selected `add-pi-provider-adapter` / G2b at `10/11`, apply-ready, repo-local only at `C:/Github/Ordico/opencode-antigravity-guard`, with no action-context warnings. Per instruction, no status, acquire, or settle action occurred.
- `createPiLifecycleStream()` now invokes `runTransport` from a promise microtask, so a synchronous setup throw cannot escape the factory: it returns the Pi stream immediately, which emits `start`, then one safe error terminal and settles its result.
- Pi 0.85.1's `AssistantMessageEventStream` exposes only `push`, `end`, async iteration, and `result`; its iterator has no provider-observable consumer-abandonment/cancellation callback. The G2b task wording and test name therefore now accurately cover the nearest host-supported contract: the caller-provided `SimpleStreamOptions.signal` aborts the owned transport signal and settles exactly once. External-abort cleanup remains covered and is not weakened.

### TDD Cycle Evidence � G2b correction

| Stage | Command | Exit | Evidence |
|---|---|---:|---|
| Safety net | `npx vitest run packages/pi/src/stream.test.ts` | 0 | 13 focused tests passed before correction. |
| RED | same focused command | 1 | New synchronous-throw fixture caused `createPiLifecycleStream()` to throw `CANARY-synchronous-setup` instead of returning a stream. |
| GREEN | same focused command | 0 | Deferring `runTransport` invocation through `Promise.resolve().then(...)` yielded 14/14, with ordered `start` then safe `error` and settled result. |
| TRIANGULATE | same focused command | 0 | The renamed external-abort fixture waits for transport start, proves the supplied transport signal becomes aborted, and preserves the independent concurrent completion. |
| REFACTOR | same focused command | 0 | The one-line promise boundary retained 14/14; no further refactor was warranted. |

## G2b correction verification, workload, and rollback

- Passed: focused stream tests (1 file / 14 tests), raw Pi `tsc --noEmit`, core workspace build, `npm test` (52 files / 1,213 passed / 25 todo), and scoped `git diff --check`.
- G2b's supplied cumulative ledger was 173 changed lines. This correction adds 27 source/test changed lines, for 200/400; the narrow task/evidence wording remains within the assigned G2b work-unit boundary.
- Persisted checkbox evidence: reread `tasks.md`; G2b remains visibly `[x]`, while H is the sole unchecked implementation-owned row.
- Rollback boundary: revert only the deferred transport invocation, synchronous-throw regression, caller-supplied-abort test wording/assertion, the narrow task terminology correction, and this appendix; retain G2a transport, the completed G2b lifecycle behavior, and unrelated worktree dirt.
- Remaining implementation-owned row: `- [ ] Register exactly \`antigravity-guard\` with one public model \`antigravity-gemini-3.8-flash\`, wire it to \`gemini-3.8-flash\`, connect the completed OAuth and G2b stream behaviors, prove package discovery from a packed consumer, and document the text-only operating limits. <!-- sdd-owner: implementation -->`
