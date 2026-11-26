export type StandardReasoningLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"

const ANSWER_RESERVE = 1024

type NativeThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh"

export interface ToolEvidenceRef {
  readonly record: string
  readonly revision: string
  readonly publicModelId: string
  readonly reasoning: StandardReasoningLevel
  readonly wireModel: string
}

export const GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE = "gemini-parameters-json-schema" as const
export const CLAUDE_CUSTOM_PARAMETERS_PROFILE = "claude-custom-parameters" as const
export type ToolSchemaProfile = typeof GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE | typeof CLAUDE_CUSTOM_PARAMETERS_PROFILE

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
    readonly thinkingLevelMap: Readonly<Record<"minimal" | "low" | "medium" | "high", string | null> & { readonly xhigh?: string | null }>
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
  publicId: "antigravity-gemini-3.8-flash-tiered",
  descriptor: {
    name: "Gemini 3.8 Flash Tiered (Antigravity)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  routes: {
    off: { wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.8-flash-tiered-off-v1", publicModelId: "antigravity-gemini-3.8-flash-tiered", reasoning: "off", wireModel: "gemini-3.8-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.8-flash-tiered-low-v1", publicModelId: "antigravity-gemini-3.8-flash-tiered", reasoning: "low", wireModel: "gemini-3.8-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.8-flash-tiered-medium-v1", publicModelId: "antigravity-gemini-3.8-flash-tiered", reasoning: "medium", wireModel: "gemini-3.8-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-3.8-flash-tiered", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.8-flash-tiered-high-v1", publicModelId: "antigravity-gemini-3.8-flash-tiered", reasoning: "high", wireModel: "gemini-3.8-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
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
  publicId: "antigravity-gemini-3.7-flash-tiered",
  descriptor: {
    name: "Gemini 3.7 Flash Tiered (Antigravity)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  routes: {
    off: { wireModel: "gemini-3.7-flash-tiered", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.7-flash-tiered-off-v1", publicModelId: "antigravity-gemini-3.7-flash-tiered", reasoning: "off", wireModel: "gemini-3.7-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-3.7-flash-tiered", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.7-flash-tiered-low-v1", publicModelId: "antigravity-gemini-3.7-flash-tiered", reasoning: "low", wireModel: "gemini-3.7-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-3.7-flash-tiered", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.7-flash-tiered-medium-v1", publicModelId: "antigravity-gemini-3.7-flash-tiered", reasoning: "medium", wireModel: "gemini-3.7-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-3.7-flash-tiered", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.7-flash-tiered-high-v1", publicModelId: "antigravity-gemini-3.7-flash-tiered", reasoning: "high", wireModel: "gemini-3.7-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
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
  publicId: "antigravity-gemini-3.6-flash-tiered",
  descriptor: {
    name: "Gemini 3.6 Flash Tiered (Antigravity)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  routes: {
    off: { wireModel: "gemini-3.6-flash-tiered", thinking: { kind: "omit" }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.6-flash-tiered-off-v1", publicModelId: "antigravity-gemini-3.6-flash-tiered", reasoning: "off", wireModel: "gemini-3.6-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-3.6-flash-tiered", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.6-flash-tiered-low-v1", publicModelId: "antigravity-gemini-3.6-flash-tiered", reasoning: "low", wireModel: "gemini-3.6-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-3.6-flash-tiered", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.6-flash-tiered-medium-v1", publicModelId: "antigravity-gemini-3.6-flash-tiered", reasoning: "medium", wireModel: "gemini-3.6-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-3.6-flash-tiered", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.6-flash-tiered-high-v1", publicModelId: "antigravity-gemini-3.6-flash-tiered", reasoning: "high", wireModel: "gemini-3.6-flash-tiered" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
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
    off: { wireModel: "claude-sonnet-4-6", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "claude-sonnet-4.6-off-v1", publicModelId: "antigravity-claude-sonnet-4.6", reasoning: "off", wireModel: "claude-sonnet-4-6" }, CLAUDE_CUSTOM_PARAMETERS_PROFILE) },
    high: { wireModel: "claude-sonnet-4-6", thinking: { kind: "budget", budget: 1024, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "claude-sonnet-4.6-high-v1", publicModelId: "antigravity-claude-sonnet-4.6", reasoning: "high", wireModel: "claude-sonnet-4-6" }, CLAUDE_CUSTOM_PARAMETERS_PROFILE) },
  },
  replay: { kind: "same-public-model" },
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
    off: { wireModel: "claude-opus-4-6-thinking", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "claude-opus-4.6-thinking-off-v1", publicModelId: "antigravity-claude-opus-4.6-thinking", reasoning: "off", wireModel: "claude-opus-4-6-thinking" }, CLAUDE_CUSTOM_PARAMETERS_PROFILE) },
    high: { wireModel: "claude-opus-4-6-thinking", thinking: { kind: "budget", budget: 1024, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "claude-opus-4.6-thinking-high-v1", publicModelId: "antigravity-claude-opus-4.6-thinking", reasoning: "high", wireModel: "claude-opus-4-6-thinking" }, CLAUDE_CUSTOM_PARAMETERS_PROFILE) },
  },
  replay: { kind: "same-public-model" },
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
    off: { wireModel: "gpt-oss-120b-medium", thinking: { kind: "omit" }, tools: enabled({ record: "pi-json-tool-loop", revision: "gpt-oss-120b-off-v1", publicModelId: "antigravity-gpt-oss-120b", reasoning: "off", wireModel: "gpt-oss-120b-medium" }, CLAUDE_CUSTOM_PARAMETERS_PROFILE) },
    medium: { wireModel: "gpt-oss-120b-medium", thinking: { kind: "budget", budget: 8192, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gpt-oss-120b-medium-v1", publicModelId: "antigravity-gpt-oss-120b", reasoning: "medium", wireModel: "gpt-oss-120b-medium" }, CLAUDE_CUSTOM_PARAMETERS_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gpt-oss" },
}, {
  publicId: "antigravity-gemini-4-argon",
  descriptor: {
    name: "Gemini 4 Argon (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 65_536,
  },
  routes: {
    off: { wireModel: "gemini-4-argon-low", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-argon-off-v1", publicModelId: "antigravity-gemini-4-argon", reasoning: "off", wireModel: "gemini-4-argon-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-4-argon-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-argon-low-v1", publicModelId: "antigravity-gemini-4-argon", reasoning: "low", wireModel: "gemini-4-argon-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-4-argon-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-argon-medium-v1", publicModelId: "antigravity-gemini-4-argon", reasoning: "medium", wireModel: "gemini-4-argon-medium" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-4-argon-high", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-argon-high-v1", publicModelId: "antigravity-gemini-4-argon", reasoning: "high", wireModel: "gemini-4-argon-high" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-gemini-4-carbon",
  descriptor: {
    name: "Gemini 4 Carbon (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 262_144,
  },
  routes: {
    off: { wireModel: "gemini-4-carbon-low", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-carbon-off-v1", publicModelId: "antigravity-gemini-4-carbon", reasoning: "off", wireModel: "gemini-4-carbon-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-4-carbon-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-carbon-low-v1", publicModelId: "antigravity-gemini-4-carbon", reasoning: "low", wireModel: "gemini-4-carbon-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-4-carbon-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-carbon-medium-v1", publicModelId: "antigravity-gemini-4-carbon", reasoning: "medium", wireModel: "gemini-4-carbon-medium" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-4-carbon-high", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-carbon-high-v1", publicModelId: "antigravity-gemini-4-carbon", reasoning: "high", wireModel: "gemini-4-carbon-high" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-gemini-4-neon",
  descriptor: {
    name: "Gemini 4 Neon (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh" },
    contextWindow: 1_048_576,
    maxTokens: 262_144,
  },
  routes: {
    off: { wireModel: "gemini-4-neon-low", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-neon-off-v1", publicModelId: "antigravity-gemini-4-neon", reasoning: "off", wireModel: "gemini-4-neon-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-4-neon-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-neon-low-v1", publicModelId: "antigravity-gemini-4-neon", reasoning: "low", wireModel: "gemini-4-neon-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-4-neon-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-neon-medium-v1", publicModelId: "antigravity-gemini-4-neon", reasoning: "medium", wireModel: "gemini-4-neon-medium" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-4-neon-high", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-neon-high-v1", publicModelId: "antigravity-gemini-4-neon", reasoning: "high", wireModel: "gemini-4-neon-high" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    xhigh: { wireModel: "gemini-4-neon-xhigh", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-neon-xhigh-v1", publicModelId: "antigravity-gemini-4-neon", reasoning: "xhigh", wireModel: "gemini-4-neon-xhigh" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-gemini-4-hydrogen",
  descriptor: {
    name: "Gemini 4 Hydrogen (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: "low", medium: "medium", high: "high", xhigh: "xhigh" },
    contextWindow: 1_048_576,
    maxTokens: 262_144,
  },
  routes: {
    off: { wireModel: "gemini-4-hydrogen-low", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-off-v1", publicModelId: "antigravity-gemini-4-hydrogen", reasoning: "off", wireModel: "gemini-4-hydrogen-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-4-hydrogen-low", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-low-v1", publicModelId: "antigravity-gemini-4-hydrogen", reasoning: "low", wireModel: "gemini-4-hydrogen-low" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    medium: { wireModel: "gemini-4-hydrogen-medium", thinking: { kind: "budget", budget: 4000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-medium-v1", publicModelId: "antigravity-gemini-4-hydrogen", reasoning: "medium", wireModel: "gemini-4-hydrogen-medium" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-4-hydrogen-high", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-high-v1", publicModelId: "antigravity-gemini-4-hydrogen", reasoning: "high", wireModel: "gemini-4-hydrogen-high" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    xhigh: { wireModel: "gemini-4-hydrogen-xhigh", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-xhigh-v1", publicModelId: "antigravity-gemini-4-hydrogen", reasoning: "xhigh", wireModel: "gemini-4-hydrogen-xhigh" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-gemini-4-hydrogen-tiered",
  descriptor: {
    name: "Gemini 4 Hydrogen Tiered (Antigravity)",
    thinkingLevelMap: { minimal: null, low: null, medium: null, high: "high", xhigh: "xhigh" },
    contextWindow: 1_048_576,
    maxTokens: 262_144,
  },
  routes: {
    off: { wireModel: "gemini-4-hydrogen-tiered-high", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-tiered-off-v1", publicModelId: "antigravity-gemini-4-hydrogen-tiered", reasoning: "off", wireModel: "gemini-4-hydrogen-tiered-high" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-4-hydrogen-tiered-high", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-tiered-high-v1", publicModelId: "antigravity-gemini-4-hydrogen-tiered", reasoning: "high", wireModel: "gemini-4-hydrogen-tiered-high" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    xhigh: { wireModel: "gemini-4-hydrogen-tiered-xhigh", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-tiered-xhigh-v1", publicModelId: "antigravity-gemini-4-hydrogen-tiered", reasoning: "xhigh", wireModel: "gemini-4-hydrogen-tiered-xhigh" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-gemini-4-hydrogen-sonar",
  descriptor: {
    name: "Gemini 4 Hydrogen Sonar (Antigravity)",
    thinkingLevelMap: { minimal: null, low: null, medium: null, high: "high" },
    contextWindow: 1_048_576,
    maxTokens: 262_144,
  },
  routes: {
    off: { wireModel: "gemini-4-hydrogen-sonar", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-sonar-off-v1", publicModelId: "antigravity-gemini-4-hydrogen-sonar", reasoning: "off", wireModel: "gemini-4-hydrogen-sonar" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    high: { wireModel: "gemini-4-hydrogen-sonar", thinking: { kind: "budget", budget: -1, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-4-hydrogen-sonar-high-v1", publicModelId: "antigravity-gemini-4-hydrogen-sonar", reasoning: "high", wireModel: "gemini-4-hydrogen-sonar" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}, {
  publicId: "antigravity-gemini-3.5-flash-lite",
  descriptor: {
    name: "Gemini 3.5 Flash Lite (Antigravity, text only)",
    thinkingLevelMap: { minimal: null, low: "low", medium: null, high: null },
    contextWindow: 1_048_576,
    maxTokens: 65_535,
  },
  routes: {
    off: { wireModel: "gemini-3.5-flash-lite", thinking: { kind: "budget", budget: 0, includeThoughts: false }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.5-flash-lite-off-v1", publicModelId: "antigravity-gemini-3.5-flash-lite", reasoning: "off", wireModel: "gemini-3.5-flash-lite" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
    low: { wireModel: "gemini-3.5-flash-lite", thinking: { kind: "budget", budget: 1000, includeThoughts: true }, tools: enabled({ record: "pi-json-tool-loop", revision: "gemini-3.5-flash-lite-low-v1", publicModelId: "antigravity-gemini-3.5-flash-lite", reasoning: "low", wireModel: "gemini-3.5-flash-lite" }, GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE) },
  },
  replay: { kind: "same-public-model" },
  response: { kind: "gemini-envelope", family: "gemini" },
}] as const satisfies readonly CatalogEntry[]))

type Catalog = typeof CATALOG
export type AntigravityPublicModelId = Catalog[number]["publicId"]
export type AntigravityWireModelId = Catalog[number]["routes"][keyof Catalog[number]["routes"]]["wireModel"]

const lookup = new Map<string, CatalogEntry>(CATALOG.map((entry) => [entry.publicId, entry]))
const dynamicLookup = new Map<string, CatalogEntry>()

export interface DiscoveredAntigravityModel {
  displayName?: string
  modelName?: string
}

function titleFromModelId(modelId: string): string {
  return modelId
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function defaultLimitsForDiscoveredModel(modelId: string): { contextWindow: number; maxTokens: number } {
  const lower = modelId.toLowerCase()
  if (lower.includes("claude")) {
    return { contextWindow: 250_000, maxTokens: 64_000 }
  }
  if (lower.includes("gpt-oss")) {
    return { contextWindow: 131_072, maxTokens: 32_768 }
  }
  if (
    lower.includes("gemini-4-carbon") ||
    lower.includes("gemini-4-neon") ||
    lower.includes("gemini-4-hydrogen")
  ) {
    return { contextWindow: 1_048_576, maxTokens: 262_144 }
  }
  if (lower.includes("gemini-3.5-flash-lite") || lower.includes("gemini-3.1-pro")) {
    return { contextWindow: 1_048_576, maxTokens: 65_535 }
  }
  return { contextWindow: 1_048_576, maxTokens: 65_536 }
}

function inferDiscoveredFamily(wireModel: string): "gemini" | "claude" | "gpt-oss" {
  const lower = wireModel.toLowerCase()
  if (lower.includes("claude")) return "claude"
  if (lower.includes("gpt-oss")) return "gpt-oss"
  return "gemini"
}

export function registerDiscoveredCatalogEntries(
  models: Readonly<Record<string, DiscoveredAntigravityModel>>,
): readonly CatalogEntry[] {
  const discoveredEntries: CatalogEntry[] = []
  for (const [sourceId, rawEntry] of Object.entries(models)) {
    const rawId = (rawEntry?.modelName || sourceId).trim()
    if (!rawId) continue
    const wireBase = rawId.replace(/^models\//, "").replace(/^antigravity-/, "")
    if (!wireBase) continue
    const publicId = `antigravity-${wireBase}`
    if (publicId === "antigravity-gemini-3.5-flash") continue
    const staticEntry = lookup.get(publicId)
    if (staticEntry) {
      discoveredEntries.push(staticEntry)
      continue
    }

    const family = inferDiscoveredFamily(wireBase)
    const schemaProfile =
      family === "gemini" ? GEMINI_PARAMETERS_JSON_SCHEMA_PROFILE : CLAUDE_CUSTOM_PARAMETERS_PROFILE
    const limits = defaultLimitsForDiscoveredModel(publicId)
    const labelBase = rawEntry?.displayName?.trim() || titleFromModelId(wireBase)
    const name = labelBase.endsWith("(Antigravity)") ? labelBase : `${labelBase} (Antigravity)`
    const revisionPrefix = wireBase

    const entry: CatalogEntry = freeze({
      publicId,
      descriptor: {
        name,
        thinkingLevelMap:
          family === "claude"
            ? { minimal: null, low: null, medium: null, high: "high" }
            : family === "gpt-oss"
              ? { minimal: null, low: null, medium: "medium", high: null }
              : { minimal: null, low: "low", medium: "medium", high: "high" },
        contextWindow: limits.contextWindow,
        maxTokens: limits.maxTokens,
      },
      routes:
        family === "claude"
          ? {
              off: {
                wireModel: wireBase,
                thinking: { kind: "budget", budget: 0, includeThoughts: false },
                tools: enabled(
                  {
                    record: "pi-json-tool-loop",
                    revision: `${revisionPrefix}-off-v1`,
                    publicModelId: publicId,
                    reasoning: "off",
                    wireModel: wireBase,
                  },
                  schemaProfile,
                ),
              },
              high: {
                wireModel: wireBase,
                thinking: { kind: "budget", budget: 1024, includeThoughts: true },
                tools: enabled(
                  {
                    record: "pi-json-tool-loop",
                    revision: `${revisionPrefix}-high-v1`,
                    publicModelId: publicId,
                    reasoning: "high",
                    wireModel: wireBase,
                  },
                  schemaProfile,
                ),
              },
            }
          : family === "gpt-oss"
            ? {
                off: {
                  wireModel: wireBase,
                  thinking: { kind: "omit" },
                  tools: enabled(
                    {
                      record: "pi-json-tool-loop",
                      revision: `${revisionPrefix}-off-v1`,
                      publicModelId: publicId,
                      reasoning: "off",
                      wireModel: wireBase,
                    },
                    schemaProfile,
                  ),
                },
                medium: {
                  wireModel: wireBase,
                  thinking: { kind: "budget", budget: 8192, includeThoughts: true },
                  tools: enabled(
                    {
                      record: "pi-json-tool-loop",
                      revision: `${revisionPrefix}-medium-v1`,
                      publicModelId: publicId,
                      reasoning: "medium",
                      wireModel: wireBase,
                    },
                    schemaProfile,
                  ),
                },
              }
            : {
                off: {
                  wireModel: wireBase,
                  thinking: { kind: "budget", budget: 0, includeThoughts: false },
                  tools: enabled(
                    {
                      record: "pi-json-tool-loop",
                      revision: `${revisionPrefix}-off-v1`,
                      publicModelId: publicId,
                      reasoning: "off",
                      wireModel: wireBase,
                    },
                    schemaProfile,
                  ),
                },
                low: {
                  wireModel: wireBase,
                  thinking: { kind: "budget", budget: 1000, includeThoughts: true },
                  tools: enabled(
                    {
                      record: "pi-json-tool-loop",
                      revision: `${revisionPrefix}-low-v1`,
                      publicModelId: publicId,
                      reasoning: "low",
                      wireModel: wireBase,
                    },
                    schemaProfile,
                  ),
                },
                medium: {
                  wireModel: wireBase,
                  thinking: { kind: "budget", budget: 4000, includeThoughts: true },
                  tools: enabled(
                    {
                      record: "pi-json-tool-loop",
                      revision: `${revisionPrefix}-medium-v1`,
                      publicModelId: publicId,
                      reasoning: "medium",
                      wireModel: wireBase,
                    },
                    schemaProfile,
                  ),
                },
                high: {
                  wireModel: wireBase,
                  thinking: { kind: "budget", budget: -1, includeThoughts: true },
                  tools: enabled(
                    {
                      record: "pi-json-tool-loop",
                      revision: `${revisionPrefix}-high-v1`,
                      publicModelId: publicId,
                      reasoning: "high",
                      wireModel: wireBase,
                    },
                    schemaProfile,
                  ),
                },
              },
      replay: { kind: "same-public-model" },
      response: { kind: "gemini-envelope", family },
    })
    dynamicLookup.set(publicId, entry)
    discoveredEntries.push(entry)
  }

  const merged = new Map<string, CatalogEntry>()
  for (const entry of CATALOG) {
    merged.set(entry.publicId, entry)
  }
  for (const entry of discoveredEntries) {
    if (!merged.has(entry.publicId)) {
      merged.set(entry.publicId, entry)
    }
  }
  return [...merged.values()]
}

export function clearDynamicCatalogEntries(): void {
  dynamicLookup.clear()
}

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
      if (level !== "off" && entry.descriptor.thinkingLevelMap[level as keyof typeof entry.descriptor.thinkingLevelMap] == null) {
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
  if (typeof publicId !== "string") return undefined
  return lookup.get(publicId) ?? dynamicLookup.get(publicId)
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
  const isMultimodal = entry.response.family === "gemini" || entry.response.family === "claude"
  return {
    id: entry.publicId,
    name: entry.descriptor.name.replace(", text only", ""),
    reasoning: true,
    thinkingLevelMap: { ...entry.descriptor.thinkingLevelMap },
    input: (isMultimodal ? ["text", "image"] : ["text"]) as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: entry.descriptor.contextWindow,
    maxTokens: entry.descriptor.maxTokens,
  }
}
