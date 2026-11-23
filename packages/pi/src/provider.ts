import type { Api, Context, Model, SimpleStreamOptions } from "@earendil-works/pi-ai"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import {
  ANTIGRAVITY_ENDPOINTS,
  DEFAULT_SHARED_GUARD_CONFIG,
  createAntigravityVersionState,
  createSessionFingerprintStore,
  fetchAntigravityHubVersion,
  loadSharedGuardConfig,
  type ResolveSharedGuardPathsOptions,
  type SharedGuardConfig,
} from "@benjamolina/antigravity-guard-core"

import { listCatalogEntries, toPiModelDescriptor } from "./catalog.ts"
import { createPiOAuthLifecycle } from "./oauth.ts"
import { resolveLoginProject } from "./project.ts"
import { createPiLifecycleStream, executeStreamTransport } from "./stream.ts"

const PROVIDER = "antigravity-guard"
const API = "antigravity-guard-sse"
const INVALID_CREDENTIALS = "Antigravity credentials are invalid. Run /login antigravity-guard."

export interface PiGuardRuntimeOptions extends ResolveSharedGuardPathsOptions {
  fetch?: typeof globalThis.fetch
}

export interface PiGuardRuntime {
  getVersion(): string
  getUserAgent(): string
  getConfig(): SharedGuardConfig
  refreshSession(cwd?: string): Promise<void>
}

export function createPiGuardRuntime(options: PiGuardRuntimeOptions = {}): PiGuardRuntime {
  const versionState = createAntigravityVersionState()
  const fingerprintStore = createSessionFingerprintStore({
    getVersion: () => versionState.getVersion(),
  })
  const hasExplicitConfigScope =
    options.cwd !== undefined || options.homeDir !== undefined || options.env !== undefined
  let config: SharedGuardConfig = hasExplicitConfigScope
    ? loadSharedGuardConfig(options)
    : {
        ...DEFAULT_SHARED_GUARD_CONFIG,
        signature_cache: { ...DEFAULT_SHARED_GUARD_CONFIG.signature_cache },
      }

  return {
    getVersion(): string {
      return versionState.getVersion()
    },
    getUserAgent(): string {
      return fingerprintStore.get().userAgent
    },
    getConfig(): SharedGuardConfig {
      return config
    },
    async refreshSession(cwd?: string): Promise<void> {
      config = loadSharedGuardConfig({
        ...options,
        cwd: cwd ?? options.cwd,
      })

      const env = options.env ?? process.env
      if (/^(1|true|yes)$/i.test(env.PI_OFFLINE ?? "")) {
        return
      }

      const liveVersion = await fetchAntigravityHubVersion({
        fetch: options.fetch ?? globalThis.fetch,
      })
      if (liveVersion && versionState.setVersion(liveVersion)) {
        fingerprintStore.syncVersion(versionState.getVersion())
      }
    },
  }
}

type ProviderRegistrationHost = Pick<ExtensionAPI, "registerProvider"> & {
  on?: (
    event: "session_start",
    handler: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void,
  ) => void
}

export function registerAntigravityProvider(
  pi: ProviderRegistrationHost,
  options?: PiGuardRuntimeOptions,
): PiGuardRuntime {
  const runtime = createPiGuardRuntime(options)
  const oauth = createPiOAuthLifecycle({
    fetch: options?.fetch ?? globalThis.fetch,
    now: Date.now,
    project: (projectOptions) =>
      resolveLoginProject({
        ...projectOptions,
        userAgent: runtime.getUserAgent(),
      }),
  })

  pi.on?.("session_start", async (_event, ctx) => {
    await runtime.refreshSession(ctx?.cwd)
  })

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
    streamSimple(model, context, streamOptions) {
      return streamText(model, context, streamOptions, runtime)
    },
  })

  return runtime
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

function streamText(
  model: Model<Api>,
  context: Context,
  options: SimpleStreamOptions | undefined,
  runtime: PiGuardRuntime,
) {
  return createPiLifecycleStream({
    model,
    now: Date.now,
    signal: options?.signal,
    runTransport: ({ onSemantic, signal }) => {
      const credentials = parseProviderApiKey(options?.apiKey ?? "")
      const guardConfig = runtime.getConfig()
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
        requestJitterMaxMs: guardConfig.request_jitter_max_ms,
        signal,
        timeoutMs: options?.timeoutMs,
        userAgent: runtime.getUserAgent(),
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
