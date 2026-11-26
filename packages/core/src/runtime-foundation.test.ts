import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"

import {
  ANTIGRAVITY_HUB_MANIFEST_URL,
  ANTIGRAVITY_VERSION_FALLBACK,
  DEFAULT_SHARED_GUARD_CONFIG,
  buildFingerprintHeaders,
  collectCurrentFingerprint,
  createAntigravityVersionState,
  createSessionFingerprintStore,
  fetchAntigravityHubVersion,
  generateFingerprint,
  loadSharedGuardConfig,
  resolveSharedGuardPaths,
  updateFingerprintVersion,
  type Fingerprint,
} from "./index.ts"

describe("Phase 1 core version state & live Hub fetcher", () => {
  it("initializes to 2.34.0, rejects < 2.9.1 or malformed versions, and accepts valid >= 2.9.1 updates", () => {
    const state = createAntigravityVersionState()
    expect(state.getVersion()).toBe(ANTIGRAVITY_VERSION_FALLBACK)

    expect(state.setVersion("2.0.6")).toBe(false)
    expect(state.setVersion("invalid")).toBe(false)
    expect(state.getVersion()).toBe("2.34.0")

    expect(state.setVersion("2.36.1")).toBe(true)
    expect(state.getVersion()).toBe("2.36.1")
  })

  it("fetches latest-arm64-mac.yml with electron-builder headers and returns null on invalid or failed responses", async () => {
    const okFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response("version: 2.37.0\nfiles: []\n", { status: 200 }),
    )
    await expect(fetchAntigravityHubVersion({ fetch: okFetch })).resolves.toBe("2.37.0")
    expect(okFetch).toHaveBeenCalledWith(
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

    const oldFetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response("version: 2.0.6\n", { status: 200 }),
    )
    await expect(fetchAntigravityHubVersion({ fetch: oldFetch })).resolves.toBeNull()

    const errFetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error("offline"))
    await expect(fetchAntigravityHubVersion({ fetch: errFetch })).resolves.toBeNull()
  })
})

describe("Phase 1 core device Fingerprint & session store", () => {
  it("generates Hub fingerprints, collects OS fingerprints, and migrates legacy/CLI/browser userAgents with floor checks", () => {
    const generated = generateFingerprint({ version: "2.35.0" })
    expect(generated.userAgent).toMatch(/^antigravity\/hub\/2\.35\.0 (darwin|win32)\/(x64|arm64)$/)
    expect(buildFingerprintHeaders(generated)).toEqual({ "User-Agent": generated.userAgent })
    expect(buildFingerprintHeaders(null)).toEqual({})

    const collected = collectCurrentFingerprint({ version: "2.35.0" })
    expect(collected.userAgent).toBe(`antigravity/hub/2.35.0 ${os.platform()}/${os.arch()}`)

    const cliFp: Fingerprint = { ...collected, userAgent: "antigravity/cli/1.1.23 (aidev-cli win32/x64)" }
    expect(updateFingerprintVersion(cliFp, "2.0.6")).toBe(false)
    expect(updateFingerprintVersion(cliFp, "2.36.0")).toBe(true)
    expect(cliFp.userAgent).toBe("antigravity/hub/2.36.0 darwin/arm64")

    const store = createSessionFingerprintStore({ getVersion: () => "2.34.0" })
    const first = store.get()
    expect(store.get()).toBe(first)
    expect(store.syncVersion("2.38.0")).toBe(true)
    expect(store.get().userAgent).toMatch(/^antigravity\/hub\/2\.38\.0 (darwin|win32)\/(x64|arm64)$/)
    const regenerated = store.regenerate()
    expect(regenerated.deviceId).not.toBe(first.deviceId)
  })
})

describe("Phase 1 core shared Guard paths & cascade config loader", () => {
  it("cascades from OPENCODE_CONFIG_DIR -> ~/.config/opencode -> ~/.pi/agent and merges project overrides", () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "ag-guard-core-cfg-"))
    try {
      const fakeHome = join(scratch, "home")
      const projectDir = join(scratch, "project")
      mkdirSync(fakeHome, { recursive: true })
      mkdirSync(projectDir, { recursive: true })

      // 1. Standalone Pi machine (no ~/.config/opencode directory)
      const piOnlyPaths = resolveSharedGuardPaths({ homeDir: fakeHome, env: {}, cwd: projectDir })
      expect(piOnlyPaths.source).toBe("pi")
      expect(piOnlyPaths.userConfigPath).toBe(join(fakeHome, ".pi", "agent", "antigravity.json"))
      expect(piOnlyPaths.accountsPath).toBe(join(fakeHome, ".pi", "agent", "antigravity-accounts.json"))

      // 2. Shared OpenCode + Pi machine (~/.config/opencode exists)
      const opencodeDir = join(fakeHome, ".config", "opencode")
      mkdirSync(opencodeDir, { recursive: true })
      writeFileSync(
        join(opencodeDir, "antigravity.json"),
        JSON.stringify({
          soft_quota_threshold_percent: 95,
          request_jitter_max_ms: 250,
          account_selection_strategy: "hybrid",
        }),
        "utf8",
      )
      const sharedPaths = resolveSharedGuardPaths({ homeDir: fakeHome, env: {}, cwd: projectDir })
      expect(sharedPaths.source).toBe("opencode")
      expect(sharedPaths.userConfigPath).toBe(join(opencodeDir, "antigravity.json"))
      expect(sharedPaths.accountsPath).toBe(join(opencodeDir, "antigravity-accounts.json"))

      // 3. Project override (.pi/antigravity.json overrides .opencode/antigravity.json and user config; invalid fields ignored)
      mkdirSync(join(projectDir, ".opencode"), { recursive: true })
      mkdirSync(join(projectDir, ".pi"), { recursive: true })
      writeFileSync(
        join(projectDir, ".opencode", "antigravity.json"),
        JSON.stringify({ soft_quota_threshold_percent: 85, max_backoff_seconds: 90 }),
        "utf8",
      )
      writeFileSync(
        join(projectDir, ".pi", "antigravity.json"),
        JSON.stringify({ request_jitter_max_ms: 120, soft_quota_threshold_percent: 999 }),
        "utf8",
      )

      const loaded = loadSharedGuardConfig({ homeDir: fakeHome, env: {}, cwd: projectDir })
      expect(loaded.soft_quota_threshold_percent).toBe(85)
      expect(loaded.max_backoff_seconds).toBe(90)
      expect(loaded.request_jitter_max_ms).toBe(120)
      expect(loaded.scheduling_mode).toBe(DEFAULT_SHARED_GUARD_CONFIG.scheduling_mode)

      // 4. Explicit OPENCODE_CONFIG_DIR wins
      const explicitDir = join(scratch, "custom-opencode")
      const explicitPaths = resolveSharedGuardPaths({
        homeDir: fakeHome,
        env: { OPENCODE_CONFIG_DIR: explicitDir },
        cwd: projectDir,
      })
      expect(explicitPaths.source).toBe("opencode")
      expect(explicitPaths.userConfigPath).toBe(join(explicitDir, "antigravity.json"))
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
