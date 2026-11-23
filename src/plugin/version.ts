/**
 * Remote Antigravity Hub version fetcher.
 *
 * Queries the Antigravity Hub electron-builder YAML manifest (`latest-arm64-mac.yml`)
 * with a `>= 2.9.1` floor check, falling back to `ANTIGRAVITY_VERSION_FALLBACK` ("2.34.0").
 */

import {
  ANTIGRAVITY_HUB_MANIFEST_URL,
  ANTIGRAVITY_VERSION_FALLBACK,
  parseAntigravityHubManifestVersion,
} from "@benjamolina/antigravity-guard-core";
import { getAntigravityVersion, setAntigravityVersion } from "../constants";
import { createLogger } from "./logger";

const FETCH_TIMEOUT_MS = 5000;

async function tryFetchHubVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(ANTIGRAVITY_HUB_MANIFEST_URL, {
      method: "GET",
      headers: {
        "User-Agent": "electron-builder",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const manifestYaml = await response.text();
    return parseAntigravityHubManifestVersion(manifestYaml);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch the latest Antigravity Hub version and update the runtime version state.
 * Safe to call before logger is initialized (will silently skip logging).
 */
export async function initAntigravityVersion(): Promise<void> {
  const log = createLogger("version");
  const current = getAntigravityVersion();
  const version = await tryFetchHubVersion();

  if (!version) {
    const fallback = current || ANTIGRAVITY_VERSION_FALLBACK;
    setAntigravityVersion(fallback);
    log.info("version-fetch-failed", { fallback });
    return;
  }

  if (version !== current) {
    log.info("version-updated", { version, source: "hub-manifest", previous: current });
  } else {
    log.debug("version-unchanged", { version, source: "hub-manifest" });
  }
  setAntigravityVersion(version);
}
