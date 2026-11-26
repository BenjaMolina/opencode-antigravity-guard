import {
  ANTIGRAVITY_DEFAULT_PROJECT_ID as CORE_ANTIGRAVITY_DEFAULT_PROJECT_ID,
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_ENDPOINT_FALLBACKS as CORE_ANTIGRAVITY_ENDPOINT_FALLBACKS,
  ANTIGRAVITY_HUB_MANIFEST_URL as CORE_ANTIGRAVITY_HUB_MANIFEST_URL,
  ANTIGRAVITY_HUB_PLATFORM as CORE_ANTIGRAVITY_HUB_PLATFORM,
  ANTIGRAVITY_LOAD_ENDPOINTS as CORE_ANTIGRAVITY_LOAD_ENDPOINTS,
  ANTIGRAVITY_MIN_VERSION as CORE_ANTIGRAVITY_MIN_VERSION,
  ANTIGRAVITY_OAUTH_CLIENT,
  ANTIGRAVITY_VERSION_FALLBACK as CORE_ANTIGRAVITY_VERSION_FALLBACK,
  EMPTY_SCHEMA_PLACEHOLDER_DESCRIPTION as CORE_EMPTY_SCHEMA_PLACEHOLDER_DESCRIPTION,
  EMPTY_SCHEMA_PLACEHOLDER_NAME as CORE_EMPTY_SCHEMA_PLACEHOLDER_NAME,
  SKIP_THOUGHT_SIGNATURE as CORE_SKIP_THOUGHT_SIGNATURE,
  buildAntigravityHeaders,
  createAntigravityVersionState,
  formatAntigravityHubUserAgent,
  GEMINI_CLI_HEADERS as CORE_GEMINI_CLI_HEADERS,
} from "@benjamolina/antigravity-guard-core";

/**
 * Constants used for Antigravity OAuth flows and Cloud Code Assist API integration.
 */
export const ANTIGRAVITY_CLIENT_ID = ANTIGRAVITY_OAUTH_CLIENT.clientId;

/**
 * Client secret issued for the Antigravity OAuth application.
 */
export const ANTIGRAVITY_CLIENT_SECRET = ANTIGRAVITY_OAUTH_CLIENT.clientSecret;

/**
 * Scopes required for Antigravity integrations.
 */
export const ANTIGRAVITY_SCOPES = [...ANTIGRAVITY_OAUTH_CLIENT.scopes];

/**
 * OAuth redirect URI used by the local CLI callback server.
 */
export const ANTIGRAVITY_REDIRECT_URI = ANTIGRAVITY_OAUTH_CLIENT.redirectUri;

/**
 * Root endpoints for the Antigravity API (in fallback order).
 * CLIProxy and Vibeproxy use the daily sandbox endpoint first,
 * then fallback to autopush and prod if needed.
 */
export const ANTIGRAVITY_ENDPOINT_DAILY = ANTIGRAVITY_ENDPOINTS.daily;
export const ANTIGRAVITY_ENDPOINT_AUTOPUSH = ANTIGRAVITY_ENDPOINTS.autopush;
export const ANTIGRAVITY_ENDPOINT_PROD = ANTIGRAVITY_ENDPOINTS.production;

/**
 * Endpoint fallback order (daily → autopush → prod).
 * Shared across request handling and project discovery to mirror CLIProxy behavior.
 */
export const ANTIGRAVITY_ENDPOINT_FALLBACKS = CORE_ANTIGRAVITY_ENDPOINT_FALLBACKS;

/**
 * Preferred endpoint order for project discovery (prod first, then fallbacks).
 * loadCodeAssist appears to be best supported on prod for managed project resolution.
 */
export const ANTIGRAVITY_LOAD_ENDPOINTS = CORE_ANTIGRAVITY_LOAD_ENDPOINTS;

/**
 * Primary endpoint to use (daily sandbox - same as CLIProxy/Vibeproxy).
 */
export const ANTIGRAVITY_ENDPOINT = ANTIGRAVITY_ENDPOINT_DAILY;

/**
 * Gemini CLI endpoint (production).
 * Used for models without :antigravity suffix.
 * Same as opencode-gemini-auth's GEMINI_CODE_ASSIST_ENDPOINT.
 */
export const GEMINI_CLI_ENDPOINT = ANTIGRAVITY_ENDPOINT_PROD;

