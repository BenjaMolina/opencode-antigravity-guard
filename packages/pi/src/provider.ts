import { Type, type Api, type Context, type Model, type RefreshModelsContext, type SimpleStreamOptions } from "@earendil-works/pi-ai"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import {
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_ENDPOINT_FALLBACKS,
  DEFAULT_SHARED_GUARD_CONFIG,
  MAX_CAPACITY_RETRIES_PER_ENDPOINT,
  SEARCH_MODEL,
  abortableSleep,
  createAntigravityVersionState,
  createSessionFingerprintStore,
  createSessionSignatureCache,
  createSignatureCache,
  executeAntigravitySearchDetailed,
  fetchAntigravityHubVersion,
  fetchAvailableModels,
  loadAccountsFromPath,
  loadSharedGuardConfig,
  parseRefreshParts,
  resolveSharedGuardPaths,
  type ResolveSharedGuardPathsOptions,
  type SessionSignatureCache,
  type SharedGuardConfig,
} from "@benjamolina/antigravity-guard-core"

import {
  SHARED_POOL_PLACEHOLDER_ACCESS,
  createPiAccountPool,
  readPiAuthEntry,
  resolvePiAuthJsonPath,
  type PiAccountPool,
} from "./accounts.ts"
import { refreshCredentials } from "./auth-http.ts"
import {
  listCatalogEntries,
  registerDiscoveredCatalogEntries,
  toPiModelDescriptor,
} from "./catalog.ts"
import { registerPiGuardCommands } from "./commands.ts"
import { createPiOAuthLifecycle } from "./oauth.ts"
import { resolveLoginProject } from "./project.ts"
import {
  StreamTransportError,
  createPiLifecycleStream,
  createPoolUnavailableError,
  executeStreamTransport,
} from "./stream.ts"

const PROVIDER = "antigravity-guard"
const API = "antigravity-guard-sse"
const INVALID_CREDENTIALS = "Antigravity credentials are invalid. Run /login antigravity-guard."

export interface PiGuardRuntimeOptions extends ResolveSharedGuardPathsOptions {
  fetch?: typeof globalThis.fetch
  now?: () => number
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

export interface PiGuardRuntime {
  getVersion(): string
  getUserAgent(): string
  getConfig(): SharedGuardConfig
  getAccountPool(): PiAccountPool
  getSignatureCache(): SessionSignatureCache
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
        model_discovery: { ...DEFAULT_SHARED_GUARD_CONFIG.model_discovery },
        signature_cache: { ...DEFAULT_SHARED_GUARD_CONFIG.signature_cache },
      }
  const signatureCache = createSessionSignatureCache({
    memoryTtlMs: config.signature_cache.memory_ttl_seconds * 1_000,
    now: options.now,
  })

  const syncDiskSignatureCache = (cwd?: string): void => {
    signatureCache.setMemoryTtlMs(config.signature_cache.memory_ttl_seconds * 1_000)
    signatureCache.setDiskCache(null, { shutdownPrevious: true })
    const paths = resolveSharedGuardPaths({
      ...options,
      cwd: cwd ?? options.cwd,
    })
    const diskCache = createSignatureCache(config.signature_cache, {
      cacheFilePath: paths.signatureCachePath,
      now: options.now,
    })
    signatureCache.setDiskCache(diskCache)
  }

  if (hasExplicitConfigScope) {
    syncDiskSignatureCache(options.cwd)
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
    getSignatureCache(): SessionSignatureCache {
      return signatureCache
    },
    async refreshSession(cwd?: string): Promise<void> {
      config = loadSharedGuardConfig({
        ...options,
        cwd: cwd ?? options.cwd,
      })
      syncDiskSignatureCache(cwd)

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
      signatureCache.shutdown()
    },
  }
}

