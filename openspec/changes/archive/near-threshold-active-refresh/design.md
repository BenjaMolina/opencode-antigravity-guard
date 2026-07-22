# Design: Near-Threshold Active Quota Refresh

## Architecture Overview

```
[Request Interceptor (plugin.ts)]
         │
         ▼
[Select Account Candidate]
         │
         ▼
[needsActiveQuotaRefresh()] ────── (False: Healthy & Fresh) ──► [Dispatch Request]
         │ (True)
         ▼
[refreshSingleAccountQuota()]
         │
         ▼
[isAccountOverSoftQuota()] ────── (True: Over Threshold) ──► [Skip & Pick Next Account]
         │ (False)
         ▼
[Dispatch Request]
```

## Detailed Component Design

### 1. `src/constants.ts`
- `DEFAULT_SOFT_QUOTA_REFRESH_TTL_MS = 120000` (2 minutes)
- `DEFAULT_SOFT_QUOTA_NEAR_THRESHOLD_MARGIN = 10` (10%)

### 2. `src/plugin/accounts.ts`
- `needsActiveQuotaRefresh(account, family, thresholdPercent, refreshTtlMs, nearThresholdMargin, model)`
  - Evaluates cache existence, timestamp age, and warning zone status.

### 3. `src/plugin/quota.ts`
- `refreshSingleAccountQuota(account, accountManager, client, providerId)`
  - Performs single-account `checkAccountsQuota([accountMetadata])` call.
  - Updates `accountManager.updateQuotaCache()` upon HTTP 200 result.

### 4. `src/plugin.ts`
- Intercepts account candidate before token refresh / request dispatch.
- Performs active refresh if `needsActiveQuotaRefresh()` returns `true`.
- Re-checks `isAccountOverSoftQuota()` post-refresh to ensure over-threshold candidates are skipped.
