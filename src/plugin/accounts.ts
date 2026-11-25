import {
  AccountManager as CoreAccountManager,
  calculateBackoffMs,
  computeSoftQuotaCacheTtlMs,
  needsActiveQuotaRefresh,
  parseRateLimitReason,
  resolveQuotaGroup,
  type AccountManagerDependencies,
  type BaseQuotaKey,
  type ManagedAccount,
  type QuotaKey,
  type RateLimitBackoffResult,
  type RateLimitReason,
} from "@benjamolina/antigravity-guard-core";
import type { AccountSelectionStrategy } from "./config/schema";
import { debugLogToFile } from "./debug";
import { generateFingerprint, updateFingerprintVersion } from "./fingerprint";
import {
  loadAccounts,
  saveAccounts,
  saveAccountsReplace,
  type AccountStorageV4,
  type CooldownReason,
  type HeaderStyle,
  type ModelFamily,
} from "./storage";
import type { OAuthAuthDetails } from "./types";

export type { ModelFamily, HeaderStyle, CooldownReason } from "./storage";
export type { AccountSelectionStrategy } from "./config/schema";
export {
  calculateBackoffMs,
  computeSoftQuotaCacheTtlMs,
  needsActiveQuotaRefresh,
  parseRateLimitReason,
  resolveQuotaGroup,
};
export type {
  BaseQuotaKey,
  ManagedAccount,
  QuotaKey,
  RateLimitBackoffResult,
  RateLimitReason,
};

function createOpenCodeAccountManagerDeps(
  overrides: AccountManagerDependencies = {},
): AccountManagerDependencies {
  return {
    loadAccounts: () => loadAccounts(),
    saveAccounts: (state) => saveAccounts(state),
    saveAccountsReplace: (state) => saveAccountsReplace(state),
    generateFingerprint: () => generateFingerprint(),
    updateFingerprintVersion: (fingerprint) =>
      updateFingerprintVersion(fingerprint),
    onDebugLog: (message) => debugLogToFile(message),
    ...overrides,
  };
}

export class AccountManager extends CoreAccountManager {
  static override async loadFromDisk(
    authFallback?: OAuthAuthDetails,
    deps?: AccountManagerDependencies,
  ): Promise<AccountManager> {
    const bound = createOpenCodeAccountManagerDeps(deps);
    const stored = bound.loadAccounts ? await bound.loadAccounts() : null;
    return new AccountManager(authFallback, stored, bound);
  }

  constructor(
    authFallback?: OAuthAuthDetails,
    stored?: AccountStorageV4 | null,
    deps?: AccountManagerDependencies,
  ) {
    super(authFallback, stored, createOpenCodeAccountManagerDeps(deps));
  }
}
