import {
  accessTokenExpired as coreAccessTokenExpired,
  calculateTokenExpiry as calculateCoreTokenExpiry,
  formatRefreshParts as coreFormatRefreshParts,
  parseRefreshParts as coreParseRefreshParts,
} from "@benjamolina/antigravity-guard-core";

import type { AuthDetails, OAuthAuthDetails, RefreshParts } from "./types";

export function isOAuthAuth(auth: AuthDetails): auth is OAuthAuthDetails {
  return auth.type === "oauth";
}

export function parseRefreshParts(refresh: string): RefreshParts {
  return coreParseRefreshParts(refresh);
}

export function formatRefreshParts(parts: RefreshParts): string {
  return coreFormatRefreshParts(parts);
}

export function accessTokenExpired(auth: OAuthAuthDetails): boolean {
  return coreAccessTokenExpired(auth);
}

export const calculateTokenExpiry = calculateCoreTokenExpiry;
