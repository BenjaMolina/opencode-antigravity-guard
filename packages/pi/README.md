# Pi Antigravity Guard

`@benjamolina/pi-antigravity-guard` is the Pi extension for Antigravity Guard (`antigravity-guard`), powered by `@benjamolina/antigravity-guard-core`. It shares the exact runtime protections and credentials pool used by `@benjamolina/opencode-antigravity-guard`:

- **Shared Multi-Account Pool & Cascade Fallback**: Resolves `antigravity-accounts.json` (`AccountStorageV4` with lockfile coordination) and `antigravity.json` across `OPENCODE_CONFIG_DIR`, `~/.config/opencode`, and `~/.pi/agent` (with non-destructive standalone `auth.json` fallback), supporting `hybrid`, `sticky`, and `round-robin` rotation.
- **Strict Quota Guard & Endpoint Failover**: Enforces soft-quota thresholds with strict reset-time locking, `daily -> autopush -> prod` pre-stream endpoint failover, and `RetryInfo`-aware `429/503/529` backoff retries.
- **Permissive Tool Schemas & Signature Continuity**: Normalizes rich JSON Schemas (`$ref`, `anyOf`/`oneOf`/`allOf`, `const`, constraints, empty-object placeholders) and persists thinking signatures via `SignatureCache` with `skip_thought_signature_validator` recovery.
- **Multimodal Inputs & Grounded Search**: Supports images (`image/*`) and PDF documents (`application/pdf`) on Gemini and Claude models, registers the `google_search` grounding tool, auto-injects native Google Search grounding on `-sonar` text turns, and supports opt-in dynamic `model_discovery`.

## Use

Install the package in Pi, then authenticate or inspect your pool:

```text
/login antigravity-guard
/antigravity-accounts
/antigravity-quota
```

Choose browser login, or choose manual login and paste the complete callback URL. The loopback callback uses fixed port `51121`; browser callback failures, remote shells, and port conflicts can use the manual callback-URL flow.

## Catalog and tool admission

All seventeen static catalog rows below are registered with verified routes and tool schemas:

| Public ID | Exposed Pi levels | Tool state | Admission |
|---|---|---|---|
| `antigravity-gemini-3.8-flash` | off, low, medium, high | Enabled (off, low, medium, high) | pi-json-tool-loop/gemini-3.8-flash-off-v1 |
| `antigravity-gemini-3.8-flash-tiered` | off, low, medium, high | Enabled (off, low, medium, high) | pi-json-tool-loop/gemini-3.8-flash-tiered-off-v1 |
| `antigravity-gemini-3.7-flash` | off, low, medium, high | Enabled (off, low, medium, high) | pi-json-tool-loop/gemini-3.7-flash-off-v1 |
| `antigravity-gemini-3.7-flash-tiered` | off, low, medium, high | Enabled (off, low, medium, high) | pi-json-tool-loop/gemini-3.7-flash-tiered-off-v1 |
| `antigravity-gemini-3.6-flash` | off, low, medium, high | Enabled (off, low, medium, high) | pi-json-tool-loop/gemini-3.6-flash-off-v1 |
| `antigravity-gemini-3.6-flash-tiered` | off, low, medium, high | Enabled (off, low, medium, high) | pi-json-tool-loop/gemini-3.6-flash-tiered-off-v1 |
| `antigravity-gemini-3.1-pro` | off, low, high | Enabled (off, low, high) | pi-json-tool-loop/gemini-3.1-pro-off-v1 |
| `antigravity-claude-sonnet-4.6` | off, high | Enabled (off, high) | pi-json-tool-loop/claude-sonnet-4.6-off-v1 |
| `antigravity-claude-opus-4.6-thinking` | off, high | Enabled (off, high) | pi-json-tool-loop/claude-opus-4.6-thinking-off-v1 |
| `antigravity-gpt-oss-120b` | off, medium | Enabled (off, medium) | pi-json-tool-loop/gpt-oss-120b-off-v1 |
| `antigravity-gemini-4-argon` | off, low, medium, high | Enabled (off, low, medium, high) | pi-json-tool-loop/gemini-4-argon-off-v1 |
| `antigravity-gemini-4-carbon` | off, low, medium, high | Enabled (off, low, medium, high) | pi-json-tool-loop/gemini-4-carbon-off-v1 |
| `antigravity-gemini-4-neon` | off, low, medium, high, xhigh | Enabled (off, low, medium, high, xhigh) | pi-json-tool-loop/gemini-4-neon-off-v1 |
| `antigravity-gemini-4-hydrogen` | off, low, medium, high, xhigh | Enabled (off, low, medium, high, xhigh) | pi-json-tool-loop/gemini-4-hydrogen-off-v1 |
| `antigravity-gemini-4-hydrogen-tiered` | off, high, xhigh | Enabled (off, high, xhigh) | pi-json-tool-loop/gemini-4-hydrogen-tiered-off-v1 |
| `antigravity-gemini-4-hydrogen-sonar` | off, high | Enabled (off, high) | pi-json-tool-loop/gemini-4-hydrogen-sonar-off-v1 |
| `antigravity-gemini-3.5-flash-lite` | off, low | Enabled (off, low) | pi-json-tool-loop/gemini-3.5-flash-lite-off-v1 |

