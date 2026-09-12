import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

import { createPiOAuthLifecycle } from "./oauth.ts"
import { loadCodeAssistProject } from "./project.ts"
import { createPiLifecycleStream, executeStreamTransport } from "./stream.ts"

const PROVIDER = "antigravity-guard"
const API = "antigravity-guard-sse"
const MODEL = "antigravity-gemini-3.8-flash"

export function registerAntigravityProvider(pi: Pick<ExtensionAPI, "registerProvider">): void {
  const oauth = createPiOAuthLifecycle({ fetch: globalThis.fetch, now: Date.now })

  pi.registerProvider(PROVIDER, {
    name: "Antigravity Guard",
    api: API,
    models: [{
      id: MODEL,
      name: "Gemini 3.8 Flash (Antigravity, text only)",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1_048_576,
      maxTokens: 65_536,
    }],
    oauth: {
      name: "Antigravity Guard",
      isSubscription: true,
      login: oauth.login,
      refreshToken: oauth.refreshToken,
      getApiKey: oauth.getApiKey,
    },
    streamSimple(model, context, options) {
      return streamText(model, context, options)
    },
  })
}

function streamText(model: Model<Api>, context: Context, options?: SimpleStreamOptions) {
  return createPiLifecycleStream({
    model,
    now: Date.now,
    signal: options?.signal,
    runTransport: ({ onSemantic, signal }) => executeStreamTransport({
      accessToken: options?.apiKey ?? "",
      context,
      fetch: options?.fetch ?? globalThis.fetch,
      generationOptions: options,
      headers: safeHeaders(options?.headers),
      loadProject: loadCodeAssistProject,
      model,
      now: Date.now,
      onSemantic,
      platform: process.platform,
      requestId: `agent-${crypto.randomUUID()}`,
      signal,
      timeoutMs: options?.timeoutMs,
    }),
  })
}

function safeHeaders(headers: SimpleStreamOptions["headers"]): Record<string, string> | undefined {
  if (!headers) return undefined
  return Object.fromEntries(Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== null))
}
