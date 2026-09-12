export interface PiCredentials {
  refresh: string
  access: string
  expires: number
  projectId?: string
  email?: string
}

export interface AuthHttpDependencies {
  fetch: typeof globalThis.fetch
  now: () => number
  signal?: AbortSignal
  deadlineMs?: number
}
