/**
 * Device Fingerprint Generator for Rate Limit Mitigation
 *
 * Re-export and runtime-version binding facade over `@benjamolina/antigravity-guard-core`.
 */

import {
  MAX_FINGERPRINT_HISTORY,
  buildFingerprintHeaders,
  collectCurrentFingerprint as coreCollectCurrentFingerprint,
  createSessionFingerprintStore,
  generateFingerprint as coreGenerateFingerprint,
  updateFingerprintVersion as coreUpdateFingerprintVersion,
  type ClientMetadata,
  type Fingerprint,
  type FingerprintHeaders,
  type FingerprintVersion,
} from "@benjamolina/antigravity-guard-core";
import { getAntigravityVersion } from "../constants";

export { MAX_FINGERPRINT_HISTORY, buildFingerprintHeaders };
export type {
  ClientMetadata,
  Fingerprint,
  FingerprintHeaders,
  FingerprintVersion,
};

const sessionFingerprintStore = createSessionFingerprintStore({
  getVersion: getAntigravityVersion,
});

/**
 * Generate a randomized device fingerprint using the current runtime Antigravity version.
 */
export function generateFingerprint(): Fingerprint {
  return coreGenerateFingerprint({ version: getAntigravityVersion() });
}

/**
 * Collect fingerprint based on actual current system using the current runtime Antigravity version.
 */
export function collectCurrentFingerprint(): Fingerprint {
  return coreCollectCurrentFingerprint({ version: getAntigravityVersion() });
}

/**
 * Update the version and Hub family in a fingerprint's userAgent to match the target version.
 */
export function updateFingerprintVersion(
  fingerprint: Fingerprint,
  version = getAntigravityVersion(),
): boolean {
  return coreUpdateFingerprintVersion(fingerprint, version);
}

/**
 * Get or create the session fingerprint.
 */
export function getSessionFingerprint(): Fingerprint {
  return sessionFingerprintStore.get();
}

/**
 * Regenerate the session fingerprint.
 */
export function regenerateSessionFingerprint(): Fingerprint {
  return sessionFingerprintStore.regenerate();
}
