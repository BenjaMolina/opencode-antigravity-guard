/**
 * Gemini-specific Request Transformations
 *
 * Handles Gemini model-specific request transformations including:
 * - Thinking config (camelCase keys, thinkingLevel for Gemini 3)
 * - Tool normalization (function/custom format)
 * - Schema transformation (JSON Schema -> Gemini Schema format)
 */

import { toGeminiSchema } from "@benjamolina/antigravity-guard-core";
import type {
  RequestPayload,
  ThinkingConfig,
  ThinkingTier,
  GoogleSearchConfig,
} from "./types";

export { toGeminiSchema };

/**
 * Check if a model is a Gemini model (not Claude).
 */
export function isGeminiModel(model: string): boolean {
  const lower = model.toLowerCase();
  return lower.includes("gemini") && !lower.includes("claude");
}

/**
 * Check if a model is Gemini 3 (uses thinkingLevel string).
 */
export function isGemini3Model(model: string): boolean {
  const lower = model.toLowerCase();
  return lower.includes("gemini-3") || lower.includes("gemini-4");
}

/**
 * Check if a model is Gemini 2.5 (uses numeric thinkingBudget).
 */
export function isGemini25Model(model: string): boolean {
  return model.toLowerCase().includes("gemini-2.5");
}

/**
 * Check if a model is an image generation model.
 * Image models don't support thinking and require imageConfig.
 */
export function isImageGenerationModel(model: string): boolean {
  const lower = model.toLowerCase();
  return lower.includes("image") || lower.includes("imagen");
}

/**
 * Build Gemini 3 thinking config with thinkingLevel string.
 */
export function buildGemini3ThinkingConfig(
  includeThoughts: boolean,
  thinkingLevel: ThinkingTier,
): ThinkingConfig {
  return {
    includeThoughts,
    thinkingLevel,
  };
}

/**
 * Build Gemini 2.5 thinking config with numeric thinkingBudget.
 */
export function buildGemini25ThinkingConfig(
  includeThoughts: boolean,
  thinkingBudget?: number,
): ThinkingConfig {
  return {
    includeThoughts,
    ...(typeof thinkingBudget === "number" && thinkingBudget > 0
      ? { thinkingBudget }
      : {}),
  };
}

/**
 * Image generation config for Gemini image models.
 *
 * Supported aspect ratios: "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
 */
export interface ImageConfig {
  aspectRatio?: string;
}

/**
 * Valid aspect ratios for image generation.
 */
const VALID_ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
];

/**
 * Build image generation config for Gemini image models.
 *
 * Configuration is read from environment variables:
 * - OPENCODE_IMAGE_ASPECT_RATIO: Aspect ratio (e.g., "16:9", "4:3")
 *
 * Defaults to 1:1 aspect ratio if not specified.
 *
 * Note: Resolution setting is not currently supported by the Antigravity API.
 */
export function buildImageGenerationConfig(): ImageConfig {
  // Read aspect ratio from environment or default to 1:1
  const aspectRatio = process.env.OPENCODE_IMAGE_ASPECT_RATIO || "1:1";

  if (VALID_ASPECT_RATIOS.includes(aspectRatio)) {
    return { aspectRatio };
  }

  console.warn(
    `[gemini] Invalid aspect ratio "${aspectRatio}". Using default "1:1". Valid values: ${VALID_ASPECT_RATIOS.join(", ")}`,
  );

  // Default to 1:1 square aspect ratio
  return { aspectRatio: "1:1" };
}

/**
 * Normalize tools for Gemini models.
 * Ensures tools have proper function-style format.
 *
 * @returns Debug info about tool normalization
 */
