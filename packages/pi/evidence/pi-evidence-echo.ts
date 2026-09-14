import { Type } from "@earendil-works/pi-ai"
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

const ECHO_VALUE = "gemini-tool-loop"

export default function extension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "pi_evidence_echo",
    label: "Pi evidence echo",
    description: "Return the fixed Pi tool-loop evidence value. Call only with value gemini-tool-loop.",
    parameters: Type.Object({
      value: Type.String(),
    }),
    async execute(_toolCallId, params, signal) {
      signal?.throwIfAborted()
      if (params.value !== ECHO_VALUE) throw new Error("pi_evidence_echo requires the fixed evidence value.")
      return {
        content: [{ type: "text", text: "PI_EVIDENCE_ECHO_OK" }],
        details: { value: ECHO_VALUE },
        terminate: false,
      }
    },
  })
}
