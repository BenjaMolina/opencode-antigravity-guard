import { createServer, request } from "node:http"
import { connect } from "node:net"
import { once } from "node:events"
import { afterEach, describe, expect, it } from "vitest"

import { openLoopbackReceiver, validateLoopbackCallback } from "./loopback.ts"

const PORT = 51121
const STATE = "0123456789abcdef0123456789abcdef"

async function send(path: string, method = "GET", host = "localhost:51121") {
  return new Promise<{ status: number; headers: Record<string, string | string[] | undefined> }>((resolve, reject) => {
    const client = request({ host: "127.0.0.1", port: PORT, path, method, headers: { host } }, (response) => {
      response.resume()
      response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers }))
    })
    client.on("error", reject)
    client.end()
  })
}

async function canBindPort() {
  const server = createServer()
  await new Promise<void>((resolve, reject) => server.once("error", reject).listen(PORT, "127.0.0.1", resolve))
  await new Promise<void>((resolve) => server.close(() => resolve()))
}

async function sendTwoCallbacks() {
  const socket = connect(PORT, "127.0.0.1")
  await once(socket, "connect")
  const statuses = new Promise<number[]>((resolve) => {
    let response = ""
    socket.on("data", (chunk: Buffer) => { response += chunk.toString() })
    socket.once("close", () => resolve([...response.matchAll(/HTTP\/1\.1 (\d+)/g)].map((match) => Number(match[1]))))
  })
  const target = `/oauth-callback?code=winner&state=${STATE}`
  socket.write(`GET ${target} HTTP/1.1\r\nHost: localhost:51121\r\n\r\nGET ${target} HTTP/1.1\r\nHost: localhost:51121\r\n\r\n`)
  return statuses
}

afterEach(async () => {
  await canBindPort().catch(() => undefined)
})

describe("validateLoopbackCallback", () => {
  it("rejects non-loopback, malformed, duplicate, mixed, wrong-state, and denied callbacks", () => {
    const valid = { method: "GET", host: "localhost:51121", remoteAddress: "127.0.0.1" }
    expect(validateLoopbackCallback({ ...valid, url: "/other" }, STATE)).toMatchObject({ kind: "ignore", status: 404 })
    expect(validateLoopbackCallback({ ...valid, method: "POST", url: "/oauth-callback" }, STATE)).toMatchObject({ kind: "ignore", status: 405 })
    for (const url of [
      `/oauth-callback?code=a&state=${STATE}&state=${STATE}`,
      `/oauth-callback?code=a&code=b&state=${STATE}`,
      `/oauth-callback?error=a&error=b&state=${STATE}`,
      `/oauth-callback?code=a&error=access_denied&state=${STATE}`,
      `/oauth-callback?code=a&state=wrong`,
      `/oauth-callback?${"x".repeat(8193)}`,
    ]) {
      expect(validateLoopbackCallback({ ...valid, url }, STATE)).toMatchObject({ kind: "reject" })
    }
    expect(validateLoopbackCallback({ ...valid, host: "evil.example", url: `/oauth-callback?code=a&state=${STATE}` }, STATE)).toMatchObject({ kind: "reject" })
    expect(validateLoopbackCallback({ ...valid, remoteAddress: "10.0.0.1", url: `/oauth-callback?code=a&state=${STATE}` }, STATE)).toMatchObject({ kind: "reject" })
    expect(validateLoopbackCallback({ ...valid, url: `/oauth-callback?error=access_denied&state=${STATE}` }, STATE)).toEqual({ kind: "denied" })
  })

  it("rejects hostile targets and malformed Unicode while accepting exactly 8KiB", () => {
    const valid = { method: "GET", host: "localhost:51121", remoteAddress: "127.0.0.1" }
    const base = `/oauth-callback?code=a&state=${STATE}&x=`
    const atLimit = base + "x".repeat(8192 - Buffer.byteLength(base))
    expect(validateLoopbackCallback({ ...valid, url: atLimit }, STATE)).toEqual({ kind: "callback", code: "a" })
    for (const url of [
      `${atLimit}x`,
      `//localhost:51121/oauth-callback?code=a&state=${STATE}`,
      `/safe/../oauth-callback?code=a&state=${STATE}`,
      `/oauth-callback#fragment`,
      `/oauth-callback?code=a&state=${STATE}#fragment`,
      `/oauth-callback?code=%&state=${STATE}`,
      `/oauth-callback?code=%ed%a0%80&state=${STATE}`,
    ]) expect(validateLoopbackCallback({ ...valid, url }, STATE)).toMatchObject({ kind: "reject" })
    expect(validateLoopbackCallback({ ...valid, url: `/oauth-callback?code=a&state=${STATE}\ud800` }, STATE)).toMatchObject({ kind: "reject" })
  })
})

