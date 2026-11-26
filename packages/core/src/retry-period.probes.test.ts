import { describe, expect, it } from "vitest"

import {
  extractRateLimitBodyInfo,
  extractRateLimitTextInfo,
  extractRetryInfoFromBody,
  parseDurationToMs,
} from "./retry.ts"

describe("Phase 3 retry-delay parser punctuation & boundary probes (S1, S4)", () => {
  it("B1: extracts simple and compound durations from punctuated Cloud Code 'reset after <duration>.' messages in JSON and plain text", async () => {
    const cases: Array<{ message: string; expectedMs: number }> = [
      {
        message:
          "You have exhausted your capacity on this model. Your quota will reset after 3s.",
        expectedMs: 3_000,
      },
      {
        message:
          "You have exhausted your quota on this model. Your quota will reset after 15s.",
        expectedMs: 15_000,
      },
      {
        message:
          "You have exhausted your quota on this model. Your quota will reset after 1h16m0.667s.",
        expectedMs: 4_560_667,
      },
      {
        message: "Rate limit hit; reset after 1m30s.",
        expectedMs: 90_000,
      },
      {
        message: "Quota exhausted (reset after 250ms).",
        expectedMs: 250,
      },
    ]

    for (const { message, expectedMs } of cases) {
      const payload = {
        error: {
          code: 429,
          message,
          status: "RESOURCE_EXHAUSTED",
        },
      }
      expect(extractRateLimitBodyInfo(payload).retryDelayMs).toBe(expectedMs)
      expect(extractRateLimitTextInfo(JSON.stringify(payload)).retryDelayMs).toBe(
        expectedMs,
      )
      expect(extractRateLimitTextInfo(message).retryDelayMs).toBe(expectedMs)

      const response = new Response(JSON.stringify(payload), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
      expect((await extractRetryInfoFromBody(response)).retryDelayMs).toBe(expectedMs)
    }
  })

  it("keeps strict rejection on malformed duration strings passed directly to parseDurationToMs", () => {
    expect(parseDurationToMs("")).toBeNull()
    expect(parseDurationToMs("abc")).toBeNull()
    expect(parseDurationToMs("5m_garbage_30s")).toBeNull()
    expect(parseDurationToMs("-5s")).toBeNull()
  })
})
