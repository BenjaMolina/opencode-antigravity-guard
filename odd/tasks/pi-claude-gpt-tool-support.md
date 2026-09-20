# ODD Feature: Tool support for Claude and GPT-OSS in Pi

## Objective
Enable tool capability for Claude Sonnet 4.6, Claude Opus 4.6 Thinking, and GPT-OSS 120B in @benjamolina/pi-antigravity-guard using the Cloud Code Assist custom-tools schema bridge (parameters field) and same-public-model function calling replay.

## Tasks
- [x] Task 1: Add custom-parameters schema profile in catalog.ts, 	ool-schema.ts, 	ool-context.ts, and context.ts.
- [x] Task 2: Enable tools on Claude Sonnet 4.6, Claude Opus 4.6, and GPT-OSS 120B in catalog.ts with matching evidence records.
- [x] Task 3: Update test coverage across catalog, context, tool-schema, provider, and stream test suites.
- [ ] Task 4: Verify full test suite, typechecks, open PR with approved issue, and release package.
