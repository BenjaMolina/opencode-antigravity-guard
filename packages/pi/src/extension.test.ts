import { describe, expect, it, vi } from "vitest"

import extension from "./extension.ts"

describe("Pi extension factory", () => {
  it("synchronously registers the provider through Pi's extension factory", () => {
    const registerProvider = vi.fn()

    const result = extension({ registerProvider })

    expect(result).toBeUndefined()
    expect(registerProvider).toHaveBeenCalledOnce()
    expect(registerProvider.mock.calls[0]?.[0]).toBe("antigravity-guard")
  })
})
