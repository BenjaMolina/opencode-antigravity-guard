import { describe, expect, it } from "vitest"

import {
  defineCatalog,
  getCatalogEntry,
  listCatalogEntries,
  resolveGenerationRoute,
  toPiModelDescriptor,
} from "./catalog.ts"

describe("Antigravity model catalog", () => {
  it("keeps the released 3.8 descriptor and literal tiered routes in registration order", () => {
    const [entry] = listCatalogEntries()
    expect(entry?.publicId).toBe("antigravity-gemini-3.8-flash")
    expect(toPiModelDescriptor(entry!)).toEqual({
      id: "antigravity-gemini-3.8-flash",
      name: "Gemini 3.8 Flash (Antigravity, text only)",
      reasoning: true,
      thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high" },
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1_048_576,
      maxTokens: 65_536,
    })
    expect(resolveGenerationRoute(entry!, undefined)).toEqual({ wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "native-level", thinkingLevel: "low", includeThoughts: false } })
    expect(resolveGenerationRoute(entry!, "high")).toEqual({ wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "native-level", thinkingLevel: "high", includeThoughts: true } })
  })

  it("rejects unsupported levels and protects internal descriptors from host mutation", () => {
    const entry = getCatalogEntry("antigravity-gemini-3.8-flash")!
    expect(() => resolveGenerationRoute(entry, "minimal")).toThrow("Unsupported reasoning level")
    expect(() => resolveGenerationRoute(entry, "xhigh")).toThrow("Unsupported reasoning level")
    expect(() => resolveGenerationRoute(entry, "max")).toThrow("Unsupported reasoning level")
    expect(() => resolveGenerationRoute(entry, "unknown")).toThrow("Unsupported reasoning level")
    const descriptor = toPiModelDescriptor(entry)
    descriptor.input.pop()
    expect(toPiModelDescriptor(entry).input).toEqual(["text"])
    expect(Object.isFrozen(entry)).toBe(true)
    expect(Object.isFrozen(entry.routes)).toBe(true)
  })

  it("rejects duplicate public identities but allows intentionally repeated wire identities", () => {
    expect(() => defineCatalog([
      { publicId: "one", routes: { off: { wireModel: "same" } } },
      { publicId: "one", routes: { off: { wireModel: "same" } } },
    ])).toThrow("Duplicate public model ID")
    expect(() => defineCatalog([{ publicId: "one", routes: {} }])).toThrow("Model has no routes")
    expect(() => defineCatalog([{ publicId: "one", routes: {
      off: { wireModel: "same" }, low: { wireModel: "same" },
    } }])).not.toThrow()
  })

  it("admits Claude Sonnet and Opus only at the evidenced integer-budget routes", () => {
    for (const [publicId, wireModel] of [
      ["antigravity-claude-sonnet-4.6", "claude-sonnet-4-6"],
      ["antigravity-claude-opus-4.6-thinking", "claude-opus-4-6-thinking"],
    ]) {
      const entry = getCatalogEntry(publicId)!
      expect(toPiModelDescriptor(entry)).toMatchObject({
        contextWindow: 250_000,
        maxTokens: 64_000,
        thinkingLevelMap: { minimal: null, low: null, medium: null, high: "high" },
      })
      expect(resolveGenerationRoute(entry, "off")).toEqual({ wireModel, thinking: { kind: "budget", budget: 0, includeThoughts: false } })
      expect(resolveGenerationRoute(entry, "high")).toEqual({ wireModel, thinking: { kind: "budget", budget: 1024, includeThoughts: true } })
      for (const level of ["minimal", "low", "medium"] as const) expect(() => resolveGenerationRoute(entry, level)).toThrow("Unsupported reasoning level")
    }
  })

  it("admits GPT-OSS only at literal off and medium routes", () => {
    const entry = getCatalogEntry("antigravity-gpt-oss-120b")!
    expect(toPiModelDescriptor(entry)).toMatchObject({
      contextWindow: 131_072,
      maxTokens: 32_768,
      thinkingLevelMap: { minimal: null, low: null, medium: "medium", high: null },
    })
    expect(resolveGenerationRoute(entry, "off")).toEqual({ wireModel: "gpt-oss-120b-medium", thinking: { kind: "omit" } })
    expect(resolveGenerationRoute(entry, "medium")).toEqual({ wireModel: "gpt-oss-120b-medium", thinking: { kind: "budget", budget: 8192, includeThoughts: true } })
    for (const level of ["minimal", "low", "high", "xhigh", "max"] as const) expect(() => resolveGenerationRoute(entry, level)).toThrow("Unsupported reasoning level")
  })

  it("contains only the evidence-admitted Gemini routes with literal budgets and omissions", () => {
    expect(listCatalogEntries().map((entry) => entry.publicId)).toEqual([
      "antigravity-gemini-3.8-flash",
      "antigravity-gemini-3.7-flash",
      "antigravity-gemini-3.6-flash",
      "antigravity-gemini-3.1-pro",
      "antigravity-claude-sonnet-4.6",
      "antigravity-claude-opus-4.6-thinking",
      "antigravity-gpt-oss-120b",
    ])
    expect(getCatalogEntry("antigravity-gemini-3.5-flash")).toBeUndefined()
    expect(toPiModelDescriptor(getCatalogEntry("antigravity-gemini-3.1-pro")!)).toMatchObject({
      thinkingLevelMap: { minimal: null, low: "low", medium: null, high: "high" },
      contextWindow: 1_048_576,
      maxTokens: 65_535,
    })

    const route = (model: string, level: "off" | "low" | "medium" | "high") =>
      resolveGenerationRoute(getCatalogEntry(model)!, level)
    expect(route("antigravity-gemini-3.7-flash", "off")).toEqual({ wireModel: "gemini-3.7-flash-low", thinking: { kind: "budget", budget: 0, includeThoughts: false } })
    expect(route("antigravity-gemini-3.7-flash", "medium")).toEqual({ wireModel: "gemini-3.7-flash-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true } })
    expect(route("antigravity-gemini-3.7-flash", "high")).toEqual({ wireModel: "gemini-3.7-flash-high", thinking: { kind: "budget", budget: -1, includeThoughts: true } })
    expect(route("antigravity-gemini-3.6-flash", "off")).toEqual({ wireModel: "gemini-3.6-flash-low", thinking: { kind: "omit" } })
    expect(route("antigravity-gemini-3.6-flash", "low")).toEqual({ wireModel: "gemini-3.6-flash-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true } })
    expect(route("antigravity-gemini-3.6-flash", "medium")).toEqual({ wireModel: "gemini-3.6-flash-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true } })
    expect(route("antigravity-gemini-3.1-pro", "off")).toEqual({ wireModel: "gemini-3.1-pro-low", thinking: { kind: "omit" } })
    expect(route("antigravity-gemini-3.1-pro", "low")).toEqual({ wireModel: "gemini-3.1-pro-low", thinking: { kind: "budget", budget: 1001, includeThoughts: true } })
    expect(route("antigravity-gemini-3.1-pro", "high")).toEqual({ wireModel: "gemini-pro-agent", thinking: { kind: "budget", budget: 10001, includeThoughts: true } })
    expect(() => route("antigravity-gemini-3.1-pro", "medium")).toThrow("Unsupported reasoning level")
  })
})
