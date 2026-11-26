import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

import type { SharedSignatureCacheConfig } from "./config.ts"
import { ensureGitignoreSync } from "./storage.ts"

interface CacheEntry {
  value: string
  timestamp: number
  thinkingText?: string
  textPreview?: string
  toolIds?: string[]
}

interface CacheData {
  version: "1.0"
  memory_ttl_seconds: number
  disk_ttl_seconds: number
  entries: Record<string, CacheEntry>
  statistics: {
    memory_hits: number
    disk_hits: number
    misses: number
    writes: number
    last_write: number
  }
}

export interface SignatureCacheStats {
  memoryHits: number
  diskHits: number
  misses: number
  writes: number
  memoryEntries: number
  dirty: boolean
  diskEnabled: boolean
}

export interface ThinkingCacheData {
  text: string
  signature: string
  toolIds?: string[]
}

export interface SignatureCacheOptions {
  cacheFilePath?: string
  now?: () => number
}

function getDefaultOpenCodeConfigDir(): string {
  const explicit = process.env.OPENCODE_CONFIG_DIR?.trim()
  if (explicit) {
    return explicit
  }
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "opencode")
  }
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return join(xdgConfig, "opencode")
}

function getDefaultCacheFilePath(): string {
  return join(getDefaultOpenCodeConfigDir(), "antigravity-signature-cache.json")
}

export class SignatureCache {
  private cache: Map<string, CacheEntry> = new Map()
  private memoryTtlMs: number
  private diskTtlMs: number
  private writeIntervalMs: number
  private cacheFilePath: string
  private enabled: boolean
  private nowFn?: () => number

  private dirty = false
  private writeTimer: ReturnType<typeof setInterval> | null = null
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  private stats = {
    memoryHits: 0,
    diskHits: 0,
    misses: 0,
    writes: 0,
  }

  constructor(config: SharedSignatureCacheConfig, options?: SignatureCacheOptions) {
    this.enabled = config.enabled
    this.memoryTtlMs = config.memory_ttl_seconds * 1000
    this.diskTtlMs = config.disk_ttl_seconds * 1000
    this.writeIntervalMs = config.write_interval_seconds * 1000
    this.cacheFilePath = options?.cacheFilePath ?? getDefaultCacheFilePath()
    this.nowFn = options?.now

    if (this.enabled) {
      this.loadFromDisk()
      this.startBackgroundTasks()
    }
  }

  private now(): number {
    return this.nowFn ? this.nowFn() : Date.now()
  }

  static makeKey(sessionId: string, modelId: string): string {
    return `${sessionId}:${modelId}`
  }

  getCacheFilePath(): string {
    return this.cacheFilePath
  }

  store(key: string, signature: string): void {
    if (!this.enabled) return

    this.cache.set(key, {
      value: signature,
      timestamp: this.now(),
    })
    this.dirty = true
  }

  retrieve(key: string): string | null {
    if (!this.enabled) return null

    const entry = this.cache.get(key)
    if (entry) {
      const age = this.now() - entry.timestamp
      if (age <= this.memoryTtlMs) {
        this.stats.memoryHits++
        return entry.value
      }
      this.cache.delete(key)
    }

    this.stats.misses++
    return null
  }

  has(key: string): boolean {
    if (!this.enabled) return false

    const entry = this.cache.get(key)
    if (!entry) return false

    const age = this.now() - entry.timestamp
    return age <= this.memoryTtlMs
  }

  storeThinking(
    key: string,
    thinkingText: string,
    signature: string,
    toolIds?: string[],
  ): void {
    if (!this.enabled || !thinkingText || !signature) return

    this.cache.set(key, {
      value: signature,
      timestamp: this.now(),
      thinkingText,
      textPreview: thinkingText.slice(0, 100),
      toolIds,
    })
    this.dirty = true
  }

