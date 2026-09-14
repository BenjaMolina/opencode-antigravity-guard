# Sync Report: add-pi-tool-support

## Status

**PASS — verified delta synced successfully.**

## Scope

- Domain: `pi-provider-adapter`
- Source: `openspec/changes/add-pi-tool-support/specs/pi-provider-adapter/spec.md`
- Destination: `openspec/specs/pi-provider-adapter/spec.md`
- Artifact store: hybrid/OpenSpec; filesystem sync completed before archive.
- Verification evidence revision: `sha256:b8aa0153684fed4bea345979ed5a0ed9ce9ee52d470b06491015f39ab1389133`

## Requirement operations

### ADDED

- Tool capability is admitted per catalog row and route
- Tool declarations and tool choice are explicit
- Tool schemas use bounded immutable normalization
- Tool-call streaming has executable lifecycle semantics
- Tool result replay preserves exact identity and source order
- Orphaned calls receive context-derived failed responses
- Tool outcomes are observable without secret disclosure
- Tool support has mandatory qualification and distribution gates

### MODIFIED

- Exactly one intended Antigravity model is registered
- Text context is serialized and unsupported context is explicit
- Streaming has strict terminal semantics
- Generation policies and response compatibility are discriminated and evidenced
- Expanded catalog scope preserves explicit non-goals
- Deferred capabilities are not silently enabled

The last modification replaces the legacy canonical `## Deferred Capabilities` section with the verified named requirement and preserves its deferred-capability scenario under the canonical Requirements hierarchy.

### REMOVED

None.

## Safety checks

- All pre-existing canonical requirements remain present; no unrelated requirement was removed.
- MODIFIED blocks were replaced in full by exact requirement-name match; no scenario was silently dropped.
- Approximate canonical line impact: 41 lines removed and 222 lines added.
- The parent request explicitly approved syncing this verified delta during archive and instructed continuation unless unrelated canonical requirements would be destructively removed. No such removal occurred.
- No active same-domain change was found other than the selected change itself.
- No implementation code, credentials, runtime configuration, branches, commits, publication, or live calls were changed.
