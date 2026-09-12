import {
  ANTIGRAVITY_OAUTH_CLIENT,
  buildCodeExchangeForm,
  buildRefreshForm,
  calculateTokenExpiry,
} from "@benjamolina/antigravity-guard-core"

import type { AuthHttpDependencies, PiCredentials } from "./types.ts"

const MAX_BODY_BYTES = 64 * 1024
const REQUEST_TIMEOUT_MS = 10_000

type AuthErrorKind = "aborted" | "authentication" | "response" | "transport"

export class AuthHttpError extends Error {
  readonly kind: AuthErrorKind
  readonly status?: number

  constructor(kind: AuthErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

export interface ExchangeAuthorizationCodeOptions extends AuthHttpDependencies {
  code: string
  verifier: string
}

export interface RefreshCredentialsOptions extends AuthHttpDependencies {
  credentials: PiCredentials
}

export async function exchangeAuthorizationCode(
  options: ExchangeAuthorizationCodeOptions,
): Promise<PiCredentials> {
  return requestTokens(
    buildCodeExchangeForm(ANTIGRAVITY_OAUTH_CLIENT, options),
    options,
    undefined,
  )
}

export async function refreshCredentials(options: RefreshCredentialsOptions): Promise<PiCredentials> {
  return requestTokens(
    buildRefreshForm(ANTIGRAVITY_OAUTH_CLIENT, options.credentials.refresh),
    options,
    options.credentials.refresh,
  )
}

async function requestTokens(
  form: URLSearchParams,
  options: AuthHttpDependencies,
  priorRefresh: string | undefined,
): Promise<PiCredentials> {
  const signal = requestSignal(options)
  const requestTime = options.now()
  let response: Response
  try {
    response = await abortable(options.fetch(ANTIGRAVITY_OAUTH_CLIENT.tokenEndpoint, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal,
    }), signal)
  } catch {
    if (signal.aborted) throw safeAbortError(signal)
    throw new AuthHttpError("transport", "Authentication request failed.")
  }

  const body = await readBoundedBody(response, signal)
  if (!response.ok) throw responseError(response.status, tryParseJson(body))
  return credentialsFrom(parseJson(body), requestTime, priorRefresh)
}

function requestSignal(options: AuthHttpDependencies): AbortSignal {
  const remaining = options.deadlineMs === undefined
    ? REQUEST_TIMEOUT_MS
    : Math.min(REQUEST_TIMEOUT_MS, options.deadlineMs - options.now())
  if (remaining <= 0 || options.signal?.aborted) throw safeAbortError(options.signal)
  return options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(remaining)]) : AbortSignal.timeout(remaining)
}

async function readBoundedBody(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) return ""
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await abortable(reader.read(), signal)
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_BODY_BYTES) throw new AuthHttpError("response", "Authentication response was too large.")
      chunks.push(next.value)
    }
  } catch (error) {
    void reader.cancel().catch(() => undefined)
    if (error instanceof AuthHttpError) throw error
    if (signal.aborted) throw safeAbortError(signal)
    throw new AuthHttpError("transport", "Authentication request failed.")
  } finally {
    reader.releaseLock()
  }
  return new TextDecoder().decode(concat(chunks, size))
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(safeAbortError(signal))
  return new Promise((resolve, reject) => {
    const abort = () => reject(safeAbortError(signal))
    signal.addEventListener("abort", abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
}

function concat(chunks: Uint8Array[], size: number): Uint8Array {
  const output = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

function parseJson(body: string): unknown {
  const value = tryParseJson(body)
  if (value === undefined) throw new AuthHttpError("response", "Authentication service returned an invalid response.")
  return value
}

function tryParseJson(body: string): unknown | undefined {
  try {
    return JSON.parse(body) as unknown
  } catch {
    return undefined
  }
}

function credentialsFrom(
  value: unknown,
  requestTime: number,
  priorRefresh: string | undefined,
): PiCredentials {
  if (!isRecord(value) || !nonempty(value.access_token) || !finitePositive(value.expires_in)) {
    throw new AuthHttpError("response", "Authentication service returned invalid credentials.")
  }
  if (Object.hasOwn(value, "refresh_token") && !nonempty(value.refresh_token)) {
    throw new AuthHttpError("response", "Authentication service returned invalid credentials.")
  }
  const refresh = nonempty(value.refresh_token) ? value.refresh_token : priorRefresh
  const expires = calculateTokenExpiry(requestTime, value.expires_in)
  if (!refresh || !Number.isFinite(expires)) {
    throw new AuthHttpError("response", "Authentication service returned invalid credentials.")
  }
  return { access: value.access_token, refresh, expires }
}

function responseError(status: number, value: unknown): AuthHttpError {
  if (isRecord(value) && (value.error === "invalid_grant" || (isRecord(value.error) && value.error.error === "invalid_grant"))) {
    return new AuthHttpError("authentication", "Authentication expired. Run /login antigravity-guard.", status)
  }
  return new AuthHttpError(
    "authentication",
    status >= 500 ? "Authentication service is unavailable." : "Authentication request was rejected.",
    status,
  )
}

function safeAbortError(signal: AbortSignal | undefined): AuthHttpError {
  return new AuthHttpError("aborted", signal?.aborted ? "Authentication request was cancelled." : "Authentication request failed.")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}
