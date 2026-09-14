# Pre-Proposal Gate: Add Pi Tool Support

## Status

Product decisions were confirmed by the user. `sdd-proposal` may proceed.

## Confirmed intent

- Normal `pi` sessions with active tools must work without silently stripping tool context.
- Preserve the published seven-model static catalog and current no-tool behavior.
- Implement declarations, streamed calls, result replay, multi-turn reconstruction, and interruption handling.
- Keep images, dynamic catalog discovery, rotation, quota fallback, and model substitution outside the change unless explicitly admitted below.

## Research selection

Optional external research was offered by exploration but is not selected. The current SDD runtime declares no evidence grants, so selecting it would fail closed and block proposal. The change may use repository evidence, installed Pi documentation, hermetic fixtures, and separately authorized live verification during apply/verify without claiming external research completion.

## Confirmed grouped decisions

1. **Staged capability rollout:** preserve all seven text routes, but advertise and enable tools per family/model only after hermetic fixtures and direct validation establish support.
2. **Bounded deterministic schema normalization:** preserve intent with documented transformations and reject schemas whose fidelity cannot be guaranteed. Support `auto` and `none`; forced/required tool selection remains unsupported.
3. **Deterministic interruption recovery:** synthesize an explicit cancelled/failed `functionResponse` on the next turn for a persisted orphan call. Image-bearing tool results remain rejected in this first scope.
4. **Legacy provider registration with Claude fail-closed:** retain the current `registerProvider` architecture. Claude tool capability remains disabled until evidence establishes safe tool/signature continuity; no durable per-session signature store is introduced.

## Constraints

- Silent tool declaration removal is forbidden.
- Call IDs and names must not be heuristically reassigned.
- Strict TDD remains mandatory.
- Delivery strategy is `ask-on-risk` with a 400 changed-line review budget.
