import { ANTIGRAVITY_OAUTH_CLIENT, buildCodeExchangeForm, buildRefreshForm } from "@benjamolina/antigravity-guard-core"
import { describe, expect, it, vi } from "vitest"

import { exchangeAuthorizationCode, refreshCredentials } from "./auth-http.ts"

describe("Pi OAuth token HTTP", () => {
  it("exchanges an authorization code with the fixed token endpoint and Pi credential mapping", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )

    await expect(
      exchangeAuthorizationCode({
        code: "authorization-code",
        verifier: "pkce-verifier",
        fetch,
        now: () => 1_000,
      }),
    ).resolves.toEqual({ refresh: "refresh-token", access: "access-token", expires: 3_601_000 })

    expect(fetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: buildCodeExchangeForm(ANTIGRAVITY_OAUTH_CLIENT, { code: "authorization-code", verifier: "pkce-verifier" }).toString(),
      }),
    )
  })

  it("refreshes with the exact core form, preserving or accepting rotation", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "fresh", expires_in: 60 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "rotated", refresh_token: "next", expires_in: 120 })))
    const credentials = { refresh: "prior", access: "old", expires: 1 }

    await expect(refreshCredentials({ credentials, fetch, now: () => 10 })).resolves.toEqual({ refresh: "prior", access: "fresh", expires: 60_010 })
    await expect(refreshCredentials({ credentials, fetch, now: () => 10 })).resolves.toEqual({ refresh: "next", access: "rotated", expires: 120_010 })
    expect(fetch).toHaveBeenCalledWith("https://oauth2.googleapis.com/token", expect.objectContaining({
      body: buildRefreshForm(ANTIGRAVITY_OAUTH_CLIENT, "prior").toString(),
      redirect: "error",
    }))
  })

  it.each([
    [{ access_token: "", refresh_token: "refresh", expires_in: 1 }],
    [{ access_token: " ", refresh_token: "refresh", expires_in: 1 }],
    [{ access_token: "access", refresh_token: "", expires_in: 1 }],
    [{ access_token: "access", refresh_token: " ", expires_in: 1 }],
    [{ access_token: "access", refresh_token: "refresh", expires_in: Number.NaN }],
    [{ access_token: "access", refresh_token: "refresh", expires_in: 0 }],
  ])("rejects invalid token payloads", async (payload) => {
    await expect(exchangeAuthorizationCode({
      code: "code", verifier: "verifier", now: () => 0,
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify(payload))),
    })).rejects.toMatchObject({ kind: "response", message: "Authentication service returned invalid credentials." })
  })

  it("redacts malformed, redirect, and invalid-grant responses", async () => {
    const canary = "CANARY-secret-code-token"
    const failures = [
      new Response("not-json"),
      new Response(JSON.stringify({ error: "invalid_grant", message: canary }), { status: 400 }),
      new Response(canary, { status: 302, headers: { Location: "https://example.test" } }),
    ]
    for (const response of failures) {
      await expect(exchangeAuthorizationCode({ code: canary, verifier: canary, now: () => 0, fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(response) }))
        .rejects.not.toThrow(canary)
    }
    await expect(exchangeAuthorizationCode({
      code: "code", verifier: "verifier", now: () => 0,
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({ error: "invalid_grant", message: canary }), { status: 400 })),
    })).rejects.toMatchObject({ kind: "authentication", status: 400, message: "Authentication expired. Run /login antigravity-guard." })
    await expect(exchangeAuthorizationCode({
      code: "code", verifier: "verifier", now: () => 0,
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response("not-json", { status: 500 })),
    })).rejects.toMatchObject({ kind: "authentication", status: 500, message: "Authentication service is unavailable." })
  })

  it("bounds upstream bodies and classifies transport failures without leaking them", async () => {
    const canary = "CANARY-transport-secret"
    for (const fetch of [
      vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error(canary)),
      vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(`${canary}${"x".repeat(64 * 1024)}`, { status: 500 })),
    ]) {
      await expect(exchangeAuthorizationCode({ code: canary, verifier: canary, now: () => 0, fetch }))
        .rejects.not.toThrow(canary)
    }
    await expect(exchangeAuthorizationCode({ code: "code", verifier: "verifier", now: () => 0, fetch: vi.fn<typeof globalThis.fetch>().mockRejectedValue(new Error(canary)) }))
      .rejects.toMatchObject({ kind: "transport", message: "Authentication request failed." })
  })

  it("stops before fetch and during in-flight fetch or body reads", async () => {
    const before = new AbortController()
    before.abort()
    const fetch = vi.fn<typeof globalThis.fetch>()
    await expect(exchangeAuthorizationCode({ code: "code", verifier: "verifier", now: () => 0, fetch, signal: before.signal })).rejects.toMatchObject({ kind: "aborted" })
    expect(fetch).not.toHaveBeenCalled()

    const duringFetch = new AbortController()
    const fetchPending = exchangeAuthorizationCode({
      code: "code", verifier: "verifier", now: () => 0, signal: duringFetch.signal,
      fetch: vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Promise<Response>(() => {})),
    })
    duringFetch.abort()
    await expect(fetchPending).rejects.toMatchObject({ kind: "aborted", message: "Authentication request was cancelled." })

    const duringBody = new AbortController()
    const body = new ReadableStream<Uint8Array>({ start() {} })
    const pending = exchangeAuthorizationCode({ code: "code", verifier: "verifier", now: () => 0, signal: duringBody.signal, fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body)) })
    duringBody.abort()
    await expect(pending).rejects.toMatchObject({ kind: "aborted", message: "Authentication request was cancelled." })
  })

  it("settles an aborted body read even when cancellation never resolves", async () => {
    const controller = new AbortController()
    const cancel = vi.fn(() => new Promise<void>(() => {}))
    const body = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => {}),
      cancel,
    })
    const pending = exchangeAuthorizationCode({
      code: "code", verifier: "verifier", now: () => 0, signal: controller.signal,
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body)),
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.abort()

    const result = await Promise.race([
      pending.then(() => "resolved", (error: unknown) => error),
      new Promise<"timed out">((resolve) => setTimeout(() => resolve("timed out"), 50)),
    ])

    expect(result).toMatchObject({ kind: "aborted", message: "Authentication request was cancelled." })
    expect(cancel).toHaveBeenCalledOnce()
  })

  it.each(["", " ", 1, { token: "invalid" }])("rejects a present malformed refresh rotation: %j", async (refresh_token) => {
    await expect(refreshCredentials({
      credentials: { refresh: "prior", access: "old", expires: 1 },
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
        access_token: "access",
        refresh_token,
        expires_in: 60,
      }))),
      now: () => 0,
    })).rejects.toMatchObject({ kind: "response", message: "Authentication service returned invalid credentials." })
  })

  it("rejects an expiry calculation that overflows", async () => {
    await expect(exchangeAuthorizationCode({
      code: "code", verifier: "verifier", now: () => Number.MAX_VALUE,
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(JSON.stringify({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: Number.MAX_VALUE,
      }))),
    })).rejects.toMatchObject({ kind: "response", message: "Authentication service returned invalid credentials." })
  })

  it("classifies a body transport failure without an abort signal as transport", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("socket closed"))
      },
    })
    await expect(exchangeAuthorizationCode({
      code: "code", verifier: "verifier", now: () => 0,
      fetch: vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(body)),
    })).rejects.toMatchObject({ kind: "transport", message: "Authentication request failed." })
  })

  it("does not fetch after the remaining deadline has elapsed", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
    await expect(exchangeAuthorizationCode({
      code: "code", verifier: "verifier", fetch, now: () => 1_000, deadlineMs: 1_000,
    })).rejects.toMatchObject({ kind: "aborted", message: "Authentication request failed." })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("settles a pending fetch when a positive deadline expires", async () => {
    const pending = exchangeAuthorizationCode({
      code: "code",
      verifier: "verifier",
      now: () => 1_000,
      deadlineMs: 1_010,
      fetch: vi.fn<typeof globalThis.fetch>().mockImplementation(() => new Promise<Response>(() => {})),
    })

    const result = await Promise.race([
      pending.then(() => "resolved", (error: unknown) => error),
      new Promise<"timed out">((resolve) => setTimeout(() => resolve("timed out"), 100)),
    ])

    expect(result).toMatchObject({ kind: "aborted", message: "Authentication request was cancelled." })
  })

})
