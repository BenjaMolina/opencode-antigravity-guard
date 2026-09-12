import { describe, expect, it } from "vitest"

import {
  buildAuthorizationUrl,
  buildCodeExchangeForm,
  buildRefreshForm,
  type OAuthClientConfig,
} from "./oauth.ts"

const config: OAuthClientConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  scopes: ["scope-a", "scope-b"],
  redirectUri: "http://localhost:51121/oauth-callback",
  authorizeEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
}

describe("OAuth form builders", () => {
  it("builds the installed-app authorization URL with PKCE and offline consent", () => {
    expect(buildAuthorizationUrl(config, { challenge: "pkce-challenge", state: "opaque-state" })).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth?client_id=client-id&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A51121%2Foauth-callback&scope=scope-a+scope-b&code_challenge=pkce-challenge&code_challenge_method=S256&state=opaque-state&access_type=offline&prompt=consent",
    )
  })

  it("preserves opaque state and encodes a distinct PKCE challenge", () => {
    const url = new URL(
      buildAuthorizationUrl(config, { challenge: "second challenge", state: "state+/=&" }),
    )

    expect(url.searchParams.get("code_challenge")).toBe("second challenge")
    expect(url.searchParams.get("state")).toBe("state+/=&")
  })

  it("builds distinct code-exchange and refresh forms with the configured credentials", () => {
    expect(buildCodeExchangeForm(config, { code: "authorization-code", verifier: "pkce-verifier" }).toString()).toBe(
      "client_id=client-id&client_secret=client-secret&code=authorization-code&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost%3A51121%2Foauth-callback&code_verifier=pkce-verifier",
    )
    expect(buildRefreshForm(config, "refresh-token").toString()).toBe(
      "grant_type=refresh_token&refresh_token=refresh-token&client_id=client-id&client_secret=client-secret",
    )
  })
})
