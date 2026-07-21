# Tasks: Restrictive Quota Aggregation

## Review Workload Forecast
- **Estimated Code Changes**: ~20 changed lines
- **Budget Risk**: Low (well within 400-line budget limit)
- **Chained PRs**: No, single-pr

## Tasks

### Task 1.1: Add Unit Tests Expecting Minimum Quota Aggregation (RED)
- Update/add test cases in `src/plugin/quota.test.ts` to assert that `aggregateQuota` selects the entry with the minimum `remainingFraction` and retains its corresponding `resetTime`.
- Verify that tests fail against current maximum/additive logic or un-updated state.

### Task 2.1: Update `aggregateQuota` to Select Minimum `remainingFraction` (GREEN)
- Update `aggregateQuota` in `src/plugin/quota.ts` so that `remainingFraction < existing.remainingFraction` triggers the entry update, selecting the lower fraction and its matching `resetTime`.

### Task 3.1: Run `npm test` and Verify Full Suite Passes
- Execute `npm test` to ensure all quota aggregation tests and existing tests pass cleanly.