export type ProviderRegistrationHost = Pick<ExtensionAPI, "registerProvider"> & {
  registerCommand?: ExtensionAPI["registerCommand"]
  registerTool?: ExtensionAPI["registerTool"]
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
  let activeSessionCwd = options?.cwd
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
    activeSessionCwd = ctx?.cwd ?? options?.cwd
    await runtime.refreshSession(ctx?.cwd)
  })
  pi.on?.("session_shutdown", () => {
    runtime.shutdown()
  })

  registerPiGuardCommands(pi, {
    pool: runtime.getAccountPool(),
    getConfig: () => runtime.getConfig(),
    now: options?.now,
  })

  registerPiGoogleSearchTool(pi, runtime, options, () => activeSessionCwd)

  pi.registerProvider(PROVIDER, {
    name: "Antigravity Guard",
    baseUrl: ANTIGRAVITY_ENDPOINTS.daily,
    api: API,
    models: listCatalogEntries().map(toPiModelDescriptor),
    async refreshModels(refreshCtx: RefreshModelsContext) {
      return refreshDiscoveredModels(refreshCtx, runtime, options, activeSessionCwd)
    },
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

      if (activeManager && pool.hasManagedPoolHistory()) {
        if (activeManager.getTotalAccountCount() === 0) {
          throw createPoolUnavailableError({ reason: "no-accounts" })
        }
        const excludedRefreshTokens = new Set<string>()
        let lastError: unknown
        let waitedForSoftQuota = false
        let waitedForRateLimit = false
        while (true) {
          const selected = await pool.acquireCredentials({
            modelId: model.id,
            fetch: fetchFn,
            signal,
            excludeRefreshTokens: excludedRefreshTokens,
          })
          if (!selected) {
            if (lastError) throw lastError
            const unavailable = await pool.resolvePoolUnavailableOutcome({
              modelId: model.id,
              fetch: fetchFn,
              signal,
              alreadyWaitedForSoftQuota: waitedForSoftQuota,
              alreadyWaitedForRateLimit: waitedForRateLimit,
            })
            if (unavailable.action === "wait-and-retry") {
              if (unavailable.kind === "soft-quota") {
                waitedForSoftQuota = true
                await (runtimeOptions?.sleep ?? abortableSleep)(unavailable.waitMs, signal)
                await pool.refreshQuotasLive({ fetch: fetchFn, signal })
              } else {
                waitedForRateLimit = true
                await (runtimeOptions?.sleep ?? abortableSleep)(unavailable.waitMs, signal)
              }
              excludedRefreshTokens.clear()
              continue
            }
            throw unavailable.error
          }
          excludedRefreshTokens.add(selected.account.parts.refreshToken)

          let emittedOutput = false
          try {
            await executeStreamTransport({
              accessToken: selected.accessToken,
              projectId: selected.projectId,
              context,
              endpoints: ANTIGRAVITY_ENDPOINT_FALLBACKS,
              fetch: fetchFn,
              generationOptions: options,
              headers: normalizeProviderHeaders(options?.headers),
              maxCapacityRetriesPerEndpoint: MAX_CAPACITY_RETRIES_PER_ENDPOINT,
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
              signatureCache: runtime.getSignatureCache(),
              sleep: runtimeOptions?.sleep,
              timeoutMs: options?.timeoutMs,
              userAgent: selected.userAgent,
            })
            await pool.recordSuccess(selected.account, fetchFn)
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
              headers: error.responseHeaders,
              message: error.message,
              tokenConsumed: selected.tokenConsumed,
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
        signatureCache: runtime.getSignatureCache(),
        sleep: runtimeOptions?.sleep,
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
    candidate.token.trim() !== SHARED_POOL_PLACEHOLDER_ACCESS &&
    typeof candidate.projectId === "string" &&
    candidate.projectId.trim().length > 0
  )
}

const googleSearchParameters = Type.Object({
  query: Type.String({
    description: "The search query or question to answer using web search",
  }),
  urls: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "List of specific URLs to fetch and analyze. Extract and include any URLs mentioned by the user.",
    }),
  ),
  thinking: Type.Optional(
    Type.Boolean({
      description: "Enable deep thinking for more thorough analysis (default: true)",
    }),
  ),
})

