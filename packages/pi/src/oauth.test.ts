import type { OAuthLoginCallbacks } from "@earendil-works/pi-ai/oauth"
import { describe, expect, it, vi } from "vitest"

import { createPiOAuthLifecycle } from "./oauth.ts"
import type { LoopbackOutcome } from "./loopback.ts"

const credentials = { refresh: "refresh", access: "access", expires: 42 }

function receiver(result: LoopbackOutcome) {
  return { ready: Promise.resolve(), result: Promise.resolve(result), cancel: vi.fn() }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe("Pi OAuth lifecycle", () => {
  it("completes a manual full callback URL through token and project resolution", async () => {
    const exchange = vi.fn().mockResolvedValue({ refresh: "refresh", access: "access", expires: 42 })
    const project = vi.fn().mockResolvedValue("project")
    const openLoopback = vi.fn()
    let authUrl = ""
    const oauth = createPiOAuthLifecycle({
      fetch: vi.fn(),
      now: () => 0,
      randomBytes: () => new Uint8Array(32).fill(1),
      exchange,
      project,
      openLoopback,
    })

    await expect(oauth.login({
      onSelect: async () => "manual",
      onAuth: ({ url }) => { authUrl = url },
      onPrompt: async () => {
        const state = new URL(authUrl).searchParams.get("state")
        return `http://localhost:51121/oauth-callback?code=code&state=${state}`
      },
      onDeviceCode: () => undefined,
    })).resolves.toEqual({ refresh: "refresh", access: "access", expires: 42 })

    expect(openLoopback).not.toHaveBeenCalled()
    expect(exchange).toHaveBeenCalledWith(expect.objectContaining({ code: "code" }))
    expect(project).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "access" }))
    expect(new URL(authUrl).searchParams.get("code_verifier")).toBeNull()
  })

  it("uses the browser callback before exchange and offers one-state manual fallback", async () => {
    const exchange = vi.fn().mockResolvedValue(credentials)
    const fallback = receiver({ kind: "manual", reason: "timeout" })
    const openLoopback = vi.fn(() => fallback)
    const randomBytes = vi.fn()
      .mockReturnValueOnce(new Uint8Array(32).fill(2))
      .mockReturnValueOnce(new Uint8Array(32).fill(3))
    let authUrl = ""
    const oauth = createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0, randomBytes, exchange, project: vi.fn().mockResolvedValue("project"), openLoopback })

    await oauth.login({
      onSelect: async () => "browser",
      onAuth: (info) => { authUrl = info.url; expect(Object.keys(info)).toEqual(["url"]) },
      onPrompt: async () => `http://localhost:51121/oauth-callback?code=fallback&state=${new URL(authUrl).searchParams.get("state")}`,
      onDeviceCode: () => undefined,
    })

    expect(openLoopback).toHaveBeenCalledWith(expect.objectContaining({ state: new URL(authUrl).searchParams.get("state") }))
    const verifier = Buffer.from(new Uint8Array(32).fill(3)).toString("base64url")
    expect(exchange).toHaveBeenCalledWith(expect.objectContaining({ code: "fallback", verifier }))
    expect(authUrl).not.toContain(verifier)
    expect(randomBytes).toHaveBeenCalledTimes(2)
  })

  it("redacts a project-resolution failure after the token exchange", async () => {
    let authUrl = ""
    const oauth = createPiOAuthLifecycle({
      fetch: vi.fn(), now: () => 0, exchange: vi.fn().mockResolvedValue(credentials),
      project: vi.fn().mockRejectedValue(new Error("CANARY-project-token")),
    })
    await expect(oauth.login({
      onSelect: async () => "manual", onAuth: ({ url }) => { authUrl = url },
      onPrompt: async () => `http://localhost:51121/oauth-callback?code=code&state=${new URL(authUrl).searchParams.get("state")}`,
      onDeviceCode: () => undefined,
    })).rejects.not.toThrow("CANARY-project-token")
  })

  it("returns fixed denial and cancellation errors for manual callbacks without exchanging secrets", async () => {
    const exchange = vi.fn()
    const oauth = createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0, exchange, project: vi.fn() })
    for (const input of ["", "code-only", "http://localhost:51121/oauth-callback?error=access_denied&state=wrong", "http://localhost:51121/oauth-callback?code=CANARY&state=wrong"]) {
      await expect(oauth.login({
        onSelect: async () => "manual", onAuth: () => undefined, onPrompt: async () => input, onDeviceCode: () => undefined,
      })).rejects.toThrow(input === "" ? "cancelled" : "Paste the full callback URL")
    }
    let authUrl = ""
    await expect(oauth.login({
      onSelect: async () => "manual", onAuth: ({ url }) => { authUrl = url },
      onPrompt: async () => `http://localhost:51121/oauth-callback?error=access_denied&state=${new URL(authUrl).searchParams.get("state")}`,
      onDeviceCode: () => undefined,
    })).rejects.toThrow("authorization was denied")
    await expect(oauth.login({
      onSelect: async () => "manual", onAuth: () => undefined,
      onPrompt: async () => Promise.reject(new Error("CANARY-prompt")), onDeviceCode: () => undefined,
    })).rejects.toThrow("cancelled")
    expect(exchange).not.toHaveBeenCalled()
  })

  it("normalizes replayed lifecycle errors from callbacks and dependencies", async () => {
    const cancelledError = await createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0 }).login({ onSelect: async () => undefined, onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined }).catch((error: unknown) => error instanceof Error ? error : new Error())
    cancelledError.message = "CANARY-replay"
    await expect(createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0 }).login({ onSelect: () => { throw cancelledError }, onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined })).rejects.toThrow("Antigravity login failed.")
    for (const dependency of ["exchange", "project"] as const) {
      let authUrl = ""
      const oauth = createPiOAuthLifecycle({
        fetch: vi.fn(), now: () => 0,
        exchange: dependency === "exchange" ? vi.fn().mockRejectedValue(cancelledError) : vi.fn().mockResolvedValue(credentials),
        project: dependency === "project" ? vi.fn().mockRejectedValue(cancelledError) : vi.fn().mockResolvedValue("project"),
      })
      await expect(oauth.login({
        onSelect: async () => "manual", onAuth: ({ url }) => { authUrl = url },
        onPrompt: async () => `http://localhost:51121/oauth-callback?code=code&state=${new URL(authUrl).searchParams.get("state")}`,
        onDeviceCode: () => undefined,
      })).rejects.toThrow("Antigravity login failed.")
    }
    await expect(createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0, refresh: vi.fn().mockRejectedValue(cancelledError) })
      .refreshToken(credentials, new AbortController().signal)).rejects.toThrow("Antigravity credential refresh failed.")
  })

  it("normalizes forged loopback setup, ready, and result errors", async () => {
    const error = await createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0 }).login({ onSelect: async () => undefined, onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined }).catch((value: unknown) => value)
    for (const boundary of ["setup", "ready", "result"] as const) {
      const oauth = createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0, openLoopback: () => {
        if (boundary === "setup") throw error
        return { ready: boundary === "ready" ? Promise.reject(error) : Promise.resolve(), result: boundary === "result" ? Promise.reject(error) : Promise.resolve({ kind: "cancelled" as const }), cancel: vi.fn() }
      } })
      await expect(oauth.login({ onSelect: async () => "browser", onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined })).rejects.toThrow("Antigravity login failed.")
    }
  })

  it("uses installed Pi callbacks to cancel an active browser prompt/listener without browser or account access", async () => {
    const controller = new AbortController()
    const waiting = deferred<{ kind: "callback"; code: string }>()
    const active = { ready: Promise.resolve(), result: waiting.promise, cancel: vi.fn() }
    const exchange = vi.fn()
    const callbacks: OAuthLoginCallbacks = {
      signal: controller.signal,
      onSelect: async () => "browser",
      onAuth: () => undefined,
      onPrompt: async () => new Promise<string>(() => {}),
      onDeviceCode: () => undefined,
    }
    const oauth = createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0, exchange, project: vi.fn(), openLoopback: vi.fn(() => active) })
    const login = oauth.login(callbacks)
    await Promise.resolve()
    controller.abort()

    await expect(login).rejects.toThrow("Antigravity login was cancelled.")
    expect(active.cancel).toHaveBeenCalledOnce()
    expect(exchange).not.toHaveBeenCalled()
  })

  it("cancels before selection and during prompt, token, or project work", async () => {
    const before = new AbortController()
    before.abort()
    const select = vi.fn()
    const oauth = createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0, project: vi.fn() })
    await expect(oauth.login({ signal: before.signal, onSelect: select, onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined })).rejects.toThrow("cancelled")
    expect(select).not.toHaveBeenCalled()

    for (const phase of ["prompt", "exchange", "project"] as const) {
      const controller = new AbortController()
      const exchange = vi.fn(() => phase === "exchange" ? new Promise<typeof credentials>(() => {}) : Promise.resolve(credentials))
      const project = vi.fn(() => phase === "project" ? new Promise<string>(() => {}) : Promise.resolve("project"))
      let authUrl = ""
      const pending = createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0, exchange, project }).login({
        signal: controller.signal,
        onSelect: async () => "manual",
        onAuth: ({ url }) => { authUrl = url },
        onPrompt: async () => phase === "prompt"
          ? new Promise<string>(() => {})
          : `http://localhost:51121/oauth-callback?code=code&state=${new URL(authUrl).searchParams.get("state")}`,
        onDeviceCode: () => undefined,
      })
      await Promise.resolve()
      controller.abort()
      await expect(pending).rejects.toThrow("cancelled")
      if (phase === "prompt") expect(exchange).not.toHaveBeenCalled()
      if (phase === "exchange") expect(project).not.toHaveBeenCalled()
    }
  })

  it("ignores late prompt or callback completions after cancellation", async () => {
    for (const method of ["manual", "browser"] as const) {
      const controller = new AbortController()
      const prompt = deferred<string>()
      const callback = deferred<LoopbackOutcome>()
      const exchange = vi.fn().mockResolvedValue(credentials)
      const oauth = createPiOAuthLifecycle({
        fetch: vi.fn(), now: () => 0, exchange, project: vi.fn().mockResolvedValue("project"),
        openLoopback: vi.fn(() => ({ ready: Promise.resolve(), result: callback.promise, cancel: vi.fn() })),
      })
      const login = oauth.login({ signal: controller.signal, onSelect: async () => method, onAuth: () => undefined, onPrompt: () => prompt.promise, onDeviceCode: () => undefined })
      await Promise.resolve()
      controller.abort()
      await expect(login).rejects.toThrow("cancelled")
      if (method === "manual") prompt.resolve("http://localhost:51121/oauth-callback?code=late&state=state")
      else callback.resolve({ kind: "callback", code: "late" })
      await Promise.resolve()
      expect(exchange).not.toHaveBeenCalled()
    }
  })

  it("normalizes synchronous setup failures and releases the login slot", async () => {
    const randomBytes = vi.fn().mockImplementationOnce(() => { throw new Error("CANARY-setup") }).mockReturnValue(new Uint8Array(32))
    const callbacks = { onSelect: async () => undefined, onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined }
    const oauth = createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0, randomBytes, project: vi.fn() })
    await expect(oauth.login(callbacks)).rejects.toThrow("Antigravity login failed.")
    await expect(oauth.login(callbacks)).rejects.toThrow("cancelled")
  })

  it("absorbs a rejected loopback cleanup", async () => {
    const oauth = createPiOAuthLifecycle({
      fetch: vi.fn(), now: () => 0, project: vi.fn(),
      openLoopback: () => ({ ready: Promise.resolve(), result: Promise.resolve({ kind: "denied" }), cancel: () => Promise.reject(new Error("CANARY-cleanup")) }),
    })
    await expect(oauth.login({ onSelect: async () => "browser", onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined })).rejects.toThrow("authorization was denied")
  })

  it("rejects concurrent login and forwards refresh cancellation without leaking dependency errors", async () => {
    const selected = deferred<string | undefined>()
    const refresh = vi.fn()
      .mockResolvedValueOnce({ refresh: "refresh", access: "new-access", expires: 99 })
      .mockRejectedValueOnce(new Error("CANARY-refresh"))
    const oauth = createPiOAuthLifecycle({ fetch: vi.fn(), now: () => 0, refresh, project: vi.fn() })
    const first = oauth.login({ onSelect: () => selected.promise, onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined })
    const busy = await oauth.login({ onSelect: async () => "manual", onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined }).catch((error: unknown) => error instanceof Error ? error : new Error())
    selected.resolve(undefined); busy.message = "CANARY-busy"
    await expect(first).rejects.toThrow("cancelled"); await expect(oauth.login({ onSelect: () => { throw busy }, onAuth: () => undefined, onPrompt: async () => "", onDeviceCode: () => undefined })).rejects.toThrow("Antigravity login failed.")

    await expect(oauth.refreshToken(credentials, new AbortController().signal)).resolves.toEqual({ refresh: "refresh", access: "new-access", expires: 99 })
    expect(oauth.getApiKey({ refresh: "refresh", access: "new-access", expires: 99 })).toBe("new-access")
    await expect(oauth.refreshToken(credentials, new AbortController().signal)).rejects.not.toThrow("CANARY-refresh")
    const signal = new AbortController()
    signal.abort()
    await expect(oauth.refreshToken(credentials, signal.signal)).rejects.toThrow("cancelled")
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