describe("openLoopbackReceiver", () => {
  it("accepts one callback, sends static no-store CSP, and releases the port", async () => {
    const receiver = openLoopbackReceiver({ state: STATE })
    await receiver.ready
    const response = await send(`/oauth-callback?code=accepted&state=${STATE}`)
    expect(response.status).toBe(200)
    expect(response.headers["cache-control"]).toBe("no-store")
    expect(response.headers["content-security-policy"]).toContain("default-src 'none'")
    await expect(receiver.result).resolves.toEqual({ kind: "callback", code: "accepted" })
    await canBindPort()
  })

  it("returns 409 to a pipelined losing callback, closes its socket, and rebinds", async () => {
    const receiver = openLoopbackReceiver({ state: STATE })
    await receiver.ready
    await expect(sendTwoCallbacks()).resolves.toEqual([200, 409])
    await expect(receiver.result).resolves.toEqual({ kind: "callback", code: "winner" })
    await canBindPort()
  })

  it("closes after a malformed callback and makes repeated validation harmless", async () => {
    const receiver = openLoopbackReceiver({ state: STATE })
    await receiver.ready
    expect((await send(`/oauth-callback?code=%&state=${STATE}`)).status).toBe(400)
    await expect(receiver.result).resolves.toEqual({ kind: "rejected", reason: "invalid-callback" })
    expect(validateLoopbackCallback({ method: "GET", host: "localhost:51121", remoteAddress: "127.0.0.1", url: `/oauth-callback?code=b&state=${STATE}` }, STATE)).toEqual({ kind: "callback", code: "b" })
    await canBindPort()
  })

  it("cancels sockets, rejects late arrival, and never listens in manual mode", async () => {
    const receiver = openLoopbackReceiver({ state: STATE })
    await receiver.ready
    const socket = connect(PORT, "127.0.0.1")
    await once(socket, "connect")
    receiver.cancel()
    await expect(receiver.result).resolves.toEqual({ kind: "cancelled" })
    await once(socket, "close")
    await expect(send(`/oauth-callback?code=late&state=${STATE}`)).rejects.toMatchObject({ code: "ECONNREFUSED" })
    const manual = openLoopbackReceiver({ state: STATE, mode: "manual" })
    await expect(manual.result).resolves.toEqual({ kind: "manual", reason: "manual" })
    await canBindPort()
  })

  it("offers manual fallback for an occupied port or elapsed loopback window", async () => {
    const occupier = createServer()
    await new Promise<void>((resolve) => occupier.listen(PORT, "127.0.0.1", resolve))
    const unavailable = openLoopbackReceiver({ state: STATE })
    await expect(unavailable.result).resolves.toEqual({ kind: "manual", reason: "listener-failure" })
    await new Promise<void>((resolve) => occupier.close(() => resolve()))
    const expired = openLoopbackReceiver({ state: STATE, loopbackWindowMs: 0, totalDeadlineMs: 1 })
    await expired.ready
    await expect(expired.result).resolves.toEqual({ kind: "manual", reason: "timeout" })
    await canBindPort()
  })
})
