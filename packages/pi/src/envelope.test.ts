import { describe, expect, it } from "vitest"

import { listCatalogEntries } from "./catalog.ts"
import { ANTIGRAVITY_MODEL_ENUM, buildAntigravityEnvelope } from "./envelope.ts"

describe("Antigravity envelope model enum mapping", () => {
  it("registers live-verified placeholders for Gemini 4 families and Gemini 3.5 Flash Lite", () => {
    expect(Object.isFrozen(ANTIGRAVITY_MODEL_ENUM)).toBe(true)
    expect(ANTIGRAVITY_MODEL_ENUM).toMatchObject({
      "gemini-4-argon-low": "MODEL_PLACEHOLDER_M419",
      "gemini-4-argon-medium": "MODEL_PLACEHOLDER_M418",
      "gemini-4-argon-high": "MODEL_PLACEHOLDER_M417",
      "gemini-4-carbon-low": "MODEL_PLACEHOLDER_M438",
      "gemini-4-carbon-medium": "MODEL_PLACEHOLDER_M437",
      "gemini-4-carbon-high": "MODEL_PLACEHOLDER_M427",
      "gemini-4-neon-low": "MODEL_PLACEHOLDER_M534",
      "gemini-4-neon-medium": "MODEL_PLACEHOLDER_M533",
      "gemini-4-neon-high": "MODEL_PLACEHOLDER_M532",
      "gemini-4-neon-xhigh": "MODEL_PLACEHOLDER_M535",
      "gemini-4-hydrogen-low": "MODEL_PLACEHOLDER_M527",
      "gemini-4-hydrogen-medium": "MODEL_PLACEHOLDER_M526",
      "gemini-4-hydrogen-high": "MODEL_PLACEHOLDER_M525",
      "gemini-4-hydrogen-xhigh": "MODEL_PLACEHOLDER_M528",
      "gemini-4-hydrogen-tiered-high": "MODEL_PLACEHOLDER_M530",
      "gemini-4-hydrogen-tiered-xhigh": "MODEL_PLACEHOLDER_M531",
      "gemini-4-hydrogen-sonar": "MODEL_PLACEHOLDER_M578",
      "gemini-3.5-flash-lite": "MODEL_PLACEHOLDER_M198",
    })
  })

  it("maps every catalog route wire model to a verified envelope model_enum", () => {
    for (const entry of listCatalogEntries()) {
      for (const route of Object.values(entry.routes)) {
        if (!route) continue
        const envelope = buildAntigravityEnvelope({
          wireModelId: route.wireModel,
          family: entry.response.family,
          contentsCount: 1,
          messages: [{ role: "user", content: "hello", timestamp: 1 }],
        })
        expect(envelope.labels.model_enum).toBeDefined()
        expect(envelope.labels.model_enum).toBe(ANTIGRAVITY_MODEL_ENUM[route.wireModel])
      }
    }

    const neonXhigh = buildAntigravityEnvelope({
      wireModelId: "gemini-4-neon-xhigh",
      family: "gemini",
      contentsCount: 2,
      messages: [{ role: "user", content: "hello", timestamp: 1 }],
    })
    expect(neonXhigh.labels).toMatchObject({
      last_step_index: "1",
      model_enum: "MODEL_PLACEHOLDER_M535",
      used_claude: "false",
      used_claude_conservative: "false",
      used_non_gemini_model: "false",
    })
  })
})
