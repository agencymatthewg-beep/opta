# Auto-05: Undo / Rollback System

**Priority:** HIGH (gap score 3) | **Effort:** ~150 lines | **New module**
**Competitors with this:** OpenCode (/undo — best in class), Aider (git-based undo)

**Launch:** `cd /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS && claude --dangerously-skip-permissions`
**Paste:** `Proceed with the plan located at: /Users/matthewbyrden/Synced/Opta/1-Apps/1D-Opta-CLI-TS/tasks/plans/auto-05-undo-rollback.md`

---

<context>
Read these files first:
1. `CLAUDE.md` — Architecture guide
2. `src/core/tools.ts` — File write/edit tools (need to capture snapshots before changes)
3. `src/commands/chat.ts` — Slash commands (add /undo)
4. `docs/plans/2026-02-15-v2-features-design.md` — V2 git checkpoint design (this is a lighter precursor)
</context>

<instructions>
### 1. Create `src/history/snapshots.ts` (~80 lines)

In-memory file snapshot system:

```typescript
interface FileSnapshot {
  path: string;
  content: string;       // Original content before edit
  timestamp: number;
}

interface CheckpointGroup {
  id: string;            // nanoid
  label: string;         // "write_file: src/utils.ts" or "multi_edit: 3 files"
  snapshots: FileSnapshot[];
  timestamp: number;
}

class SnapshotManager {
  private checkpoints: CheckpointGroup[] = [];  // Stack (most recent last)
  private maxCheckpoints = 20;

  // Call BEFORE any file modification
  captureSnapshot(paths: string[]): string  // Returns checkpoint ID

  // Undo the most recent checkpoint
  undo(): { restored: string[]; label: string } | null

  // List recent checkpoints
  list(): { id: string; label: string; files: number; ago: string }[]

  // Clear all checkpoints
  clear(): void
}
```

### 2. Wire into file tools

In `tools.ts`, before executing `write_file`, `edit_file`, or `multi_edit`:
1. Read the current file content
2. Call `snapshotManager.captureSnapshot([path])` with the ORIGINAL content
3. Then proceed with the write/edit

For `multi_edit`, capture ALL affected files in a single checkpoint group.

### 3. Add `/undo` slash command

In `chat.ts`, add `/undo`:
- Call `snapshotManager.undo()`
- If checkpoint exists: restore all files, print `"↩ Undone: {label} — restored {N} files"`
- If no checkpoints: print `"Nothing to undo"`

### 4. Add `/history` enhancement

Enhance existing `/history` to show file change history:
```
Recent changes:
  1. [2m ago] write_file: src/utils.ts
  2. [5m ago] multi_edit: 3 files (agent.ts, tools.ts, config.ts)
  3. [8m ago] edit_file: package.json
Use /undo to revert the most recent change.
```

### 5. Export singleton

Export a singleton `snapshotManager` from `snapshots.ts` that tools.ts imports.

### 6. Tests

Create `tests/history/snapshots.test.ts`:
- Capture + undo restores file content
- Multiple undos work (stack behavior)
- Max checkpoints limit works (oldest evicted)
- Undo with no checkpoints returns null
- Multi-file checkpoint undoes all files atomically
</instructions>

<constraints>
- In-memory only (no disk persistence) — checkpoints die with the session. This is intentional — disk persistence is V2's git checkpoint system.
- Max 20 checkpoints (prevent memory bloat)
- Undo is sequential (most recent first) — no cherry-picking
- This is a LIGHTER precursor to V2's full git integration. When git checkpoints land, the snapshot system becomes the fallback for non-git repos.
</constraints>

<output>
When finished:
```bash
npm run typecheck && npm test
openclaw system event --text "Done: Auto-05 — /undo rollback system with in-memory snapshots, 20-checkpoint stack" --mode now
```
</output>
