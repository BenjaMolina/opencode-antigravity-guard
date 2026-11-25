import {
  DEFAULT_POOL_QUOTA_REFRESH_COOLDOWN_MS,
  DEFAULT_QUOTA_FETCH_TIMEOUT_MS,
  aggregateQuota,
  checkAccountsQuotaWithDeps,
  classifyQuotaGroup,
  createPoolQuotaRefreshCoordinator,
  fetchAvailableModels as coreFetchAvailableModels,
  type AccountQuotaResult,
  type AccountQuotaStatus,
  type FetchAvailableModelEntry,
  type FetchAvailableModelsResponse,
  type GeminiCliQuotaModel,
  type GeminiCliQuotaSummary,
  type QuotaGroup,
  type QuotaGroupSummary,
  type QuotaSummary,
} from "@benjamolina/antigravity-guard-core";
import {
  ANTIGRAVITY_ENDPOINT_PROD,
  ANTIGRAVITY_PROVIDER_ID,
  getAntigravityHeaders,
} from "../constants";
import type { AccountManager, ManagedAccount } from "./accounts";
import { logQuotaFetch, logQuotaStatus } from "./debug";
import { ensureProjectContext } from "./project";
import type { AccountMetadataV3 } from "./storage";
import { refreshAccessToken } from "./token";
import type { PluginClient } from "./types";

export type {
  AccountQuotaResult,
  AccountQuotaStatus,
  FetchAvailableModelEntry,
  FetchAvailableModelsResponse,
  GeminiCliQuotaModel,
  GeminiCliQuotaSummary,
  QuotaGroup,
  QuotaGroupSummary,
  QuotaSummary,
};

const poolQuotaRefreshCoordinator = createPoolQuotaRefreshCoordinator({
  cooldownMs: DEFAULT_POOL_QUOTA_REFRESH_COOLDOWN_MS,
});

export async function fetchAvailableModels(
  accessToken: string,
  projectId: string,
): Promise<FetchAvailableModelsResponse> {
  const quotaUserAgent =
    getAntigravityHeaders()["User-Agent"] || "antigravity/windows/amd64";
  return coreFetchAvailableModels(accessToken, projectId, {
    endpoint: ANTIGRAVITY_ENDPOINT_PROD,
    userAgent: quotaUserAgent,
    timeoutMs: DEFAULT_QUOTA_FETCH_TIMEOUT_MS,
  });
}

export async function checkAccountsQuota(
  accounts: AccountMetadataV3[],
  client: PluginClient,
  providerId = ANTIGRAVITY_PROVIDER_ID,
): Promise<AccountQuotaResult[]> {
  return checkAccountsQuotaWithDeps(accounts, {
    endpoint: ANTIGRAVITY_ENDPOINT_PROD,
    timeoutMs: DEFAULT_QUOTA_FETCH_TIMEOUT_MS,
    getUserAgent: () =>
      getAntigravityHeaders()["User-Agent"] || "antigravity/windows/amd64",
    refreshAuth: (auth) => refreshAccessToken(auth, client, providerId),
    resolveProjectContext: (auth) => ensureProjectContext(auth),
    onQuotaFetchLog: (stage, count, detail) => logQuotaFetch(stage, count, detail),
    onQuotaStatusLog: (email, index, remainingPercent, family) =>
      logQuotaStatus(email, index, remainingPercent, family),
  });
}

/**
 * Proactively refreshes quotas for all accounts in the background.
 * Updates the account manager with new quota data.
 */
export async function triggerAsyncQuotaRefreshForAll(
  accountManager: AccountManager,
  client: PluginClient,
  providerId: string,
): Promise<void> {
  await poolQuotaRefreshCoordinator.triggerForAll(
    accountManager,
    (accountsMetadata) => checkAccountsQuota(accountsMetadata, client, providerId),
    (error) => {
      console.error("[ProactiveQuota] Failed to refresh all quotas", error);
    },
  );
}

/**
 * Actively refreshes quota for a single candidate account before request dispatch.
 * Updates the accountManager's cached quota on success.
 */
export async function refreshSingleAccountQuota(
  account: ManagedAccount,
  accountManager: AccountManager,
  client: PluginClient,
  providerId: string,
): Promise<boolean> {
  return poolQuotaRefreshCoordinator.refreshSingle(
    account,
    accountManager,
    (accountsMetadata) => checkAccountsQuota(accountsMetadata, client, providerId),
    (error) => {
      console.warn("[ActiveQuota] Single account active refresh failed", error);
    },
  );
}

export const __testExports = {
  aggregateQuota,
  classifyQuotaGroup,
};
