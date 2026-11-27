import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  ANTIGRAVITY_VERSION_FALLBACK,
  DEFAULT_SHARED_GUARD_CONFIG,
  collectCurrentFingerprint,
  createSessionFingerprintStore,
  generateFingerprint,
  loadSharedGuardConfig,
  resolveSharedGuardPaths,
  updateFingerprintVersion,
} from "./index.ts"

describe("Phase 1 S1/S2 floor, cascade, and hostile-config regression probes", () => {
  it("loads the OpenCode request timeout and ignores invalid project overrides", () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "ag-core-timeout-"))
    try {
      const projectDir = join(scratch, ".opencode")
      const userDir = join(scratch, "user")
      mkdirSync(projectDir)
      mkdirSync(userDir)
      const options = { homeDir: scratch, cwd: scratch, env: { OPENCODE_CONFIG_DIR: userDir } }
      expect(loadSharedGuardConfig(options)).toHaveProperty("request_timeout_seconds", 600)
      writeFileSync(join(userDir, "antigravity.json"), '{"request_timeout_seconds":30,"request_jitter_max_ms":50}')
      const projectFile = join(projectDir, "antigravity.json")
      for (const invalid of ['29', '3601', '"60"', '1e309']) {
        writeFileSync(projectFile, `{"request_timeout_seconds":${invalid}}`)
        expect(loadSharedGuardConfig(options)).toMatchObject({ request_timeout_seconds: 30, request_jitter_max_ms: 50 })
      }
      writeFileSync(projectFile, '{"request_timeout_seconds":3600}')
      expect(loadSharedGuardConfig(options)).toHaveProperty("request_timeout_seconds", 3600)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("enforces >= 2.9.1 floor and whitespace trimming in generateFingerprint, collectCurrentFingerprint, and uninitialized SessionFingerprintStore.syncVersion", () => {
    expect(generateFingerprint({ version: "2.0.6" }).userAgent).toMatch(
      new RegExp(`^antigravity/hub/${ANTIGRAVITY_VERSION_FALLBACK.replace(/\./g, "\\.")} (darwin|win32)/(x64|arm64)$`),
    )
    expect(generateFingerprint({ version: "  2.39.0  " }).userAgent).toMatch(
      /^antigravity\/hub\/2\.39\.0 (darwin|win32)\/(x64|arm64)$/,
    )
    expect(collectCurrentFingerprint({ version: "not-a-semver" }).userAgent).toBe(
      `antigravity/hub/${ANTIGRAVITY_VERSION_FALLBACK} ${os.platform()}/${os.arch()}`,
    )

    const store = createSessionFingerprintStore({ getVersion: () => "2.34.0" })
    expect(store.syncVersion("2.0.6")).toBe(false)
    expect(store.syncVersion("not-a-semver")).toBe(false)
    expect(store.get().userAgent).toMatch(/^antigravity\/hub\/2\.34\.0 (darwin|win32)\/(x64|arm64)$/)

    const storeTrim = createSessionFingerprintStore({ getVersion: () => "2.34.0" })
    expect(storeTrim.syncVersion("  2.39.0  ")).toBe(true)
    expect(storeTrim.get().userAgent).toMatch(/^antigravity\/hub\/2\.39\.0 (darwin|win32)\/(x64|arm64)$/)

    const cliFp = generateFingerprint({ version: "2.34.0" })
    cliFp.userAgent = "antigravity/cli/1.1.23 (aidev_client; os_type=linux; arch=amd64)"
    const snapshot = structuredClone(cliFp)
    expect(updateFingerprintVersion(cliFp, "2.9.0")).toBe(false)
    expect(cliFp).toEqual(snapshot)
    expect(updateFingerprintVersion(cliFp, "2.9.1")).toBe(true)
    expect(cliFp.userAgent).toBe("antigravity/hub/2.9.1 darwin/arm64")
  })

  it("cascades XDG_CONFIG_HOME/opencode -> ~/.config/opencode -> PI_CODING_AGENT_DIR -> ~/.pi/agent, ignores non-directory opencode files, and falls back to Pi user config when OpenCode antigravity.json is absent", () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "ag-core-cascade-probe-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      const xdgEmpty = join(scratch, "xdg-empty")
      const piExplicit = join(scratch, "pi-explicit")
      mkdirSync(join(home, ".config", "opencode"), { recursive: true })
      mkdirSync(join(home, ".pi", "agent"), { recursive: true })
      mkdirSync(xdgEmpty, { recursive: true })
      mkdirSync(piExplicit, { recursive: true })
      mkdirSync(cwd, { recursive: true })

      const xdgFallback = resolveSharedGuardPaths({
        homeDir: home,
        cwd,
        env: { XDG_CONFIG_HOME: xdgEmpty, PI_CODING_AGENT_DIR: piExplicit },
      })
      expect(xdgFallback.source).toBe("opencode")
      expect(xdgFallback.configDir).toBe(join(home, ".config", "opencode"))

      writeFileSync(
        join(home, ".pi", "agent", "antigravity.json"),
        JSON.stringify({ soft_quota_threshold_percent: 91 }),
        "utf8",
      )
      expect(loadSharedGuardConfig({ homeDir: home, cwd, env: {} }).soft_quota_threshold_percent).toBe(91)

      const homeWithFile = join(scratch, "home-file")
      mkdirSync(join(homeWithFile, ".config"), { recursive: true })
      writeFileSync(join(homeWithFile, ".config", "opencode"), "not-a-dir", "utf8")
      mkdirSync(join(homeWithFile, ".pi", "agent"), { recursive: true })
      writeFileSync(
        join(homeWithFile, ".pi", "agent", "antigravity.json"),
        JSON.stringify({ soft_quota_threshold_percent: 88 }),
        "utf8",
      )
      const filePaths = resolveSharedGuardPaths({ homeDir: homeWithFile, cwd, env: {} })
      expect(filePaths.source).toBe("pi")
      expect(loadSharedGuardConfig({ homeDir: homeWithFile, cwd, env: {} }).soft_quota_threshold_percent).toBe(88)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("resists prototype pollution, malformed/non-object JSON, non-finite numbers, and mutation of returned configs while leaving files byte-identical", () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "ag-core-hostile-probe-"))
    try {
      const home = join(scratch, "home")
      const cwd = join(scratch, "cwd")
      mkdirSync(join(home, ".pi", "agent"), { recursive: true })
      mkdirSync(join(cwd, ".opencode"), { recursive: true })
      mkdirSync(join(cwd, ".pi"), { recursive: true })

      const userFile = join(home, ".pi", "agent", "antigravity.json")
      const ocFile = join(cwd, ".opencode", "antigravity.json")
      const piFile = join(cwd, ".pi", "antigravity.json")

      writeFileSync(
        userFile,
        '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"signature_cache":{"enabled":false},"soft_quota_threshold_percent":82,"request_jitter_max_ms":1e309}',
        "utf8",
      )
      writeFileSync(ocFile, '{"signature_cache":{"memory_ttl_seconds":120},"max_backoff_seconds":45}', "utf8")
      writeFileSync(piFile, "{ invalid json", "utf8")

      const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex")
      const before = [sha(userFile), sha(ocFile), sha(piFile)]
      const first = loadSharedGuardConfig({ homeDir: home, cwd, env: {} })
      expect([sha(userFile), sha(ocFile), sha(piFile)]).toEqual(before)
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
      expect(first.soft_quota_threshold_percent).toBe(82)
      expect(first.max_backoff_seconds).toBe(45)
      expect(first.request_jitter_max_ms).toBe(0)
      expect(first.signature_cache).toEqual({
        enabled: false,
        memory_ttl_seconds: 120,
        disk_ttl_seconds: 172_800,
        write_interval_seconds: 60,
      })

      first.soft_quota_threshold_percent = 1
      first.signature_cache.memory_ttl_seconds = 999_999
      const second = loadSharedGuardConfig({ homeDir: home, cwd, env: {} })
      expect(second.soft_quota_threshold_percent).toBe(82)
      expect(second.signature_cache.memory_ttl_seconds).toBe(120)
      expect(DEFAULT_SHARED_GUARD_CONFIG.soft_quota_threshold_percent).toBe(70)
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})
