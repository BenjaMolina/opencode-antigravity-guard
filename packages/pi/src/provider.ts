import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { ANTIGRAVITY_ENDPOINTS } from "@benjamolina/antigravity-guard-core"

import { listCatalogEntries, toPiModelDescriptor } from "./catalog.ts"
import { createPiOAuthLifecycle } from "./oauth.ts"
import { createPiLifecycleStream, executeStreamTransport } from "./stream.ts"

const PROVIDER = "antigravity-guard"
const API = "antigravity-guard-sse"
const INVALID_CREDENTIALS = "Antigravity credentials are invalid. Run /login antigravity-guard."

export function registerAntigravityProvider(pi: Pick<ExtensionAPI, "registerProvider">): void {
  const oauth = createPiOAuthLifecycle({ fetch: globalThis.fetch, now: Date.now })

  pi.registerProvider(PROVIDER, {
    name: "Antigravity Guard",
    baseUrl: ANTIGRAVITY_ENDPOINTS.daily,
    api: API,
    models: listCatalogEntries().map(toPiModelDescriptor),
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

export function parseProviderApiKey(value: string): { token: string, projectId: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(value) as unknown
  } catch {
    throw new Error(INVALID_CREDENTIALS)
  }
  if (!isRecord(parsed) || Object.keys(parsed).length !== 2 || !nonempty(parsed.token) || !nonempty(parsed.projectId)) {
    throw new Error(INVALID_CREDENTIALS)
  }
  return { token: parsed.token, projectId: parsed.projectId }
}

function streamText(model: Model<Api>, context: Context, options?: SimpleStreamOptions) {
  return createPiLifecycleStream({
    model,
    now: Date.now,
    signal: options?.signal,
    runTransport: ({ onSemantic, signal }) => {
      const credentials = parseProviderApiKey(options?.apiKey ?? "")
      return executeStreamTransport({
        accessToken: credentials.token,
        projectId: credentials.projectId,
        context,
        fetch: options?.fetch ?? globalThis.fetch,
        generationOptions: options,
        headers: safeHeaders(options?.headers),
        model,
        now: Date.now,
        onSemantic,
        platform: process.platform,
        requestId: `agent-${crypto.randomUUID()}`,
        signal,
        timeoutMs: options?.timeoutMs,
      })
    },
  })
}

function safeHeaders(headers: SimpleStreamOptions["headers"]): Record<string, string> | undefined {
  if (!headers) return undefined
  return Object.fromEntries(Object.entries(headers).filter((entry): entry is [string, string] => entry[1] !== null))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}
