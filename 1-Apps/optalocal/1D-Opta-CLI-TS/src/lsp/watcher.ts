import { watch, type FSWatcher } from 'chokidar';
import { resolve } from 'node:path';
import type { LspManager } from './manager.js';
import { debug } from '../core/debug.js';

let activeWatcher: FSWatcher | null = null;

/**
 * Binds a filesystem watcher to the LspManager to stream millisecond-accurate
 * textDocument/didChange events to the language server when the user edits
 * files in their IDE outside of Opta's immediate context.
 */
export function setupWorkspaceWatcher(manager: LspManager, cwd: string): void {
  if (activeWatcher) {
    return;
  }

  activeWatcher = watch('**/*', {
    cwd,
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/.opta/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/.venv/**',
      '**/__pycache__/**',
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 150,
      pollInterval: 50,
    },
  });

  activeWatcher.on('change', (relativePath: string) => {
    const absolutePath = resolve(cwd, relativePath);
    // Suppress errors if language server isn't loaded for this file type yet
    manager.notifyFileChanged(absolutePath).catch(() => {});
  });

  debug(`LSP OS-level workspace synchronization active in ${cwd}`);
}

export async function teardownWorkspaceWatcher(): Promise<void> {
  if (activeWatcher) {
    await activeWatcher.close();
    activeWatcher = null;
    debug('LSP OS-level workspace synchronization terminated.');
  }
}
