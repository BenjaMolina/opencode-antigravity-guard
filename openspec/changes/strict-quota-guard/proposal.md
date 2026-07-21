# Proposal: Strict Quota Guard

## Intent

Prevent an account already over its soft-quota threshold from re-entering selection before its known quota reset time merely because cached quota data is stale. This reduces quota-exhaustion exposure; it does not guarantee account safety or make bans impossible.

## Scope

### In Scope
- Add a reset-time-based strict soft-quota lock in `src/plugin/accounts.ts`: retain exclusion while usage is over threshold and `resetTime` remains valid, including cache-TTL expiry.
- Change the default `soft_quota_threshold_percent` from 90 to 70 and synchronize `assets/antigravity.schema.json`.
- Add focused Vitest regressions for future-reset locking, expiry/re-entry, and multi-account rotation; assert the schema default.
- Verify existing Gemini 3.5 Flash, routing, all-blocked wait/error, and `agy_sdk.api_key_fallback` behavior remains unchanged.

### Out of Scope
- Broad upstream sync, proxy work, multi-provider authentication changes, or changes to current Gemini/routing support.
- Claims that this feature prevents bans or guarantees account safety.

## Capabilities

### New Capabilities
- `strict-quota-guard`: Exclude over-threshold accounts until a valid quota reset time passes, independent of cache freshness.

### Modified Capabilities
None; `openspec/specs/` has no existing capability specifications.

## Approach

Selectively port the proven reset-time guard into `isOverSoftQuotaThreshold()` rather than syncing upstream account or plugin code. Preserve fail-open behavior only when quota/reset metadata is absent or invalid. Keep `src/plugin.ts` control flow intact.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/plugin/accounts.ts` | Modified | Strict reset-time exclusion. |
| `src/plugin/accounts.test.ts` | Modified | Targeted selection regressions. |
| `src/plugin/config/schema.ts` | Modified | Default threshold: 70. |
| `assets/antigravity.schema.json` | Modified | Generated default alignment. |
| `src/plugin/config/schema.test.ts` | Modified | Default regression test. |
| `src/plugin.ts` | Verified | Preserve fallback and blocking flow. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Missing/invalid reset metadata cannot lock safely | Med | Fail open only in that case; test it. |
| External ToS/account enforcement risk | Med | State the boundary; reduce exposure, do not promise safety. |
| Scope creep/regression | Low | Single automatic PR; keep review change budget at 400 lines. |

## Rollback Plan

Revert the strict-lock helper, threshold/schema changes, and accompanying tests in the single PR. This restores current TTL-based selection without modifying credentials or account data.

## Dependencies

- Valid `resetTime` data supplied by the existing quota pipeline.

## Success Criteria

- [ ] An over-threshold account with a future valid reset remains excluded after cache TTL expiry and re-enters only after reset.
- [ ] Rotation selects an eligible account, or preserves the current all-blocked wait/error behavior.
- [ ] Gemini 3.5 Flash, routing, and `agy_sdk` fallback regressions pass; default/schema tests report 70.
