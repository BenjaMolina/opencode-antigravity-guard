import { describe, expect, it } from "vitest";

import { __testExports } from "./quota.ts";

describe("Antigravity quota aggregation", () => {
  it("selects the minimum remainingFraction and its corresponding resetTime when multiple entries exist for a quota group", () => {
    const summary = __testExports.aggregateQuota({
      "gemini-3.5-flash-low": {
        displayName: "Gemini 3.5 Flash Low",
        quotaInfo: {
          remainingFraction: 1,
          resetTime: "2026-05-26T18:00:00Z",
        },
      },
      "gemini-3-flash-agent": {
        displayName: "Gemini 3 Flash Agent",
        quotaInfo: {
          remainingFraction: 0.2,
          resetTime: "2026-05-27T18:00:00Z",
        },
      },
    });

    expect(summary.groups["gemini-flash"]?.remainingFraction).toBe(0.2);
    expect(summary.groups["gemini-flash"]?.resetTime).toBe("2026-05-27T18:00:00Z");
    expect(summary.groups["gemini-flash"]?.modelCount).toBe(2);
  });

  it("keeps the reset time from the displayed Gemini variant quota", () => {
    const summary = __testExports.aggregateQuota({
      "gemini-3.5-flash-low": {
        displayName: "Gemini 3.5 Flash Low",
        quotaInfo: {
          remainingFraction: 0.5,
          resetTime: "2026-05-27T18:00:00Z",
        },
      },
      "gemini-3-flash-agent": {
        displayName: "Gemini 3 Flash Agent",
        quotaInfo: {
          remainingFraction: 0.1,
          resetTime: "2026-05-26T18:00:00Z",
        },
      },
    });

    expect(summary.groups["gemini-flash"]?.remainingFraction).toBe(0.1);
    expect(summary.groups["gemini-flash"]?.resetTime).toBe("2026-05-26T18:00:00Z");
  });

  it("includes Gemini 4 models in the gemini-pro quota group", () => {
    const summary = __testExports.aggregateQuota({
      "gemini-4-argon-high": {
        displayName: "Gemini 4 Argon High",
        quotaInfo: {
          remainingFraction: 0.75,
          resetTime: "2026-11-23T00:00:00Z",
        },
      },
      "gemini-4-neon-xhigh": {
        displayName: "Gemini 4 Neon XHigh",
        quotaInfo: {
          remainingFraction: 0.4,
          resetTime: "2026-11-22T22:00:00Z",
        },
      },
    });

    expect(summary.groups["gemini-pro"]).toEqual({
      remainingFraction: 0.4,
      resetTime: "2026-11-22T22:00:00Z",
      modelCount: 2,
    });
    expect(summary.modelCount).toBe(2);
  });
});
