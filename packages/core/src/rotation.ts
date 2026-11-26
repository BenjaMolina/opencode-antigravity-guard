/**
 * Account Rotation System
 *
 * Implements advanced account selection algorithms:
 * - Health Score: Track account wellness based on success/failure
 * - LRU Selection: Prefer accounts with longest rest periods
 * - Jitter: Add random variance to break predictable patterns
 *
 * Used by 'hybrid' strategy for improved ban prevention and load distribution.
 */

export interface HealthScoreConfig {
  /** Initial score for new accounts (default: 70) */
  initial: number
  /** Points added on successful request (default: 1) */
  successReward: number
  /** Points removed on rate limit (default: -10) */
  rateLimitPenalty: number
  /** Points removed on failure (auth, network, etc.) (default: -20) */
  failurePenalty: number
  /** Points recovered per hour of rest (default: 2) */
  recoveryRatePerHour: number
  /** Minimum score to be considered usable (default: 50) */
  minUsable: number
  /** Maximum score cap (default: 100) */
  maxScore: number
}

export const DEFAULT_HEALTH_SCORE_CONFIG: HealthScoreConfig = {
  initial: 70,
  successReward: 1,
  rateLimitPenalty: -10,
  failurePenalty: -20,
  recoveryRatePerHour: 2,
  minUsable: 50,
  maxScore: 100,
}

interface HealthScoreState {
  score: number
  lastUpdated: number
  lastSuccess: number
  consecutiveFailures: number
}

/**
 * Tracks health scores for accounts.
 * Higher score = healthier account = preferred for selection.
 */
export class HealthScoreTracker {
  private readonly scores = new Map<number, HealthScoreState>()
  private readonly config: HealthScoreConfig

  constructor(config: Partial<HealthScoreConfig> = {}) {
    this.config = { ...DEFAULT_HEALTH_SCORE_CONFIG, ...config }
  }

  getScore(accountIndex: number): number {
    const state = this.scores.get(accountIndex)
    if (!state) {
      return this.config.initial
    }

    const now = Date.now()
    const hoursSinceUpdate = (now - state.lastUpdated) / (1000 * 60 * 60)
    const recoveredPoints = Math.floor(hoursSinceUpdate * this.config.recoveryRatePerHour)

    return Math.min(this.config.maxScore, state.score + recoveredPoints)
  }

  recordSuccess(accountIndex: number): void {
    const now = Date.now()
    const current = this.getScore(accountIndex)

    this.scores.set(accountIndex, {
      score: Math.min(this.config.maxScore, current + this.config.successReward),
      lastUpdated: now,
      lastSuccess: now,
      consecutiveFailures: 0,
    })
  }

  recordRateLimit(accountIndex: number): void {
    const now = Date.now()
    const state = this.scores.get(accountIndex)
    const current = this.getScore(accountIndex)

    this.scores.set(accountIndex, {
      score: Math.max(0, current + this.config.rateLimitPenalty),
      lastUpdated: now,
      lastSuccess: state?.lastSuccess ?? 0,
      consecutiveFailures: (state?.consecutiveFailures ?? 0) + 1,
    })
  }

  recordFailure(accountIndex: number): void {
    const now = Date.now()
    const state = this.scores.get(accountIndex)
    const current = this.getScore(accountIndex)

    this.scores.set(accountIndex, {
      score: Math.max(0, current + this.config.failurePenalty),
      lastUpdated: now,
      lastSuccess: state?.lastSuccess ?? 0,
      consecutiveFailures: (state?.consecutiveFailures ?? 0) + 1,
    })
  }

  isUsable(accountIndex: number): boolean {
    return this.getScore(accountIndex) >= this.config.minUsable
  }

  getConsecutiveFailures(accountIndex: number): number {
    return this.scores.get(accountIndex)?.consecutiveFailures ?? 0
  }

  reset(accountIndex: number): void {
    this.scores.delete(accountIndex)
  }

  getSnapshot(): Map<number, { score: number; consecutiveFailures: number }> {
    const result = new Map<number, { score: number; consecutiveFailures: number }>()
    for (const [index] of this.scores) {
      result.set(index, {
        score: this.getScore(index),
        consecutiveFailures: this.getConsecutiveFailures(index),
      })
    }
    return result
  }
}

export function addJitter(baseMs: number, jitterFactor = 0.3): number {
  const jitterRange = baseMs * jitterFactor
  const jitter = (Math.random() * 2 - 1) * jitterRange
  return Math.max(0, Math.round(baseMs + jitter))
}

export function randomDelay(minMs: number, maxMs: number): number {
  return Math.round(minMs + Math.random() * (maxMs - minMs))
}

export interface AccountWithMetrics {
  index: number
  lastUsed: number
  healthScore: number
  isRateLimited: boolean
  isCoolingDown: boolean
}