`off` is available for every row even though it is omitted from Pi's level map; omitted reasoning also selects that row's `off` route. Unsupported levels are not advertised and are rejected before transport. `antigravity-gemini-3.5-flash` is not registered or advertised as supported because its recorded HTTP-200 response lacks the strict terminal metadata required for admission. A future `fixture-qualified` route remains disabled for ordinary tool use; only separately authorized direct validation for the exact route may make it enabled.

## Opt-in direct tool-loop validation

Maintainers can run `npm run build:pi` followed by `npx tsx scripts/pi-tool-loop-probe.ts --live --expect-enabled` to verify the directly admitted Gemini 3.8 Flash `off` route. The isolated runner invokes Pi in `--mode json`, passes the deterministic non-terminating `pi_evidence_echo` prompt positionally, drains its event stream, and completes after Pi emits `agent_end` and the child exits. It stores only the passing route and sanitized assertions; it never stores message contents, tool details, names, IDs, arguments, credentials, headers, or raw provider output.

## Tool preflight, multimodal, and grounding boundaries

Tool-bearing requests are never silently downgraded to text. Declarations are retained in order and omitted or `auto` choice serializes as `AUTO`; explicit `none` serializes as `NONE`. Forced, required, named, unknown, and constrained-sampling choices are rejected before transport.

Gemini routes use the `parametersJsonSchema` profile while Claude and GPT-OSS routes use `claude-custom-parameters`, backed by the shared permissive Antigravity JSON Schema cleaner (resolving local RFC 6901 `#` / `#/...` `$ref` pointers while failing closed on external, cyclic, or unresolved references). Tool results must match the exact call ID and name and are replayed in assistant source-call order; Gemini and Claude routes accept `text`, `image/*`, and `application/pdf` parts (`image`, `document`, or `file` blocks with base64/data-URI payloads), whereas `antigravity-gpt-oss-120b` remains text-only.

For live web grounding alongside function declarations, invoke the registered `google_search` tool (which runs a dedicated grounded `v1internal:generateContent` request with `googleSearch` + `urlContext` across the shared account pool and endpoint fallback chain). On `antigravity-gemini-4-hydrogen-sonar` turns without function declarations (and `toolChoice !== "none"`), `{ googleSearch: {} }` is injected automatically and response `groundingMetadata` / `urlContextMetadata` citations are appended to the assistant output.

## Catalog limits and dynamic discovery

| Public ID | Exposed Pi levels | Context / output |
|---|---|---:|
| `antigravity-gemini-3.8-flash` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.8-flash-tiered` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.7-flash` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.7-flash-tiered` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.6-flash` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.6-flash-tiered` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.1-pro` | off, low, high | 1,048,576 / 65,535 |
| `antigravity-claude-sonnet-4.6` | off, high | 250,000 / 64,000 |
| `antigravity-claude-opus-4.6-thinking` | off, high | 250,000 / 64,000 |
| `antigravity-gpt-oss-120b` | off, medium | 131,072 / 32,768 |
| `antigravity-gemini-4-argon` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-4-carbon` | off, low, medium, high | 1,048,576 / 262,144 |
| `antigravity-gemini-4-neon` | off, low, medium, high, xhigh | 1,048,576 / 262,144 |
| `antigravity-gemini-4-hydrogen` | off, low, medium, high, xhigh | 1,048,576 / 262,144 |
| `antigravity-gemini-4-hydrogen-tiered` | off, high, xhigh | 1,048,576 / 262,144 |
| `antigravity-gemini-4-hydrogen-sonar` | off, high | 1,048,576 / 262,144 |
| `antigravity-gemini-3.5-flash-lite` | off, low | 1,048,576 / 65,535 |

An explicit `maxTokens` must be a positive integer no greater than the row's output limit. For a route with a positive finite thinking budget, it must also be greater than that budget. When `maxTokens` is omitted, the provider uses 4,096 unless a larger finite thinking budget needs a 1,024-token answer reserve, always bounded by the row's output limit. Custom `thinkingBudgets` are unsupported and rejected.

- Costs are reported as zero because subscription usage is unpriced, not because access is free.
- Dynamic model discovery via `ProviderConfig.refreshModels` is opt-in in Pi (`"model_discovery": { "enabled": true, "antigravity": true }` in `antigravity.json`), falling back cleanly to the static catalog when disabled, offline (`PI_OFFLINE=1`), or unreachable.

To remove it, disable or uninstall `@benjamolina/pi-antigravity-guard` and reload Pi. Removal does not delete shared or Pi-managed credentials or revoke tokens.