  retrieveThinking(key: string): ThinkingCacheData | null {
    if (!this.enabled) return null

    const entry = this.cache.get(key)
    if (!entry || !entry.thinkingText) return null

    const age = this.now() - entry.timestamp
    if (age > this.memoryTtlMs) {
      this.cache.delete(key)
      return null
    }

    this.stats.memoryHits++
    return {
      text: entry.thinkingText,
      signature: entry.value,
      toolIds: entry.toolIds,
    }
  }

  hasThinking(key: string): boolean {
    if (!this.enabled) return false

    const entry = this.cache.get(key)
    if (!entry || !entry.thinkingText) return false

    const age = this.now() - entry.timestamp
    return age <= this.memoryTtlMs
  }

  getStats(): SignatureCacheStats {
    return {
      ...this.stats,
      memoryEntries: this.cache.size,
      dirty: this.dirty,
      diskEnabled: this.enabled,
    }
  }

  async flush(): Promise<boolean> {
    if (!this.enabled) return true
    return this.saveToDisk()
  }

  shutdown(): void {
    if (this.writeTimer) {
      clearInterval(this.writeTimer)
      this.writeTimer = null
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }

    if (this.dirty && this.enabled) {
      this.saveToDisk()
    }
  }

  private loadFromDisk(): void {
    try {
      if (!existsSync(this.cacheFilePath)) {
        return
      }

      const content = readFileSync(this.cacheFilePath, "utf-8")
      const data = JSON.parse(content) as Partial<CacheData>

      if (data.version !== "1.0" || !data.entries || typeof data.entries !== "object") {
        return
      }

      const now = this.now()
      for (const [key, entry] of Object.entries(data.entries)) {
        if (!entry || typeof entry.value !== "string" || typeof entry.timestamp !== "number") {
          continue
        }
        const age = now - entry.timestamp
        if (age <= this.diskTtlMs) {
          this.cache.set(key, {
            value: entry.value,
            timestamp: entry.timestamp,
            ...(typeof entry.thinkingText === "string" ? { thinkingText: entry.thinkingText } : {}),
            ...(typeof entry.textPreview === "string" ? { textPreview: entry.textPreview } : {}),
            ...(Array.isArray(entry.toolIds) ? { toolIds: entry.toolIds } : {}),
          })
        }
      }
    } catch {
      // Corrupted or unreadable cache files safely start fresh
    }
  }