export function sortByLruWithHealth(
  accounts: AccountWithMetrics[],
  minHealthScore = 50,
): AccountWithMetrics[] {
  return accounts
    .filter((acc) => !acc.isRateLimited && !acc.isCoolingDown && acc.healthScore >= minHealthScore)
    .sort((a, b) => {
      const lruDiff = a.lastUsed - b.lastUsed
      if (lruDiff !== 0) return lruDiff
      return b.healthScore - a.healthScore
    })
}

const STICKINESS_BONUS = 150
const SWITCH_THRESHOLD = 100

export function selectHybridAccount(
  accounts: AccountWithMetrics[],
  tokenTracker: TokenBucketTracker,
  currentAccountIndex: number | null = null,
  minHealthScore = 50,
): number | null {
  const candidates = accounts
    .filter(
      (acc) =>
        !acc.isRateLimited &&
        !acc.isCoolingDown &&
        acc.healthScore >= minHealthScore &&
        tokenTracker.hasTokens(acc.index),
    )
    .map((acc) => ({
      ...acc,
      tokens: tokenTracker.getTokens(acc.index),
    }))

  if (candidates.length === 0) {
    return null
  }

  const maxTokens = tokenTracker.getMaxTokens()
  const scored = candidates
    .map((acc) => {
      const baseScore = calculateHybridScore(acc, maxTokens)
      const stickinessBonus = acc.index === currentAccountIndex ? STICKINESS_BONUS : 0
      return {
        index: acc.index,
        baseScore,
        score: baseScore + stickinessBonus,
        isCurrent: acc.index === currentAccountIndex,
      }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best) {
    return null
  }

  const currentCandidate = scored.find((s) => s.isCurrent)
  if (currentCandidate && !best.isCurrent) {
    const advantage = best.baseScore - currentCandidate.baseScore
    if (advantage < SWITCH_THRESHOLD) {
      return currentCandidate.index
    }
  }

  return best.index
}

interface AccountWithTokens extends AccountWithMetrics {
  tokens: number
}

function calculateHybridScore(account: AccountWithTokens, maxTokens: number): number {
  const healthComponent = account.healthScore * 2
  const tokenComponent = (account.tokens / maxTokens) * 100 * 5
  const secondsSinceUsed = (Date.now() - account.lastUsed) / 1000
  const freshnessComponent = Math.min(secondsSinceUsed, 3600) * 0.1
  return Math.max(0, healthComponent + tokenComponent + freshnessComponent)
}

export interface TokenBucketConfig {
  maxTokens: number
  regenerationRatePerMinute: number
  initialTokens: number
}

export const DEFAULT_TOKEN_BUCKET_CONFIG: TokenBucketConfig = {
  maxTokens: 50,
  regenerationRatePerMinute: 6,
  initialTokens: 50,
}

interface TokenBucketState {
  tokens: number
  lastUpdated: number
}

export class TokenBucketTracker {
  private readonly buckets = new Map<number, TokenBucketState>()
  private readonly config: TokenBucketConfig

  constructor(config: Partial<TokenBucketConfig> = {}) {
    this.config = { ...DEFAULT_TOKEN_BUCKET_CONFIG, ...config }
  }

  getTokens(accountIndex: number): number {
    const state = this.buckets.get(accountIndex)
    if (!state) {
      return this.config.initialTokens
    }

    const now = Date.now()
    const minutesSinceUpdate = (now - state.lastUpdated) / (1000 * 60)
    const recoveredTokens = minutesSinceUpdate * this.config.regenerationRatePerMinute

    return Math.min(this.config.maxTokens, state.tokens + recoveredTokens)
  }

  hasTokens(accountIndex: number, cost = 1): boolean {
    return this.getTokens(accountIndex) >= cost
  }

  consume(accountIndex: number, cost = 1): boolean {
    const current = this.getTokens(accountIndex)
    if (current < cost) {
      return false
    }

    this.buckets.set(accountIndex, {
      tokens: current - cost,
      lastUpdated: Date.now(),
    })
    return true
  }

  refund(accountIndex: number, amount = 1): void {
    const current = this.getTokens(accountIndex)
    this.buckets.set(accountIndex, {
      tokens: Math.min(this.config.maxTokens, current + amount),
      lastUpdated: Date.now(),
    })
  }

  getMaxTokens(): number {
    return this.config.maxTokens
  }
}

let globalTokenTracker: TokenBucketTracker | null = null

export function getTokenTracker(): TokenBucketTracker {
  if (!globalTokenTracker) {
    globalTokenTracker = new TokenBucketTracker()
  }
  return globalTokenTracker
}

export function initTokenTracker(config: Partial<TokenBucketConfig>): TokenBucketTracker {
  globalTokenTracker = new TokenBucketTracker(config)
  return globalTokenTracker
}

let globalHealthTracker: HealthScoreTracker | null = null

export function getHealthTracker(): HealthScoreTracker {
  if (!globalHealthTracker) {
    globalHealthTracker = new HealthScoreTracker()
  }
  return globalHealthTracker
}

export function initHealthTracker(config: Partial<HealthScoreConfig>): HealthScoreTracker {
  globalHealthTracker = new HealthScoreTracker(config)
  return globalHealthTracker
}
