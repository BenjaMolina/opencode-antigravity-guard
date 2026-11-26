import type { Context, Model, SimpleStreamOptions, Tool } from "@earendil-works/pi-ai"
import { describe, expect, it } from "vitest"
import { getCatalogEntry, listCatalogEntries, resolveGenerationRoute } from "./catalog.ts"
import { sanitizeAntigravitySystemPrompt, serializeContext } from "./context.ts"
import { ANTIGRAVITY_MODEL_ENUM } from "./envelope.ts"

describe("S4 Pi Gemini 4 catalog, xhigh boundaries, envelope placeholders, and prompt sanitization probes", () => {
  it("supports xhigh + 262144 maxTokens on Neon/Hydrogen and rejects xhigh on Argon/Carbon/3.8-flash/3.5-flash-lite", () => {
    expect(listCatalogEntries()).toHaveLength(17)
    expect(resolveGenerationRoute(getCatalogEntry("antigravity-gemini-4-neon")!, "xhigh").wireModel).toBe(
      "gemini-4-neon-xhigh",
    )
    expect(resolveGenerationRoute(getCatalogEntry("antigravity-gemini-4-hydrogen")!, "xhigh").wireModel).toBe(
      "gemini-4-hydrogen-xhigh",
    )
    for (const id of [
      "antigravity-gemini-4-argon",
      "antigravity-gemini-4-carbon",
      "antigravity-gemini-3.8-flash",
      "antigravity-gemini-3.5-flash-lite",
    ]) {
      expect(() => resolveGenerationRoute(getCatalogEntry(id)!, "xhigh")).toThrow("Unsupported reasoning level")
    }
    expect(ANTIGRAVITY_MODEL_ENUM["gemini-4-neon-xhigh"]).toBe("MODEL_PLACEHOLDER_M535")
    expect(ANTIGRAVITY_MODEL_ENUM["gemini-4-hydrogen-tiered-xhigh"]).toBe("MODEL_PLACEHOLDER_M531")
    expect(ANTIGRAVITY_MODEL_ENUM["gemini-4-hydrogen-sonar"]).toBe("MODEL_PLACEHOLDER_M578")
    expect(ANTIGRAVITY_MODEL_ENUM["gemini-3.5-flash-lite"]).toBe("MODEL_PLACEHOLDER_M198")
  })

  it("is idempotent on Pi harness prompts and leaves non-Pi prompts untouched across text and tool paths", () => {
    const piPrompt = [
      "You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files.",
      "",
      "Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):",
      "- Main documentation: C:\\node_modules\\@mariozechner\\pi-coding-agent\\README.md",
      "- Additional docs: C:\\node_modules\\@mariozechner\\pi-coding-agent\\docs",
      "- Examples: C:\\node_modules\\@mariozechner\\pi-coding-agent\\examples (extensions, custom tools, SDK)",
      "- When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), pi packages (docs/packages.md)",
      "- When working on pi topics, read the docs and examples, and follow .md cross-references before implementing",
      "- Always read pi .md files completely and follow links to related docs (e.g., tui.md for TUI API details)",
      "<docs>C:\\opt\\pi\\README.md</docs>",
      "",
      "# Project Context",
      "Project-specific instructions and guidelines:",
    ].join("\n")
    const once = sanitizeAntigravitySystemPrompt(piPrompt)
    expect(sanitizeAntigravitySystemPrompt(once)).toBe(once)
    expect(once).not.toContain("operating inside pi, a coding agent harness")
    expect(once).not.toContain("When working on pi topics")
    expect(once).toContain("C:\\node_modules\\@mariozechner\\pi-coding-agent\\README.md")
    expect(once).toContain("# Project Context")

    const toolContext: Context = {
      systemPrompt: piPrompt,
      tools: [{ name: "ping", description: "Ping", parameters: { type: "object", properties: {} } as unknown as Tool["parameters"] }],
      messages: [{ role: "user", content: "hello", timestamp: 1 }],
    }
    const serialized = serializeContext({
      context: toolContext,
      model: { id: "antigravity-gemini-4-neon" } as Model<string>,
      options: { reasoning: "xhigh" as SimpleStreamOptions["reasoning"], maxTokens: 262_144 },
      project: "proj-1",
      requestId: "req-1",
    })
    expect(serialized.model).toBe("gemini-4-neon-xhigh")
    expect(serialized.request.generationConfig.maxOutputTokens).toBe(262_144)
    expect(serialized.request.labels?.model_enum).toBe("MODEL_PLACEHOLDER_M535")
    expect(JSON.stringify(serialized.request.systemInstruction)).not.toContain(
      "operating inside pi, a coding agent harness",
    )
    expect(toolContext.systemPrompt).toBe(piPrompt)
  })
})