export function normalizeGeminiTools(payload: RequestPayload): {
  toolDebugMissing: number;
  toolDebugSummaries: string[];
} {
  let toolDebugMissing = 0;
  const toolDebugSummaries: string[] = [];

  if (!Array.isArray(payload.tools)) {
    return { toolDebugMissing, toolDebugSummaries };
  }

  payload.tools = (payload.tools as unknown[]).map(
    (tool: unknown, toolIndex: number) => {
      const t = tool as Record<string, unknown>;

      // Skip normalization for Google Search tools (both old and new API)
      if (t.googleSearch || t.googleSearchRetrieval) {
        return t;
      }

      const newTool = { ...t };

      const schemaCandidates = [
        (newTool.function as Record<string, unknown> | undefined)?.input_schema,
        (newTool.function as Record<string, unknown> | undefined)?.parameters,
        (newTool.function as Record<string, unknown> | undefined)?.inputSchema,
        (newTool.custom as Record<string, unknown> | undefined)?.input_schema,
        (newTool.custom as Record<string, unknown> | undefined)?.parameters,
        newTool.parameters,
        newTool.input_schema,
        newTool.inputSchema,
      ].filter(Boolean);

      const placeholderSchema: Record<string, unknown> = {
        type: "OBJECT",
        properties: {
          _placeholder: {
            type: "BOOLEAN",
            description: "Placeholder. Always pass true.",
          },
        },
        required: ["_placeholder"],
      };

      let schema = schemaCandidates[0] as Record<string, unknown> | undefined;
      const schemaObjectOk =
        schema && typeof schema === "object" && !Array.isArray(schema);
      if (!schemaObjectOk) {
        schema = placeholderSchema;
        toolDebugMissing += 1;
      } else {
        // Transform existing schema to Gemini-compatible format
        schema = toGeminiSchema(schema) as Record<string, unknown>;
      }

      const nameCandidate =
        newTool.name ||
        (newTool.function as Record<string, unknown> | undefined)?.name ||
        (newTool.custom as Record<string, unknown> | undefined)?.name ||
        `tool-${toolIndex}`;

      // Always update function.input_schema with transformed schema
      if (newTool.function && schema) {
        (newTool.function as Record<string, unknown>).input_schema = schema;
      }

      // Always update custom.input_schema with transformed schema
      if (newTool.custom && schema) {
        (newTool.custom as Record<string, unknown>).input_schema = schema;
      }

      // Create custom from function if missing
      if (!newTool.custom && newTool.function) {
        const fn = newTool.function as Record<string, unknown>;
        newTool.custom = {
          name: fn.name || nameCandidate,
          description: fn.description,
          input_schema: schema,
        };
      }

      // Create custom if both missing
      if (!newTool.custom && !newTool.function) {
        newTool.custom = {
          name: nameCandidate,
          description: newTool.description,
          input_schema: schema,
        };

        if (
          !newTool.parameters &&
          !newTool.input_schema &&
          !newTool.inputSchema
        ) {
          newTool.parameters = schema;
        }
      }

      if (newTool.custom && !newTool.function) {
        const c = newTool.custom as Record<string, unknown>;
        newTool.function = {
          name: c.name || nameCandidate,
          description: c.description,
          input_schema: schema,
        };
      }

      if (
        newTool.custom &&
        !(newTool.custom as Record<string, unknown>).input_schema
      ) {
        (newTool.custom as Record<string, unknown>).input_schema =
          placeholderSchema;
        toolDebugMissing += 1;
      }

      toolDebugSummaries.push(
        `idx=${toolIndex}, hasCustom=${!!newTool.custom}, customSchema=${!!(newTool.custom as Record<string, unknown> | undefined)?.input_schema}, hasFunction=${!!newTool.function}, functionSchema=${!!(newTool.function as Record<string, unknown> | undefined)?.input_schema}`,
      );

      // Strip custom wrappers for Gemini; only function-style is accepted.
      if (newTool.custom) {
        delete newTool.custom;
      }

      return newTool;
    },
  );

  return { toolDebugMissing, toolDebugSummaries };
}

/**
 * Apply all Gemini-specific transformations to a request payload.
 */
