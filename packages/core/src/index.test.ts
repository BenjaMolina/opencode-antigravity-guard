import { describe, expect, it } from "vitest"

import { CORE_PACKAGE_NAME } from "./index.ts"

describe("core package surface", () => {
  it("exports its stable package identity", () => {
    expect(CORE_PACKAGE_NAME).toBe("@benjamolina/antigravity-guard-core")
  })
})
