# Exploration: Restrictive Quota Aggregation

## Overview
This document explores the current quota aggregation strategy in `src/plugin/quota.ts` (`aggregateQuota`) and analyzes the impact of switching from an optimistic aggregation strategy to a restrictive strategy.

## 1. Current Implementation in `src/plugin/quota.ts`

In `src/plugin/quota.ts`, model quota entries returned by Antigravity endpoints are aggregated into broader quota groups (`claude`, `gemini-pro`, `gemini-flash`) via `aggregateQuota`:

```typescript
function aggregateQuota(models?: Record<string, FetchAvailableModelEntry>): QuotaSummary {
  const groups: Partial<Record<QuotaGroup, QuotaGroupSummary>> = {};
  // ...
  for (const [modelName, entry] of Object.entries(models)) {
    const group = classifyQuotaGroup(modelName, entry.displayName ?? entry.modelName);
    if (!group) continue;
    // ...
    const existing = groups[group];
    const nextCount = (existing?.modelCount ?? 0) + 1;
    const useCurrentQuota =
      remainingFraction !== undefined &&
      (existing?.remainingFraction === undefined || remainingFraction > existing.remainingFraction);
    const nextRemaining = useCurrentQuota ? remainingFraction : existing?.remainingFraction;
    const nextResetTime = useCurrentQuota
      ? resetTime
      : existing?.resetTime ?? (resetTimestamp === null ? undefined : resetTime);

    groups[group] = {
      remainingFraction: nextRemaining,
      resetTime: nextResetTime,
      modelCount: nextCount,
    };
  }

  return { groups, modelCount: totalCount };
}
```

### Group Classification
Model entries are categorized into three target `QuotaGroup` strings:
- **`claude`**: Triggered if the model name or display name contains `"claude"`.
- **`gemini-flash`**: Triggered for Gemini 3 / Gemini 3.5 variants where `getModelFamily(modelName)` returns `"gemini-flash"`.
- **`gemini-pro`**: Triggered for Gemini 3 / Gemini 3.5 variants where `getModelFamily(modelName)` returns `"gemini-pro"`.

## 2. Why `remainingFraction > existing.remainingFraction` is Optimistic

Currently, `aggregateQuota` selects the variant with the **maximum** `remainingFraction` (`remainingFraction > existing.remainingFraction`).

### Analysis & Implications
1. **Optimistic Bias**: If one variant within a family (e.g. `gemini-3.5-flash-low`) has `1.0` quota remaining while another variant in the same family (e.g. `gemini-3-flash-agent`) has `0.0` remaining, the aggregated group summary reports `1.0` (100% remaining).
2. **System Behavior**:
   - **Display / UI**: Displays a high or healthy quota fraction for the entire family.
   - **Account Health & Routing**: If routing falls back or targets specific variants that are actually exhausted (0.0 quota), requests using those variants will fail unexpectedly even though the aggregated summary claimed the account had remaining quota.
3. **Contrast with Restrictive Approach**:
   - A restrictive approach would take the **minimum** `remainingFraction` (`remainingFraction < existing.remainingFraction`), reflecting the bottleneck or most constrained model variant in that family.
   - Alternatively, taking the minimum ensures the system doesn't falsely report an account as fully healthy when essential variants within the group are exhausted.

## 3. Existing Unit Tests (`src/plugin/quota.test.ts`)

`src/plugin/quota.test.ts` currently verifies the optimistic behavior:
- Tests that `aggregateQuota` chooses the best available Gemini variant (`remainingFraction: 1`) over an exhausted variant (`remainingFraction: 0`).
- Tests that the reset time of the chosen variant (the best variant) is retained.

## 4. Considerations for Switching to Restrictive Aggregation

If the strategy is updated from optimistic (`Math.max` / `>`) to restrictive (`Math.min` / `<`):
- `quota.ts` logic will need to update `useCurrentQuota` logic to prioritize lower `remainingFraction` values.
- `quota.test.ts` test expectations must be updated to expect the minimum `remainingFraction` and its corresponding reset timestamp.
- Impact on account selection / cooldown mechanisms must be considered to ensure accounts are not prematurely marked as usable when critical models are exhausted.
