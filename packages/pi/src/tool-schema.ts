import { denseArray, fail, freeze, ownData, plainObject, type JsonObject, type JsonValue } from "./tool-contract.ts"

const MAX_SCHEMA_DEPTH = 32
const MAX_SCHEMA_NODES = 2048
const MAX_SCHEMA_BYTES = 256 * 1024
const MAX_TOTAL_SCHEMA_BYTES = 1024 * 1024
const METADATA = new Set(["$schema", "$id", "$anchor", "$dynamicAnchor", "$vocabulary", "$comment"])
const SCHEMA_MAPS = new Set(["properties", "patternProperties", "dependentSchemas"])
const SCHEMAS = new Set(["additionalItems", "additionalProperties", "contains", "contentSchema", "else", "if", "items", "not", "propertyNames", "then", "unevaluatedItems", "unevaluatedProperties"])
const SCHEMA_ARRAYS = new Set(["allOf", "anyOf", "oneOf", "prefixItems"])

interface SchemaState {
  readonly ancestors: Set<object>
  nodes: number
}

export interface ToolDeclaration {
  readonly name: string
  readonly description: string
  readonly parameters: JsonObject
}

export function normalizeToolDeclarations(value: unknown): readonly ToolDeclaration[] {
  const tools = denseArray(value, "tools", "$")
  const names = new Set<string>()
  const declarations = tools.map((tool, index) => normalizeDeclaration(tool, index, names))
  let totalSchemaBytes = 0
  for (const declaration of declarations) {
    totalSchemaBytes += Buffer.byteLength(JSON.stringify(declaration.parameters), "utf8")
    if (totalSchemaBytes > MAX_TOTAL_SCHEMA_BYTES) fail("PI_TOOL_SCHEMA_LIMIT", declaration.name, "$")
  }
  return freeze(declarations)
}

function normalizeDeclaration(value: unknown, index: number, names: Set<string>): ToolDeclaration {
  const path = `$[${index}]`
  const tool = plainObject(value, `tool-${index}`, path)
  const name = ownData(tool, "name", `tool-${index}`, path)
  if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/.test(name)) fail("PI_TOOL_DECLARATION_INVALID", `tool-${index}`, `${path}.name`)
  if (names.has(name)) fail("PI_TOOL_DECLARATION_DUPLICATE", name, `${path}.name`)
  names.add(name)
  const description = ownData(tool, "description", name, path)
  if (typeof description !== "string" || !description.trim()) fail("PI_TOOL_DECLARATION_INVALID", name, `${path}.description`)
  const constrainedSampling = ownData(tool, "constrainedSampling", name, path)
  if (constrainedSampling !== undefined && constrainedSampling !== false) fail("PI_TOOL_CONSTRAINED_SAMPLING_UNSUPPORTED", name, `${path}.constrainedSampling`)
  const root = plainObject(ownData(tool, "parameters", name, path), name, "$")
  if (ownData(root, "type", name, "$") !== "object") fail("PI_TOOL_SCHEMA_INVALID", name, "$.type")
  const snapshot = snapshotJson(root, name, "$", { ancestors: new Set(), nodes: 0 })
  if (!isJsonObject(snapshot)) fail("PI_TOOL_SCHEMA_INVALID", name, "$")
  const parameters = emitSchema(snapshot, name, "$")
  if (!isJsonObject(parameters) || parameters.type !== "object") fail("PI_TOOL_SCHEMA_INVALID", name, "$.type")
  if (Buffer.byteLength(JSON.stringify(parameters), "utf8") > MAX_SCHEMA_BYTES) fail("PI_TOOL_SCHEMA_LIMIT", name, "$")
  return freeze({ name, description, parameters })
}

function snapshotJson(value: unknown, declaration: string, path: string, state: SchemaState, depth = 0): JsonValue {
  if (depth > MAX_SCHEMA_DEPTH || ++state.nodes > MAX_SCHEMA_NODES) fail("PI_TOOL_SCHEMA_LIMIT", declaration, path)
  if (value === null || typeof value === "string" || typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  if (typeof value !== "object" || state.ancestors.has(value)) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  state.ancestors.add(value)
  try {
    if (Array.isArray(value)) return freeze(snapshotArray(value, declaration, path, state, depth))
    const object = plainObject(value, declaration, path)
    const output: Record<string, JsonValue> = {}
    for (const key of Object.keys(object).sort()) define(output, key, snapshotJson(ownData(object, key, declaration, path), declaration, `${path}.${key}`, state, depth + 1))
    return freeze(output) as JsonObject
  } finally {
    state.ancestors.delete(value)
  }
}

function snapshotArray(value: unknown[], declaration: string, path: string, state: SchemaState, depth: number): JsonValue[] {
  if (Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length !== value.length + 1) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  const values = denseArray(value, declaration, path)
  const output: JsonValue[] = []
  for (let index = 0; index < values.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
    if (!descriptor || !("value" in descriptor)) fail("PI_TOOL_SCHEMA_INVALID", declaration, `${path}[${index}]`)
    output.push(snapshotJson(descriptor.value, declaration, `${path}[${index}]`, state, depth + 1))
  }
  return output
}

function emitSchema(value: JsonValue, declaration: string, path: string): JsonValue {
  if (typeof value === "boolean") return value
  if (!isJsonObject(value)) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  const output: Record<string, JsonValue> = {}
  for (const key of Object.keys(value)) {
    const child = value[key]!
    if (METADATA.has(key)) continue
    if (key === "$ref" || key === "$defs" || key === "definitions") fail("PI_TOOL_SCHEMA_REFERENCE_INVALID", declaration, `${path}.${key}`)
    if (key === "dependencies") define(output, key, emitDependencies(child, declaration, `${path}.${key}`))
    else if (SCHEMA_MAPS.has(key)) define(output, key, emitSchemaMap(child, declaration, `${path}.${key}`))
    else if (SCHEMAS.has(key)) define(output, key, emitSchema(child, declaration, `${path}.${key}`))
    else if (SCHEMA_ARRAYS.has(key)) define(output, key, emitSchemaArray(child, declaration, `${path}.${key}`))
    else define(output, key, child)
  }
  return freeze(output) as JsonObject
}

function emitSchemaMap(value: JsonValue, declaration: string, path: string): JsonObject {
  if (!isJsonObject(value)) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  const output: Record<string, JsonValue> = {}
  for (const key of Object.keys(value)) define(output, key, emitSchema(value[key]!, declaration, `${path}.${key}`))
  return freeze(output) as JsonObject
}

function emitDependencies(value: JsonValue, declaration: string, path: string): JsonObject {
  if (!isJsonObject(value)) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  const output: Record<string, JsonValue> = {}
  for (const key of Object.keys(value)) {
    const dependency = value[key]!
    define(output, key, Array.isArray(dependency) ? dependency : emitSchema(dependency, declaration, `${path}.${key}`))
  }
  return freeze(output) as JsonObject
}

function emitSchemaArray(value: JsonValue, declaration: string, path: string): readonly JsonValue[] {
  if (!Array.isArray(value)) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  return freeze(value.map((item, index) => emitSchema(item, declaration, `${path}[${index}]`)))
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function define(target: Record<string, JsonValue>, key: string, value: JsonValue): void {
  Object.defineProperty(target, key, { value, enumerable: true, configurable: false, writable: false })
}
