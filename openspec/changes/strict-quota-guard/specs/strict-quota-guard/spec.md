# Strict Quota Guard Specification

## Purpose

Define selection behavior for accounts whose observed quota exceeds the configured soft threshold. This guard reduces quota-exhaustion exposure; it MUST NOT be represented as a guarantee of account safety or external-service enforcement outcomes.

## Requirements

### Requirement: Reset-Time Soft-Quota Lock

The system MUST exclude an account when its observed quota is at or above the configured soft threshold and it has a valid reset time in the future. The exclusion MUST remain effective after cached quota data expires and until that reset time passes.

#### Scenario: Future reset survives cache expiry

- GIVEN an account is at or above the soft threshold with a valid future reset time
- WHEN its cached quota data has expired and the account is considered for selection
- THEN the system MUST continue to exclude that account

#### Scenario: Reset permits re-entry

- GIVEN an account was excluded by a valid future reset time
- WHEN the reset time has passed and the account is considered for selection
- THEN the system MUST allow it to be considered under the normal quota-selection rules

### Requirement: Account Selection and Metadata Boundary

The system MUST select an eligible account when a reset-locked account and an eligible account are both available. It MUST fail open for this strict lock only when the account is over threshold but reset metadata is missing or invalid. The system MUST preserve existing all-blocked wait or error behavior when no account is eligible.

#### Scenario: Rotation bypasses a reset-locked account

- GIVEN one account is reset-locked and another account is eligible
- WHEN account selection runs
- THEN the system MUST select the eligible account rather than the reset-locked account

#### Scenario: Missing or invalid reset metadata

- GIVEN an account is over threshold and its reset metadata is missing or invalid
- WHEN the account is considered for the strict lock
- THEN the strict lock MUST NOT exclude the account solely on that metadata

#### Scenario: All accounts remain unavailable

- GIVEN every available account is excluded by existing eligibility rules or a valid reset-time lock
- WHEN account selection runs
- THEN the system MUST retain the existing all-blocked wait or error outcome

### Requirement: Soft-Quota Default and Schema Consistency

The default `soft_quota_threshold_percent` MUST be 70. The distributable configuration schema MUST declare the same default, and both defaults MUST be observable without user configuration.

#### Scenario: Default is applied

- GIVEN no soft-quota threshold is configured
- WHEN configuration is resolved
- THEN the effective threshold MUST be 70 percent

#### Scenario: Schema advertises the default

- GIVEN a consumer reads the distributable configuration schema
- WHEN it inspects `soft_quota_threshold_percent`
- THEN the declared default MUST be 70

### Requirement: Unrelated Routing Behavior Preservation

The change MUST NOT alter Gemini 3.5 Flash support, existing model-routing behavior, or `agy_sdk.api_key_fallback` behavior. It MUST NOT introduce broader authentication, provider, or model-support changes.

#### Scenario: Existing routing and fallback regressions

- GIVEN the existing Gemini 3.5 Flash, routing, and `agy_sdk` fallback regression cases
- WHEN they execute with the strict quota guard enabled
- THEN their pre-existing outcomes MUST remain unchanged
