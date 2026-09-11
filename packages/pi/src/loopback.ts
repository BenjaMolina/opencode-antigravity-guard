import { createServer } from "node:http"
import type { Server } from "node:http"
import type { Socket } from "node:net"
import { timingSafeEqual } from "node:crypto"

const ADDRESS = "127.0.0.1"
const PORT = 51121
const HOST = "localhost:51121"
const PATH = "/oauth-callback"
const MAX_URL_BYTES = 8 * 1024
const LOOPBACK_WINDOW_MS = 30_000
const TOTAL_DEADLINE_MS = 5 * 60_000
const RESPONSE = "<!doctype html><title>Authorization complete</title><p>You may close this window.</p>"

export type LoopbackOutcome =
  | { kind: "callback"; code: string }
  | { kind: "denied" }
  | { kind: "rejected"; reason: "invalid-callback" }
  | { kind: "manual"; reason: "manual" | "listener-failure" | "timeout" }
  | { kind: "cancelled" }

export interface LoopbackRequest {
  method?: string
  host?: string
  remoteAddress?: string
  url?: string
}

export type CallbackValidation =
  | { kind: "callback"; code: string }
  | { kind: "denied" }
  | { kind: "reject" }
  | { kind: "ignore"; status: 404 | 405 }

export interface LoopbackReceiver {
  ready: Promise<void>
  result: Promise<LoopbackOutcome>
  cancel(): void
}

export interface LoopbackOptions {
  state: string
  mode?: "loopback" | "manual"
  signal?: AbortSignal
  loopbackWindowMs?: number
  totalDeadlineMs?: number
}

function hasOne(values: string[]): values is [string] {
  return values.length === 1 && values[0]!.length > 0
}

function isWellFormed(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      if (++index === value.length || value.charCodeAt(index) < 0xdc00 || value.charCodeAt(index) > 0xdfff) return false
    } else if (code >= 0xdc00 && code <= 0xdfff) return false
  }
  return true
}

function stateMatches(expected: string, actual: string): boolean {
  if (!isWellFormed(expected) || !isWellFormed(actual)) return false
  const expectedBytes = Buffer.from(expected, "utf8")
  const actualBytes = Buffer.from(actual, "utf8")
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes)
}

export function validateLoopbackCallback(request: LoopbackRequest, state: string): CallbackValidation {
  try {
    const target = request.url
    if (!target?.startsWith("/") || Buffer.byteLength(target, "utf8") > MAX_URL_BYTES) return { kind: "reject" }
    if (target.includes("#")) return { kind: "reject" }
    const queryAt = target.indexOf("?")
    const rawPath = target.slice(0, queryAt === -1 ? target.length : queryAt)
    if (rawPath !== PATH) {
      if (rawPath.startsWith("//") || rawPath.includes("..") || rawPath.includes("%")) return { kind: "reject" }
      return { kind: "ignore", status: 404 }
    }
    const rawQuery = queryAt === -1 ? "" : target.slice(queryAt + 1)
    if (/%(?![0-9a-f]{2})/i.test(rawQuery)) return { kind: "reject" }
    try {
      decodeURIComponent(rawQuery.replace(/\+/g, "%20"))
    } catch {
      return { kind: "reject" }
    }
    if (request.method !== "GET") return { kind: "ignore", status: 405 }
    if (request.host !== HOST || request.remoteAddress !== ADDRESS) return { kind: "reject" }

    const parameters = new URLSearchParams(rawQuery)
    const codes = parameters.getAll("code")
    const states = parameters.getAll("state")
    const errors = parameters.getAll("error")
    if (!hasOne(states) || !stateMatches(state, states[0]!)) return { kind: "reject" }
    if (hasOne(codes) === hasOne(errors)) return { kind: "reject" }
    return hasOne(codes) ? { kind: "callback", code: codes[0]! } : { kind: "denied" }
  } catch {
    return { kind: "reject" }
  }
}

export function openLoopbackReceiver(options: LoopbackOptions): LoopbackReceiver {
  let server: Server | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let settled = false
  let readyResolve!: () => void
  let resolve!: (outcome: LoopbackOutcome) => void
  const ready = new Promise<void>((done) => { readyResolve = done })
  const result = new Promise<LoopbackOutcome>((done) => { resolve = done })
  const sockets = new Set<Socket>()

  const cleanup = () => new Promise<void>((done) => {
    if (timer) clearTimeout(timer)
    options.signal?.removeEventListener("abort", cancel)
    for (const socket of sockets) socket.destroy()
    sockets.clear()
    if (!server) return done()
    server.close(() => done())
  })

  const claim = (): boolean => {
    if (settled) return false
    settled = true
    return true
  }

  const settle = (outcome: LoopbackOutcome) => {
    if (!claim()) return
    void cleanup().finally(() => resolve(outcome))
  }

  const cancel = () => settle({ kind: "cancelled" })
  const fallback = (reason: "listener-failure" | "timeout") => settle({ kind: "manual", reason })

  if (options.signal?.aborted) {
    readyResolve()
    cancel()
  } else if (options.mode === "manual") {
    readyResolve()
    settle({ kind: "manual", reason: "manual" })
  } else if (options.totalDeadlineMs !== undefined && options.totalDeadlineMs <= 0) {
    readyResolve()
    fallback("timeout")
  } else {
    server = createServer((request, response) => {
      let validation: CallbackValidation
      try {
        validation = validateLoopbackCallback({
          method: request.method,
          host: request.headers.host,
          remoteAddress: request.socket.remoteAddress,
          url: request.url,
        }, options.state)
      } catch {
        validation = { kind: "reject" }
      }
      if (validation.kind === "ignore") {
        response.writeHead(validation.status).end()
        return
      }
      const outcome: LoopbackOutcome = validation.kind === "callback"
        ? validation
        : validation.kind === "denied"
          ? validation
          : { kind: "rejected", reason: "invalid-callback" }
      if (!claim()) {
        response.writeHead(409).end()
        return
      }
      response.writeHead(validation.kind === "callback" ? 200 : 400, {
        "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        "content-type": "text/html; charset=utf-8",
      }).end(RESPONSE, () => {
        setImmediate(() => void cleanup().finally(() => resolve(outcome)))
      })
    })
    server.on("connection", (socket) => {
      sockets.add(socket)
      socket.once("close", () => sockets.delete(socket))
    })
    server.once("error", () => {
      readyResolve()
      fallback("listener-failure")
    })
    server.listen(PORT, ADDRESS, () => {
      readyResolve()
      const total = Math.min(options.totalDeadlineMs ?? TOTAL_DEADLINE_MS, TOTAL_DEADLINE_MS)
      const window = Math.min(options.loopbackWindowMs ?? LOOPBACK_WINDOW_MS, total)
      timer = setTimeout(() => fallback("timeout"), Math.max(0, window))
    })
    options.signal?.addEventListener("abort", cancel, { once: true })
  }

  return { ready, result, cancel }
}
