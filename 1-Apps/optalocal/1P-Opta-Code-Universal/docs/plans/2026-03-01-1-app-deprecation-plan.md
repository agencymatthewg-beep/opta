# 1-App Deprecation and Rename Plan (Executed 2026-03-01)

## Execution Status
Executed after explicit approval.
- Created backup archive: `/tmp/opta-1L-Opta-Local-backup-20260301.tgz`
- Archived duplicate app repo: `optalocal/1L-Opta-Local` -> `_archived/2026-03-01-1L-Opta-Local`
- Permanently deleted archived duplicate: `_archived/2026-03-01-1L-Opta-Local`
- Renamed golden repo: `optalocal/1P-Opta-Code-Desktop` -> `optalocal/1P-Opta-Code-Universal`

## Target Architecture
- Canonical repo: `optalocal/1P-Opta-Code-Universal`
- Canonical runtime model:
  - `src/` = shared universal frontend (web + native)
  - `src-tauri/` = native shell for desktop permissions and OS integration

## Deprecation Candidates

### Primary duplicate app candidate
1. `optalocal/1L-Opta-Local`
- Reason: overlaps with app-client UX concerns now consolidated in the Tauri universal app.

### Legacy archive candidate (already archived)
2. `_archived/2026-02-28-opta-codex-legacy/*`
- Reason: historical codex app material; not an active runtime target.

### Not deprecating in this plan
- `optalocal/1D-Opta-CLI-TS` (daemon/CLI dependency for universal app)
- `optalocal/1O`, `1R`, `1S`, `1T`, `1U`, `1V` (separate web properties)

## Safe Execution Sequence

1. Freeze and verify
- Run in Golden Repo:
  - `npm run check:desktop`
  - `npm run dev` (web mode)
  - `npm run tauri dev` or `npm run dev:native` (native mode)

2. Snapshot before deprecation
- Create backup archive:
  - `tar -czf /tmp/opta-1L-Opta-Local-backup-$(date +%Y%m%d).tgz /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1L-Opta-Local`

3. Soft archive (recommended first step)
- Move duplicate repo into local archive namespace:
  - `mv /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1L-Opta-Local /Users/matthewbyrden/Synced/Opta/1-Apps/_archived/$(date +%Y-%m-%d)-1L-Opta-Local`

4. Hard delete (optional, only if explicitly approved)
- Remove archived duplicate after cooling period:
  - `rm -rf /Users/matthewbyrden/Synced/Opta/1-Apps/_archived/<archived-1L-folder>`

5. Rename Golden Repo
- Rename folder to reflect final universal architecture:
  - `mv /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Desktop /Users/matthewbyrden/Synced/Opta/1-Apps/optalocal/1P-Opta-Code-Universal`

6. Post-rename fixups
- Update path references in scripts, docs, CI workflow paths, and local symlinks.
- Re-run:
  - `npm run check:desktop`

## Remaining Approval Gate
- Optional backup removal: `/tmp/opta-1L-Opta-Local-backup-20260301.tgz`
