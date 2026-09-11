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
