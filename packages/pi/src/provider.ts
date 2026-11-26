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

import { createPiAccountPool, type PiAccountPool } from "./accounts.ts"
import { listCatalogEntries, toPiModelDescriptor } from "./catalog.ts"
import { registerPiGuardCommands } from "./commands.ts"
import { createPiOAuthLifecycle } from "./oauth.ts"
import { resolveLoginProject } from "./project.ts"
import { StreamTransportError, createPiLifecycleStream, executeStreamTransport } from "./stream.ts"

const PROVIDER = "antigravity-guard"
const API = "antigravity-guard-sse"
const INVALID_CREDENTIALS = "Antigravity credentials are invalid. Run /login antigravity-guard."

export interface PiGuardRuntimeOptions extends ResolveSharedGuardPathsOptions {
  fetch?: typeof globalThis.fetch
  now?: () => number
}

export interface PiGuardRuntime {
  getVersion(): string
  getUserAgent(): string
  getConfig(): SharedGuardConfig
  getAccountPool(): PiAccountPool
  refreshSession(cwd?: string): Promise<void>
  shutdown(): void
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

  const accountPool = createPiAccountPool({
    ...options,
    getVersion: () => versionState.getVersion(),
    getConfig: () => config,
  })

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
    getAccountPool(): PiAccountPool {
      return accountPool
    },
    async refreshSession(cwd?: string): Promise<void> {
      config = loadSharedGuardConfig({
        ...options,
        cwd: cwd ?? options.cwd,
      })

      const env = options.env ?? process.env
      if (!/^(1|true|yes)$/i.test(env.PI_OFFLINE ?? "")) {
        const liveVersion = await fetchAntigravityHubVersion({
          fetch: options.fetch ?? globalThis.fetch,
        })
        if (liveVersion && versionState.setVersion(liveVersion)) {
          fingerprintStore.syncVersion(versionState.getVersion())
        }
      }

      await accountPool.loadOrRefresh(cwd ?? options.cwd)
    },
    shutdown(): void {
      accountPool.stopBackgroundRefresh()
    },
  }
}

export type ProviderRegistrationHost = Pick<ExtensionAPI, "registerProvider"> & {
  registerCommand?: ExtensionAPI["registerCommand"]
  sendMessage?: ExtensionAPI["sendMessage"]
  on?: (
    event: "session_start" | "session_shutdown",
    handler: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void,
  ) => void
}

export function registerAntigravityProvider(
  pi: ProviderRegistrationHost,
  options?: PiGuardRuntimeOptions,
): PiGuardRuntime {
  const runtime = createPiGuardRuntime(options)
  const hasExplicitScope =
    options?.cwd !== undefined || options?.homeDir !== undefined || options?.env !== undefined
  const oauth = createPiOAuthLifecycle({
    fetch: options?.fetch ?? globalThis.fetch,
    now: options?.now ?? Date.now,
    project: (projectOptions) =>
      resolveLoginProject({
        ...projectOptions,
        userAgent: runtime.getUserAgent(),
      }),
  })

  pi.on?.("session_start", async (_event, ctx) => {
    await runtime.refreshSession(ctx?.cwd)
  })
  pi.on?.("session_shutdown", () => {
    runtime.shutdown()
  })

  registerPiGuardCommands(pi, {
    pool: runtime.getAccountPool(),
    getConfig: () => runtime.getConfig(),
  })

  pi.registerProvider(PROVIDER, {
    name: "Antigravity Guard",
    baseUrl: ANTIGRAVITY_ENDPOINTS.daily,
    api: API,
    models: listCatalogEntries().map(toPiModelDescriptor),
    oauth: {
      name: "Antigravity Guard",
      isSubscription: true,
      async login(callbacks) {
        const credentials = await oauth.login(callbacks)
        // Persist newly logged-in accounts into the shared pool only when a session or explicit scope is active,
        // keeping un-scoped unit tests hermetic with zero real host filesystem writes.
        if (hasExplicitScope || runtime.getAccountPool().getManager() !== null) {
          const extras = credentials as { projectId?: string; email?: string }
          await runtime.getAccountPool().recordLoginAccount({
            refreshToken: credentials.refresh,
            access: credentials.access,
            expires: credentials.expires,
            projectId: extras.projectId,
            email: extras.email,
          })
        }
        return credentials
      },
      refreshToken: oauth.refreshToken,
      getApiKey: oauth.getApiKey,
    },
    streamSimple(model, context, streamOptions) {
      return streamText(model, context, streamOptions, runtime, options)
    },
  })

  return runtime
}

