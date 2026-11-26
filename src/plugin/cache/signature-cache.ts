/**
 * Move-and-Reexport facade delegating disk-persistent SignatureCache to @benjamolina/antigravity-guard-core.
 */

export {
  SignatureCache,
  createSignatureCache,
  type SignatureCacheOptions,
  type SignatureCacheStats,
  type ThinkingCacheData,
} from "@benjamolina/antigravity-guard-core";
