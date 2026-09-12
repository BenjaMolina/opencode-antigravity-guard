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
})