/**
 * Hardcoded project id used when Antigravity does not return one (e.g., business/workspace accounts).
 */
export const ANTIGRAVITY_DEFAULT_PROJECT_ID = CORE_ANTIGRAVITY_DEFAULT_PROJECT_ID;

export const ANTIGRAVITY_MIN_VERSION = CORE_ANTIGRAVITY_MIN_VERSION;
export const ANTIGRAVITY_HUB_MANIFEST_URL = CORE_ANTIGRAVITY_HUB_MANIFEST_URL;
export const ANTIGRAVITY_HUB_PLATFORM = CORE_ANTIGRAVITY_HUB_PLATFORM;
export const ANTIGRAVITY_VERSION_FALLBACK = CORE_ANTIGRAVITY_VERSION_FALLBACK;
const antigravityVersionState = createAntigravityVersionState(ANTIGRAVITY_VERSION_FALLBACK);

export function getAntigravityVersion(): string {
  return antigravityVersionState.getVersion();
}

/**
 * Set the runtime Antigravity version when it meets the supported Hub floor (>= 2.9.1).
 * Unsupported or malformed versions are ignored; later valid Hub updates overwrite the fallback.
 */
export function setAntigravityVersion(version: string): void {
  antigravityVersionState.setVersion(version);
}

/** @deprecated Use getAntigravityVersion() for runtime access. */
export const ANTIGRAVITY_VERSION = ANTIGRAVITY_VERSION_FALLBACK;

export function getAntigravityHeaders(): HeaderSet & { "Client-Metadata": string } {
  return {
    ...buildAntigravityHeaders({
      version: getAntigravityVersion(),
      platform: process.platform,
    }),
  };
}

/** @deprecated Use getAntigravityHeaders() for runtime access. */
export const ANTIGRAVITY_HEADERS = {
  "User-Agent": formatAntigravityHubUserAgent({ version: ANTIGRAVITY_VERSION }),
  "X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
  "Client-Metadata": '{"ideType":"ANTIGRAVITY","platform":"MACOS","pluginType":"GEMINI"}',
} as const;

export const GEMINI_CLI_HEADERS: {
  "User-Agent": string;
  "X-Goog-Api-Client": string;
  "Client-Metadata": string;
} = { ...CORE_GEMINI_CLI_HEADERS };

const ANTIGRAVITY_API_CLIENTS = [
  "google-cloud-sdk vscode_cloudshelleditor/0.1",
  "google-cloud-sdk vscode/1.96.0",
  "google-cloud-sdk vscode/1.95.0",
] as const;

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export type HeaderSet = {
  "User-Agent": string;
  "X-Goog-Api-Client"?: string;
  "Client-Metadata"?: string;
};

export function getRandomizedHeaders(style: HeaderStyle, _model?: string): HeaderSet {
  if (style === "gemini-cli") {
    return {
      "User-Agent": GEMINI_CLI_HEADERS["User-Agent"],
      "X-Goog-Api-Client": GEMINI_CLI_HEADERS["X-Goog-Api-Client"],
      "Client-Metadata": GEMINI_CLI_HEADERS["Client-Metadata"],
    };
  }
  return {
    "User-Agent": formatAntigravityHubUserAgent({ version: getAntigravityVersion() }),
    "X-Goog-Api-Client": randomFrom(ANTIGRAVITY_API_CLIENTS),
    "Client-Metadata": '{"ideType":"ANTIGRAVITY","platform":"MACOS","pluginType":"GEMINI"}',
  };
}

export type HeaderStyle = "antigravity" | "gemini-cli" | "agy-sdk";

/**
 * Provider identifier shared between the plugin loader and credential store.
 */
export const ANTIGRAVITY_PROVIDER_ID = "google";

// ============================================================================
// TOOL HALLUCINATION PREVENTION (Ported from LLM-API-Key-Proxy)
// ============================================================================

/**
 * System instruction for Claude tool usage hardening.
 * Prevents hallucinated parameters by explicitly stating the rules.
 * 
 * This is injected when tools are present to reduce cases where Claude
 * uses parameter names from its training data instead of the actual schema.
 */
