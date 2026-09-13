# Pi Antigravity Guard

`@benjamolina/pi-antigravity-guard` is a static Pi extension that registers the text-only `antigravity-guard` provider. It uses Pi-managed OAuth credentials and the existing Antigravity OAuth endpoint and quota path; it does not provide alternate credential routes, quota pools, fallback, or model substitution.

## Use

Install the package in Pi, then run:

```text
/login antigravity-guard
```

Choose browser login, or choose manual login and paste the complete callback URL. The loopback callback uses fixed port `51121`; browser callback failures, remote shells, and port conflicts can use the manual callback-URL flow.

Start a fresh text-only session with `--no-builtin-tools` and disable any active extension-provided tools. That flag does not disable extension tools by itself. Tools, tool history, and images are unsupported and rejected rather than silently changed.

## Supported static catalog

The provider registers only these evidence-admitted public IDs, in this order. `off` is available for every row even though it is omitted from Pi's level map; omitted reasoning also selects that row's `off` route. Unsupported levels are not advertised and are rejected before transport.

| Public ID | Exposed Pi levels | Context / output |
|---|---|---:|
| `antigravity-gemini-3.8-flash` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.7-flash` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.6-flash` | off, low, medium, high | 1,048,576 / 65,536 |
| `antigravity-gemini-3.1-pro` | off, low, high | 1,048,576 / 65,535 |
| `antigravity-claude-sonnet-4.6` | off, high | 250,000 / 64,000 |
| `antigravity-claude-opus-4.6-thinking` | off, high | 250,000 / 64,000 |
| `antigravity-gpt-oss-120b` | off, medium | 131,072 / 32,768 |

Gemini 3.8 remains compatible with the released mapping: `antigravity-gemini-3.8-flash` sends `gemini-3.8-flash-tiered`; `off` sends native `thinkingLevel: "low"` with hidden thoughts, and `low`, `medium`, and `high` send their matching native level with visible thoughts.

`antigravity-gemini-3.5-flash` is not registered or advertised as supported because its recorded HTTP-200 response lacks the strict terminal metadata required for admission.

## Limits and safety

An explicit `maxTokens` must be a positive integer no greater than the row's output limit. For a route with a positive finite thinking budget, it must also be greater than that budget. When `maxTokens` is omitted, the provider uses 4,096 unless a larger finite thinking budget needs a 1,024-token answer reserve, always bounded by the row's output limit. Custom `thinkingBudgets` are unsupported and rejected.

- Costs are reported as zero because subscription usage is unpriced, not because access is free.
- The catalog is static: it performs no startup or runtime model discovery, catalog synchronization, or dynamic registration.
- It has no account rotation, quota fallback, model substitution, tool support, or image support.

To remove it, disable or uninstall `@benjamolina/pi-antigravity-guard` and reload Pi. Removal does not delete Pi-managed credentials or revoke tokens.
