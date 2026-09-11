import { beforeEach, describe, expect, it, vi } from "vitest";

import { ANTIGRAVITY_PROVIDER_ID } from "../constants";
import { AntigravityTokenRefreshError, refreshAccessToken } from "./token";
import type { OAuthAuthDetails, PluginClient } from "./types";

const baseAuth: OAuthAuthDetails = {
  type: "oauth",
  refresh: "refresh-token|project-123",
  access: "old-access",
  expires: Date.now() - 1000,
};

function createClient() {
  return {
    auth: {
      set: vi.fn(async () => {}),
    },
  } as PluginClient & {
    auth: { set: ReturnType<typeof vi.fn> };
  };
}

describe("refreshAccessToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updates the caller when refresh token is unchanged", async () => {
    const client = createClient();
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => {
      return new Response(
        JSON.stringify({
          access_token: "new-access",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await refreshAccessToken(baseAuth, client, ANTIGRAVITY_PROVIDER_ID);

    expect(result?.access).toBe("new-access");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    expect((fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams).toString()).toBe(
      "grant_type=refresh_token&refresh_token=refresh-token&client_id=1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com&client_secret=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",
    );
    expect(client.auth.set.mock.calls.length).toBe(0);
  });

  it("handles Google refresh token rotation", async () => {
    const client = createClient();
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => {
      return new Response(
        JSON.stringify({
          access_token: "next-access",
          expires_in: 3600,
          refresh_token: "rotated-token",
        }),
        { status: 200 },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await refreshAccessToken(baseAuth, client, ANTIGRAVITY_PROVIDER_ID);

    expect(result?.access).toBe("next-access");
    expect(result?.refresh).toContain("rotated-token");
    expect(client.auth.set.mock.calls.length).toBe(0);
  });

  it("throws a typed error on invalid_grant", async () => {
    const client = createClient();
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) => {
      return new Response(
        JSON.stringify({
          error: "invalid_grant",
          error_description: "Refresh token revoked",
        }),
        { status: 400, statusText: "Bad Request" },
      );
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(refreshAccessToken(baseAuth, client, ANTIGRAVITY_PROVIDER_ID)).rejects.toMatchObject({
      name: "AntigravityTokenRefreshError",
      code: "invalid_grant",
    });
  });
});
