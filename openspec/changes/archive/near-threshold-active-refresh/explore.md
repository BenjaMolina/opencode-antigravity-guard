# Exploration: Near-Threshold Active Quota Refresh

## Current State
- `checkAccountsQuota()` was called only on manual CLI auth checks or when `shouldRefreshAllQuotas()` returned `true` (75%+ accounts blocked).
- Account candidate selection relied on in-memory `cachedQuota` and `cachedQuotaUpdatedAt`.
- During continuous usage, accounts near the soft threshold could continue sending requests after crossing the limit because local disk cache was not updated.

## Architectural Evaluation
1. **Trigger Condition**:
   - Evaluate `needsActiveQuotaRefresh(account, family, thresholdPercent, refreshTtlMs, nearThresholdMargin, model)`.
   - Returns `true` if cache is missing/null, age > 2 min (`120,000 ms`), or usage is in warning margin `[threshold - margin, threshold]` (e.g. 60%–70% for a 70% threshold).

2. **Pre-Execution Hook**:
   - In `plugin.ts` candidate selection loop, call `refreshSingleAccountQuota(account, accountManager, client, providerId)` before proceeding with request payload preparation.

3. **Fail-Closed Safety**:
   - If active refresh network fetch fails, retain previous cached values and enforce soft quota blocking if previously over threshold.
