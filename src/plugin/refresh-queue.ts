import {
  DEFAULT_PROACTIVE_REFRESH_CONFIG,
  ProactiveRefreshQueue as CoreProactiveRefreshQueue,
  type ProactiveRefreshConfig,
} from "@benjamolina/antigravity-guard-core";
import type { AccountManager, ManagedAccount } from "./accounts";
import { createLogger } from "./logger";
import { refreshAccessToken } from "./token";
import type { OAuthAuthDetails, PluginClient } from "./types";

const log = createLogger("refresh-queue");

export { DEFAULT_PROACTIVE_REFRESH_CONFIG };
export type { ProactiveRefreshConfig };

export class ProactiveRefreshQueue extends CoreProactiveRefreshQueue<AccountManager> {
  constructor(
    client: PluginClient,
    providerId: string,
    config?: Partial<ProactiveRefreshConfig>,
  ) {
    super({
      config,
      logger: log,
      refreshToken: async (auth: OAuthAuthDetails, account: ManagedAccount) => {
        const minutesUntilExpiry = account.expires
          ? Math.round((account.expires - Date.now()) / 60000)
          : "unknown";
        log.debug("Proactively refreshing token", {
          accountIndex: account.index,
          email: account.email ?? "unknown",
          minutesUntilExpiry,
        });
        return refreshAccessToken(auth, client, providerId);
      },
    });
  }

  override setAccountManager(manager: AccountManager): void {
    super.setAccountManager(manager);
  }
}

export function createProactiveRefreshQueue(
  client: PluginClient,
  providerId: string,
  config?: Partial<ProactiveRefreshConfig>,
): ProactiveRefreshQueue {
  return new ProactiveRefreshQueue(client, providerId, config);
}
