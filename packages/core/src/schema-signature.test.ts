import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import * as os from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  EMPTY_SCHEMA_PLACEHOLDER_DESCRIPTION,
  EMPTY_SCHEMA_PLACEHOLDER_NAME,
  MIN_THOUGHT_SIGNATURE_LENGTH,
  SKIP_THOUGHT_SIGNATURE,
  SignatureCache,
  buildSignatureSessionKey,
  cleanJSONSchemaForAntigravity,
  createSessionSignatureCache,
  createSignatureCache,
  resolveSharedGuardPaths,
  signatureCacheProjectKey,
  stripThinkingTierSuffixForCacheKey,
  toGeminiSchema,
} from "./index.ts"

describe("Phase 4 core constants & shared signature-cache path resolution", () => {
  it("exports schema placeholder and thought-signature sentinel constants", () => {
    expect(EMPTY_SCHEMA_PLACEHOLDER_NAME).toBe("_placeholder")
    expect(EMPTY_SCHEMA_PLACEHOLDER_DESCRIPTION).toBe("Placeholder. Always pass true.")
    expect(SKIP_THOUGHT_SIGNATURE).toBe("skip_thought_signature_validator")
    expect(MIN_THOUGHT_SIGNATURE_LENGTH).toBe(50)
  })

  it("resolves antigravity-signature-cache.json in shared OpenCode and standalone Pi directories", () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "ag-guard-sigpath-"))
    try {
      const fakeHome = join(scratch, "home")
      const projectDir = join(scratch, "project")
      const piPaths = resolveSharedGuardPaths({ homeDir: fakeHome, env: {}, cwd: projectDir })
      expect(piPaths.signatureCachePath).toBe(
        join(fakeHome, ".pi", "agent", "antigravity-signature-cache.json"),
      )

      const customOpencode = join(scratch, "opencode-dir")
      const ocPaths = resolveSharedGuardPaths({
        homeDir: fakeHome,
        env: { OPENCODE_CONFIG_DIR: customOpencode },
        cwd: projectDir,
      })
      expect(ocPaths.signatureCachePath).toBe(
        join(customOpencode, "antigravity-signature-cache.json"),
      )
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })
})

describe("Phase 4 core cleanJSONSchemaForAntigravity & toGeminiSchema", () => {
  it("cleans $ref, const, enum hints, constraints, allOf, anyOf/oneOf, nullable type arrays, and empty object schemas", () => {
    const rawSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      allOf: [
        {
          properties: {
            mode: { const: "strict" },
            tier: {
              type: "string",
              description: "Execution tier",
              enum: ["fast", "deep"],
            },
            format: {
              description: "Output format",
              anyOf: [{ const: "text" }, { const: "markdown" }, { const: "html" }],
            },
          },
          required: ["mode"],
        },
        {
          properties: {
            query: {
              type: "string",
              minLength: 3,
              maxLength: 120,
              pattern: "^[a-z]+$",
            },
            payload: {
              description: "Nested ref",
              $ref: "#/$defs/PayloadNode",
            },
            choice: {
              anyOf: [
                { type: "string" },
                { type: "object", properties: { id: { type: "number" } } },
              ],
            },
            optionalTag: {
              type: ["string", "null"],
              default: "none",
            },
            emptyMeta: {
              type: "object",
              properties: {},
            },
          },
          required: ["query", "optionalTag", "nonexistentProp"],
        },
      ],
    }

    const cleaned = cleanJSONSchemaForAntigravity(rawSchema) as Record<string, any>
    expect(cleaned.$schema).toBeUndefined()
    expect(cleaned.additionalProperties).toBeUndefined()
    expect(cleaned.allOf).toBeUndefined()
    expect(cleaned.description).toContain("No extra properties allowed")

    expect(cleaned.properties.mode).toEqual({ enum: ["strict"] })
    expect(cleaned.properties.tier).toEqual({
      type: "string",
      enum: ["fast", "deep"],
      description: "Execution tier (Allowed: fast, deep)",
    })
    expect(cleaned.properties.format).toEqual({
      type: "string",
      enum: ["text", "markdown", "html"],
      description: "Output format",
    })
    expect(cleaned.properties.query).toEqual({
      type: "string",
      description: "minLength: 3 (maxLength: 120) (pattern: ^[a-z]+$)",
    })
    expect(cleaned.properties.payload).toEqual({
      type: "object",
      description: "Nested ref (See: PayloadNode)",
      properties: {
        _placeholder: {
          type: "boolean",
          description: "Placeholder. Always pass true.",
        },
      },
      required: ["_placeholder"],
    })
    expect(cleaned.properties.choice.type).toBe("object")
    expect(cleaned.properties.choice.description).toContain("Accepts: string | object")
    expect(cleaned.properties.optionalTag).toEqual({
      type: "string",
      description: "default: none (nullable)",
    })
    expect(cleaned.properties.emptyMeta).toEqual({
      type: "object",
      properties: {
        _placeholder: {
          type: "boolean",
          description: "Placeholder. Always pass true.",
        },
      },
      required: ["_placeholder"],
    })
    // optionalTag (nullable) and nonexistentProp must be stripped from root required
    expect(cleaned.required).toEqual(["mode", "query"])
  })

  it("transforms schemas to uppercase Gemini protobuf format with array items and empty-object placeholders", () => {
    const gemini = toGeminiSchema({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      additionalProperties: false,
      properties: {
        tags: { type: "array" },
        emptyObj: { type: "object", properties: {} },
      },
      required: ["tags", "missing"],
    }) as Record<string, any>

    expect(gemini).toEqual({
      type: "OBJECT",
      properties: {
        tags: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
        emptyObj: {
          type: "OBJECT",
          properties: {
            _placeholder: {
              type: "BOOLEAN",
              description: "Placeholder parameter. Always pass true.",
            },
          },
          required: ["_placeholder"],
        },
      },
      required: ["tags"],
    })
  })
})

