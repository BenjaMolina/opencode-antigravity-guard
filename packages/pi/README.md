# Pi Antigravity Guard

`@benjamolina/pi-antigravity-guard` is a Pi extension that registers the text-only `antigravity-guard` provider. It exposes exactly one selectable model, `antigravity-gemini-3.8-flash`, which is sent to Antigravity as `gemini-3.8-flash-tiered`.

## Use

Install the package in Pi, then run:

```text
/login antigravity-guard
```

Choose browser login, or choose manual login and paste the complete callback URL. The loopback callback uses fixed port `51121`; browser callback failures, remote shells, and port conflicts can use the manual callback-URL flow.

Start a fresh text-only session with `--no-builtin-tools` and disable any active extension-provided tools. That flag does not disable extension tools by itself. Tools, tool history, and images are unsupported and rejected rather than silently changed.

`@benjamolina/pi-antigravity-guard@0.2.0` supports Pi reasoning levels `low`, `medium`, and `high`. An authorized live matrix against `gemini-3.8-flash-tiered` confirmed all three levels; `minimal` was rejected twice with zero usage and is not exposed. Each supported level is sent as the matching native `thinkingLevel` with visible thoughts enabled. When reasoning is off or omitted, the request uses native `low` thinking without returning visible thoughts. Custom `thinkingBudgets` are unsupported and rejected.

## Limits and safety

- This provider stores credentials through Pi's OAuth lifecycle and never reads or changes OpenCode account files; each is independent.
- Costs are reported as zero because subscription usage is unpriced, not because access is free.
- The public-to-wire model mapping remains separate from availability and entitlement. The documented reasoning levels are limited to the authorized live matrix results above.
- It has no account rotation, quota fallback, model substitution, or tool support.

To remove it, disable or uninstall `@benjamolina/pi-antigravity-guard` and reload Pi. Removal does not delete Pi-managed credentials or revoke tokens.
