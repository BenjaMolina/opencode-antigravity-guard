import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  ANTIGRAVITY_HUB_MANIFEST_URL,
  isSupportedAntigravityVersion,
} from "@benjamolina/antigravity-guard-core"

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("ANTIGRAVITY_VERSION_FALLBACK", () => {
  it("defaults to 2.34.0 and meets the >= 2.9.1 Hub floor", async () => {
    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityVersion } = await import("../constants.ts")
    expect(ANTIGRAVITY_VERSION_FALLBACK).toBe("2.34.0")
    expect(getAntigravityVersion()).toBe("2.34.0")
    expect(isSupportedAntigravityVersion(getAntigravityVersion())).toBe(true)
  })
})

describe("setAntigravityVersion", () => {
  it("ignores versions below 2.9.1 or malformed strings", async () => {
    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityVersion, setAntigravityVersion } = await import("../constants.ts")
    setAntigravityVersion("2.0.6")
    setAntigravityVersion("1.19.4")
    setAntigravityVersion("not-a-version")
    expect(getAntigravityVersion()).toBe(ANTIGRAVITY_VERSION_FALLBACK)
  })

  it("allows valid >= 2.9.1 updates even after fallback initialization", async () => {
    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityVersion, setAntigravityVersion } = await import("../constants.ts")
    setAntigravityVersion(ANTIGRAVITY_VERSION_FALLBACK)
    expect(getAntigravityVersion()).toBe("2.34.0")

    setAntigravityVersion("2.35.0")
    expect(getAntigravityVersion()).toBe("2.35.0")

    setAntigravityVersion("2.9.1")
    expect(getAntigravityVersion()).toBe("2.9.1")
  })
})

describe("initAntigravityVersion", () => {
  it("fetches Hub manifest YAML with electron-builder headers and updates version", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "version: 2.35.2\nfiles:\n  - url: Antigravity-2.35.2-arm64-mac.zip\n",
    })
    vi.stubGlobal("fetch", fetchMock)

    const { getAntigravityVersion } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")
    await initAntigravityVersion()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      ANTIGRAVITY_HUB_MANIFEST_URL,
      expect.objectContaining({
        method: "GET",
        headers: {
          "User-Agent": "electron-builder",
          "Cache-Control": "no-cache",
        },
        signal: expect.any(AbortSignal),
      }),
    )
    expect(getAntigravityVersion()).toBe("2.35.2")
  })

  it("ignores Hub manifest versions below 2.9.1 and keeps fallback 2.34.0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "version: 2.0.6\n",
      }),
    )

    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityVersion } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")
    await initAntigravityVersion()

    expect(getAntigravityVersion()).toBe(ANTIGRAVITY_VERSION_FALLBACK)
  })

  it("falls back to 2.34.0 on network error without permanently locking future updates", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unreachable"))
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "version: '2.36.0'\n",
      })
    vi.stubGlobal("fetch", fetchMock)

    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityVersion } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")

    await initAntigravityVersion()
    expect(getAntigravityVersion()).toBe(ANTIGRAVITY_VERSION_FALLBACK)

    await initAntigravityVersion()
    expect(getAntigravityVersion()).toBe("2.36.0")
  })

  it("falls back to 2.34.0 when Hub manifest responds non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => "" }),
    )

    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityVersion } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")
    await initAntigravityVersion()

    expect(getAntigravityVersion()).toBe(ANTIGRAVITY_VERSION_FALLBACK)
  })

  it("propagates fallback version to legacy and Hub User-Agent headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")))

    const { ANTIGRAVITY_VERSION_FALLBACK, getAntigravityHeaders, getRandomizedHeaders } = await import("../constants.ts")
    const { initAntigravityVersion } = await import("./version.ts")
    await initAntigravityVersion()

    expect(getAntigravityHeaders()["User-Agent"]).toContain(`Antigravity/${ANTIGRAVITY_VERSION_FALLBACK}`)
    expect(getRandomizedHeaders("antigravity")["User-Agent"]).toBe(
      `antigravity/hub/${ANTIGRAVITY_VERSION_FALLBACK} darwin/arm64`,
    )
  })
})
