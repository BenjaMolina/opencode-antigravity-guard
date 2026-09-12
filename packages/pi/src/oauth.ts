import { createHash, randomBytes } from "node:crypto"

import { ANTIGRAVITY_OAUTH_CLIENT, buildAuthorizationUrl } from "@benjamolina/antigravity-guard-core"
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai/oauth"

import { exchangeAuthorizationCode, refreshCredentials } from "./auth-http.ts"
import { openLoopbackReceiver, validateLoopbackCallback } from "./loopback.ts"
import type { LoopbackReceiver } from "./loopback.ts"
import { defaultProjectId, resolveLoginProject } from "./project.ts"
import type { LoginProject } from "./project.ts"
import type { PiCredentials } from "./types.ts"

const ATTEMPT_TIMEOUT_MS = 5 * 60_000
const PI_OAUTH_CLIENT = {
  ...ANTIGRAVITY_OAUTH_CLIENT,
  scopes: [...ANTIGRAVITY_OAUTH_CLIENT.scopes, "https://www.googleapis.com/auth/aicode"],
}
const trustedErrors = new WeakSet<OAuthLifecycleError>()

type PiOAuthCredentials = OAuthCredentials & Pick<PiCredentials, "projectId" | "email">

export interface PiOAuthDependencies {
  fetch: typeof globalThis.fetch
  now: () => number
  randomBytes?: (size: number) => Uint8Array
  exchange?: typeof exchangeAuthorizationCode
  refresh?: typeof refreshCredentials
  project?: (options: Parameters<typeof resolveLoginProject>[0]) => Promise<LoginProject>
  openLoopback?: (options: Parameters<typeof openLoopbackReceiver>[0]) => LoopbackReceiver
}

export interface PiOAuthLifecycle {
  login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>
  refreshToken(credentials: OAuthCredentials, signal: AbortSignal): Promise<OAuthCredentials>
  getApiKey(credentials: OAuthCredentials): string
}

export function createPiOAuthLifecycle(dependencies: PiOAuthDependencies): PiOAuthLifecycle {
  const bytes = dependencies.randomBytes ?? randomBytes
  const exchange = dependencies.exchange ?? exchangeAuthorizationCode
  const refresh = dependencies.refresh ?? refreshCredentials
  const project = dependencies.project ?? resolveLoginProject
  const openLoopback = dependencies.openLoopback ?? openLoopbackReceiver
  let active = false

  return {
    async login(callbacks) {
      if (active) throw new Error("An Antigravity login is already in progress.")
      active = true
      let receiver: LoopbackReceiver | undefined
      let signal: AbortSignal | undefined
      try {
        const deadline = dependencies.now() + ATTEMPT_TIMEOUT_MS
        signal = composedSignal(callbacks.signal, ATTEMPT_TIMEOUT_MS)
        const state = base64Url(bytes(32))
        const verifier = base64Url(bytes(32))
        const challenge = base64Url(createHash("sha256").update(verifier).digest())
        const authorizationUrl = buildAuthorizationUrl(PI_OAUTH_CLIENT, { challenge, state })
        const method = await abortable(() => callbacks.onSelect({
          message: "Choose how to complete Antigravity login.",
          options: [
            { id: "browser", label: "Open browser and wait for callback" },
            { id: "manual", label: "Paste the full callback URL" },
          ],
        }), signal)
        if (!method) throw cancelled()
        if (method === "browser") {
          const opened = await untrusted(() => openLoopback({ state, signal, totalDeadlineMs: deadline - dependencies.now() }), "Antigravity login failed.")
          receiver = opened
          await abortable(() => untrusted(() => opened.ready, "Antigravity login failed."), signal)
        } else if (method !== "manual") {
          throw cancelled()
        }
        callbacks.onAuth({ url: authorizationUrl })
        const code = receiver ? await codeFromLoopback(receiver, callbacks, signal, state) : await codeFromPrompt(callbacks, signal, state)
        const credentials = await abortable(() => untrusted(() => exchange({
          code, verifier, fetch: dependencies.fetch, now: dependencies.now, signal, deadlineMs: deadline,
        }), "Antigravity token exchange failed after authorization."), signal)
        const discovery = await abortable(
          () => Promise.resolve(project({ accessToken: credentials.access, fetch: dependencies.fetch, now: dependencies.now, platform: process.platform, signal, deadlineMs: deadline })).catch(() => ({})),
          signal,
        )
        return piCredentials(credentials, discovery)
      } catch (error) {
        if (trusted(error)) throw error
        if (signal?.aborted) throw cancelled()
        throw new OAuthLifecycleError("Antigravity login failed.")
      } finally {
        try { void Promise.resolve(receiver?.cancel()).catch(() => undefined) } catch {}
        active = false
      }
    },
    async refreshToken(credentials, signal) {
      try {
        const refreshed = await abortable(() => untrusted(
          () => refresh({ credentials: credentialsFrom(credentials), fetch: dependencies.fetch, now: dependencies.now, signal }),
          "Antigravity credential refresh failed.",
        ), signal)
        return piCredentials(refreshed, credentialProject(credentials))
      } catch (error) {
        if (trusted(error)) throw error
        if (signal.aborted) throw cancelled()
        throw new OAuthLifecycleError("Antigravity credential refresh failed.")
      }
    },
    getApiKey(credentials) {
      const project = credentialProject(credentials)
      return JSON.stringify({ token: credentials.access, projectId: project.projectId ?? defaultProjectId(project.email ?? "antigravity-default") })
    },
  }
}

