# Near-Threshold Active Quota Refresh Specification

## Purpose
Define candidate evaluation and active refresh triggers for multi-account selection when cached quota data is stale or approaching soft quota threshold.

## Requirements

### Requirement 1: Active Quota Refresh Triggers
- The plugin MUST check if an account candidate requires an active quota refresh before selecting it for request dispatch.
- An active refresh MUST be triggered if any of the following conditions are met:
  1. `cachedQuota` or `cachedQuotaUpdatedAt` is missing/null.
  2. Cache age `(now - cachedQuotaUpdatedAt)` exceeds `DEFAULT_SOFT_QUOTA_REFRESH_TTL_MS` (2 minutes / 120,000 ms).
  3. Cached quota usage falls in the near-threshold warning zone `[threshold - margin, threshold]` (e.g. 60%–70% for a 70% threshold).

### Requirement 2: Zero Latency for Healthy Accounts
- The plugin MUST NOT execute network quota refreshes for accounts with fresh cache (<2 min) and usage below the warning zone (<60% used / >40% remaining).

### Requirement 3: Fail-Closed Handling
- If an active quota refresh fails due to network error or API timeout, the plugin MUST retain existing cached quota values and enforce v1.1.3 conservative soft-quota locking logic.

## Scenarios

### Scenario 1: Candidate with stale cache (>2 min)
- **Given** an account candidate with `cachedQuotaUpdatedAt` 3 minutes ago and 50% usage
- **When** `needsActiveQuotaRefresh()` is evaluated
- **Then** it MUST return `true` and trigger `refreshSingleAccountQuota()`.

### Scenario 2: Candidate in near-threshold warning zone (65% used)
- **Given** an account candidate with fresh cache (30s ago) and 65% usage with a 70% soft threshold
- **When** `needsActiveQuotaRefresh()` is evaluated
- **Then** it MUST return `true` and trigger `refreshSingleAccountQuota()`.

### Scenario 3: Healthy candidate (50% used, fresh cache)
- **Given** an account candidate with fresh cache (30s ago) and 50% usage
- **When** `needsActiveQuotaRefresh()` is evaluated
- **Then** it MUST return `false` and dispatch the request without extra network calls.
