import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent"

import {
  formatPoolAccountSummary,
  formatPoolQuotaSummary,
  type PiAccountPool,
} from "./accounts.ts"
import type { SharedGuardConfig } from "@benjamolina/antigravity-guard-core"

export interface PiCommandRegistrationHost {
  registerCommand?: ExtensionAPI["registerCommand"]
  sendMessage?: ExtensionAPI["sendMessage"]
}

export interface RegisterPiGuardCommandsOptions {
  pool: PiAccountPool
  getConfig: () => SharedGuardConfig
}

function emitCommandReport(
  pi: PiCommandRegistrationHost,
  ctx: Partial<ExtensionCommandContext> | undefined,
  customType: "antigravity-accounts" | "antigravity-quota",
  content: string,
): void {
  if (typeof pi.sendMessage === "function") {
    pi.sendMessage(
      {
        customType,
        content,
        display: true,
      },
      { triggerTurn: false },
    )
    return
  }
  ctx?.ui?.notify?.(content, "info")
}

const ACCOUNTS_USAGE =
  "Usage: /antigravity-accounts [enable <n>|disable <n>|remove <n>] (where <n> is a positive integer >= 1)."
const QUOTA_USAGE = "Usage: /antigravity-quota (no arguments accepted)."
const POSITIVE_INDEX_RE = /^[1-9]\d*$/

function emitWarning(
  pi: PiCommandRegistrationHost,
  ctx: Partial<ExtensionCommandContext> | undefined,
  customType: "antigravity-accounts" | "antigravity-quota",
  message: string,
): void {
  if (typeof ctx?.ui?.notify === "function") {
    ctx.ui.notify(message, "warning")
    return
  }
  emitCommandReport(pi, ctx, customType, message)
}

export function registerPiGuardCommands(
  pi: PiCommandRegistrationHost,
  options: RegisterPiGuardCommandsOptions,
): void {
  if (typeof pi.registerCommand !== "function") {
    return
  }

  pi.registerCommand("antigravity-accounts", {
    description:
      "Inspect and manage the shared Antigravity Guard multi-account pool (usage: /antigravity-accounts [enable <n>|disable <n>|remove <n>])",
    handler: async (args, ctx) => {
      const trimmed = (args ?? "").trim()
      const tokens = trimmed ? trimmed.split(/\s+/) : []

      if (tokens.length === 0) {
        const manager = await options.pool.loadOrRefresh(ctx?.cwd)
        const cfg = options.getConfig()
        const report = formatPoolAccountSummary(
          manager.getAccounts(),
          options.pool.getAccountsPath(),
          cfg.account_selection_strategy,
        )
        emitCommandReport(pi, ctx, "antigravity-accounts", report)
        return
      }

      const subcommand = tokens[0]?.toLowerCase()
      const rawTarget = tokens[1] ?? ""
      const isValidAction =
        tokens.length === 2 &&
        (subcommand === "enable" || subcommand === "disable" || subcommand === "remove") &&
        POSITIVE_INDEX_RE.test(rawTarget)
      const targetNum = isValidAction ? Number(rawTarget) : Number.NaN

      if (!isValidAction || !Number.isSafeInteger(targetNum) || targetNum < 1) {
        emitWarning(pi, ctx, "antigravity-accounts", ACCOUNTS_USAGE)
        return
      }

      let manager
      if (subcommand === "remove") {
        const outcome = await options.pool.removeAccountByIndex(targetNum - 1, ctx?.cwd)
        manager = outcome.manager
        if (outcome.removed) {
          ctx?.ui?.notify?.(`Removed account #${targetNum} from pool.`, "info")
        } else {
          ctx?.ui?.notify?.(`Account #${targetNum} not found.`, "warning")
        }
      } else {
        manager = await options.pool.loadOrRefresh(ctx?.cwd)
        const index = targetNum - 1
        const enable = subcommand === "enable"
        if (enable) {
          manager.clearAccountVerificationRequired(index, true)
        }
        const changed = manager.setAccountEnabled(index, enable)
        if (changed) {
          await manager.saveToDisk()
          ctx?.ui?.notify?.(
            `Account #${targetNum} ${enable ? "enabled" : "disabled"}.`,
            "info",
          )
        } else {
          ctx?.ui?.notify?.(`Account #${targetNum} not found.`, "warning")
        }
      }

      const cfg = options.getConfig()
      const report = formatPoolAccountSummary(
        manager.getAccounts(),
        options.pool.getAccountsPath(),
        cfg.account_selection_strategy,
      )
      emitCommandReport(pi, ctx, "antigravity-accounts", report)
    },
  })

  pi.registerCommand("antigravity-quota", {
    description:
      "Display cached soft-quota usage across the shared Antigravity Guard account pool",
    handler: async (args, ctx) => {
      if ((args ?? "").trim().length > 0) {
        emitWarning(pi, ctx, "antigravity-quota", QUOTA_USAGE)
        return
      }
      const manager = await options.pool.loadOrRefresh(ctx?.cwd)
      const cfg = options.getConfig()
      const report = formatPoolQuotaSummary(
        manager.getAccounts(),
        cfg.soft_quota_threshold_percent,
      )
      emitCommandReport(pi, ctx, "antigravity-quota", report)
    },
  })
}
