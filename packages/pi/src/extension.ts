import {
  registerAntigravityProvider,
  type PiGuardRuntimeOptions,
  type ProviderRegistrationHost,
} from "./provider.ts"

export default function extension(
  pi: ProviderRegistrationHost,
  options?: PiGuardRuntimeOptions,
): void {
  registerAntigravityProvider(pi, options)
}
