export function calculateTokenExpiry(requestTimeMs: number, expiresInSeconds: unknown): number {
  const seconds = typeof expiresInSeconds === "number" ? expiresInSeconds : 3_600
  if (Number.isNaN(seconds) || seconds <= 0) {
    return requestTimeMs
  }
  return requestTimeMs + seconds * 1_000
}