export interface GeminiTransformOptions {
  /** The effective model name (resolved) */
  model: string;
  /** Tier-based thinking budget (from model suffix, for Gemini 2.5) */
  tierThinkingBudget?: number;
  /** Tier-based thinking level (from model suffix, for Gemini 3) */
  tierThinkingLevel?: ThinkingTier;
  /** Normalized thinking config from user settings */
  normalizedThinking?: { includeThoughts?: boolean; thinkingBudget?: number };
  /** Google Search configuration */
  googleSearch?: GoogleSearchConfig;
}

export interface GeminiTransformResult {
  toolDebugMissing: number;
  toolDebugSummaries: string[];
  /** Number of function declarations after wrapping */
  wrappedFunctionCount: number;
  /** Number of passthrough tools (googleSearch, googleSearchRetrieval, codeExecution) */
  passthroughToolCount: number;
}

/**
 * Apply all Gemini-specific transformations.
 */
export function applyGeminiTransforms(
  payload: RequestPayload,
  options: GeminiTransformOptions,
): GeminiTransformResult {
  const {
    model,
    tierThinkingBudget,
    tierThinkingLevel,
    normalizedThinking,
    googleSearch,
  } = options;

  // 1. Apply thinking config if needed
  if (normalizedThinking) {
    let thinkingConfig: ThinkingConfig;

    if (tierThinkingLevel && isGemini3Model(model)) {
      // Gemini 3 uses thinkingLevel string
      thinkingConfig = buildGemini3ThinkingConfig(
        normalizedThinking.includeThoughts ?? true,
        tierThinkingLevel,
      );
    } else {
      // Gemini 2.5 and others use numeric budget
      const thinkingBudget =
        tierThinkingBudget ?? normalizedThinking.thinkingBudget;
      thinkingConfig = buildGemini25ThinkingConfig(
        normalizedThinking.includeThoughts ?? true,
        thinkingBudget,
      );
    }

    const generationConfig = (payload.generationConfig ?? {}) as Record<
      string,
      unknown
    >;
    generationConfig.thinkingConfig = thinkingConfig;
    payload.generationConfig = generationConfig;
  }

  // 2. Apply Google Search (Grounding) if enabled
  // Uses the new googleSearch API for Gemini 2.0+ / Gemini 3 models
  // Note: The old googleSearchRetrieval with dynamicRetrievalConfig is deprecated
  // The new API doesn't support threshold - the model decides when to search automatically
  if (googleSearch && googleSearch.mode === "auto") {
    const tools = (payload.tools as unknown[]) || [];
    if (!payload.tools) {
      payload.tools = tools;
    }

    // Add Google Search tool using new API format for Gemini 2.0+
    // See: https://ai.google.dev/gemini-api/docs/grounding
    (payload.tools as any[]).push({
      googleSearch: {},
    });
  }

  // 3. Normalize tools
  const result = normalizeGeminiTools(payload);

  // 4. Wrap tools in functionDeclarations format (fixes #203, #206)
  // Antigravity strict protobuf validation rejects wrapper-level 'parameters' field
  // Must be: [{ functionDeclarations: [{ name, description, parameters }] }]
  const wrapResult = wrapToolsAsFunctionDeclarations(payload);

  return {
    ...result,
    wrappedFunctionCount: wrapResult.wrappedFunctionCount,
    passthroughToolCount: wrapResult.passthroughToolCount,
  };
}

export interface WrapToolsResult {
  wrappedFunctionCount: number;
  passthroughToolCount: number;
}

/**
 * Wrap tools array in Gemini's required functionDeclarations format.
 *
 * Gemini/Antigravity API expects:
 *   { tools: [{ functionDeclarations: [{ name, description, parameters }] }] }
 *
 * NOT:
 *   { tools: [{ function: {...}, parameters: {...} }] }
 *
 * The wrapper-level 'parameters' field causes:
 *   "Unknown name 'parameters' at 'request.tools[0]'"
 */