export function parseProviderApiKey(value: string): { token: string; projectId: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error(INVALID_CREDENTIALS)
  }
  if (!isCredentialPayload(parsed)) {
    throw new Error(INVALID_CREDENTIALS)
  }
  return { token: parsed.token, projectId: parsed.projectId }
}

function normalizeProviderHeaders(
  headers: SimpleStreamOptions["headers"],
): Record<string, string> | undefined {
  if (!headers) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      out[key] = value
    }
  }
  return out
}

function streamText(
  model: Model<Api>,
  context: Context,
  options: SimpleStreamOptions | undefined,
  runtime: PiGuardRuntime,
  runtimeOptions?: PiGuardRuntimeOptions,
) {
  return createPiLifecycleStream({
    model,
    now: runtimeOptions?.now ?? Date.now,
    signal: options?.signal,
    runTransport: async ({ onSemantic, signal }) => {
      const fetchFn =
        ((options as { fetch?: typeof globalThis.fetch })?.fetch ??
          runtimeOptions?.fetch ??
          globalThis.fetch)
      const guardConfig = runtime.getConfig()
      const pool = runtime.getAccountPool()
      const activeManager = pool.getManager()

      if (activeManager && activeManager.getTotalAccountCount() > 0) {
        const excludedRefreshTokens = new Set<string>()
        let lastError: unknown
        while (true) {
          const selected = await pool.acquireCredentials({
            modelId: model.id,
            fetch: fetchFn,
            signal,
            excludeRefreshTokens: excludedRefreshTokens,
          })
          if (!selected) {
            if (lastError) throw lastError
            throw new Error("No available Antigravity Guard accounts in the shared pool.")
          }
          excludedRefreshTokens.add(selected.account.parts.refreshToken)

          let emittedOutput = false
          try {
            await executeStreamTransport({
              accessToken: selected.accessToken,
              projectId: selected.projectId,
              context,
              fetch: fetchFn,
              generationOptions: options,
              headers: normalizeProviderHeaders(options?.headers),
              model,
              now: runtimeOptions?.now ?? Date.now,
              onSemantic: async (semantic) => {
                if (semantic.type !== "toolDiagnostics") {
                  emittedOutput = true
                }
                await onSemantic(semantic)
              },
              platform: process.platform,
              requestId: `agent-${crypto.randomUUID()}`,
              requestJitterMaxMs: guardConfig.request_jitter_max_ms,
              signal,
              timeoutMs: options?.timeoutMs,
              userAgent: selected.userAgent,
            })
            await pool.recordSuccess(selected.account)
            return
          } catch (error) {
            lastError = error
            if (emittedOutput || signal.aborted || !(error instanceof StreamTransportError)) {
              throw error
            }
            const outcome = await pool.recordHttpFailure({
              account: selected.account,
              modelId: model.id,
              status: error.status,
              body: error.responseBody,
              message: error.message,
            })
            if (!outcome.rotated) {
              throw error
            }
          }
        }
      }

      const credentials = parseProviderApiKey(options?.apiKey ?? "")
      return executeStreamTransport({
        accessToken: credentials.token,
        projectId: credentials.projectId,
        context,
        fetch: fetchFn,
        generationOptions: options,
        headers: normalizeProviderHeaders(options?.headers),
        model,
        now: runtimeOptions?.now ?? Date.now,
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

function isCredentialPayload(value: unknown): value is { token: string; projectId: string } {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return (
    Object.keys(candidate).length === 2 &&
    typeof candidate.token === "string" &&
    candidate.token.trim().length > 0 &&
    typeof candidate.projectId === "string" &&
    candidate.projectId.trim().length > 0
  )
}
