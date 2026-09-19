import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import {
  createEnabledToolCapability,
  defineCatalog,
  getCatalogEntry,
  listCatalogEntries,
  resolveGenerationRoute,
  resolveGenerationSelection,
  resolveToolCapability,
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
    expect(resolveGenerationRoute(entry!, undefined)).toEqual({ wireModel: "gemini-3.8-flash-low", thinking: { kind: "budget", budget: 0, includeThoughts: false } })
    expect(resolveGenerationRoute(entry!, "high")).toEqual({ wireModel: "gemini-3.8-flash-high", thinking: { kind: "budget", budget: -1, includeThoughts: true } })
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

  it("rejects routes hidden by a descriptor and finite budgets without answer reserve", () => {
    const definition = {
      publicId: "one",
      descriptor: {
        name: "One",
        thinkingLevelMap: { minimal: null, low: "low", medium: null, high: null },
        contextWindow: 100,
        maxTokens: 1024,
      },
      replay: { kind: "strip" as const },
      response: { kind: "gemini-envelope" as const, family: "gemini" as const },
    }
    expect(() => defineCatalog([{ ...definition, routes: {
      high: { wireModel: "one", thinking: { kind: "budget" as const, budget: 1, includeThoughts: true } },
    } }])).toThrow("Route is hidden by descriptor")
    expect(() => defineCatalog([{ ...definition, routes: {
      xhigh: { wireModel: "one", thinking: { kind: "budget" as const, budget: 1, includeThoughts: true } },
    } }])).toThrow("Route is outside descriptor map")
    expect(() => defineCatalog([{ ...definition, routes: {
      max: { wireModel: "one", thinking: { kind: "budget" as const, budget: 1, includeThoughts: true } },
    } }])).toThrow("Route is outside descriptor map")
    expect(() => defineCatalog([{ ...definition, routes: {
      low: { wireModel: "one", thinking: { kind: "budget" as const, budget: 1, includeThoughts: true } },
    } }])).toThrow("does not leave answer reserve")
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

  it("documents the exact static catalog without advertising blocked models or levels", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8")
    const catalog = listCatalogEntries().map((entry) => ({
      id: entry.publicId,
      levels: Object.keys(entry.routes).join(", "),
      contextWindow: entry.descriptor.contextWindow.toLocaleString("en-US"),
      maxTokens: entry.descriptor.maxTokens.toLocaleString("en-US"),
    }))

    expect(readme).toContain("| Public ID | Exposed Pi levels | Context / output |");
    for (const entry of catalog) {
      expect(readme).toContain(`| \`${entry.id}\` | ${entry.levels} | ${entry.contextWindow} / ${entry.maxTokens} |`)
    }
    expect(readme).toContain("`antigravity-gemini-3.5-flash` is not registered or advertised as supported")
    expect(readme).toContain("Unsupported levels are not advertised")
  })

  it("keeps per-route frozen capability evidence fail-closed except for the directly admitted route", () => {
    const catalog = listCatalogEntries()
    for (const entry of catalog) {
      for (const level of Object.keys(entry.routes)) {
        const selection = resolveGenerationSelection(entry, level)
        expect(Object.isFrozen(selection.tools)).toBe(true)
        const isDirectlyAdmitted = entry.publicId === "antigravity-gemini-3.8-flash"
        expect(selection.tools.state).toBe(isDirectlyAdmitted ? "enabled" : "disabled")
        if (isDirectlyAdmitted) {
          const wireModel = level === "high" ? "gemini-3.8-flash-high" : level === "medium" ? "gemini-3.8-flash-medium" : "gemini-3.8-flash-low"
          const revision = `gemini-3.8-flash-${level}-v1`
          expect(selection.tools).toMatchObject({
            state: "enabled",
            contractRevision: 1,
            fixtureEvidence: { record: "pi-json-tool-loop", revision, publicModelId: entry.publicId, reasoning: level, wireModel },
            directEvidence: { record: "pi-json-tool-loop", revision, publicModelId: entry.publicId, reasoning: level, wireModel },
          })
          continue
        }
        if (selection.tools.state !== "disabled") throw new Error("expected disabled capability")
        expect(selection.tools.reason).toBe(entry.response.family === "claude" ? "claude-continuity-unproven" : "missing-direct-evidence")
      }
    }
    const gemini = getCatalogEntry("antigravity-gemini-3.8-flash")!
    const low = resolveGenerationSelection(gemini, "low")
    const high = resolveGenerationSelection(gemini, "high")
    expect(low.level).toBe("low")
    expect(low.route).toEqual(resolveGenerationRoute(gemini, "low"))
    expect(low.tools).not.toBe(high.tools)
    const stale = { state: "fixture-qualified", contractRevision: 0, fixtureEvidence: { record: "fixture", revision: "1", publicModelId: gemini.publicId, reasoning: "low", wireModel: low.route.wireModel } } as unknown as Parameters<typeof resolveToolCapability>[0]
    expect(resolveToolCapability(stale, gemini.publicId, "low", low.route.wireModel)).toEqual({ state: "disabled", contractRevision: 1, reason: "stale-or-conflicting-evidence" })
  })

  it("enables the directly admitted Gemini 3.8 Flash off route", () => {
    const entry = getCatalogEntry("antigravity-gemini-3.8-flash")!
    const capability = resolveGenerationSelection(entry, "off").tools
        expect(capability.state === "enabled" ? capability.schemaProfile : undefined).toBe("gemini-parameters-json-schema")
  })

    it("keeps disabled Gemini, Claude, and GPT routes profile-free", () => {
      for (const publicId of ["antigravity-gemini-3.7-flash", "antigravity-claude-sonnet-4.6", "antigravity-gpt-oss-120b"]) {
        const capability = resolveGenerationSelection(getCatalogEntry(publicId)!, "off").tools
        expect(capability.state).toBe("disabled")
        expect("schemaProfile" in capability).toBe(false)
      }
    })

    it("constructs immutable enabled fixture data independently from catalog admission", () => {
    const entry = getCatalogEntry("antigravity-gemini-3.8-flash")!
    const selection = resolveGenerationSelection(entry, "off")
    const enabled = createEnabledToolCapability({ record: "fixture", revision: "1", publicModelId: entry.publicId, reasoning: "off", wireModel: selection.route.wireModel }, "gemini-parameters-json-schema")
    expect(Object.isFrozen(enabled)).toBe(true)
    expect(enabled.state).toBe("enabled")
    expect(resolveGenerationSelection(entry, "off").tools.state).toBe("enabled")
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
