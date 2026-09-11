export interface OAuthClientConfig {
  clientId: string
  clientSecret: string
  scopes: readonly string[]
  redirectUri: string
  authorizeEndpoint: string
  tokenEndpoint: string
}

export interface AuthorizationCodeExchange {
  code: string
  verifier: string
}

export function buildAuthorizationUrl(
  config: OAuthClientConfig,
  options: { challenge: string; state: string },
): string {
  const url = new URL(config.authorizeEndpoint)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("scope", config.scopes.join(" "))
  url.searchParams.set("code_challenge", options.challenge)
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("state", options.state)
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  return url.toString()
}

export function buildCodeExchangeForm(
  config: OAuthClientConfig,
  exchange: AuthorizationCodeExchange,
): URLSearchParams {
  return new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: exchange.code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code_verifier: exchange.verifier,
  })
}

export function buildRefreshForm(config: OAuthClientConfig, refreshToken: string): URLSearchParams {
  return new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })
}
