/**
 * Remote Antigravity Hub version fetcher.
 *
 * Delegates manifest fetching and `>= 2.9.1` floor parsing to
 * `@benjamolina/antigravity-guard-core`, updating the OpenCode runtime version state.
 */

import {
  ANTIGRAVITY_VERSION_FALLBACK,
  fetchAntigravityHubVersion,
} from "@benjamolina/antigravity-guard-core";
import { getAntigravityVersion, setAntigravityVersion } from "../constants";
import { createLogger } from "./logger";

const FETCH_TIMEOUT_MS = 5000;

/**
 * Fetch the latest Antigravity Hub version and update the runtime version state.
 * Safe to call before logger is initialized (will silently skip logging).
 */
export async function initAntigravityVersion(): Promise<void> {
  const log = createLogger("version");
  const current = getAntigravityVersion();
  const version = await fetchAntigravityHubVersion({ timeoutMs: FETCH_TIMEOUT_MS });

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
