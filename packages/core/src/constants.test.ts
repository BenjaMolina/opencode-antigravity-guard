import { describe, expect, it } from "vitest"

import { ANTIGRAVITY_ENDPOINTS } from "./constants.ts"

describe("ANTIGRAVITY_ENDPOINTS", () => {
  it("exposes the fixed OAuth and Antigravity API endpoints", () => {
    expect(ANTIGRAVITY_ENDPOINTS).toEqual({
      authorize: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
      userInfo: "https://www.googleapis.com/oauth2/v1/userinfo?alt=json",
      daily: "https://daily-cloudcode-pa.sandbox.googleapis.com",
      autopush: "https://autopush-cloudcode-pa.sandbox.googleapis.com",
      production: "https://cloudcode-pa.googleapis.com",
    })
  })
})
