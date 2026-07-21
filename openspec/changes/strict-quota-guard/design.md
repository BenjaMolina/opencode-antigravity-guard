# Design: Strict Quota Guard

## Technical Approach

Apply a selective change to the current insign-aligned account helper, not an upstream file sync. `isOverSoftQuotaThreshold()` will treat a valid future quota reset as a lock that outranks cache freshness. Existing selection strategies, plugin routing, authentication, recovery, and model resolution remain unchanged. The configuration default moves from 90 to 70, with the generated schema kept synchronized.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Minimal helper change | Relies on existing quota metadata, but has the smallest blast radius | **Chosen.** Every selection strategy and all-blocked calculation already delegates to the helper, so one ordered predicate fixes behavior consistently without replacing newer insign logic. |
| Broader upstream port | Closer textual parity, but risks fallback, routing, and current-model regressions | Rejected; it adds unrelated change and review cost. |
| Persist a separate lock | Makes locking explicit, but introduces migration and stale-state cleanup | Rejected; `cachedQuota[*].resetTime` already persists and is the authoritative boundary. |

## Decision Order and Data Flow

`isOverSoftQuotaThreshold()` will evaluate in this exact order:

1. Return `false` when protection is disabled (`thresholdPercent >= 100`) or quota/group/`remainingFraction` metadata is absent.
2. Resolve the group through existing `resolveQuotaGroup(family, model)`, clamp the fraction, and return `false` when usage is below threshold.
3. Parse `resetTime` once. If it is finite and strictly later than `Date.now()`, return `true` **before** reading `cachedQuotaUpdatedAt` or cache age.
4. Otherwise apply the existing freshness boundary: missing `cachedQuotaUpdatedAt` or age beyond TTL returns `false`; fresh over-threshold data returns `true`.

Thus missing, malformed, or elapsed reset metadata never creates a strict lock. Fresh quota data still follows current threshold behavior; after reset, the account re-enters normal TTL-based evaluation.

    quota cache → group/usage → future reset? ─yes→ exclude
                               │ no
                               ↓
                         cache fresh? ─yes→ exclude
                               │ no
                               ↓
                             eligible

Sticky, round-robin, and hybrid selection already filter through this predicate, so a locked account is skipped and another eligible account is selected. `areAllAccountsOverSoftQuota()` and `getMinWaitTimeForSoftQuota()` consume the same result; when all accounts are locked, `src/plugin.ts` continues to try `agy_sdk.api_key_fallback` first, then either waits until the minimum reset or returns the existing blocked response when the wait is unknown or exceeds the configured maximum. Model-specific grouping and Gemini 3.5 Flash routing are untouched.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/plugin/accounts.ts` | Modify | Reorder strict reset lock ahead of TTL checks. |
| `src/plugin/accounts.test.ts` | Modify | Add fake-time RED regressions for stale future reset, reset expiry, invalid/missing reset, rotation, and all-blocked wait calculation. |
| `src/plugin/config/schema.ts` | Modify | Set schema and `DEFAULT_CONFIG` threshold defaults to 70. |
| `assets/antigravity.schema.json` | Regenerate | Run `npm run build:schema`; do not hand-edit generated structure. |
| `src/plugin/config/schema.test.ts` | Modify | Assert runtime and distributable defaults are 70. |
| `src/plugin.ts` and existing routing/fallback tests | Verify only | Prove control flow and model behavior remain unchanged. |

## Interfaces / Contracts

No public type, API, storage-version, credential, or routing contract changes. The observable configuration default changes to `70`; explicit values, including `100` to disable protection, retain current semantics.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (RED first) | Ordering and metadata boundary | Vitest fake clocks; first prove stale+future remains blocked, then reset/past/invalid/missing cases and fresh-cache compatibility. |
| Integration | Multi-account and all-blocked outcomes | Exercise `AccountManager` selection and minimum wait with locked and eligible pools across existing strategies. |
| Regression | Schema, fallback, and routing | Run focused accounts/schema tests, existing `quota-fallback`, API-key, model resolver/models, request, and Gemini 3.5 Flash tests; then `npm test`, `npm run typecheck`, and `npm run build`. Environment-backed E2E is optional and recorded if unavailable. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is changed. Existing routing is verification-only; schema generation uses the established build command.

## Migration / Rollout

No data migration or feature flag is required. Roll out as one reviewable PR; expected authored change is under 200 lines and therefore low risk against the 400-line budget. Rollback reverts the helper ordering, both defaults, regenerated schema, and tests; persisted accounts and credentials are unaffected.

## Open Questions

None.
