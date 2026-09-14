import { canonicalJson, denseArray, fail, freeze, ownData, plainObject, type JsonObject, type JsonPrimitive, type JsonValue } from "./tool-contract.ts"

const TYPES = new Set(["object", "array", "string", "number", "integer", "boolean"])
const KEYWORDS = new Set(["type", "description", "nullable", "enum", "const", "properties", "required", "items"])
const MAX_SCHEMA_DEPTH = 32
const MAX_SCHEMA_NODES = 2048
const MAX_SCHEMA_BYTES = 256 * 1024
const MAX_TOTAL_SCHEMA_BYTES = 1024 * 1024

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
  const parameterRoot = plainObject(ownData(tool, "parameters", name, path), name, "$")
  if (ownData(parameterRoot, "type", name, "$") !== "object") fail("PI_TOOL_SCHEMA_INVALID", name, "$.type")
  const parameters = normalizeSchema(parameterRoot, name, "$")
  if (Buffer.byteLength(JSON.stringify(parameters), "utf8") > MAX_SCHEMA_BYTES) fail("PI_TOOL_SCHEMA_LIMIT", name, "$")
  return freeze({ name, description, parameters })
}

function normalizeSchema(value: unknown, declaration: string, path: string, state: SchemaState = { ancestors: new Set(), nodes: 0 }, depth = 0): JsonObject {
  if (depth > MAX_SCHEMA_DEPTH || ++state.nodes > MAX_SCHEMA_NODES) fail("PI_TOOL_SCHEMA_LIMIT", declaration, path)
  if (typeof value === "object" && value !== null) {
    if (state.ancestors.has(value)) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
    state.ancestors.add(value)
  }
  const schema = plainObject(value, declaration, path)
  for (const key of Object.keys(schema)) if (!KEYWORDS.has(key)) fail("PI_TOOL_SCHEMA_UNSUPPORTED", declaration, `${path}.${key}`)
  const type = ownData(schema, "type", declaration, path)
  if (typeof type !== "string" || !TYPES.has(type)) fail("PI_TOOL_SCHEMA_INVALID", declaration, `${path}.type`)
  const output: Record<string, JsonValue> = { type }
  const description = ownData(schema, "description", declaration, path)
  if (description !== undefined) {
    if (typeof description !== "string") fail("PI_TOOL_SCHEMA_INVALID", declaration, `${path}.description`)
    output.description = description
  }
  const nullable = ownData(schema, "nullable", declaration, path)
  if (nullable !== undefined) {
    if (typeof nullable !== "boolean") fail("PI_TOOL_SCHEMA_INVALID", declaration, `${path}.nullable`)
    output.nullable = nullable
  }
  const enumValue = ownData(schema, "enum", declaration, path)
  const constant = ownData(schema, "const", declaration, path)
  if (enumValue !== undefined && constant !== undefined) fail("PI_TOOL_SCHEMA_INVALID", declaration, `${path}.const`)
  if (enumValue !== undefined) output.enum = normalizeEnum(enumValue, type, nullable === true, declaration, `${path}.enum`)
  if (constant !== undefined) output.enum = freeze([validateEnumValue(constant, type, nullable === true, declaration, `${path}.const`)])
  if (type === "object") normalizeObject(schema, output, declaration, path, state, depth)
  else if (type === "array") normalizeArray(schema, output, declaration, path, state, depth)
  else if (ownData(schema, "properties", declaration, path) !== undefined || ownData(schema, "required", declaration, path) !== undefined || ownData(schema, "items", declaration, path) !== undefined) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  return freeze(output) as JsonObject
}

function normalizeObject(schema: Record<string, unknown>, output: Record<string, JsonValue>, declaration: string, path: string, state: SchemaState, depth: number): void {
  if (ownData(schema, "items", declaration, path) !== undefined) fail("PI_TOOL_SCHEMA_INVALID", declaration, `${path}.items`)
  const properties = plainObject(ownData(schema, "properties", declaration, path), declaration, `${path}.properties`)
  const names = Object.keys(properties).sort()
  if (!names.length) fail("PI_TOOL_SCHEMA_INVALID", declaration, `${path}.properties`)
  const normalized: Record<string, JsonValue> = {}
  for (const name of names) normalized[name] = normalizeSchema(properties[name], declaration, `${path}.properties.${name}`, state, depth + 1)
  output.properties = freeze(normalized) as JsonObject
  const required = ownData(schema, "required", declaration, path)
  if (required !== undefined) {
    const values = denseArray(required, declaration, `${path}.required`)
    if (values.some((name) => typeof name !== "string" || !Object.hasOwn(properties, name)) || new Set(values).size !== values.length) fail("PI_TOOL_SCHEMA_INVALID", declaration, `${path}.required`)
    output.required = freeze([...values as string[]].sort())
  }
}

function normalizeArray(schema: Record<string, unknown>, output: Record<string, JsonValue>, declaration: string, path: string, state: SchemaState, depth: number): void {
  if (ownData(schema, "properties", declaration, path) !== undefined || ownData(schema, "required", declaration, path) !== undefined) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  output.items = normalizeSchema(ownData(schema, "items", declaration, path), declaration, `${path}.items`, state, depth + 1)
}

function normalizeEnum(value: unknown, type: string, nullable: boolean, declaration: string, path: string): readonly JsonPrimitive[] {
  const values = denseArray(value, declaration, path)
  if (!values.length) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  const normalized = values.map((item, index) => validateEnumValue(item, type, nullable, declaration, `${path}[${index}]`))
  if (new Set(normalized.map((item) => JSON.stringify(item))).size !== normalized.length) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  return freeze(normalized)
}

function validateEnumValue(value: unknown, type: string, nullable: boolean, declaration: string, path: string): JsonPrimitive {
  const json = canonicalJson(value, declaration, path)
  if (typeof json === "object" || (json === null && !nullable) || (json !== null && (type === "integer" ? typeof json !== "number" || !Number.isInteger(json) : typeof json !== type))) fail("PI_TOOL_SCHEMA_INVALID", declaration, path)
  return json
}
