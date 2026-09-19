export type StandardReasoningLevel = "off" | "minimal" | "low" | "medium" | "high"

const ANSWER_RESERVE = 1024

type NativeThinkingLevel = "low" | "medium" | "high"

export interface ToolEvidenceRef {
  readonly record: string
  readonly revision: string
  readonly publicModelId: string
  readonly reasoning: StandardReasoningLevel
  readonly wireModel: string
}

export const GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE = "gemini-parameters-json-schema" as const
export type ToolSchemaProfile = typeof GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE

export type ToolCapability =
  | { readonly state: "disabled", readonly contractRevision: 1, readonly reason: "missing-direct-evidence" | "stale-or-conflicting-evidence" | "claude-continuity-unproven" }
  | { readonly state: "fixture-qualified", readonly contractRevision: 1, readonly fixtureEvidence: ToolEvidenceRef }
  | { readonly state: "enabled", readonly contractRevision: 1, readonly schemaProfile: ToolSchemaProfile, readonly fixtureEvidence: ToolEvidenceRef, readonly directEvidence: ToolEvidenceRef }

type NativeRoute = {
  readonly wireModel: string
  readonly thinking: { readonly kind: "native-level", readonly thinkingLevel: NativeThinkingLevel, readonly includeThoughts: boolean }
}
type IntegerBudgetRoute = {
  readonly wireModel: string
  readonly thinking: { readonly kind: "budget", readonly budget: number, readonly includeThoughts: boolean } | { readonly kind: "omit" }
}
export type GenerationRoute = NativeRoute | IntegerBudgetRoute
type ConfiguredGenerationRoute = GenerationRoute & { readonly tools: ToolCapability }

export interface CatalogEntry {
  readonly publicId: string
  readonly descriptor: {
    readonly name: string
    readonly thinkingLevelMap: Readonly<Record<"minimal" | "low" | "medium" | "high", string | null>>
    readonly contextWindow: number
    readonly maxTokens: number
  }
  readonly routes: Readonly<Partial<Record<StandardReasoningLevel, ConfiguredGenerationRoute>>>
  readonly replay: { readonly kind: "same-public-model" | "strip" }
  readonly response: { readonly kind: "gemini-envelope", readonly family: "gemini" | "claude" | "gpt-oss" }
}

