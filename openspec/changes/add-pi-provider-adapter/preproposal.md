# Pre-Proposal State: Add Pi Provider Adapter

## Status

Product decisions confirmed. Research is unselected and does not block proposal readiness.

## Confirmed

- One repository will support OpenCode and Pi through a shared framework-neutral core and separate host adapters.
- The first milestone is a vertical slice: preserve OpenCode behavior and provide Pi OAuth plus one functional text-streaming Antigravity model.
- The Pi package name is `@benjamolina/pi-antigravity-guard`.
- Multi-account rotation, quota gating, tools, Claude, images, dynamic discovery, and recovery are follow-on work.
- Delivery strategy is `ask-on-risk` with a 400 changed-line review budget.

## Confirmed pre-proposal decisions

1. Preserve the current OpenCode package at the repository root and add npm workspaces for `packages/core` and `packages/pi`.
2. Use Gemini 3.8 Flash as the first Pi vertical-slice model.
3. Provide automatic loopback OAuth callback handling with a manual callback-URL fallback for SSH/headless environments.

The proposal phase is ready.
