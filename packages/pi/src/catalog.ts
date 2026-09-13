export type StandardReasoningLevel = "off" | "minimal" | "low" | "medium" | "high"

type NativeThinkingLevel = "low" | "medium" | "high"
type NativeRoute = {
  readonly wireModel: string
  readonly thinking: { readonly kind: "native-level", readonly thinkingLevel: NativeThinkingLevel, readonly includeThoughts: boolean }
}
type IntegerBudgetRoute = {
  readonly wireModel: string
  readonly thinking: { readonly kind: "budget", readonly budget: number, readonly includeThoughts: boolean } | { readonly kind: "omit" }
}
export type GenerationRoute = NativeRoute | IntegerBudgetRoute

export interface CatalogEntry {
  readonly publicId: string
  readonly descriptor: {
    readonly name: string
    readonly thinkingLevelMap: Readonly<Record<"minimal" | "low" | "medium" | "high", string | null>>
    readonly contextWindow: number
    readonly maxTokens: number
  }
  readonly routes: Readonly<Partial<Record<StandardReasoningLevel, GenerationRoute>>>
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
    off: { wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "native-level", thinkingLevel: "low", includeThoughts: false } },
    low: { wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "native-level", thinkingLevel: "low", includeThoughts: true } },
    medium: { wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "native-level", thinkingLevel: "medium", includeThoughts: true } },
    high: { wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "native-level", thinkingLevel: "high", includeThoughts: true } },
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
    off: { wireModel: "gemini-3.7-flash-low", thinking: { kind: "budget", budget: 0, includeThoughts: false } },
    low: { wireModel: "gemini-3.7-flash-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true } },
    medium: { wireModel: "gemini-3.7-flash-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true } },
    high: { wireModel: "gemini-3.7-flash-high", thinking: { kind: "budget", budget: -1, includeThoughts: true } },
  },
  replay: { kind: "strip" },
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
    off: { wireModel: "gemini-3.6-flash-low", thinking: { kind: "omit" } },
    low: { wireModel: "gemini-3.6-flash-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true } },
    medium: { wireModel: "gemini-3.6-flash-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true } },
    high: { wireModel: "gemini-3.6-flash-high", thinking: { kind: "budget", budget: -1, includeThoughts: true } },
  },
  replay: { kind: "strip" },
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
    off: { wireModel: "gemini-3.1-pro-low", thinking: { kind: "omit" } },
    low: { wireModel: "gemini-3.1-pro-low", thinking: { kind: "budget", budget: 1001, includeThoughts: true } },
    high: { wireModel: "gemini-pro-agent", thinking: { kind: "budget", budget: 10001, includeThoughts: true } },
  },
  replay: { kind: "strip" },
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
    off: { wireModel: "claude-sonnet-4-6", thinking: { kind: "budget", budget: 0, includeThoughts: false } },
    high: { wireModel: "claude-sonnet-4-6", thinking: { kind: "budget", budget: 1024, includeThoughts: true } },
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
    off: { wireModel: "claude-opus-4-6-thinking", thinking: { kind: "budget", budget: 0, includeThoughts: false } },
    high: { wireModel: "claude-opus-4-6-thinking", thinking: { kind: "budget", budget: 1024, includeThoughts: true } },
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
    off: { wireModel: "gpt-oss-120b-medium", thinking: { kind: "omit" } },
    medium: { wireModel: "gpt-oss-120b-medium", thinking: { kind: "budget", budget: 8192, includeThoughts: true } },
  },
  replay: { kind: "strip" },
  response: { kind: "gemini-envelope", family: "gpt-oss" },
}] as const satisfies readonly CatalogEntry[]))

type Catalog = typeof CATALOG
export type AntigravityPublicModelId = Catalog[number]["publicId"]
export type AntigravityWireModelId = Catalog[number]["routes"][keyof Catalog[number]["routes"]]["wireModel"]

const lookup = new Map<string, CatalogEntry>(CATALOG.map((entry) => [entry.publicId, entry]))

function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value)
    for (const child of Object.values(value)) freeze(child)
  }
  return value
}

export function defineCatalog<T extends readonly { readonly publicId: string, readonly routes: Readonly<Record<string, { readonly wireModel: string }>> }[]>(entries: T): T {
  const identities = new Set<string>()
  for (const entry of entries) {
    if (identities.has(entry.publicId)) throw new Error(`Duplicate public model ID: ${entry.publicId}`)
    identities.add(entry.publicId)
    if (!Object.keys(entry.routes).length) throw new Error(`Model has no routes: ${entry.publicId}`)
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
  const level = reasoning === undefined || reasoning === "off" ? "off" : reasoning
  if (typeof level !== "string" || !entry.routes[level as StandardReasoningLevel]) throw new Error("Unsupported reasoning level")
  return entry.routes[level as StandardReasoningLevel]!
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
