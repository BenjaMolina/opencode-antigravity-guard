# Design: Restrictive Quota Aggregation

## Overview
This design document details the technical approach for adopting a restrictive (minimum quota fraction) aggregation strategy in aggregateQuota() inside src/plugin/quota.ts and updating unit test assertions in src/plugin/quota.test.ts.

## Technical Approach

### 1. Technical approach in src/plugin/quota.ts
In aggregateQuota(models):
Change condition:
```typescript
const useCurrentQuota =
  remainingFraction !== undefined &&
  (existing?.remainingFraction === undefined || remainingFraction < existing.remainingFraction);
```
This ensures that lower quota fractions overwrite higher ones for the same QuotaGroup.

#### Detailed Behavior:
- When iterating over model entries belonging to a group (claude, gemini-pro, gemini-flash), any model with a defined remainingFraction lower than the currently accumulated existing.remainingFraction will trigger useCurrentQuota = true.
- When useCurrentQuota is true, the aggregated group summary is updated with the new lower remainingFraction and its matching resetTime.
- If remainingFraction is equal to or greater than the existing minimum, the existing lower quota fraction and its corresponding reset time are preserved.

### 2. Update unit test assertions in src/plugin/quota.test.ts
Update assertions in src/plugin/quota.test.ts to verify that:
- When a group receives multiple model entries (e.g. one with remainingFraction: 1 and another with remainingFraction: 0), the aggregate result reflects the lowest remainingFraction (0) and its corresponding resetTime.
- Test cases validating reset time retention verify that the resetTime associated with the model supplying the lowest remainingFraction is retained.

## Affected Files
- src/plugin/quota.ts
- src/plugin/quota.test.ts
