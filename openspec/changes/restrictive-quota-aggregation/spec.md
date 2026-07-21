# Specification: Restrictive Quota Aggregation

## Overview
This specification defines the aggregation behavior for `aggregateQuota()` in `src/plugin/quota.ts`. When evaluating models within the defined quota groups (`claude`, `gemini-pro`, `gemini-flash`), quota calculation must strictly adopt the most restrictive (minimum) quota state across evaluated models to prevent bypassing soft quota thresholds and triggering unexpected rate limits (429 errors).

## Specification Requirements

### 1. Minimum Quota Aggregation Strategy
- When iterating through model entries belonging to a specific group (`claude`, `gemini-pro`, or `gemini-flash`), if multiple models provide a `remainingFraction`, `aggregateQuota()` **MUST** choose the entry with the **MINIMUM** `remainingFraction`.
- In case of a tie between minimum quota entries, or when updating the aggregated group quota, the corresponding `resetTime` from that minimum quota entry **MUST** be retained alongside the minimum `remainingFraction`.

### 2. Requirement Scenarios

#### Scenario 1: Group with Exhausted Limit
- **Given** a group containing Model A with `remainingFraction: 0.26` and Model B with `remainingFraction: 0.00`.
- **Then** the resulting aggregated group `remainingFraction` **MUST** be `0.00`.
- **And** the aggregated group `resetTime` **MUST** match the `resetTime` associated with Model B (the minimum quota entry).

#### Scenario 2: Group with Differing Active Quota Limits
- **Given** a group containing Model A with `remainingFraction: 0.80` and Model B with `remainingFraction: 0.50`.
- **Then** the resulting aggregated group `remainingFraction` **MUST** be `0.50`.
- **And** the aggregated group `resetTime` **MUST** match the `resetTime` associated with Model B (the minimum quota entry).

