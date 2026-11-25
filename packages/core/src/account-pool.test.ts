import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import {
  AccountManager,
  HealthScoreTracker,
  ProactiveRefreshQueue,
  TokenBucketTracker,
  acquireDefaultDirLock,
  extractVerificationErrorDetails,
  getQuotaKey,
  isOverSoftQuotaThreshold,
  isRateLimitedForFamily,
  isRateLimitedForHeaderStyle,
  isRateLimitedForQuotaKey,
  mergeAccountStorage,
} from "./index.ts"

describe("Phase 2 core AccountManager and advisory hardening (S1, S3)", () => {
  it("supports hybrid/sticky/round-robin rotation, pid_offset_enabled, verification quarantine, and ProactiveRefreshQueue integration", async () => {
    const health = new HealthScoreTracker()
    const bucket = new TokenBucketTracker()
    const savedSnapshots: unknown[] = []

    const manager = new AccountManager(
      undefined,
      {
        version: 4,
        accounts: [
          { email: "a@example.com", refreshToken: "r-a", projectId: "p-a", addedAt: 1, lastUsed: 10 },
          { email: "b@example.com", refreshToken: "r-b", projectId: "p-b", addedAt: 2, lastUsed: 20 },
        ],
        activeIndex: 0,
      },
      {
        saveAccounts: async (state) => {
          savedSnapshots.push(state)
        },
        healthTracker: health,
        tokenTracker: bucket,
      },
    )

    const rr1 = manager.getCurrentOrNextForFamily("gemini", "gemini-4-carbon", "round-robin")
    const rr2 = manager.getCurrentOrNextForFamily("gemini", "gemini-4-carbon", "round-robin")
    expect(rr1?.index).toBe(0)
    expect(rr2?.index).toBe(1)

    const verification = extractVerificationErrorDetails(
      'data: {"error":{"message":"Account validation_required: \\"quote\\" (see https://accounts.google.com/signin/continue).","details":[{"verify_url":"https://accounts.google.com/signin/continue?plt=abc"}]}}',
    )
    expect(verification.validationRequired).toBe(true)
    expect(verification.verifyUrl).toBe("https://accounts.google.com/signin/continue?plt=abc")
    expect(verification.message).toContain('"quote"')

    // Non-https, embedded credentials, and non-default ports are rejected
    expect(
      extractVerificationErrorDetails(
        '{"error":{"message":"validation_required","verify_url":"http://accounts.google.com/signin/continue"}}',
      ).verifyUrl,
    ).toBeUndefined()
    expect(
      extractVerificationErrorDetails(
        '{"error":{"message":"validation_required","verify_url":"https://user:pass@accounts.google.com/signin/continue"}}',
      ).verifyUrl,
    ).toBeUndefined()
    expect(
      extractVerificationErrorDetails(
        '{"error":{"message":"validation_required","verify_url":"https://accounts.google.com:8443/signin/continue"}}',
      ).verifyUrl,
    ).toBeUndefined()

    manager.markAccountVerificationRequired(0, verification.message, verification.verifyUrl)
    expect(manager.getAccountCount()).toBe(1)
    expect(manager.getCurrentOrNextForFamily("gemini", "gemini-4-carbon", "hybrid")?.email).toBe("b@example.com")

    await manager.saveToDisk()
    expect(savedSnapshots).toHaveLength(1)

    const refreshedTokens: string[] = []
    const accB = manager.getAccounts()[1]!
    accB.access = "expiring-soon"
    accB.expires = Date.now() + 5 * 60_000

    const queue = new ProactiveRefreshQueue({
      config: { enabled: true, bufferSeconds: 1_800, checkIntervalSeconds: 300 },
      refreshToken: async (auth) => {
        refreshedTokens.push(auth.refresh)
        return { ...auth, access: "fresh-access", expires: Date.now() + 3_600_000 }
      },
    })
    queue.setAccountManager(manager)
    expect(queue.getAccountsNeedingRefresh().map((a) => a.email)).toEqual(["b@example.com"])
    await queue.runCheckNow()
    expect(refreshedTokens).toEqual(["r-b|p-b"])
    expect(accB.access).toBe("fresh-access")
  })

  it("covers rate-limit quota keys, soft-quota fail-closed threshold checks, post-stop refresh cancellation, and owner-stamped dir lock release", async () => {
    const manager = new AccountManager(undefined, {
      version: 4,
      accounts: [
        { email: "a@example.com", refreshToken: "r1", projectId: "p1", addedAt: 1, lastUsed: 0 },
        { email: "b@example.com", refreshToken: "r2", projectId: "p2", addedAt: 2, lastUsed: 0 },
      ],
      activeIndex: 0,
    })
    const accA = manager.getAccounts()[0]!
    const key = getQuotaKey("gemini", "antigravity", "gemini-3-flash")
    expect(key).toBe("gemini-antigravity:gemini-3-flash")

    manager.markRateLimited(accA, 60_000, "gemini", "antigravity", "gemini-3-flash")
    expect(isRateLimitedForQuotaKey(accA, key)).toBe(true)
    expect(isRateLimitedForHeaderStyle(accA, "gemini", "antigravity", "gemini-3-flash")).toBe(true)
    expect(isRateLimitedForFamily(accA, "gemini", "gemini-3-flash")).toBe(false)
    manager.markRateLimited(accA, 60_000, "gemini", "gemini-cli", "gemini-3-flash")
    expect(isRateLimitedForFamily(accA, "gemini", "gemini-3-flash")).toBe(true)

    manager.updateQuotaCache(1, {
      "gemini-flash": { remainingFraction: 0.1, modelCount: 1 },
    })
    expect(
      isOverSoftQuotaThreshold(
        manager.getAccounts()[1]!,
        "gemini",
        80,
        10 * 60_000,
        "gemini-3-flash",
      ),
    ).toBe(true)

    // Deterministic fake-timer check: stop() during in-flight refresh prevents post-stop mutation & save warnings log on failure
    vi.useFakeTimers()
    try {
      const now = Date.now()
      const stopMgr = new AccountManager(undefined, {
        version: 4,
        accounts: [
          { email: "x@example.com", refreshToken: "rx", projectId: "px", addedAt: now, lastUsed: 0 },
          { email: "y@example.com", refreshToken: "ry", projectId: "py", addedAt: now, lastUsed: 0 },
        ],
        activeIndex: 0,
      })
      for (const acc of stopMgr.getAccounts()) {
        acc.access = "expiring"
        acc.expires = now + 5 * 60_000
      }

      let afterSaveCalled = false
      let bgQueue!: ProactiveRefreshQueue
      bgQueue = new ProactiveRefreshQueue({
        config: { enabled: true, bufferSeconds: 1_800, checkIntervalSeconds: 300 },
        refreshToken: async (auth) => {
          bgQueue.stop()
          return { ...auth, access: "should-not-apply-after-stop", expires: now + 3_600_000 }
        },
        onAfterSave: () => {
          afterSaveCalled = true
        },
      })
      bgQueue.setAccountManager(stopMgr)
      bgQueue.start()
      await vi.advanceTimersByTimeAsync(5_000)
      expect(stopMgr.getAccounts()[0]?.access).toBe("expiring")
      expect(stopMgr.getAccounts()[1]?.access).toBe("expiring")
      expect(bgQueue.getStats().refreshCount).toBe(0)
      expect(afterSaveCalled).toBe(false)
    } finally {
      vi.useRealTimers()
    }

    // Save failure logs warning and skips onAfterSave
    const warnLogs: string[] = []
    const failingSaveMgr = new AccountManager(
      undefined,
      {
        version: 4,
        accounts: [{ email: "z@example.com", refreshToken: "rz", projectId: "pz", addedAt: 1, lastUsed: 0 }],
        activeIndex: 0,
      },
      {
        saveAccounts: async () => {
          throw new Error("disk-full")
        },
      },
    )
    failingSaveMgr.getAccounts()[0]!.access = "expiring"
    failingSaveMgr.getAccounts()[0]!.expires = Date.now() + 5 * 60_000
    let onAfterSaveWhenFailed = false
    const warnQueue = new ProactiveRefreshQueue({
      refreshToken: async (auth) => ({ ...auth, access: "mem-refreshed", expires: Date.now() + 3_600_000 }),
      onAfterSave: () => {
        onAfterSaveWhenFailed = true
      },
      logger: {
        warn: (msg) => {
          warnLogs.push(msg)
        },
      },
    })
    warnQueue.setAccountManager(failingSaveMgr)
    await warnQueue.runCheckNow()
    expect(failingSaveMgr.getAccounts()[0]?.access).toBe("mem-refreshed")
    expect(warnLogs).toContain("Failed to persist refreshed account to disk")
    expect(onAfterSaveWhenFailed).toBe(false)

    // Evicted dir lock holder will NOT delete a replacement lock directory that lacks its owner file yet
    const scratch = mkdtempSync(join(os.tmpdir(), "ag-core-p2-ownerlock-"))
    try {
      const target = join(scratch, "antigravity-accounts.json")
      const releaseHolder1 = await acquireDefaultDirLock(target)
      // Simulate eviction by removing holder1's lock dir and creating a replacement lock dir without owner stamp yet
      rmSync(`${target}.lock`, { recursive: true, force: true })
      const { mkdirSync, existsSync } = await import("node:fs")
      mkdirSync(`${target}.lock`)
      writeFileSync(join(`${target}.lock`, "contender-marker"), "active", "utf8")
      await releaseHolder1()
      expect(existsSync(join(`${target}.lock`, "contender-marker"))).toBe(true)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }

    expect(
      mergeAccountStorage(
        { version: 4, accounts: [{ email: "a@b.c", refreshToken: "r1", addedAt: 1, lastUsed: 10 }], activeIndex: 0 },
        { version: 4, accounts: [{ email: "a@b.c", refreshToken: "r2", addedAt: 1, lastUsed: 20 }], activeIndex: 0 },
      ).accounts[0]?.refreshToken,
    ).toBe("r2")
  })
})
