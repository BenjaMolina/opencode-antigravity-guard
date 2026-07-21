## Exploration: strict-quota-guard

### Current State
- Local `main` is already aligned with `insign/opencode-antigravity-auth-updated` `main` (`f411f6d`), so the repo is on the requested current-model base.
- `src/plugin/accounts.ts` currently fails open in `isOverSoftQuotaThreshold()` when quota cache TTL expires or `cachedQuotaUpdatedAt` is missing, even if the cached quota group still has a future `resetTime`. Because sticky, round-robin, hybrid, `areAllAccountsOverSoftQuota()`, and `getMinWaitTimeForSoftQuota()` all depend on that helper, an over-threshold account can leak back into rotation before reset.
- `src/plugin.ts` already has the right outer control flow: it computes soft-quota TTL, selects accounts through `AccountManager`, tries `agy_sdk.api_key_fallback` before soft-quota blocking, and waits/errors via `getMinWaitTimeForSoftQuota()` when every account is over threshold.
- Current-model support is already present and should remain untouched: `src/plugin/config/models.ts` includes Gemini 3 / 3.5 Flash entries, `src/plugin/api-key.ts` and `src/plugin/api-key.test.ts` explicitly support `gemini-3.5-flash` and `antigravity-gemini-3.5-flash`, and `src/plugin/quota.ts` already preserves Gemini flash/pro reset metadata consumed by soft-quota logic.

### Affected Areas
- `src/plugin/accounts.ts` — bug location for TTL fail-open and the place to enforce reset-time-based strict exclusion.
- `src/plugin/accounts.test.ts` — needs regression coverage for strict lock, TTL expiry with future reset, and multi-account rotation exclusion semantics.
- `src/plugin/config/schema.ts` — default `soft_quota_threshold_percent` changes from `90` to `70`.
- `assets/antigravity.schema.json` — generated user-facing schema must reflect the new default.
- `src/plugin/config/schema.test.ts` — should assert the new default so config/schema drift is caught.
- `src/plugin.ts` — verify-only boundary: preserve existing `agy_sdk` fallback and all-accounts-over-soft-quota wait/block flow without behavior expansion.

### Approaches
1. **Selective strict-lock port** — Port only the proven anti-ban behavior into the existing insign-aligned codebase.
   - Pros: Small blast radius; preserves current Gemini 3.5 Flash/current-model support and existing `agy_sdk` behavior; likely stays well under the 400-line review budget.
   - Cons: Requires discipline to avoid accidental upstream sync creep; still depends on valid upstream `resetTime` metadata.
   - Effort: Low

2. **Broader upstream sync from `andyvandaric/opencode-ag-auth`** — Pull larger account/quota/plugin slices to mirror the source fork more directly.
   - Pros: Closer textual parity with the reference fork.
   - Cons: Unnecessary risk; likely collides with this repo's newer account selection, fallback, and current-model work; much more likely to exceed the approved single-PR budget.
   - Effort: High

### Recommendation
Use **Selective strict-lock port**. Limit the code change to `isOverSoftQuotaThreshold()` plus the config default/schema/test updates. Do NOT wholesale copy `accounts.ts` or `plugin.ts` from `andyvandaric/opencode-ag-auth`; this repo already carries newer insign-based behavior such as refresh-token-based quota cache updates, tried-account exclusion, current-model routing, and existing `agy_sdk` fallback handling that should remain intact.

### Risks
- If quota data is over threshold but has no valid `resetTime`, strict exclusion still cannot be guaranteed; the safest boundary is to keep fail-open only for missing/invalid reset metadata, not for TTL expiry alone.
- A wider-than-needed port could regress `agy_sdk` routing or Gemini 3 / 3.5 Flash support, because those behaviors live outside the soft-quota helper.
- Schema/docs/default drift is easy here: `schema.ts`, generated JSON schema, and any user-facing docs must stay aligned.
- Direct coverage for `areAllAccountsOverSoftQuota()` is still thin; the change should add behavior-level tests that prove no account re-enters rotation before reset.

### Ready for Proposal
Yes — proceed with a minimal proposal scoped to `accounts.ts` strict lock, default threshold `70`, and targeted regression coverage only. Tell the user this should remain within the single-PR 400-line budget if the change stays focused and avoids broader upstream sync.
