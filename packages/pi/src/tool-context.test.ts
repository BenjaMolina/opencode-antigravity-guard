import { describe, expect, it } from "vitest"

import { ToolPreflightError } from "./tool-contract.ts"
import { prepareToolContext } from "./tool-context.ts"

const declaration = { name: "read_file", description: "Read one file", parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }

describe("Pi tool request preparation", () => {
  it("retains declaration order and maps omitted, auto, and none choices", () => {
    expect(prepareToolContext([declaration, { ...declaration, name: "list_files" }], undefined)?.mode).toBe("AUTO")
    expect(prepareToolContext([declaration], "auto")?.mode).toBe("AUTO")
    expect(prepareToolContext([declaration], "none")?.mode).toBe("NONE")
  })

  it.each(["required", "read_file", { type: "tool", name: "read_file" }])("rejects forced or named choice %j", (choice) => {
    expect(() => prepareToolContext([declaration], choice)).toThrow(ToolPreflightError)
  })

  it("rejects auto without declarations and preserves no-op none", () => {
    expect(() => prepareToolContext([], "auto")).toThrow("PI_TOOL_CHOICE_WITHOUT_DECLARATIONS")
    expect(prepareToolContext([], "none")).toBeUndefined()
  })
})
