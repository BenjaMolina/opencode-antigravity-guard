import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  CAPACITY_BACKOFF_MAX_DELAY_MS,
  DEFAULT_SHARED_GUARD_CONFIG,
  FIRST_RETRY_DELAY_MS,
  MAX_CAPACITY_RETRIES_PER_ENDPOINT,
  SWITCH_ACCOUNT_DELAY_MS,
  abortableSleep,
  calculateCapacityBackoffMs,
  createAccountFailureTracker,
  createRateLimitBackoffTracker,
  extractRateLimitBodyInfo,
  extractRateLimitTextInfo,
  extractRetryInfoFromBody,
  formatWaitTime,
  headerStyleToQuotaKey,
  loadSharedGuardConfig,
  parseDurationToMs,
  retryAfterMsFromHeaders,
  retryAfterMsFromResponse,
} from "./index.ts"

describe("Phase 3 core RPC RetryInfo parser, rate-limit trackers, and capacity backoff (T3.2 / S1, S4)", () => {
  it("parses simple and compound Go-style durations and Retry-After headers", () => {
    expect(parseDurationToMs("250ms")).toBe(250)
    expect(parseDurationToMs("1.5s")).toBe(1_500)
    expect(parseDurationToMs("5m30s")).toBe(330_000)
    expect(parseDurationToMs("1h16m0.667s")).toBeCloseTo(4_560_667, 0)
    expect(parseDurationToMs("42")).toBe(42_000)
    expect(parseDurationToMs("not-a-duration")).toBeNull()

    const msResp = new Response("", { status: 429, headers: { "retry-after-ms": "2750" } })
    expect(retryAfterMsFromResponse(msResp, 60_000)).toBe(2_750)

    const secResp = new Response("", { status: 429, headers: { "Retry-After": "12" } })
    expect(retryAfterMsFromResponse(secResp, 60_000)).toBe(12_000)

    expect(retryAfterMsFromHeaders({ "retry-after-ms": "900", "retry-after": "10" }, 60_000)).toBe(900)
    expect(retryAfterMsFromHeaders({}, 45_000)).toBe(45_000)
  })

  it("extracts google.rpc.ErrorInfo, google.rpc.RetryInfo, quotaResetDelay metadata, and reset-after message fallback", async () => {
    const rpcRetryBody = {
      error: {
        message: "Resource exhausted",
        details: [
          { "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "RATE_LIMIT_EXCEEDED" },
          { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "3.5s" },
        ],
      },
    }
    expect(extractRateLimitBodyInfo(rpcRetryBody)).toEqual({
      retryDelayMs: 3_500,
      message: "Resource exhausted",
      reason: "RATE_LIMIT_EXCEEDED",
    })

    const quotaMetaBody = {
      error: {
        message: "Daily quota exceeded",
        details: [
          {
            "@type": "type.googleapis.com/google.rpc.ErrorInfo",
            reason: "QUOTA_EXHAUSTED",
            metadata: {
              quotaResetDelay: "2m15s",
              quotaResetTimeStamp: "2026-11-26T12:00:00Z",
            },
          },
        ],
      },
    }
    expect(extractRateLimitBodyInfo(quotaMetaBody)).toEqual({
      retryDelayMs: 135_000,
      message: "Daily quota exceeded",
      quotaResetTime: "2026-11-26T12:00:00Z",
      reason: "QUOTA_EXHAUSTED",
    })

    const msgFallback = extractRateLimitTextInfo(
      JSON.stringify({ error: { message: "Quota will reset after 1m20s" } }),
    )
    expect(msgFallback).toEqual({
      retryDelayMs: 80_000,
      message: "Quota will reset after 1m20s",
      reason: undefined,
    })

    const response = new Response(JSON.stringify(rpcRetryBody), { status: 429 })
    await expect(extractRetryInfoFromBody(response)).resolves.toEqual({
      retryDelayMs: 3_500,
      message: "Resource exhausted",
      reason: "RATE_LIMIT_EXCEEDED",
    })
    // response body must remain readable after clone-based extraction
    expect(await response.text()).toContain("RATE_LIMIT_EXCEEDED")
  })

  it("computes jittered 1s->2s->4s->8s capacity backoff, formats wait times, and maps headerStyle quota keys", () => {
    expect(FIRST_RETRY_DELAY_MS).toBe(1_000)
    expect(SWITCH_ACCOUNT_DELAY_MS).toBe(5_000)
    expect(MAX_CAPACITY_RETRIES_PER_ENDPOINT).toBe(3)
    expect(CAPACITY_BACKOFF_MAX_DELAY_MS).toBe(8_000)

    // randomFn = 0.5 -> multiplier 0.9 + 0.1 = 1.0 exact
    expect(calculateCapacityBackoffMs(0, () => 0.5)).toBe(1_000)
    expect(calculateCapacityBackoffMs(1, () => 0.5)).toBe(2_000)
    expect(calculateCapacityBackoffMs(2, () => 0.5)).toBe(4_000)
    expect(calculateCapacityBackoffMs(3, () => 0.5)).toBe(8_000)
    expect(calculateCapacityBackoffMs(6, () => 0.5)).toBe(8_000)
    // ±10% bounds on attempt 0 (900ms..1100ms)
    expect(calculateCapacityBackoffMs(0, () => 0)).toBe(900)
    expect(calculateCapacityBackoffMs(0, () => 1)).toBe(1_100)

    expect(formatWaitTime(500)).toBe("500ms")
    expect(formatWaitTime(4_200)).toBe("5s")
    expect(formatWaitTime(125_000)).toBe("2m 5s")
    expect(formatWaitTime(3_900_000)).toBe("1h 5m")

    expect(headerStyleToQuotaKey("antigravity", "claude")).toBe("claude")
    expect(headerStyleToQuotaKey("antigravity", "gemini-pro")).toBe("gemini-antigravity")
    expect(headerStyleToQuotaKey("gemini-cli", "gemini-flash")).toBe("gemini-cli")
  })

  it("deduplicates concurrent 429s within 2s window, resets after 2m, tracks consecutive non-429 failures, and honors abortableSleep + max_rate_limit_wait_seconds", async () => {
    let nowMs = 10_000
    const rlTracker = createRateLimitBackoffTracker({ now: () => nowMs })

    const first = rlTracker.getBackoff("rt-1", "gemini-antigravity", 2_000, 60_000)
    expect(first).toEqual({ attempt: 1, delayMs: 2_000, isDuplicate: false })

    // Within 2s dedup window -> does not increment attempt
    nowMs += 500
    const dup = rlTracker.getBackoff("rt-1", "gemini-antigravity", 2_000, 60_000)
    expect(dup).toEqual({ attempt: 1, delayMs: 2_000, isDuplicate: true })

    // Outside 2s window -> increments attempt (2_000 * 2^1 = 4_000)
    nowMs += 3_000
    const second = rlTracker.getBackoff("rt-1", "gemini-antigravity", 2_000, 60_000)
    expect(second).toEqual({ attempt: 2, delayMs: 4_000, isDuplicate: false })

    // After 120s quiet window -> resets to attempt 1
    nowMs += 125_000
    const afterReset = rlTracker.getBackoff("rt-1", "gemini-antigravity", 2_000, 60_000)
    expect(afterReset).toEqual({ attempt: 1, delayMs: 2_000, isDuplicate: false })

    rlTracker.resetAllForAccount("rt-1")

    const failTracker = createAccountFailureTracker({ now: () => nowMs })
    for (let i = 1; i <= 4; i += 1) {
      expect(failTracker.trackFailure("rt-1")).toEqual({
        failures: i,
        shouldCooldown: false,
        cooldownMs: 0,
      })
    }
    expect(failTracker.trackFailure("rt-1")).toEqual({
      failures: 5,
      shouldCooldown: true,
      cooldownMs: 30_000,
    })
    failTracker.reset("rt-1")
    expect(failTracker.trackFailure("rt-1").failures).toBe(1)

    const ctrl = new AbortController()
    ctrl.abort(new Error("stop-sleep"))
    await expect(abortableSleep(5_000, ctrl.signal)).rejects.toThrow("stop-sleep")

    expect(DEFAULT_SHARED_GUARD_CONFIG.max_rate_limit_wait_seconds).toBe(300)
    const scratch = mkdtempSync(join(os.tmpdir(), "core-t32-cfg-"))
    try {
      writeFileSync(
        join(scratch, "antigravity.json"),
        JSON.stringify({ max_rate_limit_wait_seconds: 45 }),
        "utf8",
      )
      const loaded = loadSharedGuardConfig({
        homeDir: scratch,
        cwd: scratch,
        env: { OPENCODE_CONFIG_DIR: scratch },
      })
      expect(loaded.max_rate_limit_wait_seconds).toBe(45)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
