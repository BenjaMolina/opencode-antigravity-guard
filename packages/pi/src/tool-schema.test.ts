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
            format: { type: "string", enum: ["text"] },
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

  it.each([
    ["primitive declaration root", { type: "string" }, "$.type"],
    ["unknown keyword", { type: "object", properties: { value: { type: "string", minLength: 1 } } }, "$.properties.value.minLength"],
    ["union", { type: ["string", "null"] }, "$.type"],
    ["empty object", { type: "object", properties: {} }, "$.properties"],
    ["invalid enum", { type: "object", properties: { value: { type: "string", enum: ["ok", 1] } } }, "$.properties.value.enum[1]"],
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

  it("rejects duplicate declarations and hostile runtime values", () => {
    const getter = Object.create(null, { type: { get: () => { throw new Error("CANARY") } } })
    const sparse = [] as unknown[]
    sparse[1] = "value"
    const symbol = { type: "object", properties: { value: { type: "string" } }, [Symbol("x")]: true }
    const cycle: { type: string; properties: Record<string, unknown> } = { type: "object", properties: {} }
    cycle.properties.self = cycle
    for (const parameters of [getter, { type: "object", properties: { value: { type: "number", enum: [Number.NaN] } } }, { type: "object", properties: { value: { type: "string", enum: sparse } } }, symbol, cycle]) {
      expect(() => normalizeToolDeclarations([{ name: "tool", description: "A tool", parameters }])).toThrow(/PI_TOOL_SCHEMA/)
    }
    expect(() => normalizeToolDeclarations([
      { name: "tool", description: "A tool", parameters: { type: "object", properties: { value: { type: "string" } } } },
      { name: "tool", description: "Another tool", parameters: { type: "object", properties: { value: { type: "string" } } } },
    ])).toThrow(/PI_TOOL_DECLARATION_DUPLICATE/)
  })
})
