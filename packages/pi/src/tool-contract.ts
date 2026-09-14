export type JsonPrimitive = null | boolean | number | string
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject
export interface JsonObject { readonly [key: string]: JsonValue }

export class ToolPreflightError extends Error {
  constructor(
    readonly code: string,
    readonly declaration: string,
    readonly path: string,
  ) {
    super(`${code}: declaration ${declaration} at ${path}`)
  }
}

export function ownData(value: unknown, name: string, declaration: string, path: string): unknown {
  const object = plainObject(value, declaration, path)
  const descriptor = Object.getOwnPropertyDescriptor(object, name)
  if (!descriptor || !("value" in descriptor)) return undefined
  return descriptor.value
}

export function plainObject(value: unknown, declaration: string, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) || Object.getOwnPropertySymbols(value).length > 0) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  for (const name of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name)
    if (!descriptor || !("value" in descriptor)) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  }
  return value as Record<string, unknown>
}

export function denseArray(value: unknown, declaration: string, path: string): readonly unknown[] {
  if (!Array.isArray(value) || Object.keys(value).length !== value.length) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  return value
}

export function canonicalJson(value: unknown, declaration: string, path: string, ancestors = new Set<object>()): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value
    fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  }
  if (typeof value !== "object") fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  if (ancestors.has(value)) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  ancestors.add(value)
  try {
    if (Array.isArray(value)) return Object.freeze(denseArray(value, declaration, path).map((item, index) => canonicalJson(item, declaration, `${path}[${index}]`, ancestors)))
    const object = plainObject(value, declaration, path)
    const output: Record<string, JsonValue> = {}
    for (const key of Object.keys(object).sort()) output[key] = canonicalJson(object[key], declaration, `${path}.${key}`, ancestors)
    return Object.freeze(output) as JsonObject
  } finally {
    ancestors.delete(value)
  }
}

export function freeze<T>(value: T): T {
  return Object.freeze(value)
}

export function fail(code: string, declaration: string, path: string): never {
  throw new ToolPreflightError(code, declaration, path)
}
