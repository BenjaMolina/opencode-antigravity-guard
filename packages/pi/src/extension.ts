import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

import { registerAntigravityProvider } from "./provider.ts"

export default function extension(pi: Pick<ExtensionAPI, "registerProvider">): void {
  registerAntigravityProvider(pi)
}
