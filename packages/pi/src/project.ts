import {
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_VERSION_FALLBACK,
  GEMINI_CLI_HEADERS,
  buildAntigravityHeaders,
} from "@benjamolina/antigravity-guard-core"

const MAX_BODY_BYTES = 64 * 1024
const REQUEST_TIMEOUT_MS = 10_000

type ProjectErrorKind = "aborted" | "access" | "response" | "transport"

export class ProjectHttpError extends Error {
  readonly kind: ProjectErrorKind
  readonly status?: number

  constructor(kind: ProjectErrorKind, message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

export interface LoadCodeAssistProjectOptions {
  accessToken: string
  fetch: typeof globalThis.fetch
  now: () => number
  platform: string
  signal?: AbortSignal
  deadlineMs?: number
}

export async function loadCodeAssistProject(options: LoadCodeAssistProjectOptions): Promise<string> {
  const signal = requestSignal(options)
  const headers = buildAntigravityHeaders({ version: ANTIGRAVITY_VERSION_FALLBACK, platform: options.platform })
  const metadata = metadataFor(options.platform)
  let response: Response
  try {
    response = await abortable(options.fetch(`${ANTIGRAVITY_ENDPOINTS.production}/v1internal:loadCodeAssist`, {
      method: "POST",
      redirect: "error",
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": GEMINI_CLI_HEADERS["User-Agent"],
        "X-Goog-Api-Client": headers["X-Goog-Api-Client"],
        "Client-Metadata": headers["Client-Metadata"],
      },
      body: JSON.stringify({ metadata }),
      signal,
    }), signal)
  } catch {
    if (signal.aborted) throw safeAbortError(signal)
    throw new ProjectHttpError("transport", "Project resolution request failed.")
  }

  const body = await readBoundedBody(response, signal)
  if (!response.ok) throw responseError(response.status)
  return projectFrom(parseJson(body))
}

function metadataFor(platform: string): { ideType: string, platform: string, pluginType: string } {
  return {
    ideType: "ANTIGRAVITY",
    platform: platform === "win32" ? "WINDOWS" : "MACOS",
    pluginType: "GEMINI",
  }
}

function requestSignal(options: LoadCodeAssistProjectOptions): AbortSignal {
  const remaining = options.deadlineMs === undefined
    ? REQUEST_TIMEOUT_MS
    : Math.min(REQUEST_TIMEOUT_MS, options.deadlineMs - options.now())
  if (remaining <= 0 || options.signal?.aborted) throw safeAbortError(options.signal)
  return options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(remaining)]) : AbortSignal.timeout(remaining)
}

async function readBoundedBody(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) return ""
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const chunks: Uint8Array[] = []
  let size = 0
  let tooLarge = false
  try {
    reader = response.body.getReader()
    while (true) {
      const next = await abortable(reader.read(), signal)
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_BODY_BYTES) {
        tooLarge = true
        break
      }
      chunks.push(next.value)
    }
  } catch {
    void reader?.cancel().catch(() => undefined)
    if (signal.aborted) throw safeAbortError(signal)
    throw new ProjectHttpError("transport", "Project resolution request failed.")
  } finally {
    if (tooLarge) void reader?.cancel().catch(() => undefined)
    reader?.releaseLock()
  }
  if (tooLarge) throw new ProjectHttpError("response", "Project resolution response was too large.")
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
  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new ProjectHttpError("response", "Antigravity did not return a usable project. Check your Antigravity setup and access.")
  }
}

function projectFrom(value: unknown): string {
  if (!isRecord(value)) throw invalidProject()
  const project = value.cloudaicompanionProject
  if (nonempty(project)) return project
  if (isRecord(project) && nonempty(project.id)) return project.id
  throw invalidProject()
}

function responseError(status: number): ProjectHttpError {
  if (status === 401) return new ProjectHttpError("access", "Authentication expired. Run /login antigravity-guard.", status)
  if (status === 403) return new ProjectHttpError("access", "Project access was denied. Check your Antigravity access.", status)
  return new ProjectHttpError("response", "Project resolution request was rejected.", status)
}

function safeAbortError(signal: AbortSignal | undefined): ProjectHttpError {
  return new ProjectHttpError("aborted", signal?.aborted ? "Project resolution was cancelled." : "Project resolution failed.")
}

function invalidProject(): ProjectHttpError {
  return new ProjectHttpError("response", "Antigravity did not return a usable project. Check your Antigravity setup and access.")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}
