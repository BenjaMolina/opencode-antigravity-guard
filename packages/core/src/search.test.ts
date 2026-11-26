import { describe, expect, it, vi } from "vitest"

import {
  DEFAULT_SHARED_GUARD_CONFIG,
  SEARCH_MODEL,
  SEARCH_SYSTEM_INSTRUCTION,
  SEARCH_TIMEOUT_MS,
  executeAntigravitySearch,
  formatAntigravitySearchResult,
  formatGroundingFooter,
  loadSharedGuardConfig,
  parseAntigravitySearchResponse,
  parseCandidateGrounding,
} from "./index.ts"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("Phase 5 core search grounding and model_discovery config", () => {
  it("defaults model_discovery.enabled to false in SharedGuardConfig while loading partial overrides", () => {
    expect(DEFAULT_SHARED_GUARD_CONFIG.model_discovery).toEqual({
      enabled: false,
      gemini_api: true,
      antigravity: true,
    })

    const dir = mkdtempSync(join(tmpdir(), "core-phase5-cfg-"))
    try {
      writeFileSync(
        join(dir, "antigravity.json"),
        JSON.stringify({ model_discovery: { enabled: true, antigravity: false } }),
        "utf8",
      )
      const loaded = loadSharedGuardConfig({
        env: { OPENCODE_CONFIG_DIR: dir },
        homeDir: dir,
      })
      expect(loaded.model_discovery).toEqual({
        enabled: true,
        gemini_api: true,
        antigravity: false,
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("executes Antigravity grounding search with googleSearch/urlContext and formats citations", async () => {
    expect(SEARCH_MODEL).toBe("gemini-2.5-flash")
    expect(SEARCH_TIMEOUT_MS).toBe(60_000)
    expect(SEARCH_SYSTEM_INSTRUCTION).toContain("google_search")

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        response: {
          candidates: [
            {
              content: { parts: [{ text: "Node 22 LTS is active." }] },
              finishReason: "STOP",
              groundingMetadata: {
                webSearchQueries: ["node 22 lts status"],
                groundingChunks: [{ web: { title: "Node.js Releases", uri: "https://nodejs.org/en/about/previous-releases" } }],
              },
              urlContextMetadata: {
                url_metadata: [
                  { retrieved_url: "https://nodejs.org", url_retrieval_status: "URL_RETRIEVAL_STATUS_SUCCESS" },
                ],
              },
            },
          ],
        },
      }),
      text: async () => "",
    })

    const formatted = await executeAntigravitySearch(
      { query: "Node 22 status", urls: ["https://nodejs.org"], thinking: true },
      "tok-123",
      "proj-abc",
      { fetch: fetchMock as unknown as typeof globalThis.fetch, userAgent: "antigravity/hub/2.34.0 darwin/arm64" },
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/v1internal:generateContent")
    const body = JSON.parse(String(init.body))
    expect(body.project).toBe("proj-abc")
    expect(body.model).toBe("gemini-2.5-flash")
    expect(body.request.tools).toEqual([{ googleSearch: {} }, { urlContext: {} }])

    expect(formatted).toContain("## Search Results")
    expect(formatted).toContain("Node 22 LTS is active.")
    expect(formatted).toContain("- [Node.js Releases](https://nodejs.org/en/about/previous-releases)")
    expect(formatted).toContain("- ✓ https://nodejs.org")
    expect(formatted).toContain('- "node 22 lts status"')

    const parsed = parseAntigravitySearchResponse({
      response: {
        candidates: [
          {
            groundingMetadata: {
              webSearchQueries: ["q1"],
              groundingChunks: [
                { web: { title: "Site A", uri: "https://a.example" } },
                { web: { title: "Site A Dup", uri: "https://a.example" } },
              ],
            },
          },
        ],
      },
    })
    expect(formatAntigravitySearchResult(parsed)).toContain("### Sources")

    const candidateGrounding = parseCandidateGrounding({
      groundingMetadata: {
        webSearchQueries: ["q1"],
        groundingChunks: [
          { web: { title: "Site A", uri: "https://a.example" } },
          { web: { title: "Site A Dup", uri: "https://a.example" } },
        ],
      },
      urlContextMetadata: {
        url_metadata: [{ retrieved_url: "https://a.example", url_retrieval_status: "URL_RETRIEVAL_STATUS_SUCCESS" }],
      },
    })
    const footer = formatGroundingFooter(candidateGrounding)
    expect(footer).toContain("### Sources")
    expect(footer).toContain("- [Site A](https://a.example)")
    expect(footer).not.toContain("Site A Dup")
    expect(footer).toContain('- "q1"')
  })

  it("fails over across endpoints on retryable 503/429 responses and stops immediately on non-retryable 400", async () => {
    const failoverFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "daily overloaded",
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          response: {
            candidates: [{ content: { parts: [{ text: "Recovered on autopush." }] } }],
          },
        }),
        text: async () => "",
      })

    const recovered = await executeAntigravitySearch(
      { query: "failover test" },
      "tok-1",
      "proj-1",
      {
        endpoints: ["https://daily.example", "https://autopush.example", "https://prod.example"],
        fetch: failoverFetch as unknown as typeof globalThis.fetch,
      },
    )
    expect(failoverFetch).toHaveBeenCalledTimes(2)
    expect(failoverFetch.mock.calls[0]?.[0]).toBe("https://daily.example/v1internal:generateContent")
    expect(failoverFetch.mock.calls[1]?.[0]).toBe("https://autopush.example/v1internal:generateContent")
    expect(recovered).toContain("Recovered on autopush.")

    const badRequestFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => "invalid payload",
    })

    const bad = await executeAntigravitySearch(
      { query: "bad request" },
      "tok-1",
      "proj-1",
      {
        endpoints: ["https://daily.example", "https://autopush.example"],
        fetch: badRequestFetch as unknown as typeof globalThis.fetch,
      },
    )
    expect(badRequestFetch).toHaveBeenCalledTimes(1)
    expect(bad).toContain("## Search Error")
    expect(bad).toContain("400 Bad Request")
  })
})
