import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@openauthjs/openauth/pkce", () => ({
  generatePKCE: vi.fn(async () => ({
    challenge: "characterized-challenge",
    verifier: "characterized-verifier",
  })),
}));

import { authorizeAntigravity, exchangeAntigravity } from "./oauth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("authorizeAntigravity", () => {
  it("preserves the legacy authorization URL and encoded state", async () => {
    const authorization = await authorizeAntigravity("project-123");
    const url = new URL(authorization.url);

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
      response_type: "code",
      redirect_uri: "http://localhost:51121/oauth-callback",
      scope: "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/cclog https://www.googleapis.com/auth/experimentsandconfigs",
      code_challenge: "characterized-challenge",
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
    });
    expect(JSON.parse(Buffer.from(url.searchParams.get("state")!, "base64url").toString("utf8"))).toEqual({
      verifier: "characterized-verifier",
      projectId: "project-123",
    });
    expect(authorization).toMatchObject({ verifier: "characterized-verifier", projectId: "project-123" });
  });
});

describe("exchangeAntigravity", () => {
  it("preserves the legacy code-exchange form and token endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3_600,
        refresh_token: "refresh-token",
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ email: "user@example.com" })));
    vi.stubGlobal("fetch", fetchMock);

    const state = Buffer.from(JSON.stringify({ verifier: "pkce-verifier", projectId: "project-123" })).toString("base64url");
    const result = await exchangeAntigravity("authorization-code", state);
    const request = fetchMock.mock.calls[0]![1] as RequestInit;

    expect(fetchMock.mock.calls[0]![0]).toBe("https://oauth2.googleapis.com/token");
    expect(request.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    });
    expect(request.body?.toString()).toBe(
      "client_id=1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com&client_secret=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&code=authorization-code&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A51121%2Foauth-callback&code_verifier=pkce-verifier",
    );
    expect(result).toMatchObject({
      type: "success",
      refresh: "refresh-token|project-123",
      access: "access-token",
    });
  });
});
