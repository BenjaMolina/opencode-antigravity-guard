# Evidence: Pi Antigravity Static Catalog

## Scope and handling

This record supports the OpenSpec change `expand-pi-antigravity-model-catalog`. It contains no access token, refresh token, email, project identifier, callback URL, raw thought text, or complete account catalog payload. Account checks used the existing Pi-managed Antigravity OAuth credential and the existing Cloud Code Assist endpoints. All generation probes were bounded, text-only requests with the prompt `Return exactly OK.`

Recorded: 2026-09-12.

## Pinned implementation reference

Reference repository: `Rahularya01/pi-antigravity`

- Commit: `86f76ab08f16784be5bfc281dda9c645651a433b`
- Package version: `0.7.2`
- Relevant implementation: `src/models/models.ts`, `src/models/discovery.ts`, `src/models/grouping.ts`, `src/client/client.ts`, `src/stream/stream.ts`
- Evidence grade: implementation/reference only, not backend authority

The pinned implementation groups display variants into public Pi models, chooses exact runtime IDs per level, and sends integer `thinkingBudget`. Its 3.8 default route uses suffixed runtime IDs, while this project already has independently live-validated compatibility through `gemini-3.8-flash-tiered` plus native string `thinkingLevel`. The released project mapping remains authoritative for this project and is not replaced.

## Authorized account discovery

A redacted `POST /v1internal:fetchAvailableModels` with `{ project }` returned HTTP 200 and 33 model records from each fixed endpoint:

1. `daily-cloudcode-pa.googleapis.com`
2. `daily-cloudcode-pa.sandbox.googleapis.com`
3. `cloudcode-pa.googleapis.com`

All target runtime IDs below were visible through the Antigravity OAuth path on all three endpoints.

| Public target | Discovered runtime IDs | Provider metadata |
| --- | --- | --- |
| Gemini 3.8 Flash | `gemini-3.8-flash-low`, `-medium`, `-high`, `-tiered` | Google / Google Gemini; thinking and images advertised |
| Gemini 3.7 Flash | `gemini-3.7-flash-low`, `-medium`, `-high`, `-tiered` | Google / Google Gemini; thinking and images advertised |
| Gemini 3.6 Flash | `gemini-3.6-flash-low`, `-medium`, `-high`, `-tiered` | Google / Google Gemini; thinking and images advertised |
| Gemini 3.5 Flash | `gemini-3.5-flash-extra-low`, `gemini-3.5-flash-low`, `gemini-3-flash-agent` | Google / Google Gemini; thinking and images advertised |
| Gemini 3.1 Pro | `gemini-3.1-pro-low`, `gemini-3.1-pro-high` | Google / Google Gemini; thinking and images advertised |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | Anthropic / Anthropic Vertex; thinking and images advertised |
| Claude Opus 4.6 Thinking | `claude-opus-4-6-thinking` | Anthropic / Anthropic Vertex; thinking and images advertised |
| GPT-OSS 120B | `gpt-oss-120b-medium` | OpenAI / OpenAI Vertex; thinking advertised |

Discovery proves account visibility only. This change remains static and text-only.

The same authorized discovery response supplied these descriptor limits and advertised default budgets:

| Family | Context tokens | Max output tokens | Advertised budget |
| --- | ---: | ---: | ---: |
| Gemini 3.8/3.7/3.6 Flash | 1,048,576 | 65,536 | runtime variant dependent: `1000`, `4000`, or `-1`; 3.8 tiered advertises `-1` |
| Gemini 3.1 Pro | 1,048,576 | 65,535 | low `1001`; high/agent `10001` |
| Claude Sonnet 4.6 | 250,000 | 64,000 | `1024` |
| Claude Opus 4.6 Thinking | 250,000 | 64,000 | `1024` |
| GPT-OSS 120B | 131,072 | 32,768 | `8192` |

These numeric fields were independently present in the current account response. They resolve a discrepancy with the pinned reference's 200,000-token Sonnet fallback: this static catalog uses the current account's discovered 250,000-token limit.

## Bounded live generation matrix

All successful rows used the daily Antigravity SSE endpoint and returned HTTP 200. `STOP` means the final candidate reported a normal stop. Part shapes list keys only and intentionally omit content.

### Retained Gemini 3.8

The released route remains unchanged:

- public ID: `antigravity-gemini-3.8-flash`
- wire ID: `gemini-3.8-flash-tiered`
- `off`: native `low`, thoughts hidden
- `low`, `medium`, `high`: corresponding native string `thinkingLevel`

The previous authorized matrix and the 0.2.0 live installation established successful `off`, `low`, `medium`, and `high`; `minimal` was rejected twice and remains unavailable.

### New Gemini candidates