  private saveToDisk(): boolean {
    let tmpPath: string | null = null
    try {
      const dir = dirname(this.cacheFilePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      ensureGitignoreSync(dir)

      const now = this.now()

      let existingEntries: Record<string, CacheEntry> = {}
      if (existsSync(this.cacheFilePath)) {
        try {
          const content = readFileSync(this.cacheFilePath, "utf-8")
          const data = JSON.parse(content) as Partial<CacheData>
          if (data.entries && typeof data.entries === "object") {
            existingEntries = data.entries
          }
        } catch {
          // Ignore corrupted existing file on overwrite
        }
      }

      const validDiskEntries: Record<string, CacheEntry> = {}
      for (const [key, entry] of Object.entries(existingEntries)) {
        if (!entry || typeof entry.value !== "string" || typeof entry.timestamp !== "number") {
          continue
        }
        const age = now - entry.timestamp
        if (age <= this.diskTtlMs) {
          validDiskEntries[key] = entry
        }
      }

      const mergedEntries: Record<string, CacheEntry> = { ...validDiskEntries }
      for (const [key, entry] of this.cache.entries()) {
        mergedEntries[key] = {
          value: entry.value,
          timestamp: entry.timestamp,
          ...(entry.thinkingText ? { thinkingText: entry.thinkingText } : {}),
          ...(entry.textPreview ? { textPreview: entry.textPreview } : {}),
          ...(entry.toolIds ? { toolIds: entry.toolIds } : {}),
        }
      }

      const cacheData: CacheData = {
        version: "1.0",
        memory_ttl_seconds: this.memoryTtlMs / 1000,
        disk_ttl_seconds: this.diskTtlMs / 1000,
        entries: mergedEntries,
        statistics: {
          memory_hits: this.stats.memoryHits,
          disk_hits: this.stats.diskHits,
          misses: this.stats.misses,
          writes: this.stats.writes + 1,
          last_write: now,
        },
      }

      const currentTmpPath = join(
        dir,
        `.antigravity-signature-cache.${process.pid}.${now}.${Math.random().toString(36).slice(2)}.tmp`,
      )
      tmpPath = currentTmpPath
      writeFileSync(currentTmpPath, JSON.stringify(cacheData, null, 2), {
        encoding: "utf-8",
        mode: 0o600,
      })

      try {
        renameSync(currentTmpPath, this.cacheFilePath)
        tmpPath = null
      } catch {
        writeFileSync(this.cacheFilePath, readFileSync(currentTmpPath), { mode: 0o600 })
        try {
          unlinkSync(currentTmpPath)
          tmpPath = null
        } catch {
          // Ignore temp cleanup failure
        }
      }

      this.stats.writes++
      this.dirty = false
      return true
    } catch {
      if (tmpPath) {
        try {
          unlinkSync(tmpPath)
        } catch {
          // Ignore temp cleanup failure
        }
      }
      return false
    }
  }

  private startBackgroundTasks(): void {
    this.writeTimer = setInterval(() => {
      if (this.dirty) {
        this.saveToDisk()
      }
    }, this.writeIntervalMs)
    this.writeTimer.unref?.()

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired()
    }, 30 * 60 * 1000)
    this.cleanupTimer.unref?.()
  }

  private cleanupExpired(): void {
    const now = this.now()
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp
      if (age > this.memoryTtlMs) {
        this.cache.delete(key)
      }
    }
  }
}

export function createSignatureCache(
  config: SharedSignatureCacheConfig | undefined,
  options?: SignatureCacheOptions,
): SignatureCache | null {
  if (!config || !config.enabled) {
    return null
  }
  return new SignatureCache(config, options)
}

interface SessionSignatureEntry {
  signature: string
  timestamp: number
}

const DEFAULT_SESSION_SIGNATURE_TTL_MS = 60 * 60 * 1000
const DEFAULT_MAX_ENTRIES_PER_SESSION = 100
const SIGNATURE_TEXT_HASH_HEX_LEN = 16

function hashSignatureKeyText(text: string): string {
  return createHash("sha256")
    .update(text, "utf8")
    .digest("hex")
    .slice(0, SIGNATURE_TEXT_HASH_HEX_LEN)
}

function makeDiskSignatureKey(sessionId: string, textHash: string): string {
  return `${sessionId}:${textHash}`
}

export interface SessionSignatureCacheOptions {
  diskCache?: SignatureCache | null
  memoryTtlMs?: number
  maxEntriesPerSession?: number
  now?: () => number
}

export interface SessionSignatureCache {
  cacheSignature(sessionId: string, text: string, signature: string): void
  getCachedSignature(sessionId: string, text: string): string | undefined
  clear(sessionId?: string): void
  setDiskCache(diskCache: SignatureCache | null, options?: { shutdownPrevious?: boolean }): void
  getDiskCache(): SignatureCache | null
  shutdown(): void
}

