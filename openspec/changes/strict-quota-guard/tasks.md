# Tasks: Strict Quota Guard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 140-200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Deliver strict lock, default sync, and regressions together | PR 1 | `npm test -- src/plugin/accounts.test.ts src/plugin/config/schema.test.ts` | `N/A` - behavior is covered by Vitest plus later verification commands | `src/plugin/accounts.ts`, `src/plugin/accounts.test.ts`, `src/plugin/config/schema.ts`, `src/plugin/config/schema.test.ts`, `assets/antigravity.schema.json` |

## Phase 1: RED Regression Coverage

- [x] 1.1 Add RED cases in `src/plugin/accounts.test.ts` for stale cached quota + future `resetTime`, expired `resetTime`, and missing/invalid reset metadata.
- [x] 1.2 Add RED selection cases in `src/plugin/accounts.test.ts` proving rotation skips a reset-locked account and all-blocked wait/error still uses existing outcomes.
- [x] 1.3 Add RED default assertions in `src/plugin/config/schema.test.ts` for runtime config default `70` and distributable schema default `70`.

## Phase 2: GREEN Behavior Change

- [x] 2.1 Update `src/plugin/accounts.ts` so `isOverSoftQuotaThreshold()` returns locked for over-threshold accounts with a valid future `resetTime` before TTL freshness checks.
- [x] 2.2 Preserve fail-open behavior in `src/plugin/accounts.ts` when reset metadata is missing, malformed, or already elapsed, while keeping current fresh-cache threshold behavior.
- [x] 2.3 Change `soft_quota_threshold_percent` default to `70` in `src/plugin/config/schema.ts` and keep `100` as the disable-protection value.

## Phase 3: Synchronization and Refactor

- [x] 3.1 Regenerate `assets/antigravity.schema.json` via `npm run build:schema`; do not hand-edit generated schema structure.
- [x] 3.2 Refactor touched tests/helpers in `src/plugin/accounts.test.ts` only as needed to keep fake-time coverage readable without changing asserted behavior.

## Phase 4: Focused Verification

- [x] 4.1 Run `npm test -- src/plugin/accounts.test.ts src/plugin/config/schema.test.ts` and capture the strict-lock/default-sync evidence.
- [x] 4.2 Run unchanged-behavior regressions covering quota fallback, `agy_sdk.api_key_fallback`, routing, request flow, model resolver/models, and Gemini 3.5 Flash support.
- [x] 4.3 Run `npm test`, `npm run typecheck`, and `npm run build`; record any skipped environment-backed E2E as optional verification only.
