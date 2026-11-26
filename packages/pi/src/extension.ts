import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

import { registerAntigravityProvider, type PiGuardRuntimeOptions } from "./provider.ts"

type ExtensionHost = Pick<ExtensionAPI, "registerProvider"> & {
  on?: (
    event: "session_start",
    handler: (event: unknown, ctx?: { cwd?: string }) => Promise<void> | void,
  ) => void
}

export default function extension(pi: ExtensionHost, options?: PiGuardRuntimeOptions): void {
  registerAntigravityProvider(pi, options)
}