function registerPiGoogleSearchTool(
  pi: ProviderRegistrationHost,
  runtime: PiGuardRuntime,
  runtimeOptions?: PiGuardRuntimeOptions,
  getSessionCwd?: () => string | undefined,
): void {
  if (typeof pi.registerTool !== "function") return

  pi.registerTool({
    name: "google_search",
    label: "Google Search",
    description:
      "Search the web using Google Search and analyze URLs. Returns real-time information from the internet with source citations.",
    parameters: googleSearchParameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const effectiveSignal = signal ?? new AbortController().signal
      effectiveSignal.throwIfAborted()

      const fetchFn = runtimeOptions?.fetch ?? globalThis.fetch
      const nowFn = runtimeOptions?.now ?? Date.now
      const pool = runtime.getAccountPool()
      const cwd = ctx?.cwd ?? getSessionCwd?.() ?? runtimeOptions?.cwd
      const allowDiskScope =
        runtimeOptions === undefined ||
        cwd !== undefined ||
        runtimeOptions.homeDir !== undefined ||
        runtimeOptions.env !== undefined ||
        pool.getManager() !== null

      if (allowDiskScope) {
        await pool.loadOrRefresh(cwd)
      }

      const activeManager = pool.getManager()
      if (activeManager && pool.hasManagedPoolHistory()) {
        if (activeManager.getTotalAccountCount() === 0) {
          const noAccErr = createPoolUnavailableError({ reason: "no-accounts" })
          return {
            content: [{ type: "text" as const, text: `## Search Error\n\n${noAccErr.message}` }],
            details: { error: true },
          }
        }
        const excludedRefreshTokens = new Set<string>()
        const retriedStaleAuthByToken = new Set<string>()
        let lastFailureText: string | undefined
        let waitedForSoftQuota = false
        let waitedForRateLimit = false

        while (true) {
          const selected = await pool.acquireCredentials({
            modelId: SEARCH_MODEL,
            fetch: fetchFn,
            signal: effectiveSignal,
            excludeRefreshTokens: excludedRefreshTokens,
          })
          if (!selected) {
            if (lastFailureText) {
              return {
                content: [{ type: "text" as const, text: lastFailureText }],
                details: { error: true },
              }
            }
            const unavailable = await pool.resolvePoolUnavailableOutcome({
              modelId: SEARCH_MODEL,
              fetch: fetchFn,
              signal: effectiveSignal,
              alreadyWaitedForSoftQuota: waitedForSoftQuota,
              alreadyWaitedForRateLimit: waitedForRateLimit,
            })
            if (unavailable.action === "wait-and-retry") {
              if (unavailable.kind === "soft-quota") {
                waitedForSoftQuota = true
                await (runtimeOptions?.sleep ?? abortableSleep)(unavailable.waitMs, effectiveSignal)
                await pool.refreshQuotasLive({ fetch: fetchFn, signal: effectiveSignal })
              } else {
                waitedForRateLimit = true
                await (runtimeOptions?.sleep ?? abortableSleep)(unavailable.waitMs, effectiveSignal)
              }
              excludedRefreshTokens.clear()
              continue
            }
            return {
              content: [{ type: "text" as const, text: `## Search Error\n\n${unavailable.error.message}` }],
              details: { error: true },
            }
          }

          const tokenKey = selected.account.parts.refreshToken
          const searchOutcome = await executeAntigravitySearchDetailed(
            {
              query: params.query,
              urls: params.urls,
              thinking: params.thinking,
            },
            selected.accessToken,
            selected.projectId,
            {
              abortSignal: effectiveSignal,
              endpoints: ANTIGRAVITY_ENDPOINT_FALLBACKS,
              fetch: fetchFn,
              userAgent: selected.userAgent,
            },
          )

          if (searchOutcome.ok) {
            await pool.recordSuccess(selected.account, fetchFn)
            return {
              content: [{ type: "text" as const, text: searchOutcome.formatted }],
              details: { query: params.query, urlCount: params.urls?.length ?? 0 },
            }
          }

          lastFailureText = searchOutcome.formatted
          if (effectiveSignal.aborted || searchOutcome.status === undefined) {
            return {
              content: [{ type: "text" as const, text: searchOutcome.formatted }],
              details: { error: true },
            }
          }

          const failureOutcome = await pool.recordHttpFailure({
            account: selected.account,
            modelId: SEARCH_MODEL,
            status: searchOutcome.status,
            body: searchOutcome.errorBody,
            headers: searchOutcome.headers,
            message: searchOutcome.statusText,
            tokenConsumed: selected.tokenConsumed,
          })

          // If a cached access token returned HTTP 401 and recordHttpFailure cleared it, allow one immediate re-acquire on this account
          if (searchOutcome.status === 401 && !retriedStaleAuthByToken.has(tokenKey)) {
            retriedStaleAuthByToken.add(tokenKey)
            continue
          }

          excludedRefreshTokens.add(tokenKey)
          if (!failureOutcome.rotated) {
            return {
              content: [{ type: "text" as const, text: searchOutcome.formatted }],
              details: { error: true },
            }
          }
        }
      }

      if (allowDiskScope) {
        const authPath = resolvePiAuthJsonPath({
          ...runtimeOptions,
          cwd,
        })
        const authEntry = readPiAuthEntry(authPath)
        if (authEntry) {
          let accessToken = authEntry.access
          if (!accessToken || accessToken === SHARED_POOL_PLACEHOLDER_ACCESS || authEntry.expires <= nowFn() + 60_000) {
            try {
              const refreshToken = parseRefreshParts(authEntry.refresh).refreshToken
              const refreshed = await refreshCredentials({
                credentials: {
                  refresh: refreshToken,
                  access: authEntry.access,
                  expires: authEntry.expires,
                  projectId: authEntry.projectId || ANTIGRAVITY_DEFAULT_PROJECT_ID,
                  email: authEntry.email,
                },
                fetch: fetchFn,
                now: nowFn,
                signal: effectiveSignal,
                deadlineMs: nowFn() + 30_000,
              })
              accessToken = refreshed.access
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Error: Failed to refresh access token: ${message}`,
                  },
                ],
                details: { error: true },
              }
            }
          }
          if (accessToken) {
            const projectId = authEntry.projectId || ANTIGRAVITY_DEFAULT_PROJECT_ID
            const searchOutcome = await executeAntigravitySearchDetailed(
              {
                query: params.query,
                urls: params.urls,
                thinking: params.thinking,
              },
              accessToken,
              projectId,
              {
                abortSignal: effectiveSignal,
                endpoints: ANTIGRAVITY_ENDPOINT_FALLBACKS,
                fetch: fetchFn,
                userAgent: runtime.getUserAgent(),
              },
            )
            return {
              content: [{ type: "text" as const, text: searchOutcome.formatted }],
              details: { query: params.query, urlCount: params.urls?.length ?? 0 },
            }
          }
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: "Error: Not authenticated with Antigravity. Run `/login antigravity-guard` to authenticate.",
          },
        ],
        details: { error: true },
      }
    },
  })
}

async function resolveDiscoveryCredentials(
  refreshCtx: RefreshModelsContext,
  runtime: PiGuardRuntime,
  runtimeOptions?: PiGuardRuntimeOptions,
  allowDiskFallback = false,
  effectiveCwd?: string,
): Promise<{ token: string; projectId: string } | null> {
  const fetchFn = runtimeOptions?.fetch ?? globalThis.fetch
  const nowFn = runtimeOptions?.now ?? Date.now
  const nowMs = nowFn()

  const refreshInMemory = async (
    rawRefresh: string,
    fallbackProjectId?: string,
  ): Promise<{ token: string; projectId: string } | null> => {
    const parts = parseRefreshParts(rawRefresh)
    if (!parts.refreshToken) return null
    const projectId =
      parts.managedProjectId ??
      parts.projectId ??
      (fallbackProjectId && fallbackProjectId.trim() ? fallbackProjectId.trim() : undefined) ??
      ANTIGRAVITY_DEFAULT_PROJECT_ID
    try {
      const refreshed = await refreshCredentials({
        credentials: {
          refresh: parts.refreshToken,
          access: "",
          expires: 0,
          projectId,
        },
        fetch: fetchFn,
        now: nowFn,
        signal: refreshCtx.signal,
        deadlineMs: nowMs + 15_000,
      })
      if (refreshed.access) {
        return { token: refreshed.access, projectId }
      }
    } catch {
      // Ignore refresh failure on candidate and try next fallback
    }
    return null
  }

  const credential = refreshCtx.credential
  if (credential && credential.type === "oauth") {
    const extras = credential as { projectId?: unknown }
    const credProjectId =
      typeof extras.projectId === "string" && extras.projectId.trim()
        ? extras.projectId.trim()
        : undefined
    const isUnexpired =
      typeof credential.expires !== "number" || credential.expires > nowMs
    const rawAccess = typeof credential.access === "string" ? credential.access.trim() : ""

    if (rawAccess && rawAccess !== SHARED_POOL_PLACEHOLDER_ACCESS && isUnexpired) {
      try {
        return parseProviderApiKey(rawAccess)
      } catch {
        return {
          token: rawAccess,
          projectId: credProjectId ?? ANTIGRAVITY_DEFAULT_PROJECT_ID,
        }
      }
    }

    if (typeof credential.refresh === "string" && credential.refresh.trim()) {
      const refreshed = await refreshInMemory(credential.refresh, credProjectId)
      if (refreshed) return refreshed
    }
  }

  const manager = runtime.getAccountPool().getManager()
  if (manager) {
    for (const acc of manager.getEnabledAccounts()) {
      if (
        acc.access &&
        acc.access !== SHARED_POOL_PLACEHOLDER_ACCESS &&
        typeof acc.expires === "number" &&
        acc.expires > nowMs
      ) {
        return {
          token: acc.access,
          projectId:
            acc.parts.managedProjectId ??
            acc.parts.projectId ??
            ANTIGRAVITY_DEFAULT_PROJECT_ID,
        }
      }
    }
    for (const acc of manager.getEnabledAccounts()) {
      const refreshed = await refreshInMemory(
        acc.parts.refreshToken,
        acc.parts.managedProjectId ?? acc.parts.projectId,
      )
      if (refreshed) return refreshed
    }
  }

  if (allowDiskFallback) {
    const scopedOptions = {
      ...runtimeOptions,
      cwd: effectiveCwd ?? runtimeOptions?.cwd,
    }
    // Read-only disk fallback when refreshModels runs before session_start (zero mutations to AccountManager or disk)
    const paths = resolveSharedGuardPaths(scopedOptions)
    const storedPool = await loadAccountsFromPath(paths.accountsPath)
    if (storedPool?.accounts?.length) {
      for (const acc of storedPool.accounts) {
        if (acc.enabled === false) continue
        const refreshed = await refreshInMemory(
          acc.refreshToken,
          acc.managedProjectId ?? acc.projectId,
        )
        if (refreshed) return refreshed
      }
    }

    const authEntry = readPiAuthEntry(resolvePiAuthJsonPath(scopedOptions))
    if (authEntry) {
      if (
        authEntry.access &&
        authEntry.access !== SHARED_POOL_PLACEHOLDER_ACCESS &&
        authEntry.expires > nowMs
      ) {
        return {
          token: authEntry.access,
          projectId: authEntry.projectId || ANTIGRAVITY_DEFAULT_PROJECT_ID,
        }
      }
      const refreshed = await refreshInMemory(authEntry.refresh, authEntry.projectId)
      if (refreshed) return refreshed
    }
  }

  return null
}

async function refreshDiscoveredModels(
  refreshCtx: RefreshModelsContext,
  runtime: PiGuardRuntime,
  runtimeOptions?: PiGuardRuntimeOptions,
  sessionCwd?: string,
) {
  const staticModels = listCatalogEntries().map(toPiModelDescriptor)
  const env = runtimeOptions?.env ?? process.env
  const offline = /^(1|true|yes)$/i.test(env.PI_OFFLINE ?? "")

  if (!refreshCtx.allowNetwork || offline || refreshCtx.signal.aborted) {
    return staticModels
  }

  const effectiveCwd = sessionCwd ?? runtimeOptions?.cwd
  const allowDiskScope =
    runtimeOptions === undefined ||
    effectiveCwd !== undefined ||
    runtimeOptions.homeDir !== undefined ||
    runtimeOptions.env !== undefined ||
    runtime.getAccountPool().getManager() !== null

  const config = allowDiskScope
    ? loadSharedGuardConfig({
        ...runtimeOptions,
        cwd: effectiveCwd,
      })
    : runtime.getConfig()
  if (!config.model_discovery.enabled || !config.model_discovery.antigravity) {
    return staticModels
  }

  const creds = await resolveDiscoveryCredentials(
    refreshCtx,
    runtime,
    runtimeOptions,
    allowDiskScope,
    effectiveCwd,
  )
  if (!creds) {
    return staticModels
  }

  try {
    const response = await fetchAvailableModels(creds.token, creds.projectId, {
      fetch: runtimeOptions?.fetch ?? globalThis.fetch,
      signal: refreshCtx.signal,
      userAgent: runtime.getUserAgent(),
    })
    if (!response.models || Object.keys(response.models).length === 0) {
      return staticModels
    }
    const mergedEntries = registerDiscoveredCatalogEntries(response.models)
    return mergedEntries.map(toPiModelDescriptor)
  } catch {
    return staticModels
  }
}
