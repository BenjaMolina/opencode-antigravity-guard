import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  HealthScoreTracker,
  ProactiveRefreshQueue,
  TokenBucketTracker,
  accessTokenExpired,
  calculateBackoffMs,
  computeSoftQuotaCacheTtlMs,
  createAntigravityVersionState,
  extractVerificationErrorDetails,
  formatRefreshParts,
  loadSharedGuardConfig,
  needsActiveQuotaRefresh,
  parseRateLimitReason,
  parseRefreshParts,
  resolveQuotaGroup,
  selectHybridAccount,
  type ManagedAccount,
  type OAuthAuthDetails,
  type RefreshableAccountStore,
} from "./index.ts"

function makeInMemoryStore(accounts: ManagedAccount[]): RefreshableAccountStore {
  return {
    getAccounts: () => accounts,
    toAuthDetails: (acc) => ({
      type: "oauth",
      refresh: formatRefreshParts(acc.parts),
      access: acc.access,
      expires: acc.expires,
    }),
    updateFromAuth: (acc, auth: OAuthAuthDetails) => {
      acc.access = auth.access
      acc.expires = auth.expires
      acc.parts = parseRefreshParts(auth.refresh)
    },
    saveToDisk: async () => undefined,
  }
}

describe("Phase 2 core rotation, account helpers, and ProactiveRefreshQueue (S1, S3)", () => {
  it("supports hybrid selection, verification URL extraction, rate-limit backoff helpers, and trimmed version/config isolation", () => {
    expect(parseRefreshParts("rtok|proj-1|managed-1")).toEqual({
      refreshToken: "rtok",
      projectId: "proj-1",
      managedProjectId: "managed-1",
    })
    expect(formatRefreshParts({ refreshToken: "rtok", projectId: "proj-1", managedProjectId: "managed-1" })).toBe(
      "rtok|proj-1|managed-1",
    )
    expect(accessTokenExpired({ access: "a", expires: Date.now() + 5_000 })).toBe(true)
    expect(accessTokenExpired({ access: "a", expires: Date.now() + 120_000 })).toBe(false)

    const health = new HealthScoreTracker()
    const bucket = new TokenBucketTracker()
    const now = Date.now()
    expect(
      selectHybridAccount(
        [
          { index: 0, lastUsed: now, healthScore: health.getScore(0), isRateLimited: false, isCoolingDown: false },
          { index: 1, lastUsed: now - 300_000, healthScore: 95, isRateLimited: false, isCoolingDown: false },
        ],
        bucket,
        0,
      ),
    ).toBe(0)
    expect(
      selectHybridAccount(
        [
          { index: 0, lastUsed: now, healthScore: health.getScore(0), isRateLimited: false, isCoolingDown: false },
          { index: 1, lastUsed: 0, healthScore: 95, isRateLimited: false, isCoolingDown: false },
        ],
        bucket,
        0,
      ),
    ).toBe(1)

    const verification = extractVerificationErrorDetails(
      'data: {"error":{"message":"Account validation_required","details":[{"verify_url":"https://accounts.google.com/signin/continue?plt=abc"}]}}',
    )
    expect(verification.validationRequired).toBe(true)
    expect(verification.verifyUrl).toBe("https://accounts.google.com/signin/continue?plt=abc")

    expect(parseRateLimitReason(undefined, "Resource exhausted due to model capacity", 429)).toBe(
      "MODEL_CAPACITY_EXHAUSTED",
    )
    expect(calculateBackoffMs("RATE_LIMIT_EXCEEDED", 0, 500)).toBe(2_000)
    expect(resolveQuotaGroup("gemini", "gemini-3-flash")).toBe("gemini-flash")
    expect(computeSoftQuotaCacheTtlMs("auto", 15)).toBe(30 * 60 * 1000)
    expect(createAntigravityVersionState("  2.40.0  ").getVersion()).toBe("2.40.0")

    const scratch = mkdtempSync(join(os.tmpdir(), "ag-core-p2-cfg-"))
    try {
      const home = join(scratch, "home")
      const explicitOc = join(scratch, "explicit-oc")
      const cwd = join(scratch, "cwd")
      mkdirSync(join(home, ".pi", "agent"), { recursive: true })
      mkdirSync(explicitOc, { recursive: true })
      mkdirSync(cwd, { recursive: true })
      writeFileSync(
        join(home, ".pi", "agent", "antigravity.json"),
        JSON.stringify({ soft_quota_threshold_percent: 93 }),
        "utf8",
      )
      const isolatedCfg = loadSharedGuardConfig({
        homeDir: home,
        cwd,
        env: { OPENCODE_CONFIG_DIR: explicitOc },
      })
      expect(isolatedCfg.soft_quota_threshold_percent).toBe(70)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("B5: ProactiveRefreshQueue.stop() aborts an in-flight multi-account background refresh batch while preserving direct runCheckNow()", async () => {
    const now = Date.now()
    const makeAccounts = (): ManagedAccount[] =>
      ["a@example.com", "b@example.com", "c@example.com"].map((email, index) => ({
        index,
        email,
        addedAt: now,
        lastUsed: 0,
        parts: { refreshToken: `r${index + 1}`, projectId: `p${index + 1}` },
        access: "expiring",
        expires: now + 5 * 60_000,
        enabled: true,
        rateLimitResetTimes: {},
        touchedForQuota: {},
      }))

    expect(needsActiveQuotaRefresh(makeAccounts()[0]!, "gemini", 70)).toBe(true)

    const directCalls: string[] = []
    const directQueue = new ProactiveRefreshQueue({
      config: { enabled: true, bufferSeconds: 1_800, checkIntervalSeconds: 300 },
      refreshToken: async (auth) => {
        directCalls.push(auth.refresh)
        return { ...auth, access: "fresh", expires: now + 3_600_000 }
      },
    })
    directQueue.setAccountManager(makeInMemoryStore(makeAccounts()))
    await directQueue.runCheckNow()
    expect(directCalls).toHaveLength(3)

    const bgCalls: string[] = []
    let bgQueue!: ProactiveRefreshQueue
    bgQueue = new ProactiveRefreshQueue({
      config: { enabled: true, bufferSeconds: 1_800, checkIntervalSeconds: 300 },
      refreshToken: async (auth) => {
        bgCalls.push(auth.refresh)
        bgQueue.stop()
        return { ...auth, access: "fresh", expires: now + 3_600_000 }
      },
    })
    bgQueue.setAccountManager(makeInMemoryStore(makeAccounts()))
    bgQueue.start()
    await new Promise((resolve) => setTimeout(resolve, 5_200))
    bgQueue.stop()
    expect(bgCalls).toHaveLength(1)
  }, 10_000)
})
