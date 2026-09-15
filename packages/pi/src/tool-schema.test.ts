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
})