export function createSessionSignatureCache(
  options: SessionSignatureCacheOptions = {},
): SessionSignatureCache {
  const memoryCache = new Map<string, Map<string, SessionSignatureEntry>>()
  const memoryTtlMs = options.memoryTtlMs ?? DEFAULT_SESSION_SIGNATURE_TTL_MS
  const maxEntriesPerSession = options.maxEntriesPerSession ?? DEFAULT_MAX_ENTRIES_PER_SESSION
  let diskCache: SignatureCache | null = options.diskCache ?? null

  const getNow = (): number => (options.now ? options.now() : Date.now())

  return {
    cacheSignature(sessionId: string, text: string, signature: string): void {
      if (!sessionId || !text || !signature) return

      const now = getNow()
      const textHash = hashSignatureKeyText(text)
      let sessionMap = memoryCache.get(sessionId)
      if (!sessionMap) {
        sessionMap = new Map()
        memoryCache.set(sessionId, sessionMap)
      }

      if (sessionMap.size >= maxEntriesPerSession) {
        for (const [key, entry] of sessionMap.entries()) {
          if (now - entry.timestamp > memoryTtlMs) {
            sessionMap.delete(key)
          }
        }
        if (sessionMap.size >= maxEntriesPerSession) {
          const sorted = Array.from(sessionMap.entries()).sort(
            (left, right) => left[1].timestamp - right[1].timestamp,
          )
          const removeCount = Math.max(1, Math.floor(maxEntriesPerSession / 4))
          for (const [key] of sorted.slice(0, removeCount)) {
            sessionMap.delete(key)
          }
        }
      }

      sessionMap.set(textHash, { signature, timestamp: now })

      if (diskCache) {
        diskCache.store(makeDiskSignatureKey(sessionId, textHash), signature)
      }
    },

    getCachedSignature(sessionId: string, text: string): string | undefined {
      if (!sessionId || !text) return undefined

      const now = getNow()
      const textHash = hashSignatureKeyText(text)
      const sessionMap = memoryCache.get(sessionId)
      if (sessionMap) {
        const entry = sessionMap.get(textHash)
        if (entry) {
          if (now - entry.timestamp > memoryTtlMs) {
            sessionMap.delete(textHash)
          } else {
            return entry.signature
          }
        }
      }

      if (diskCache) {
        const diskValue = diskCache.retrieve(makeDiskSignatureKey(sessionId, textHash))
        if (diskValue) {
          let promoted = memoryCache.get(sessionId)
          if (!promoted) {
            promoted = new Map()
            memoryCache.set(sessionId, promoted)
          }
          promoted.set(textHash, { signature: diskValue, timestamp: now })
          return diskValue
        }
      }

      return undefined
    },

    clear(sessionId?: string): void {
      if (sessionId) {
        memoryCache.delete(sessionId)
      } else {
        memoryCache.clear()
      }
    },

    setDiskCache(
      nextDiskCache: SignatureCache | null,
      setOptions?: { shutdownPrevious?: boolean },
    ): void {
      if (setOptions?.shutdownPrevious && diskCache && diskCache !== nextDiskCache) {
        diskCache.shutdown()
      }
      diskCache = nextDiskCache
    },

    getDiskCache(): SignatureCache | null {
      return diskCache
    },

    shutdown(): void {
      if (diskCache) {
        diskCache.shutdown()
      }
    },
  }
}

export function isGemini3Or4SignatureModel(model?: string): boolean {
  if (typeof model !== "string") return false
  const lower = model.toLowerCase()
  return lower.includes("gemini-3") || lower.includes("gemini-4") || lower === "gemini-pro-agent"
}

export function stripThinkingTierSuffixForCacheKey(model: string): string {
  if (/^gpt-oss/i.test(model)) {
    return model
  }
  return model.replace(/-(minimal|low|medium|high|xhigh)$/i, "")
}

export function signatureCacheProjectKey(
  model: string | undefined,
  projectKey: string | undefined,
): string | undefined {
  if (isGemini3Or4SignatureModel(model)) {
    return undefined
  }
  return projectKey
}

export function buildSignatureSessionKey(
  sessionId: string,
  model?: string,
  conversationKey?: string,
  projectKey?: string,
): string {
  const modelKey = typeof model === "string" && model.trim() ? model.toLowerCase() : "unknown"
  const projectPart =
    typeof projectKey === "string" && projectKey.trim() ? projectKey.trim() : "default"
  const conversationPart =
    typeof conversationKey === "string" && conversationKey.trim()
      ? conversationKey.trim()
      : "default"
  return `${sessionId}:${modelKey}:${projectPart}:${conversationPart}`
}
