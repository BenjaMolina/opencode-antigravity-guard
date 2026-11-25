import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  GITIGNORE_ENTRIES,
  clearAccountsAtPath,
  ensureGitignore,
  ensureGitignoreSync,
  loadAccountsFromPath,
  mergeAccountStorage,
  saveAccountsReplaceToPath,
  saveAccountsToPath,
} from "./index.ts"

describe("Phase 2 core AccountStorageV4 persistence and migrations (S1, S3)", () => {
  it("migrates v1/v2/v3 storage to v4, enforces 0600 & .gitignore, recovers legacy .lock files, merges non-destructively, and replaces on delete", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "ag-core-p2-storage-"))
    try {
      const storagePath = join(scratch, "antigravity-accounts.json")
      const future = Date.now() + 120_000

      writeFileSync(
        storagePath,
        JSON.stringify({
          version: 1,
          accounts: [
            {
              email: "dup@example.com",
              refreshToken: "old-tok",
              addedAt: 100,
              lastUsed: 200,
              isRateLimited: true,
              rateLimitResetTime: future,
            },
            {
              email: "dup@example.com",
              refreshToken: "new-tok",
              projectId: "proj-disk",
              addedAt: 150,
              lastUsed: 500,
              isRateLimited: true,
              rateLimitResetTime: future,
            },
          ],
          activeIndex: 5,
        }),
        "utf8",
      )

      const migrated = await loadAccountsFromPath(storagePath)
      expect(migrated?.version).toBe(4)
      expect(migrated?.accounts).toHaveLength(1)
      expect(migrated?.accounts[0]?.refreshToken).toBe("new-tok")
      expect(migrated?.accounts[0]?.rateLimitResetTimes).toEqual({
        claude: future,
        "gemini-antigravity": future,
      })
      expect(migrated?.activeIndex).toBe(0)

      // Legacy .lock file (not directory) should be recovered automatically by pure-Node lock
      writeFileSync(`${storagePath}.lock`, "legacy-file-lock", "utf8")

      await saveAccountsToPath(storagePath, {
        version: 4,
        accounts: [
          {
            email: "dup@example.com",
            refreshToken: "new-tok",
            projectId: "proj-override-attempt",
            addedAt: 150,
            lastUsed: 600,
            rateLimitResetTimes: {},
          },
          {
            email: "second@example.com",
            refreshToken: "sec-tok",
            projectId: "proj-2",
            addedAt: 700,
            lastUsed: 700,
          },
        ],
        activeIndex: 1,
      })

      const gitignore = readFileSync(join(scratch, ".gitignore"), "utf8")
      for (const entry of GITIGNORE_ENTRIES) {
        expect(gitignore).toContain(entry)
      }

      const afterMerge = await loadAccountsFromPath(storagePath)
      expect(afterMerge?.accounts).toHaveLength(2)
      // Disk projectId preserved, explicit {} cleared rateLimitResetTimes
      expect(afterMerge?.accounts[0]?.projectId).toBe("proj-disk")
      expect(afterMerge?.accounts[0]?.rateLimitResetTimes).toBeUndefined()

      // Destructive replace removes account without resurrecting from disk
      await saveAccountsReplaceToPath(storagePath, {
        version: 4,
        accounts: [afterMerge!.accounts[1]!],
        activeIndex: 0,
      })
      const afterReplace = await loadAccountsFromPath(storagePath)
      expect(afterReplace?.accounts).toHaveLength(1)
      expect(afterReplace?.accounts[0]?.refreshToken).toBe("sec-tok")

      await clearAccountsAtPath(storagePath)
      await expect(loadAccountsFromPath(storagePath)).resolves.toBeNull()

      // Sync & async gitignore idempotency
      const syncDir = join(scratch, "sync-dir")
      mkdirSync(syncDir, { recursive: true })
      ensureGitignoreSync(syncDir)
      await ensureGitignore(syncDir)
      expect(readFileSync(join(syncDir, ".gitignore"), "utf8").trim().split("\n")).toEqual(GITIGNORE_ENTRIES)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

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
