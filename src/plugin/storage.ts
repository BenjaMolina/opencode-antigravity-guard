import {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as lockfileModule from "proper-lockfile";
import {
  GITIGNORE_ENTRIES,
  clearAccountsAtPath,
  deduplicateAccountsByEmail,
  ensureGitignore as coreEnsureGitignore,
  ensureGitignoreSync as coreEnsureGitignoreSync,
  loadAccountsFromPath,
  mergeAccountStorage,
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  saveAccountsReplaceToPath,
  saveAccountsToPath,
  type AccountMetadata,
  type AccountMetadataV1,
  type AccountMetadataV3,
  type AccountStorage,
  type AccountStorageIoOptions,
  type AccountStorageV1,
  type AccountStorageV3,
  type AccountStorageV4,
  type CooldownReason,
  type ModelFamily,
  type RateLimitState,
  type RateLimitStateV3,
} from "@benjamolina/antigravity-guard-core";
import type { HeaderStyle } from "../constants";
import { createLogger } from "./logger";

const lockfile = ((lockfileModule as { default?: unknown }).default ??
  lockfileModule) as typeof import("proper-lockfile");

const log = createLogger("storage");

const LOCK_OPTIONS = {
  stale: 10000,
  retries: {
    retries: 5,
    minTimeout: 100,
    maxTimeout: 1000,
    factor: 2,
  },
};

const storageIo: AccountStorageIoOptions = {
  lock: (path: string) => lockfile.lock(path, LOCK_OPTIONS),
  logger: log,
};

export {
  GITIGNORE_ENTRIES,
  deduplicateAccountsByEmail,
  mergeAccountStorage,
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
};

export type {
  AccountMetadata,
  AccountMetadataV1,
  AccountMetadataV3,
  AccountStorage,
  AccountStorageV1,
  AccountStorageV3,
  AccountStorageV4,
  CooldownReason,
  HeaderStyle,
  ModelFamily,
  RateLimitState,
  RateLimitStateV3,
};

export async function ensureGitignore(configDir: string): Promise<void> {
  await coreEnsureGitignore(configDir, log);
}

export function ensureGitignoreSync(configDir: string): void {
  coreEnsureGitignoreSync(configDir, log);
}

function getLegacyWindowsConfigDir(): string {
  return join(
    process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
    "opencode",
  );
}

export function getConfigDir(): string {
  if (process.env.OPENCODE_CONFIG_DIR) {
    return process.env.OPENCODE_CONFIG_DIR;
  }

  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfig, "opencode");
}

function migrateLegacyWindowsConfig(): boolean {
  if (process.platform !== "win32") {
    return false;
  }

  const newPath = join(getConfigDir(), "antigravity-accounts.json");
  const legacyPath = join(
    getLegacyWindowsConfigDir(),
    "antigravity-accounts.json",
  );

  if (!existsSync(legacyPath) || existsSync(newPath)) {
    return false;
  }

  try {
    const newConfigDir = getConfigDir();
    mkdirSync(newConfigDir, { recursive: true });

    try {
      renameSync(legacyPath, newPath);
      log.info("Migrated Windows config via rename", {
        from: legacyPath,
        to: newPath,
      });
    } catch {
      copyFileSync(legacyPath, newPath);
      unlinkSync(legacyPath);
      log.info("Migrated Windows config via copy+delete", {
        from: legacyPath,
        to: newPath,
      });
    }

    return true;
  } catch (error) {
    log.warn("Failed to migrate legacy Windows config, will use legacy path", {
      legacyPath,
      newPath,
      error: String(error),
    });
    return false;
  }
}

export function getStoragePath(): string {
  const newPath = join(getConfigDir(), "antigravity-accounts.json");

  if (process.platform === "win32") {
    migrateLegacyWindowsConfig();

    if (!existsSync(newPath)) {
      const legacyPath = join(
        getLegacyWindowsConfigDir(),
        "antigravity-accounts.json",
      );
      if (existsSync(legacyPath)) {
        log.info("Using legacy Windows config path (migration failed)", {
          legacyPath,
          newPath,
        });
        return legacyPath;
      }
    }
  }

  return newPath;
}

export async function loadAccounts(): Promise<AccountStorageV4 | null> {
  return loadAccountsFromPath(getStoragePath(), storageIo);
}

export async function saveAccounts(storage: AccountStorageV4): Promise<void> {
  await saveAccountsToPath(getStoragePath(), storage, storageIo);
}

export async function saveAccountsReplace(
  storage: AccountStorageV4,
): Promise<void> {
  await saveAccountsReplaceToPath(getStoragePath(), storage, storageIo);
}

export async function clearAccounts(): Promise<void> {
  await clearAccountsAtPath(getStoragePath(), storageIo);
}
