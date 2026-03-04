# 1-Apps Deprecation Plan (Unified 1 App Architecture)

Date: 2026-03-01
Status: Proposed (no destructive actions executed)
Golden Repo: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Universal`
Runtime Engine: `/Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1D-Opta-CLI-TS`

## Objective
Remove legacy overlap between web/desktop/client repos and enforce one universal app path built on Tauri + React/Vite.

## Folder Classification

### Keep (Canonical)
- `optalocal/1P-Opta-Code-Universal`
- `optalocal/1D-Opta-CLI-TS`
- `optalocal/1M-Opta-LMX`
- `optalocal/1R-Opta-Accounts`
- `optalocal/1S-Opta-Status`
- `optalocal/1T-Opta-Home`
- `optalocal/1U-Opta-Help`
- `shared/*` domain libraries/specs

### Deprecate (Alias/Redundant/Broken)
- `1P-Opta-Code-Desktop` (broken alias/symlink)
- `1D-Opta-Codex-App` (alias duplicate of CLI path)
- `1P-Opta-Accounts` (alias duplicate of `1R-Opta-Accounts`)
- `1L-Opta-Local` (retired/broken)

### Review Then Decide
- `1Q-Opta-Other` (mixed sandbox/utilities; split useful utilities or archive whole)
- `optamize/1J-Optamize-MacOS` (Tauri desktop overlap; retain only if product-distinct)

## Safety Gates Before Archival/Deletion
1. Confirm no production build/deploy scripts reference deprecated paths.
2. Confirm no CI workflows reference deprecated paths.
3. Confirm PATH-CONTRACT + README canonical references are current.
4. Snapshot metadata (`ls -la`, `readlink`, git status) before any destructive action.
5. Move first to `_archived/` instead of hard delete.

## Execution Plan (Post-Approval)
1. Create archival target directories under `_archived/2026-03-01-unified-cutover/`.
2. Move deprecated paths into archive directory.
3. Replace with explicit README pointers (optional) for short-term discoverability.
4. Re-run workspace-wide grep for stale path references.
5. Final pass: typecheck/test/build in golden repo and CLI engine.

## Suggested Commands (Do Not Run Until Approved)
```bash
mkdir -p /Users/matthewbyrden/Synced/Opta/1-Apps/_archived/2026-03-01-unified-cutover
mv /Users/matthewbyrden/Synced/Opta/1-Apps/1P-Opta-Code-Desktop /Users/matthewbyrden/Synced/Opta/1-Apps/_archived/2026-03-01-unified-cutover/ 2>/dev/null || true
mv /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-Codex-App /Users/matthewbyrden/Synced/Opta/1-Apps/_archived/2026-03-01-unified-cutover/ 2>/dev/null || true
mv /Users/matthewbyrden/Synced/Opta/1-Apps/1P-Opta-Accounts /Users/matthewbyrden/Synced/Opta/1-Apps/_archived/2026-03-01-unified-cutover/ 2>/dev/null || true
mv /Users/matthewbyrden/Synced/Opta/1-Apps/1L-Opta-Local /Users/matthewbyrden/Synced/Opta/1-Apps/_archived/2026-03-01-unified-cutover/ 2>/dev/null || true
```

## Rollback Plan
- Move archived directories back to original names/locations.
- Re-point symlinks only if required by legacy automation.

## Rename State
- Rename objective already satisfied in canonical pathing:
  - active canonical UI repo is `1P-Opta-Code-Universal`
  - legacy `1P-Opta-Code-Desktop` is treated as deprecated alias
