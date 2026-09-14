import { describe, expect, it } from "vitest"

import { assertPiArchiveContents } from "./pack-consumer.ts"

describe("Pi package archive contract", () => {
  it("requires emitted tool runtime modules and excludes repository-only files", () => {
    expect(() => assertPiArchiveContents({
      filename: "pi.tgz",
      files: [
        { path: "LICENSE" },
        { path: "README.md" },
        { path: "package.json" },
        { path: "dist/extension.js" },
        { path: "dist/provider.js" },
      ],
    })).toThrow("dist/catalog.js")
  })

  it("rejects source, fixtures, and compiled tests even when every runtime module exists", () => {
    expect(() => assertPiArchiveContents({
      filename: "pi.tgz",
      files: [
        { path: "src/tool-context.ts" },
        { path: "fixtures/tools/call.sse" },
        { path: "dist/tool-context.test.js" },
        ...["catalog", "context", "extension", "oauth", "provider", "response", "stream", "tool-contract", "tool-context", "tool-schema"].map((name) => ({ path: `dist/${name}.js` })),
      ],
    })).toThrow("source files")
  })

  it("accepts the complete emitted runtime surface without source or test artifacts", () => {
    expect(() => assertPiArchiveContents({
      filename: "pi.tgz",
      files: [
        { path: "LICENSE" },
        { path: "README.md" },
        { path: "package.json" },
        ...["catalog", "context", "extension", "oauth", "provider", "response", "stream", "tool-contract", "tool-context", "tool-schema"].map((name) => ({ path: `dist/${name}.js` })),
      ],
    })).not.toThrow()
  })
})
