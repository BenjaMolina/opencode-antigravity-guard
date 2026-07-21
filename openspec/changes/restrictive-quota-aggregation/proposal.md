# Proposal: Restrictive Quota Aggregation

## Intent
Change `aggregateQuota()` in `src/plugin/quota.ts` to pick the minimum (most restrictive) `remainingFraction` and its corresponding `resetTime` for each quota group (`claude`, `gemini-pro`, `gemini-flash`).

## Problem Statement
Picking the maximum quota fraction allows accounts with exhausted 5-hour limits (0%) to report non-zero quota (e.g. 26% weekly limit), bypassing `soft_quota_threshold_percent` protection and causing hard 429 rate limit errors.

## Target Scope
- `src/plugin/quota.ts`
- `src/plugin/quota.test.ts`

## Non-goals
- Modifying external API response structures.
- Changing account rotation strategies outside of quota calculation.
