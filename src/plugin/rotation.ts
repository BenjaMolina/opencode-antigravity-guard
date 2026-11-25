/**
 * Account Rotation System
 *
 * Re-export facade over `@benjamolina/antigravity-guard-core`.
 */
export {
  DEFAULT_HEALTH_SCORE_CONFIG,
  DEFAULT_TOKEN_BUCKET_CONFIG,
  HealthScoreTracker,
  TokenBucketTracker,
  addJitter,
  getHealthTracker,
  getTokenTracker,
  initHealthTracker,
  initTokenTracker,
  randomDelay,
  selectHybridAccount,
  sortByLruWithHealth,
} from "@benjamolina/antigravity-guard-core";
export type {
  AccountWithMetrics,
  HealthScoreConfig,
  TokenBucketConfig,
} from "@benjamolina/antigravity-guard-core";
