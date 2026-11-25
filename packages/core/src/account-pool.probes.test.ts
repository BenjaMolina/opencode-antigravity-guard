import { describe, expect, it } from "vitest"

import {
  AccountManager,
  ProactiveRefreshQueue,
  mergeAccountStorage,
} from "./index.ts"

describe("Phase 2 core multi-account pool regression probes (S1, S3)", () => {
  it("B5: ProactiveRefreshQueue.stop() aborts an in-flight multi-account background refresh batch without mutating post-stop accounts while preserving direct runCheckNow()", async () => {
    const now = Date.now()
    const makeManager = () => {
      const mgr = new AccountManager(undefined, {
        version: 4,
        accounts: [
          { email: "a@example.com", refreshToken: "r1", projectId: "p1", addedAt: now, lastUsed: 0, enabled: true },
          { email: "b@example.com", refreshToken: "r2", projectId: "p2", addedAt: now, lastUsed: 0, enabled: true },
          { email: "c@example.com", refreshToken: "r3", projectId: "p3", addedAt: now, lastUsed: 0, enabled: true },
        ],
        activeIndex: 0,
      })
      for (const acc of mgr.getAccounts()) {
        acc.access = "expiring"
        acc.expires = now + 5 * 60_000
      }
      return mgr
    }

    // Direct runCheckNow() when stopped still refreshes all accounts
    const directCalls: string[] = []
    const directQueue = new ProactiveRefreshQueue({
      config: { enabled: true, bufferSeconds: 1_800, checkIntervalSeconds: 300 },
      refreshToken: async (auth) => {
        directCalls.push(auth.refresh)
        return { ...auth, access: "fresh", expires: now + 3_600_000 }
      },
    })
    directQueue.setAccountManager(makeManager())
    await directQueue.runCheckNow()
    expect(directCalls).toHaveLength(3)

    // Background start() + mid-batch stop() halts before mutating post-stop or remaining accounts
    const bgCalls: string[] = []
    const bgMgr = makeManager()
    let bgQueue!: ProactiveRefreshQueue
    bgQueue = new ProactiveRefreshQueue({
      config: { enabled: true, bufferSeconds: 1_800, checkIntervalSeconds: 300 },
      refreshToken: async (auth) => {
        bgCalls.push(auth.refresh)
        bgQueue.stop()
        return { ...auth, access: "fresh", expires: now + 3_600_000 }
      },
    })
    bgQueue.setAccountManager(bgMgr)
    bgQueue.start()
    await new Promise((resolve) => setTimeout(resolve, 5_200))
    bgQueue.stop()
    expect(bgCalls).toHaveLength(1)
    expect(bgMgr.getAccounts().map((a) => a.access)).toEqual(["expiring", "expiring", "expiring"])
  }, 10_000)

  it("B6: mergeAccountStorage deduplicates rotated refresh tokens for the same email", () => {
    const merged = mergeAccountStorage(
      {
        version: 4,
        accounts: [{ email: "alice@example.com", refreshToken: "old-ref", projectId: "proj-1", addedAt: 1, lastUsed: 10 }],
        activeIndex: 0,
      },
      {
        version: 4,
        accounts: [{ email: "alice@example.com", refreshToken: "new-ref", projectId: "proj-1", addedAt: 1, lastUsed: 20 }],
        activeIndex: 0,
      },
    )
    expect(merged.accounts).toHaveLength(1)
    expect(merged.accounts[0]?.refreshToken).toBe("new-ref")
  })
})