describe("Phase 4 core disk SignatureCache & SessionSignatureCache", () => {
  it("persists signatures atomically to disk, updates .gitignore, reloads across restarts, and honors memory vs disk TTLs", async () => {
    const scratch = mkdtempSync(join(os.tmpdir(), "ag-guard-sigcache-"))
    try {
      const cacheFilePath = join(scratch, "config", "antigravity-signature-cache.json")
      let currentNow = 1_000_000

      const disk1 = createSignatureCache(
        {
          enabled: true,
          memory_ttl_seconds: 60,
          disk_ttl_seconds: 3_600,
          write_interval_seconds: 300,
        },
        { cacheFilePath, now: () => currentNow },
      )
      expect(disk1).toBeInstanceOf(SignatureCache)

      const session1 = createSessionSignatureCache({
        diskCache: disk1,
        now: () => currentNow,
      })
      session1.cacheSignature("sess-1", "Let us inspect the schema.", "c2lnbmF0dXJlLTE=")
      expect(session1.getCachedSignature("sess-1", "Let us inspect the schema.")).toBe(
        "c2lnbmF0dXJlLTE=",
      )

      disk1!.storeThinking("sess-1:full", "Full thought text", "c2lnbmF0dXJlLTI=", ["call-1"])
      expect(disk1!.hasThinking("sess-1:full")).toBe(true)
      expect(disk1!.retrieveThinking("sess-1:full")).toEqual({
        text: "Full thought text",
        signature: "c2lnbmF0dXJlLTI=",
        toolIds: ["call-1"],
      })

      // Shutdown flushes dirty entries to disk and writes .gitignore
      session1.shutdown()
      expect(existsSync(cacheFilePath)).toBe(true)
      const gitignore = readFileSync(join(scratch, "config", ".gitignore"), "utf8")
      expect(gitignore).toContain("antigravity-signature-cache.json")

      // Advance 30s (within disk TTL and within fresh instance's memory TTL) -> reload in new process instance
      currentNow += 30_000
      const disk2 = createSignatureCache(
        {
          enabled: true,
          memory_ttl_seconds: 60,
          disk_ttl_seconds: 3_600,
          write_interval_seconds: 300,
        },
        { cacheFilePath, now: () => currentNow },
      )
      const session2 = createSessionSignatureCache({
        diskCache: disk2,
        now: () => currentNow,
      })
      expect(session2.getCachedSignature("sess-1", "Let us inspect the schema.")).toBe(
        "c2lnbmF0dXJlLTE=",
      )
      session2.shutdown()

      // Advance beyond disk_ttl_seconds (3,600s) -> expired on reload
      currentNow += 3_700_000
      const disk3 = createSignatureCache(
        {
          enabled: true,
          memory_ttl_seconds: 60,
          disk_ttl_seconds: 3_600,
          write_interval_seconds: 300,
        },
        { cacheFilePath, now: () => currentNow },
      )
      const session3 = createSessionSignatureCache({
        diskCache: disk3,
        now: () => currentNow,
      })
      expect(session3.getCachedSignature("sess-1", "Let us inspect the schema.")).toBeUndefined()
      session3.shutdown()
    } finally {
      rmSync(scratch, { recursive: true, force: true })
    }
  })

  it("keeps Gemini 3/4 and gemini-pro-agent signature session keys project-independent while partitioning Claude by project", () => {
    expect(stripThinkingTierSuffixForCacheKey("gemini-4-neon-xhigh")).toBe("gemini-4-neon")
    expect(stripThinkingTierSuffixForCacheKey("claude-opus-4-6-thinking-high")).toBe(
      "claude-opus-4-6-thinking",
    )
    expect(stripThinkingTierSuffixForCacheKey("gpt-oss-120b-medium")).toBe("gpt-oss-120b-medium")

    expect(signatureCacheProjectKey("gemini-3.8-flash", "proj-a")).toBeUndefined()
    expect(signatureCacheProjectKey("gemini-4-argon-high", "proj-b")).toBeUndefined()
    expect(signatureCacheProjectKey("gemini-pro-agent", "proj-c")).toBeUndefined()
    expect(signatureCacheProjectKey("claude-opus-4-6-thinking", "proj-a")).toBe("proj-a")

    const gKeyA = buildSignatureSessionKey(
      "pi",
      "gemini-4-argon",
      "traj-1",
      signatureCacheProjectKey("gemini-4-argon", "proj-a"),
    )
    const gKeyB = buildSignatureSessionKey(
      "pi",
      "gemini-4-argon",
      "traj-1",
      signatureCacheProjectKey("gemini-4-argon", "proj-b"),
    )
    expect(gKeyA).toBe(gKeyB)
  })
})
