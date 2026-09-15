import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { normalizeToolDeclarations } from "./tool-schema.ts"

const rejectionFixtures = JSON.parse(readFileSync(new URL("../fixtures/tools/schema-rejections.json", import.meta.url), "utf8")) as readonly { name: string; parameters: unknown; path: string }[]

describe("Pi tool schema normalization", () => {
  it("normalizes ordered declarations and const schemas without mutating input", () => {
    const tools = [
      {
        name: "read_file",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            format: { type: "string", const: "text" },
          },
          required: ["path"],
        },
      },
      {
        name: "list_files",
        description: "List files",
        parameters: {
          type: "object",
          properties: { directory: { type: "string", nullable: true } },
        },
      },
    ]
    const before = structuredClone(tools)

    expect(normalizeToolDeclarations(tools)).toEqual([
      {
        name: "read_file",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: {
            format: { const: "text", type: "string" },
            path: { type: "string" },
          },
          required: ["path"],
        },
      },
      {
        name: "list_files",
        description: "List files",
        parameters: {
          type: "object",
          properties: { directory: { type: "string", nullable: true } },
        },
      },
    ])
    expect(tools).toEqual(before)
    expect(Object.isFrozen(normalizeToolDeclarations(tools)[0]?.parameters)).toBe(true)
  })

  it("preserves ask_user_choice constraints and canonicalizes nested schemas", () => {
    const tools = [{ name: "ask_user_choice", description: "Ask", parameters: {
      type: "object", additionalProperties: false,
      properties: {
        question: { type: "string", minLength: 1, maxLength: 80, pattern: "\\S" },
        options: { type: "array", minItems: 1, maxItems: 4, items: { type: "object", additionalProperties: false, properties: { label: { type: "string", const: "choice", default: "choice" }, value: { anyOf: [{ type: "string" }, { type: "number", minimum: 0 }] } } } },
        labels: { type: "object", patternProperties: { "^x-": { type: "string" } }, additionalProperties: { type: "boolean" } },
        empty: {}, permitted: true,
      },
    } }]
    const before = structuredClone(tools)
    expect(normalizeToolDeclarations(tools)).toEqual([{ name: "ask_user_choice", description: "Ask", parameters: {
      additionalProperties: false,
      properties: {
        empty: {}, labels: { additionalProperties: { type: "boolean" }, patternProperties: { "^x-": { type: "string" } }, type: "object" },
        options: { items: { additionalProperties: false, properties: { label: { const: "choice", default: "choice", type: "string" }, value: { anyOf: [{ type: "string" }, { minimum: 0, type: "number" }] } }, type: "object" }, maxItems: 4, minItems: 1, type: "array" },
        permitted: true, question: { maxLength: 80, minLength: 1, pattern: "\\S", type: "string" },
      }, type: "object",
    } }])
    expect(tools).toEqual(before)
  })

  it("preserves property dependencies", () => {
    const parameters = {
      type: "object",
      dependencies: { enabled: ["mode"] },
    }
    expect(normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])[0]?.parameters).toEqual(parameters)
  })

  it.each([
    ["primitive declaration root", { type: "string" }, "$.type"],




  ])("rejects %s without repairing the schema", (_label, parameters, path) => {
    try {
      normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])
    } catch (error) {
      expect(String(error)).toContain("declaration tool")
      expect(String(error)).toContain(path)
      return
    }
    throw new Error("expected schema normalization to fail")
  })

  it.each(rejectionFixtures)("rejects fixture $name at its exact path", ({ name, parameters, path }) => {
    expect(() => normalizeToolDeclarations([{ name, description: "A fixture tool", parameters }])).toThrow(path)
  })

  it("enforces schema depth and serialized-size limits", () => {
    let deep: unknown = { type: "string" }
    for (let index = 0; index < 33; index += 1) deep = { type: "array", items: deep }
    deep = { type: "object", properties: { value: deep } }
    const tooLarge = "x".repeat(256 * 1024 + 1)
    for (const parameters of [deep, { type: "object", properties: { value: { type: "string", description: tooLarge } } }]) {
      expect(() => normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])).toThrow(/PI_TOOL_SCHEMA_LIMIT/)
    }
  })

  it("enforces the aggregate normalized schema-size limit across declarations", () => {
    const tools = (count: number) => Array.from({ length: count }, (_, index) => ({
      name: `tool_${index}`,
      description: "A tool",
      parameters: {
        type: "object",
        properties: { value: { type: "string", description: "x".repeat(220 * 1024) } },
      },
    }))

    expect(normalizeToolDeclarations(tools(4))).toHaveLength(4)
    expect(() => normalizeToolDeclarations(tools(5))).toThrow(/PI_TOOL_SCHEMA_LIMIT/)
  })

  it("counts normalized schemas rather than declaration metadata", () => {
    expect(normalizeToolDeclarations([{
      name: "tool",
      description: "x".repeat(2 * 1024 * 1024),
      parameters: { type: "object", properties: { value: { type: "string" } } },
    }])).toHaveLength(1)
  })

  it("rejects unsupported constrained sampling while accepting its only admitted value", () => {
    const tool = { name: "tool", description: "A tool", parameters: { type: "object", properties: { value: { type: "string" } } } }
    expect(normalizeToolDeclarations([{ ...tool, constrainedSampling: false }])).toHaveLength(1)
    expect(() => normalizeToolDeclarations([{ ...tool, constrainedSampling: { type: "object" } }])).toThrow(/PI_TOOL_CONSTRAINED_SAMPLING_UNSUPPORTED/)
  })

  it("preserves schema-position metadata boundaries, canonical ordering, and deeply frozen output", () => {
    const properties = { second: { type: "object", $comment: "omit", properties: { z: { type: "string" }, a: { type: "string" } } } }
    Object.defineProperty(properties, "__proto__", { value: { type: "string", default: { $id: "user-data" } }, enumerable: true })
    const parameters = { type: "object", $id: "schema-id", properties }
    const normalized = normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])[0]!.parameters
    const expected = { properties: { second: { properties: { a: { type: "string" }, z: { type: "string" } }, type: "object" } }, type: "object" }
    Object.defineProperty(expected.properties, "__proto__", { value: { default: { $id: "user-data" }, type: "string" }, enumerable: true })
    expect(normalized).toEqual(expected)
    expect(Object.getPrototypeOf(normalized.properties!)).toBe(Object.prototype)
    const frozen = (value: unknown): boolean => Object.isFrozen(value) && (typeof value !== "object" || value === null || Object.values(value).every(frozen))
    expect(frozen(normalized)).toBe(true)
    expect(parameters).toHaveProperty("$id", "schema-id")
  })

  it("rejects duplicate declarations and hostile runtime values", () => {
    const getter = Object.create(null, { type: { get: () => { throw new Error("CANARY") } } })
    const sparse = [] as unknown[]
    sparse[1] = "value"
    const indexedGetter: unknown[] = []
    Object.defineProperty(indexedGetter, "0", { get: () => { throw new Error("CANARY-index") }, enumerable: true })
    const symbol = { type: "object", properties: { value: { type: "string" } }, [Symbol("x")]: true }
    const cycle: { type: string; properties: Record<string, unknown> } = { type: "object", properties: {} }
    cycle.properties.self = cycle
    class Schema { type = "object"; properties = {} }
    const inherited = Object.create({ type: "object" })
    const functionValue = { type: "object", properties: { value: () => undefined } }
    const undefinedValue = { type: "object", properties: { value: undefined } }
    const bigintValue = { type: "object", properties: { value: BigInt(1) } }
    for (const parameters of [getter, { type: "object", properties: { value: { type: "number", enum: [Number.NaN] } } }, { type: "object", properties: { value: { type: "string", enum: sparse } } }, { type: "object", default: indexedGetter }, symbol, cycle, new Schema(), inherited, functionValue, undefinedValue, bigintValue]) {
      expect(() => normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])).toThrow(/PI_TOOL_SCHEMA/)
      expect(() => normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])).not.toThrow("CANARY")
    }
    expect(() => normalizeToolDeclarations([
      { name: "tool", description: "A tool", parameters: { type: "object", properties: { value: { type: "string" } } } },
      { name: "tool", description: "Another tool", parameters: { type: "object", properties: { value: { type: "string" } } } },
    ])).toThrow(/PI_TOOL_DECLARATION_DUPLICATE/)
  })

  it("enforces deterministic hostile-value and source-node limits before returning declarations", () => {
    const invalid = { type: "object", properties: { z: () => undefined, a: BigInt(1) } }
    expect(() => normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters: invalid }])).toThrow("$.properties.a")
    const parameters = (count: number) => ({ type: "object", default: Array.from({ length: count }, () => null) })
    expect(normalizeToolDeclarations([{ name: "within", description: "A tool", parameters: parameters(2045) }])).toHaveLength(1)
    expect(() => normalizeToolDeclarations([{ name: "over", description: "A tool", parameters: parameters(2046) }])).toThrow(/PI_TOOL_SCHEMA_LIMIT/)
  })

  it("expands local RFC 6901 references without changing source schemas", () => {
    const parameters = {
      type: "object",
      $defs: {
        "value/name": { type: "string", minLength: 1 },
        nested: { $ref: "#/$defs/value~1name" },
      },
      definitions: { legacy: { type: "number", minimum: 0 } },
      properties: {
        direct: { $ref: "#/$defs/value~1name" },
        encoded: { $ref: "#/%24defs/value%7E1name" },
        nested: { $ref: "#/$defs/nested" },
        legacy: { $ref: "#/definitions/legacy" },
        tuple: { type: "array", items: [{ $ref: "#/$defs/value~1name" }] },
        combined: { allOf: [{ $ref: "#/$defs/value~1name" }] },
      },
    }
    const normalized = normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])[0]!.parameters
    expect(normalized).toEqual({
      properties: {
        combined: { allOf: [{ minLength: 1, type: "string" }] },
        direct: { minLength: 1, type: "string" },
        encoded: { minLength: 1, type: "string" },
        legacy: { minimum: 0, type: "number" },
        nested: { minLength: 1, type: "string" },
        tuple: { items: [{ minLength: 1, type: "string" }], type: "array" },
      },
      type: "object",
    })
    expect(parameters).toHaveProperty("$defs")
    expect(normalized).not.toHaveProperty("$defs")
    expect(normalized).not.toHaveProperty("definitions")
  })

  it("preserves reference conjunction and rejects unsafe references deterministically", () => {
    const normalize = (parameters: unknown) => normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])
    const parameters = {
      type: "object",
      $defs: { yes: true, no: false, value: { type: "string" } },
      allOf: [{ $ref: "#/$defs/value" }],
      dependencies: { mode: { $ref: "#/allOf/0" }, names: ["first", "second"] },
      properties: {
        conjunction: { $ref: "#/$defs/value", minLength: 2 },
        yes: { $ref: "#/$defs/yes", type: "string" },
        no: { $ref: "#/$defs/no", type: "string" },
        "$ref": { type: "number" },
        definitions: { type: "boolean" },
      },
    }
    expect(normalize(parameters)[0]!.parameters).toEqual({
      allOf: [{ type: "string" }],
      dependencies: { mode: { type: "string" }, names: ["first", "second"] },
      properties: {
        "$ref": { type: "number" },
        conjunction: { allOf: [{ type: "string" }, { minLength: 2 }] },
        definitions: { type: "boolean" },
        no: false,
        yes: { type: "string" },
      },
      type: "object",
    })
    for (const reference of ["https://example.test/schema", "#name", "#/missing", "#/$defs/~2bad", "#/allOf/00", "#/allOf/-", "#/allOf/1", "#/type"]) {
      expect(() => normalize({ type: "object", allOf: [{ type: "string" }], properties: { value: { $ref: reference } } })).toThrow("PI_TOOL_SCHEMA_REFERENCE_INVALID")
    }
    expect(() => normalize({ type: "object", properties: { value: { $ref: 1 } } })).toThrow("PI_TOOL_SCHEMA_REFERENCE_INVALID")
    expect(() => normalize({ type: "object", $defs: { loop: { $ref: "#/$defs/loop" } }, properties: { value: { $ref: "#/$defs/loop" } } })).toThrow("PI_TOOL_SCHEMA_REFERENCE_CYCLE")
  })

  it("limits reference chains and repeated expanded definitions", () => {
    const chain: Record<string, unknown> = { end: { type: "string" } }
    for (let index = 32; index >= 0; index -= 1) chain[`step${index}`] = { $ref: `#/$defs/${index === 32 ? "end" : `step${index + 1}`}` }
    expect(() => normalizeToolDeclarations([{ name: "chain", description: "A tool", parameters: { type: "object", $defs: chain, properties: { value: { $ref: "#/$defs/step0" } } } }])).toThrow("PI_TOOL_SCHEMA_LIMIT")
    const parameters = (count: number) => ({
      type: "object",
      $defs: { value: { type: "object", properties: { nested: { type: "string" } } } },
      properties: Object.fromEntries(Array.from({ length: count }, (_, index) => [`value${index}`, { $ref: "#/$defs/value" }])),
    })
    expect(normalizeToolDeclarations([{ name: "within", description: "A tool", parameters: parameters(400) }])).toHaveLength(1)
    expect(() => normalizeToolDeclarations([{ name: "over", description: "A tool", parameters: parameters(700) }])).toThrow("PI_TOOL_SCHEMA_LIMIT")
  })

  it("escapes hostile schema-key diagnostic path segments", () => {
    const hostileKey = "line\nPI_TOOL_SCHEMA_INVALID: forged"
    for (const key of [hostileKey, "quote\"bracket]"]) {
      try {
        normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters: { type: "object", properties: { [key]: () => undefined } } }])
      } catch (error) {
        expect(String(error)).toContain(`$.properties[${JSON.stringify(key)}]`)
        expect(String(error)).not.toContain("\n")
        continue
      }
      throw new Error("expected hostile schema key to be rejected")
    }
  })

  it("covers local-reference and exact expansion and aggregate boundaries", () => {
    const normalize = (parameters: unknown) => normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])
    expect(normalize({ type: "object", $defs: { "tilde~name": { type: "string" } }, properties: { value: { $ref: "#/$defs/tilde~0name" } } })[0]!.parameters.properties).toEqual({ value: { type: "string" } })
    for (const parameters of [
      { type: "object", properties: { value: { $ref: "#/%" } } },
      { type: "object", $defs: { a: { $ref: "#/$defs/b" }, b: { $ref: "#/$defs/a" } }, properties: { value: { $ref: "#/$defs/a" } } },
      { type: "object", $defs: { broken: { $ref: "#/%" } }, properties: { value: { type: "string" } } },
    ]) expect(() => normalize(parameters)).toThrow(/PI_TOOL_SCHEMA_(REFERENCE_INVALID|REFERENCE_CYCLE)/)
    const expanded = (count: number) => ({ type: "object", $defs: { value: { allOf: Array.from({ length: count }, () => true) } }, properties: { value: { $ref: "#/$defs/value" } } })
    expect(normalize(expanded(1022))).toHaveLength(1)
    expect(() => normalize(expanded(1023))).toThrow("PI_TOOL_SCHEMA_LIMIT")
    const schema = (padding: number) => ({ type: "object", properties: { value: { type: "string", description: "x".repeat(padding) } } })
    const base = Buffer.byteLength(JSON.stringify(normalize(schema(0))[0]!.parameters))
    const remaining = 1024 * 1024 - base * 4
    const tools = Array.from({ length: 4 }, (_, index) => ({ name: `tool_${index}`, description: "A tool", parameters: schema(Math.floor(remaining / 4) + (index === 3 ? remaining % 4 : 0)) }))
    expect(normalizeToolDeclarations(tools)).toHaveLength(4)
    expect(() => normalizeToolDeclarations([...tools.slice(0, 3), { ...tools[3]!, parameters: schema(Math.floor(remaining / 4) + remaining % 4 + 1) }])).toThrow("PI_TOOL_SCHEMA_LIMIT")
  })
})
