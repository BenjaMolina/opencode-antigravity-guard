import { describe, expect, it, vi } from "vitest";

import {
  getAgySdkCredentials,
  fetchGeminiApiModels,
  isAgySdkSupportedRequest,
  prepareAgySdkGeminiRequest,
  selectAgySdkCredential,
  markAgySdkCredentialRateLimited,
} from "./api-key";
import { DEFAULT_CONFIG, type AntigravityConfig } from "./config";

function withConfig(overrides: Partial<AntigravityConfig>): AntigravityConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    agy_sdk: {
      ...DEFAULT_CONFIG.agy_sdk,
      ...overrides.agy_sdk,
    },
  };
}

describe("api-key agy sdk support", () => {
  it("loads API key credentials from auth, config cloud projects, and environment", () => {
    vi.stubEnv("GEMINI_API_KEY", "env-key");
    try {
      const credentials = getAgySdkCredentials(
        withConfig({
          agy_sdk: {
            ...DEFAULT_CONFIG.agy_sdk,
            cloud_projects: [
              { label: "backup", api_key: "config-key", project_id: "cloud-project", enabled: true },
            ],
          },
        }),
        { type: "api", key: "auth-key" },
      );

      expect(credentials).toEqual([
        { label: "opencode api key", apiKey: "auth-key" },
        { label: "backup", apiKey: "config-key", projectId: "cloud-project" },
        { label: "environment", apiKey: "env-key" },
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("prepares public Gemini API requests with API key headers and no URL secret", () => {
    const prepared = prepareAgySdkGeminiRequest(
      "https://generativelanguage.googleapis.com/v1beta/models/antigravity-gemini-3-pro-high:streamGenerateContent?alt=sse&key=old-url-key",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer oauth",
          "x-api-key": "old",
        },
        body: JSON.stringify({
          model: "ignored",
          contents: [],
          generationConfig: { temperature: 0.4 },
          providerOptions: {
            google: {
              thinkingLevel: "high",
              includeThoughts: false,
              googleSearch: { mode: "auto" },
            },
          },
        }),
      },
      { label: "backup", apiKey: "test-key", projectId: "cloud-project" },
    );

    expect(String(prepared.request)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:streamGenerateContent?alt=sse",
    );
    const headers = new Headers(prepared.init.headers);
    expect(headers.get("Authorization")).toBeNull();
    expect(headers.get("x-api-key")).toBeNull();
    expect(headers.get("x-goog-api-key")).toBe("test-key");
    expect(headers.get("x-goog-user-project")).toBeNull();
    expect(JSON.parse(String(prepared.init.body))).toEqual({
      contents: [],
      generationConfig: {
        temperature: 0.4,
        thinkingConfig: {
          thinkingLevel: "high",
          includeThoughts: false,
        },
      },
      tools: [{ googleSearch: {} }],
    });
  });

  it("adds default Gemini 3 thinking config without dropping extra body options", () => {
    const prepared = prepareAgySdkGeminiRequest(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
      {
        method: "POST",
        body: JSON.stringify({
          contents: [],
          generationConfig: {
            temperature: 0.2,
          },
          extra_body: {
            cachedContent: "cachedContents/example",
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
          },
        }),
      },
      { label: "env", apiKey: "test-key" },
    );

    expect(JSON.parse(String(prepared.init.body))).toEqual({
      contents: [],
      cachedContent: "cachedContents/example",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        thinkingConfig: {
          thinkingLevel: "low",
          includeThoughts: true,
        },
      },
    });
  });

  it("keeps Gemini 3 tier suffix as thinking level while stripping it from the public API model", () => {
    const prepared = prepareAgySdkGeminiRequest(
      "https://generativelanguage.googleapis.com/v1beta/models/antigravity-gemini-3-pro-high:generateContent",
      {
        method: "POST",
        body: JSON.stringify({ contents: [] }),
      },
      { label: "env", apiKey: "test-key" },
    );

    expect(String(prepared.request)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent",
    );
    expect(JSON.parse(String(prepared.init.body))).toEqual({
      contents: [],
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: "high",
          includeThoughts: true,
        },
      },
    });
  });

  it("preserves API-native preview model names for Gemini API requests", () => {
    const prepared = prepareAgySdkGeminiRequest(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent",
      {
        method: "POST",
        body: JSON.stringify({ contents: [] }),
      },
      { label: "env", apiKey: "test-key" },
    );

    expect(String(prepared.request)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent",
    );
  });

  it("skips Claude requests and rate-limited keys", () => {
    expect(isAgySdkSupportedRequest("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent")).toBe(true);
    expect(isAgySdkSupportedRequest("https://generativelanguage.googleapis.com/v1beta/models/claude-opus-4-6-thinking:generateContent")).toBe(false);
    expect(isAgySdkSupportedRequest("https://generativelanguage.googleapis.com/v1beta/models")).toBe(false);

    const first = { label: "first", apiKey: "first" };
    const second = { label: "second", apiKey: "second" };
    markAgySdkCredentialRateLimited(first, 60_000);
    expect(selectAgySdkCredential([first, second])).toEqual(second);
  });

  it("fetches Gemini API models with API-key header and pagination", async () => {
    const requests: RequestInfo[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo, _init?: RequestInit) => {
      requests.push(input);
      const url = new URL(String(input));
      if (!url.searchParams.get("pageToken")) {
        return new Response(JSON.stringify({
          models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }],
          nextPageToken: "next",
        }));
      }
      return new Response(JSON.stringify({
        models: [{ name: "models/gemini-2.5-pro", supportedGenerationMethods: ["streamGenerateContent"] }],
      }));
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const models = await fetchGeminiApiModels({ label: "test", apiKey: "secret" });

      expect(models.map((model) => model.name)).toEqual([
        "models/gemini-2.5-flash",
        "models/gemini-2.5-pro",
      ]);
      expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
        headers: { "x-goog-api-key": "secret" },
      });
      expect(String(requests[0])).toContain("pageSize=1000");
      expect(String(requests[1])).toContain("pageToken=next");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
