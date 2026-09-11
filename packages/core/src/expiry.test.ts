import { describe, expect, it } from "vitest"

import { calculateTokenExpiry } from "./expiry.ts"

describe("calculateTokenExpiry", () => {
  it("converts a numeric OAuth lifetime into an absolute expiration timestamp", () => {
    expect(calculateTokenExpiry(1_000, 3_600)).toBe(3_601_000)
  })

  it("treats nonpositive or nonnumeric lifetimes as immediately expired", () => {
    expect(calculateTokenExpiry(5_000, 0)).toBe(5_000)
    expect(calculateTokenExpiry(5_000, "invalid")).toBe(3_605_000)
  })
})