/**
 * Detect if a tool is a web search tool in any of the supported formats:
 * - Claude/Anthropic: { type: "web_search_20250305" } or { name: "web_search" }
 * - Gemini native: { googleSearch: {} } or { googleSearchRetrieval: {} }
 */
function isWebSearchTool(tool: Record<string, unknown>): boolean {
  // 1. Gemini native format
  if (tool.googleSearch || tool.googleSearchRetrieval) {
    return true;
  }

  // 2. Claude/Anthropic format: { type: "web_search_20250305" }
  if (tool.type === "web_search_20250305") {
    return true;
  }

  // 3. Simple name-based format: { name: "web_search" | "google_search" }
  const name = tool.name as string | undefined;
  if (name === "web_search" || name === "google_search") {
    return true;
  }

  return false;
}

export function wrapToolsAsFunctionDeclarations(
  payload: RequestPayload,
): WrapToolsResult {
  if (!Array.isArray(payload.tools) || payload.tools.length === 0) {
    return { wrappedFunctionCount: 0, passthroughToolCount: 0 };
  }

  const functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> = [];

  const passthroughTools: unknown[] = [];
  let hasWebSearchTool = false;

  for (const tool of payload.tools as Array<Record<string, unknown>>) {
    // Handle passthrough tools (Google Search and Code Execution)
    if (tool.googleSearch || tool.googleSearchRetrieval || tool.codeExecution) {
      passthroughTools.push(tool);
      continue;
    }

    // Detect and convert web search tools to Gemini format
    if (isWebSearchTool(tool)) {
      hasWebSearchTool = true;
      continue; // Will be added as { googleSearch: {} } at the end
    }

    if (tool.functionDeclarations) {
      if (Array.isArray(tool.functionDeclarations)) {
        for (const decl of tool.functionDeclarations as Array<
          Record<string, unknown>
        >) {
          functionDeclarations.push({
            name: String(decl.name || `tool-${functionDeclarations.length}`),
            description: String(decl.description || ""),
            parameters: toGeminiSchema(
              (decl.parameters as Record<string, unknown>) || {
                type: "OBJECT",
                properties: {},
              },
            ) as Record<string, unknown>,
          });
        }
      }
      continue;
    }

    const fn = tool.function as Record<string, unknown> | undefined;
    const custom = tool.custom as Record<string, unknown> | undefined;

    const name = String(
      tool.name ||
        fn?.name ||
        custom?.name ||
        `tool-${functionDeclarations.length}`,
    );

    const description = String(
      tool.description || fn?.description || custom?.description || "",
    );

    const schema = (fn?.input_schema ||
      fn?.parameters ||
      fn?.inputSchema ||
      custom?.input_schema ||
      custom?.parameters ||
      tool.parameters ||
      tool.input_schema ||
      tool.inputSchema || { type: "OBJECT", properties: {} }) as Record<
      string,
      unknown
    >;

    functionDeclarations.push({
      name,
      description,
      parameters: toGeminiSchema(schema) as Record<string, unknown>,
    });
  }

  const finalTools: unknown[] = [];

  if (functionDeclarations.length > 0) {
    finalTools.push({ functionDeclarations });
  }

  finalTools.push(...passthroughTools);

  // Add googleSearch tool if a web search tool was detected
  // Note: googleSearch cannot be combined with functionDeclarations in the same request
  // If there are function declarations, we skip adding googleSearch (Gemini API limitation)
  if (hasWebSearchTool && functionDeclarations.length === 0) {
    finalTools.push({ googleSearch: {} });
  } else if (hasWebSearchTool && functionDeclarations.length > 0) {
    // Log warning: web search requested but can't be used with functions
    console.warn(
      "[gemini] web_search tool detected but cannot be combined with function declarations. " +
        "Use the explicit google_search() tool call instead.",
    );
  }

  payload.tools = finalTools;

  return {
    wrappedFunctionCount: functionDeclarations.length,
    passthroughToolCount:
      passthroughTools.length +
      (hasWebSearchTool && functionDeclarations.length === 0 ? 1 : 0),
  };
}