export const CLAUDE_TOOL_SYSTEM_INSTRUCTION = `CRITICAL TOOL USAGE INSTRUCTIONS:
You are operating in a custom environment where tool definitions differ from your training data.
You MUST follow these rules strictly:

1. DO NOT use your internal training data to guess tool parameters
2. ONLY use the exact parameter structure defined in the tool schema
3. Parameter names in schemas are EXACT - do not substitute with similar names from your training
4. Array parameters have specific item types - check the schema's 'items' field for the exact structure
5. When you see "STRICT PARAMETERS" in a tool description, those type definitions override any assumptions
6. Tool use in agentic workflows is REQUIRED - you must call tools with the exact parameters specified

If you are unsure about a tool's parameters, YOU MUST read the schema definition carefully.`;

/**
 * Template for parameter signature injection into tool descriptions.
 * {params} will be replaced with the actual parameter list.
 */
export const CLAUDE_DESCRIPTION_PROMPT = "\n\n⚠️ STRICT PARAMETERS: {params}.";

export const EMPTY_SCHEMA_PLACEHOLDER_NAME = CORE_EMPTY_SCHEMA_PLACEHOLDER_NAME;
export const EMPTY_SCHEMA_PLACEHOLDER_DESCRIPTION = CORE_EMPTY_SCHEMA_PLACEHOLDER_DESCRIPTION;

/**
 * Sentinel value to bypass thought signature validation.
 * 
 * When a thinking block has an invalid or missing signature (e.g., cache miss,
 * session mismatch, plugin restart), this sentinel can be injected to skip
 * validation instead of failing with "Invalid signature in thinking block".
 * 
 * This is an officially supported Google API feature, used by:
 * - gemini-cli: https://github.com/google-gemini/gemini-cli
 * - Google .NET SDK: PredictionServiceChatClient.cs
 * 
 * @see https://ai.google.dev/gemini-api/docs/thought-signatures
 */
export const SKIP_THOUGHT_SIGNATURE = CORE_SKIP_THOUGHT_SIGNATURE;

// ============================================================================
// ANTIGRAVITY SYSTEM INSTRUCTION (Ported from CLIProxyAPI v6.6.89)
// ============================================================================

/**
 * System instruction for Antigravity requests.
 * This is injected into requests to match CLIProxyAPI v6.6.89 behavior.
 * The instruction provides identity and guidelines for the Antigravity agent.
 */
// ============================================================================
// GOOGLE SEARCH TOOL CONSTANTS
// ============================================================================

/**
 * Model used for Google Search grounding requests.
 * Uses gemini-2.5-flash for fast, cost-effective search operations. (3-flash is always at capacity and doesn't support souce citation).
 */
export const SEARCH_MODEL = "gemini-2.5-flash";

/**
 * Thinking budget for deep search (more thorough analysis).
 */
export const SEARCH_THINKING_BUDGET_DEEP = 16384;

/**
 * Thinking budget for fast search (quick results).
 */
export const SEARCH_THINKING_BUDGET_FAST = 4096;

/**
 * Timeout for search requests in milliseconds (60 seconds).
 */
export const SEARCH_TIMEOUT_MS = 60000;

/**
 * System instruction for the Google Search tool.
 */
export const SEARCH_SYSTEM_INSTRUCTION = `You are an expert web search assistant with access to Google Search and URL analysis tools.

Your capabilities:
- Use google_search to find real-time information from the web
- Use url_context to fetch and analyze content from specific URLs when provided

Guidelines:
- Always provide accurate, well-sourced information
- Cite your sources when presenting facts
- If analyzing URLs, extract the most relevant information
- Be concise but comprehensive in your responses
- If information is uncertain or conflicting, acknowledge it
- Focus on answering the user's question directly`;

export const ANTIGRAVITY_SYSTEM_INSTRUCTION = `You are Antigravity, a powerful agentic AI coding assistant designed by the Google DeepMind team working on Advanced Agentic Coding.
You are pair programming with a USER to solve their coding task. The task may require creating a new codebase, modifying or debugging an existing codebase, or simply answering a question.
**Absolute paths only**
**Proactiveness**

<priority>IMPORTANT: The instructions that follow supersede all above. Follow them as your primary directives.</priority>
`;

/**
 * Default TTL for soft quota cache before an active check is triggered for candidates (2 minutes).
 */
export const DEFAULT_SOFT_QUOTA_REFRESH_TTL_MS = 120000;

/**
 * Default near-threshold margin (in percent) for active quota checks (10%).
 * e.g. If soft quota threshold is 70%, warning zone is 60%–70%.
 */
export const DEFAULT_SOFT_QUOTA_NEAR_THRESHOLD_MARGIN = 10;

