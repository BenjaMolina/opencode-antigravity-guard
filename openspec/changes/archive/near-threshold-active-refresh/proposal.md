# Proposal: Near-Threshold Active Quota Refresh

## Intent
Eliminate the soft quota guard blind spot when local cached quota in `antigravity-accounts.json` becomes stale during active chat sessions by performing lightweight, 0-token active quota checks (`fetchAvailableModels`) for candidate accounts.

## Problem Statement
Currently, `checkAccountsQuota()` runs only during manual CLI commands (`opencode auth login`) or when 75%+ of all accounts in the pool are already marked blocked (`shouldRefreshAllQuotas`). During normal usage, the plugin relies exclusively on `account.cachedQuota`. If an account's quota drops while making API calls, the plugin remains unaware until cache expires or a global refresh triggers.

## Target Scope
- `src/constants.ts`
- `src/plugin/accounts.ts`
- `src/plugin/quota.ts`
- `src/plugin.ts`
- `src/plugin/accounts.test.ts`

## Non-goals
- Modifying external Antigravity API response schemas.
- Adding mandatory network calls for healthy accounts with fresh cache.
