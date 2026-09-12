export interface PiCredentials {
  refresh: string
  access: string
  expires: number
}

export interface AuthHttpDependencies {
  fetch: typeof globalThis.fetch
  now: () => number
  signal?: AbortSignal
  deadlineMs?: number
}
