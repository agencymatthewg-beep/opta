/**
 * Checkpoint system for Opta CLI.
 *
 * Saves git diffs as patch files after each file-modifying tool call,
 * allowing mid-task undo via `git apply -R`.
 *
 * Checkpoint directory layout:
 *   <cwd>/.opta/checkpoints/<sessionId>/
 *     index.json   — metadata for all checkpoints in this session
 *     1.patch      — diff patch for checkpoint #1
 *     2.patch      — diff patch for checkpoint #2
 *     ...
 */

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execa } from 'execa';
import { gitDiff } from './utils.js';

/**
 * Metadata for a single checkpoint.
 */
export interface Checkpoint {
  n: number;
  tool: string;
  path: string;
  timestamp: string;
}

/**
 * Shape of the index.json file stored in each session's checkpoint directory.
 */
interface CheckpointIndex {
  session: string;
  checkpoints: Checkpoint[];
}

/**
 * Returns the checkpoint directory path for a given session.
 */
function checkpointDir(cwd: string, sessionId: string): string {
  return join(cwd, '.opta', 'checkpoints', sessionId);
}

/**
 * Creates a checkpoint by saving the current diff for `filePath` as a patch file.
 *
 * No-op if the file has no changes (empty diff).
 */
export async function createCheckpoint(
  cwd: string,
  sessionId: string,
  n: number,
  tool: string,
  filePath: string,
): Promise<void> {
  const diff = await gitDiff(cwd, filePath);
  if (!diff) return; // No changes — nothing to checkpoint

  const dir = checkpointDir(cwd, sessionId);
  await mkdir(dir, { recursive: true });

  // Write the patch file.
  // execa strips the trailing newline from stdout, but git apply requires it.
  const patchContent = diff.endsWith('\n') ? diff : diff + '\n';
  const patchPath = join(dir, `${n}.patch`);
  await writeFile(patchPath, patchContent, 'utf-8');

  // Read or create index.json
  const indexPath = join(dir, 'index.json');
  let index: CheckpointIndex;
  try {
    const raw = await readFile(indexPath, 'utf-8');
    index = JSON.parse(raw) as CheckpointIndex;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      console.error(`Failed to read checkpoint index at ${indexPath}, creating new:`, err);
    }
    index = { session: sessionId, checkpoints: [] };
  }

  // Append the new checkpoint
  index.checkpoints.push({
    n,
    tool,
    path: filePath,
    timestamp: new Date().toISOString(),
  });

  await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Returns all checkpoints for a session, in order.
 * Returns an empty array if the session has no checkpoints.
 */
export async function listCheckpoints(
  cwd: string,
  sessionId: string,
): Promise<Checkpoint[]> {
  const indexPath = join(checkpointDir(cwd, sessionId), 'index.json');
  try {
    const raw = await readFile(indexPath, 'utf-8');
    const index = JSON.parse(raw) as CheckpointIndex;
    return index.checkpoints;
  } catch {
    return [];
  }
}

/**
 * Undoes a checkpoint by applying its patch in reverse.
 *
 * Without `n`, undoes the last checkpoint.
 * With `n`, undoes the specific checkpoint.
 */
export async function undoCheckpoint(
  cwd: string,
  sessionId: string,
  n?: number,
): Promise<void> {
  const checkpoints = await listCheckpoints(cwd, sessionId);
  if (checkpoints.length === 0) {
    throw new Error(`No checkpoints found for session "${sessionId}"`);
  }

  const targetN = n ?? checkpoints[checkpoints.length - 1]!.n;
  const patchPath = join(checkpointDir(cwd, sessionId), `${targetN}.patch`);

  await execa('git', ['apply', '-R', patchPath], { cwd });
}

/**
 * Reads the raw patch content for a specific checkpoint.
 * Returns an empty string if the patch file does not exist.
 */
export async function readPatchContent(
  cwd: string,
  sessionId: string,
  n: number,
): Promise<string> {
  const patchPath = join(checkpointDir(cwd, sessionId), `${n}.patch`);
  try {
    return await readFile(patchPath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Computes a diff stat summary (additions, deletions) from a patch string.
 * Returns { additions, deletions } line counts.
 */
export function patchStat(patch: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { additions, deletions };
}

/**
 * Undoes ALL checkpoints for a session, in reverse order.
 * Throws if any individual undo fails.
 */
export async function undoAllCheckpoints(
  cwd: string,
  sessionId: string,
): Promise<number> {
  const checkpoints = await listCheckpoints(cwd, sessionId);
  if (checkpoints.length === 0) {
    throw new Error(`No checkpoints found for session "${sessionId}"`);
  }

  // Undo in reverse order to avoid patch conflicts
  const reversed = [...checkpoints].reverse();
  let undone = 0;
  for (const cp of reversed) {
    const patchPath = join(checkpointDir(cwd, sessionId), `${cp.n}.patch`);
    try {
      await execa('git', ['apply', '-R', patchPath], { cwd });
      undone++;
    } catch {
      // Patch may not apply cleanly if already reverted — skip
    }
  }
  return undone;
}

/**
 * Removes all checkpoint data for a session.
 * No-op if the session directory doesn't exist.
 */
export async function cleanupCheckpoints(
  cwd: string,
  sessionId: string,
): Promise<void> {
  const dir = checkpointDir(cwd, sessionId);
  await rm(dir, { recursive: true, force: true });
}
