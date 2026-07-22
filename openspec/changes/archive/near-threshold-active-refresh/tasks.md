# Tasks: Near-Threshold Active Quota Refresh

## Implementation Tasks

- [x] 1.1 Add active quota refresh constants in `src/constants.ts` (`DEFAULT_SOFT_QUOTA_REFRESH_TTL_MS`, `DEFAULT_SOFT_QUOTA_NEAR_THRESHOLD_MARGIN`).
- [x] 1.2 Implement `needsActiveQuotaRefresh()` in `src/plugin/accounts.ts` and export helper method on `AccountManager`.
- [x] 1.3 Implement `refreshSingleAccountQuota()` in `src/plugin/quota.ts`.
- [x] 1.4 Integrate candidate active check into `src/plugin.ts` request processing loop.
- [x] 1.5 Add unit test suite for `needsActiveQuotaRefresh()` in `src/plugin/accounts.test.ts`.
- [x] 1.6 Verify full test suite passes with `npm test` and code compiles with `npm run build`.