const CATALOG = freeze(defineCatalog([{
  publicId: "antigravity-gemini-3.8-flash",
  descriptor: {
    name: "Gemini 3.8 Flash (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  routes: {
    off: { wireModel: "gemini-3.8-flash-low", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.8-flash-off-v1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "off", wireModel: "gemini-3.8-flash-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-3.8-flash-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.8-flash-low-v1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "low", wireModel: "gemini-3.8-flash-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-3.8-flash-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.8-flash-medium-v1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "medium", wireModel: "gemini-3.8-flash-medium" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-3.8-flash-high", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.8-flash-high-v1", publicModelId: "antigravity-gemini-3.8-flash", reasoning: "high", wireModel: "gemini-3.8-flash-high" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-gemini-3.7-flash",
  descriptor: {
    name: "Gemini 3.7 Flash (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  routes: {
    off: { wireModel: "gemini-3.7-flash-low", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.7-flash-off-v1", publicModelId: "antigravity-gemini-3.7-flash", reasoning: "off", wireModel: "gemini-3.7-flash-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-3.7-flash-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.7-flash-low-v1", publicModelId: "antigravity-gemini-3.7-flash", reasoning: "low", wireModel: "gemini-3.7-flash-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-3.7-flash-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.7-flash-medium-v1", publicModelId: "antigravity-gemini-3.7-flash", reasoning: "medium", wireModel: "gemini-3.7-flash-medium" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-3.7-flash-high", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.7-flash-high-v1", publicModelId: "antigravity-gemini-3.7-flash", reasoning: "high", wireModel: "gemini-3.7-flash-high" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-gemini-3.6-flash",
  descriptor: {
    name: "Gemini 3.6 Flash (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  routes: {
    off: { wireModel: "gemini-3.6-flash-low", thinking: { kind: "omit" }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.6-flash-off-v1", publicModelId: "antigravity-gemini-3.6-flash", reasoning: "off", wireModel: "gemini-3.6-flash-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-3.6-flash-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.6-flash-low-v1", publicModelId: "antigravity-gemini-3.6-flash", reasoning: "low", wireModel: "gemini-3.6-flash-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-3.6-flash-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.6-flash-medium-v1", publicModelId: "antigravity-gemini-3.6-flash", reasoning: "medium", wireModel: "gemini-3.6-flash-medium" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-3.6-flash-high", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.6-flash-high-v1", publicModelId: "antigravity-gemini-3.6-flash", reasoning: "high", wireModel: "gemini-3.6-flash-high" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-gemini-3.1-pro",
  descriptor: {
    name: "Gemini 3.1 Pro (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: "low", medium: null, high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 65_535,
  },
  routes: {
    off: { wireModel: "gemini-3.1-pro-low", thinking: { kind: "omit" }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.1-pro-off-v1", publicModelId: "antigravity-gemini-3.1-pro", reasoning: "off", wireModel: "gemini-3.1-pro-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-3.1-pro-low", thinking: { kind: "budget", budget: 1001, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.1-pro-low-v1", publicModelId: "antigravity-gemini-3.1-pro", reasoning: "low", wireModel: "gemini-3.1-pro-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-pro-agent", thinking: { kind: "budget", budget: 10001, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.1-pro-high-v1", publicModelId: "antigravity-gemini-3.1-pro", reasoning: "high", wireModel: "gemini-pro-agent" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-claude-sonnet-4.6",
  descriptor: {
    name: "Claude Sonnet 4.6 (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: null, medium: null, high: "high" },
    contextWindow: 250_000,
    maxTokens: 64_000,
  },
  routes: {
    off: { wireModel: "claude-sonnet-4-6", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: disabled("claude-continuity-unproven") },
    high: { wireModel: "claude-sonnet-4-6", thinking: { kind: "budget", budget: 1024, includeThoughts: true }, tools: disabled("claude-continuity-unproven") },
  },
  replay: { kind: "strip" },
  response: { kind: "gemini-envelope", family: "claude" },
}, {
  publicId: "antigravity-claude-opus-4.6-thinking",
  descriptor: {
    name: "Claude Opus 4.6 Thinking (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: null, medium: null, high: "high" },
    contextWindow: 250_000,
    maxTokens: 64_000,
  },
  routes: {
    off: { wireModel: "claude-opus-4-6-thinking", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: disabled("claude-continuity-unproven") },
    high: { wireModel: "claude-opus-4-6-thinking", thinking: { kind: "budget", budget: 1024, includeThoughts: true }, tools: disabled("claude-continuity-unproven") },
  },
  replay: { kind: "strip" },
  response: { kind: "gemini-envelope", family: "claude" },
}, {
  publicId: "antigravity-gpt-oss-120b",
  descriptor: {
    name: "GPT-OSS 120B (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: null, medium: "medium", high: null },
    contextWindow: 131_072,
    maxTokens: 32_768,
  },
  routes: {
    off: { wireModel: "gpt-oss-120b-medium", thinking: { kind: "omit" }, tools: disabled("missing-direct-evidence") },
    medium: { wireModel: "gpt-oss-120b-medium", thinking: { kind: "budget", budget: 8192, includeThoughts: true }, tools: disabled("missing-direct-evidence") },
  },
  replay: { kind: "strip" },
  response: { kind: "gemini-envelope", family: "gpt-oss" },
}] as const satisfies readonly CatalogEntry[]))

type Catalog = typeof CATALOG
export type AntigravityPublicModelId = Catalog[number]["publicId"]
export type AntigravityWireModelId = Catalog[number]["routes"][keyof Catalog[number]["routes"]]["wireModel"]

const lookup = new Map<string, CatalogEntry>(CATALOG.map((entry) => [entry.publicId, entry]))

function disabled(reason: Extract<ToolCapability, { readonly state: "disabled" }>["reason"]): ToolCapability {
  return { state: "disabled", contractRevision: 1, reason }
}

function enabled(evidence: ToolEvidenceRef, schemaProfile: ToolSchemaProfile = GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE): ToolCapability {
  return { state: "enabled", contractRevision: 1, schemaProfile, fixtureEvidence: evidence, directEvidence: evidence }
}

/** Constructs deterministic capability data for hermetic serializer tests only. */
export function createEnabledToolCapability(evidence: ToolEvidenceRef, schemaProfile: ToolSchemaProfile = GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE): Extract<ToolCapability, { readonly state: "enabled" }> {
  return freeze({ state: "enabled", contractRevision: 1, schemaProfile, fixtureEvidence: evidence, directEvidence: evidence })
}

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}

export function defineCatalog<T extends readonly {
  readonly publicId: string
  readonly descriptor?: CatalogEntry["descriptor"]
  readonly routes: Readonly<Record<string, { readonly wireModel: string, readonly thinking?: GenerationRoute["thinking"] }>>
}[]>(entries: T): T {
  const identities = new Set<string>()
  for (const entry of entries) {
    if (identities.has(entry.publicId)) throw new Error(`Duplicate public model ID: ${entry.publicId}`)
    identities.add(entry.publicId)
    if (!Object.keys(entry.routes).length) throw new Error(`Model has no routes: ${entry.publicId}`)
    if (!entry.descriptor) continue
    for (const [level, route] of Object.entries(entry.routes)) {
      if (!route.thinking) throw new Error(`Route has no thinking policy: ${entry.publicId}/${level}`)
      if (level !== "off" && !Object.hasOwn(entry.descriptor.thinkingLevelMap, level)) {
        throw new Error(`Route is outside descriptor map: ${entry.publicId}/${level}`)
      }
      if (level !== "off" && entry.descriptor.thinkingLevelMap[level as keyof typeof entry.descriptor.thinkingLevelMap] === null) {
        throw new Error(`Route is hidden by descriptor: ${entry.publicId}/${level}`)
      }
      if (route.thinking.kind === "budget" && route.thinking.budget > 0 && Number.isFinite(route.thinking.budget) && route.thinking.budget + ANSWER_RESERVE > entry.descriptor.maxTokens) {
        throw new Error(`Finite thinking budget does not leave answer reserve: ${entry.publicId}/${level}`)
      }
    }
  }
  return entries
}

export function listCatalogEntries(): readonly CatalogEntry[] {
  return CATALOG
}

export function getCatalogEntry(publicId: unknown): CatalogEntry | undefined {
  return typeof publicId === "string" ? lookup.get(publicId) : undefined
}

export function resolveGenerationRoute(entry: CatalogEntry, reasoning: unknown): GenerationRoute {
  return resolveGenerationSelection(entry, reasoning).route
}

export interface GenerationSelection {
  readonly level: StandardReasoningLevel
  readonly route: GenerationRoute
  readonly tools: ToolCapability
}

export function resolveGenerationSelection(entry: CatalogEntry, reasoning: unknown): GenerationSelection {
  const level = reasoning === undefined || reasoning === "off" ? "off" : reasoning
  if (typeof level !== "string" || !entry.routes[level as StandardReasoningLevel]) throw new Error("Unsupported reasoning level")
  const typedLevel = level as StandardReasoningLevel
  const configured = entry.routes[typedLevel]!
  const { tools, ...route } = configured
  return { level: typedLevel, route, tools: resolveToolCapability(tools, entry.publicId, typedLevel, route.wireModel) }
}

export function resolveToolCapability(capability: ToolCapability, publicModelId: string, reasoning: StandardReasoningLevel, wireModel: string): ToolCapability {
  if (capability.state === "disabled") return capability
  const evidence = capability.state === "enabled" ? [capability.fixtureEvidence, capability.directEvidence] : [capability.fixtureEvidence]
  if (capability.contractRevision !== 1 || evidence.some((item) => item.publicModelId !== publicModelId || item.reasoning !== reasoning || item.wireModel !== wireModel)) {
    return freeze(disabled("stale-or-conflicting-evidence"))
  }
  return capability
}

export function toPiModelDescriptor(entry: CatalogEntry) {
  return {
    id: entry.publicId,
    name: entry.descriptor.name,
    reasoning: true,
    thinkingLevelMap: { ...entry.descriptor.thinkingLevelMap },
    input: ["text"] as "text"[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: entry.descriptor.contextWindow,
    maxTokens: entry.descriptor.maxTokens,
  }
}
