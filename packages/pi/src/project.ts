import { createHash } from "node:crypto"

const USER_INFO_ENDPOINT = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json"
const PROJECT_ENDPOINTS = [
  "https://daily-cloudcode-pa.googleapis.com",
  "https://daily-cloudcode-pa.sandbox.googleapis.com",
  "https://cloudcode-pa.googleapis.com",
]
const MAX_BODY_BYTES = 64 * 1024
const REQUEST_TIMEOUT_MS = 10_000
const ANTIGRAVITY_USER_AGENT = "antigravity/cli/1.1.23 (aidev_client; os_type=linux; arch=amd64; cl=974125021; auth_method=consumer)"

export interface LoginProjectOptions {
  accessToken: string
  fetch: typeof globalThis.fetch
  now: () => number
  platform: string
  signal?: AbortSignal
  deadlineMs?: number
}

export interface LoginProject {
  email?: string
  projectId?: string
}

export async function resolveLoginProject(options: LoginProjectOptions): Promise<LoginProject> {
  const email = await userEmail(options)
  const projectId = await discoveredProject(options)
  return { ...(email ? { email } : {}), ...(projectId ? { projectId } : {}) }
}

export function defaultProjectId(seed: string): string {
  const bytes = createHash("sha1").update(`antigravity:${seed}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

async function userEmail(options: LoginProjectOptions): Promise<string | undefined> {
  const { payload } = await bestEffort(options, USER_INFO_ENDPOINT, {
    method: "GET",
    redirect: "error",
    headers: { Authorization: `Bearer ${options.accessToken}` },
  })
  return isRecord(payload) && nonempty(payload.email) ? payload.email : undefined
}

async function discoveredProject(options: LoginProjectOptions): Promise<string | undefined> {
  const request: RequestInit = {
    method: "POST",
    redirect: "error",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": ANTIGRAVITY_USER_AGENT,
    },
    body: JSON.stringify({ metadata: { ideType: "ANTIGRAVITY" } }),
  }
  for (const origin of PROJECT_ENDPOINTS) {
    const response = await bestEffort(options, `${origin}/v1internal:loadCodeAssist`, request)
    if (!response.ok) continue
    const projectId = projectFrom(response.payload)
    return projectId ?? listProject(options, request)
  }
  return undefined
}

async function listProject(options: LoginProjectOptions, request: RequestInit): Promise<string | undefined> {
  const listRequest = { ...request, body: "{}" }
  for (const origin of PROJECT_ENDPOINTS) {
    const { payload } = await bestEffort(options, `${origin}/v1internal:listCloudAICompanionProjects`, listRequest)
    const projectId = projectFrom(payload)
    if (projectId) return projectId
  }
  return undefined
}

async function bestEffort(options: LoginProjectOptions, endpoint: string, request: RequestInit): Promise<{ ok: boolean, payload?: unknown }> {
  const timeout = options.deadlineMs === undefined
    ? REQUEST_TIMEOUT_MS
    : Math.min(REQUEST_TIMEOUT_MS, options.deadlineMs - options.now())
  if (timeout <= 0 || options.signal?.aborted) return { ok: false }
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout)
  let response: Response | undefined
  try {
    response = await options.fetch(endpoint, { ...request, signal })
  } catch {
    return { ok: false }
  }
  if (!response?.ok) return { ok: false }
  try {
    const body = await boundedBody(response.body, signal)
    return body === undefined ? { ok: true } : { ok: true, payload: JSON.parse(body) as unknown }
  } catch {
    return { ok: true }
  }
}

async function boundedBody(body: ReadableStream<Uint8Array> | null, signal: AbortSignal): Promise<string | undefined> {
  if (!body) return undefined
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let complete = false
  try {
    while (true) {
      const next = await abortable(reader.read(), signal)
      if (next.done) {
        complete = true
        const output = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) {
          output.set(chunk, offset)
          offset += chunk.byteLength
        }
        return new TextDecoder().decode(output)
      }
      size += next.value.byteLength
      if (size > MAX_BODY_BYTES) return undefined
      chunks.push(next.value)
    }
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new Error("aborted"))
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error("aborted"))
    signal.addEventListener("abort", abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort))
  })
}

function projectFrom(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const projectId = projectFrom(entry)
      if (projectId) return projectId
    }
    return undefined
  }
  if (!isRecord(value)) return undefined
  const project = value.cloudaicompanionProject
  if (nonempty(project)) return project
  if (isRecord(project) && nonempty(project.id)) return project.id
  for (const entry of Object.values(value)) {
    const projectId = projectFrom(entry)
    if (projectId) return projectId
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}