| Target / Pi choice | Runtime ID | Sent config | Result | Redacted response evidence |
| --- | --- | --- | --- | --- |
| 3.7 off | `gemini-3.7-flash-low` | budget `0`, thoughts hidden | PASS | `STOP`; modelVersion `gemini-3.7-flash`; text plus signed text; usage present |
| 3.7 low | `gemini-3.7-flash-low` | budget `1000` | PASS | `STOP`; exact text; signed text; usage present |
| 3.7 medium | `gemini-3.7-flash-medium` | budget `4000` | PASS | `STOP`; exact text; signed text; reasoning usage present |
| 3.7 high | `gemini-3.7-flash-high` | budget `-1` | PASS | `STOP`; exact text; signed text; reasoning usage present |
| 3.6 off | `gemini-3.6-flash-low` | omitted thinking config | PASS | `STOP`; modelVersion `gemini-3.6-flash`; exact text; signed text; usage present |
| 3.6 low | `gemini-3.6-flash-low` | budget `1000` | PASS | `STOP`; exact text; signed text; reasoning usage present |
| 3.6 medium | `gemini-3.6-flash-medium` | budget `4000` | PASS | `STOP`; exact text; signed text; reasoning usage present |
| 3.6 high | `gemini-3.6-flash-high` | budget `-1` | PASS | `STOP`; exact text; signed text; reasoning usage present |
| 3.1 Pro off | `gemini-3.1-pro-low` | omitted thinking config | PASS | `STOP`; modelVersion `gemini-3.1-pro-low`; text plus signed text; usage present |
| 3.1 Pro low | `gemini-3.1-pro-low` | budget `1001` | PASS | `STOP`; exact text; signed text; reasoning usage present |
| 3.1 Pro high | `gemini-pro-agent` | budget `10001` | PASS | `STOP`; modelVersion `gemini-pro-default`; exact text; signed text; reasoning usage present |

A `thinkingBudget: 0` request was rejected for 3.6 and 3.1 Pro. Their supported `off` behavior is therefore omission of `thinkingConfig`, not a zero budget.

Gemini 3.5 did not pass the strict response gate. Every discovered runtime ID returned HTTP 200 but produced the same 112-character text-only payload without a normal finish, model version, usage metadata, or requested visible answer, both with the pinned budgets and with omitted thinking config. Raw content was not retained. The candidate remains unregistered.

### Claude and GPT-OSS candidates

| Target / Pi choice | Runtime ID | Sent config | Result | Redacted response evidence |
| --- | --- | --- | --- | --- |
| Sonnet off | `claude-sonnet-4-6` | budget `0`, thoughts hidden | PASS | `STOP`; modelVersion exact; text; usage present |
| Sonnet high | `claude-sonnet-4-6` | budget `1024`, max output above budget | PASS | `STOP`; exact text; thought/text parts and signature observed; usage present |
| Opus off | `claude-opus-4-6-thinking` | budget `0`, thoughts hidden | PASS | `STOP`; modelVersion exact; exact text; usage present |
| Opus high | `claude-opus-4-6-thinking` | budget `1024`, max output above budget | PASS | `STOP`; exact text; thought/text parts and signature observed; usage present |
| GPT-OSS off | `gpt-oss-120b-medium` | omitted thinking config | PASS | `STOP`; modelVersion exact; exact text; thought/text shapes; usage present |
| GPT-OSS medium | `gpt-oss-120b-medium` | budget `8192` | PASS | `STOP`; modelVersion exact; exact text; thought/text shapes; usage present |

Claude high was rejected when `maxOutputTokens` was below the 1024 thinking budget and passed when the output limit was raised above it. Serializer validation must prevent an invalid high/max-output combination or raise the effective request ceiling according to the approved design.

A `thinkingBudget: 0` request was rejected for GPT-OSS; its supported `off` behavior is omission of `thinkingConfig`.

## Admission outcome

| Public target | Evidence outcome |
| --- | --- |
| `antigravity-gemini-3.8-flash` | RETAIN exactly as released |
| `antigravity-gemini-3.7-flash` | Eligible: off/low/medium/high |
| `antigravity-gemini-3.6-flash` | Eligible: off by omission; low/medium/high |
| `antigravity-gemini-3.1-pro` | Eligible: off by omission; low/high |
| `antigravity-claude-sonnet-4.6` | Eligible: off/high, with budget/output validation |
| `antigravity-claude-opus-4.6-thinking` | Eligible: off/high, with budget/output validation |
| `antigravity-gpt-oss-120b` | Eligible: off by omission; medium |
| `antigravity-gemini-3.5-flash` | BLOCKED by strict response gate |

## Remaining implementation fixtures

The redacted observations above define the fixture families that strict TDD must encode without retaining account data or raw thoughts:

1. signed Gemini text with normal usage;
2. Claude interleaved thought/text with signature;
3. GPT-OSS thought/text with its usage shape;
4. Gemini 3.5 abnormal 200-without-terminal metadata as a rejection fixture.

Implementation must not advertise Gemini 3.5 until a later evidence record demonstrates a strict normal terminal response.
