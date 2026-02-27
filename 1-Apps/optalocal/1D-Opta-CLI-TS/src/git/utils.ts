/**
 * Git utility functions for Opta CLI.
 *
 * All functions use `execa` with array arguments (no shell interpolation)
 * and `reject: false` for safe error handling. On error they return
 * safe defaults: false for booleans, empty array/string for collections.
 */

import { execa } from 'execa';

/**
 * Returns true if `cwd` is inside a git repository.
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
  const result = await execa(
    'git',
    ['rev-parse', '--is-inside-work-tree'],
    { cwd, reject: false },
  );
  return result.exitCode === 0;
}

/**
 * Returns true if the working tree has uncommitted changes
 * (staged, unstaged, or untracked files).
 */
export async function isDirty(cwd: string): Promise<boolean> {
  const result = await execa(
    'git',
    ['status', '--porcelain'],
    { cwd, reject: false },
  );
  if (result.exitCode !== 0) return false;
  return result.stdout.trim().length > 0;
}

/**
 * Returns a list of modified files (staged, unstaged, and untracked).
 * Each entry is a relative path from the repo root.
 */
export async function getModifiedFiles(cwd: string): Promise<string[]> {
  const result = await execa(
    'git',
    ['status', '--porcelain'],
    { cwd, reject: false },
  );
  if (result.exitCode !== 0 || !result.stdout.trim()) return [];

  return result.stdout
    .split('\n')
    .filter((line) => line.length >= 4)
    .map((line) => line.slice(3).trim())
    .filter((f) => f.length > 0);
}

/**
 * Returns the diff output for a specific file or all files.
 * Combines both staged and unstaged diffs.
 */
export async function gitDiff(cwd: string, file?: string): Promise<string> {
  const args = ['diff', 'HEAD'];
  if (file) args.push('--', file);

  const result = await execa('git', args, { cwd, reject: false });
  if (result.exitCode !== 0) return '';
  return result.stdout;
}
