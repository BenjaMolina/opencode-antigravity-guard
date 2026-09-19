# Pi Antigravity Guard

`@benjamolina/pi-antigravity-guard` is a static Pi extension that registers the text-only `antigravity-guard` provider. It uses Pi-managed OAuth credentials and the existing Antigravity OAuth endpoint and quota path; it does not provide alternate credential routes, quota pools, fallback, or model substitution.

## Use

Install the package in Pi, then run:

```text
/login antigravity-guard
```

Choose browser login, or choose manual login and paste the complete callback URL. The loopback callback uses fixed port `51121`; browser callback failures, remote shells, and port conflicts can use the manual callback-URL flow.

## Text registration is not tool enablement

All seven rows below are registered for text. The exact `antigravity-gemini-3.8-flash` `off` route is enabled for tools from recorded direct evidence; every other production route is **not enabled for tools**, so its context with a declaration, assistant tool call, or tool result fails locally before any network request. Text-only requests retain their released behavior.

| Public ID | Exposed Pi levels | Tool state | Admission |
|---|---|---|---|
| `antigravity-gemini-3.8-flash` | off, low, medium, high | Enabled (off, low, medium, high) | pi-json-tool-loop/gemini-3.8-flash-off-v1 |
| `antigravity-gemini-3.7-flash` | off, low, medium, high | Disabled | missing-direct-evidence |
| `antigravity-gemini-3.6-flash` | off, low, medium, high | Disabled | missing-direct-evidence |
| `antigravity-gemini-3.1-pro` | off, low, high | Disabled | missing-direct-evidence |
| `antigravity-claude-sonnet-4.6` | off, high | Disabled | claude-continuity-unproven |
| `antigravity-claude-opus-4.6-thinking` | off, high | Disabled | claude-continuity-unproven |
| `antigravity-gpt-oss-120b` | off, medium | Disabled | missing-direct-evidence |

`off` is available for every row even though it is omitted from Pi's level map; omitted reasoning also selects that row's `off` route. Unsupported levels are not advertised and are rejected before transport. `antigravity-gemini-3.5-flash` is not registered or advertised as supported because its recorded HTTP-200 response lacks the strict terminal metadata required for admission. A future `fixture-qualified` route remains disabled for ordinary tool use; only separately authorized direct validation for the exact route may make it enabled.

Claude Sonnet and Claude Opus remain disabled until declaration, call, result replay, thinking-signature, resume, interruption, and continuation evidence is recorded for each exact route. Only Gemini 3.8 Flash `off` is enabled by this package release.

## Opt-in direct tool-loop validation

Maintainers can run `npm run build:pi` followed by `npx tsx scripts/pi-tool-loop-probe.ts --live --expect-enabled` to verify the directly admitted Gemini 3.8 Flash `off` route. The isolated runner invokes Pi in `--mode json`, passes the deterministic non-terminating `pi_evidence_echo` prompt positionally, drains its event stream, and completes after Pi emits `agent_end` and the child exits. It stores only the passing route and sanitized assertions; it never stores message contents, tool details, names, IDs, arguments, credentials, headers, or raw provider output. Other routes remain fail-closed.

## Tool preflight boundaries

Tool-bearing requests are never silently downgraded to text. When an exact route is eventually enabled, declarations are retained in order and omitted or `auto` choice serializes as `AUTO`; explicit `none` serializes as `NONE`. Forced, required, named, unknown, and constrained-sampling choices are rejected before transport.

Only the evidence-enabled Gemini 3.8 Flash `off` route uses the `parametersJsonSchema` profile. Its hermetically verified preflight preserves ordinary JSON Schema constraints and JSON values in canonical immutable output, including safe local RFC 6901 `$ref` expansion (`#` and `#/...`) with resolved definitions removed. External, malformed, unresolved, cyclic, or otherwise unsafe references fail closed before transport. This is local serialization and safety evidence, not direct live backend acceptance of constrained or reference-based schemas. Tool results must match the exact call ID and name, remain text-only, and are replayed in assistant source-call order; image-bearing or ambiguous results are rejected. A missing persisted result uses the documented failed response only during context reconstruction.

## Text catalog limits and safety

| Public ID | Exposed Pi levels | Context / output |
|---|---|---:|
| `antigravity-gemini-3.8-flash` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.7-flash` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.6-flash` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.1-pro` | off, low, high | 1,048,576 / 65,535 |
| `antigravity-claude-sonnet-4.6` | off, high | 250,000 / 64,000 |
| `antigravity-claude-opus-4.6-thinking` | off, high | 250,000 / 64,000 |
| `antigravity-gpt-oss-120b` | off, medium | 131,072 / 32,768 |

An explicit `maxTokens` must be a positive integer no greater than the row's output limit. For a route with a positive finite thinking budget, it must also be greater than that budget. When `maxTokens` is omitted, the provider uses 4,096 unless a larger finite thinking budget needs a 1,024-token answer reserve, always bounded by the row's output limit. Custom `thinkingBudgets` are unsupported and rejected.

- Costs are reported as zero because subscription usage is unpriced, not because access is free.
- The catalog is static: it performs no startup or runtime model discovery, catalog synchronization, or dynamic registration.
- It has no account rotation, quota fallback, model substitution, image support, or enabled tools beyond the directly admitted Gemini 3.8 Flash `off` route.

To remove it, disable or uninstall `@benjamolina/pi-antigravity-guard` and reload Pi. Removal does not delete Pi-managed credentials or revoke tokens.
