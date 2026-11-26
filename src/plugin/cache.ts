import { createSessionSignatureCache } from "@benjamolina/antigravity-guard-core";
import { accessTokenExpired } from "./auth";
import { SignatureCache, createSignatureCache } from "./cache/signature-cache";
import type { SignatureCacheConfig } from "./config";
import type { OAuthAuthDetails } from "./types";

const authCache = new Map<string, OAuthAuthDetails>();

function normalizeRefreshKey(refresh?: string): string | undefined {
  const key = refresh?.trim();
  return key ? key : undefined;
}

export function resolveCachedAuth(auth: OAuthAuthDetails): OAuthAuthDetails {
  const key = normalizeRefreshKey(auth.refresh);
  if (!key) {
    return auth;
  }

  const cached = authCache.get(key);
  if (!cached) {
    authCache.set(key, auth);
    return auth;
  }

  if (!accessTokenExpired(auth)) {
    authCache.set(key, auth);
    return auth;
  }

  if (!accessTokenExpired(cached)) {
    return cached;
  }

  authCache.set(key, auth);
  return auth;
}

export function storeCachedAuth(auth: OAuthAuthDetails): void {
  const key = normalizeRefreshKey(auth.refresh);
  if (!key) {
    return;
  }
  authCache.set(key, auth);
}

export function clearCachedAuth(refresh?: string): void {
  if (!refresh) {
    authCache.clear();
    return;
  }
  const key = normalizeRefreshKey(refresh);
  if (key) {
    authCache.delete(key);
  }
}

// ============================================================================
// Thinking Signature Cache (Move-and-Reexport delegation to shared core)
// ============================================================================

const sessionSignatureCache = createSessionSignatureCache();

export function initDiskSignatureCache(config: SignatureCacheConfig | undefined): SignatureCache | null {
  if (typeof config?.memory_ttl_seconds === "number" && config.memory_ttl_seconds > 0) {
    sessionSignatureCache.setMemoryTtlMs(config.memory_ttl_seconds * 1_000);
  }
  sessionSignatureCache.setDiskCache(null, { shutdownPrevious: true });
  const diskCache = createSignatureCache(config);
  sessionSignatureCache.setDiskCache(diskCache);
  return diskCache;
}

export function getDiskSignatureCache(): SignatureCache | null {
  return sessionSignatureCache.getDiskCache();
}

export function cacheSignature(sessionId: string, text: string, signature: string): void {
  sessionSignatureCache.cacheSignature(sessionId, text, signature);
}

export function getCachedSignature(sessionId: string, text: string): string | undefined {
  return sessionSignatureCache.getCachedSignature(sessionId, text);
}

export function clearSignatureCache(sessionId?: string): void {
  sessionSignatureCache.clear(sessionId);
}

export { SignatureCache, createSignatureCache } from "./cache/signature-cache";
export type { SignatureCacheConfig } from "./config";