async function codeFromLoopback(receiver: LoopbackReceiver, callbacks: OAuthLoginCallbacks, signal: AbortSignal, state: string): Promise<string> {
  const result = await abortable(() => untrusted(() => receiver.result, "Antigravity login failed."), signal)
  if (result.kind === "callback") return result.code
  if (result.kind === "manual") return codeFromPrompt(callbacks, signal, state)
  if (result.kind === "denied") throw new OAuthLifecycleError("Antigravity authorization was denied.")
  throw cancelled()
}

async function codeFromPrompt(callbacks: OAuthLoginCallbacks, signal: AbortSignal, state: string): Promise<string> {
  let input: string
  try {
    input = await abortable(() => callbacks.onPrompt({ message: "Paste the full callback URL." }), signal)
  } catch {
    throw cancelled()
  }
  if (!input.trim()) throw cancelled()
  return codeFromManualCallback(input, state)
}

function codeFromManualCallback(input: string, state: string): string {
  let result: ReturnType<typeof validateLoopbackCallback>
  try {
    const url = new URL(input)
    if (url.origin !== "http://localhost:51121" || url.pathname !== "/oauth-callback" || url.username || url.password || url.hash) throw new Error()
    result = validateLoopbackCallback({ method: "GET", host: "localhost:51121", remoteAddress: "127.0.0.1", url: `${url.pathname}${url.search}` }, state)
  } catch {
    throw new OAuthLifecycleError("Paste the full callback URL from Antigravity login.")
  }
  if (result.kind === "callback") return result.code
  if (result.kind === "denied") throw new OAuthLifecycleError("Antigravity authorization was denied.")
  throw new OAuthLifecycleError("Paste the full callback URL from Antigravity login.")
}

function credentialsFrom(credentials: OAuthCredentials): PiCredentials {
  return credentials as PiCredentials
}

function credentialProject(credentials: OAuthCredentials): Pick<PiCredentials, "projectId" | "email"> {
  const values = credentials as Record<string, unknown>
  return {
    ...(nonempty(values.projectId) ? { projectId: values.projectId } : {}),
    ...(nonempty(values.email) ? { email: values.email } : {}),
  }
}

function piCredentials(credentials: PiCredentials, discovered: LoginProject = {}): PiOAuthCredentials {
  const email = nonempty(discovered.email) ? discovered.email : undefined
  const projectId = nonempty(discovered.projectId) ? discovered.projectId : defaultProjectId(email ?? "antigravity-default")
  return { refresh: credentials.refresh, access: credentials.access, expires: credentials.expires, projectId, ...(email ? { email } : {}) }
}

function untrusted<T>(operation: () => T | Promise<T>, message: string): Promise<T> {
  return Promise.resolve().then(operation).catch(() => { throw new OAuthLifecycleError(message) })
}

function composedSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  return signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs)
}

function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(cancelled())
  return new Promise((resolve, reject) => {
    const abort = () => reject(cancelled())
    signal.addEventListener("abort", abort, { once: true })
    operation().then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
}

function base64Url(value: Uint8Array): string {
  return Buffer.from(value).toString("base64url")
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function cancelled(): OAuthLifecycleError {
  return new OAuthLifecycleError("Antigravity login was cancelled.")
}

function trusted(error: unknown): error is OAuthLifecycleError {
  return error instanceof OAuthLifecycleError && trustedErrors.delete(error)
}

class OAuthLifecycleError extends Error {
  constructor(message: string) { super(message); trustedErrors.add(this) }
}
