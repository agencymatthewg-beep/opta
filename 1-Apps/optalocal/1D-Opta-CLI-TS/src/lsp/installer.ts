import { join } from 'node:path';
import { mkdir, access } from 'node:fs/promises';
import { execaCommand } from 'execa';
import { getLspBinDir } from '../platform/paths.js';
import { isBinaryAvailable, isWindows } from '../platform/index.js';
import type { LspServerConfig } from './servers.js';

/**
 * Checks if the required language server is available.
 * If not, attempts to auto-provision it into the isolated Opta lsp-bin directory.
 */
export async function ensureLspServerInstalled(
  language: string,
  config: LspServerConfig
): Promise<{ available: boolean; command: string }> {
  // First, check if it's already available globally in the user's PATH
  if (await isBinaryAvailable(config.command)) {
    return { available: true, command: config.command };
  }

  const lspBinDir = getLspBinDir();
  await mkdir(lspBinDir, { recursive: true });

  // Check if it's already installed in our isolated directory
  const localBinPath = join(
    lspBinDir,
    'node_modules',
    '.bin',
    isWindows ? `${config.command}.cmd` : config.command
  );
  try {
    await access(localBinPath);
    return { available: true, command: localBinPath };
  } catch {
    // Not installed yet
  }

  // Attempt auto-provisioning based on the language
  try {
    if (language === 'typescript') {
      // Auto-install via npm into the isolated directory
      await execaCommand('npm install --no-fund --no-audit typescript-language-server typescript', {
        cwd: lspBinDir,
        timeout: 60_000,
      });
      return { available: true, command: localBinPath };
    }

    if (language === 'python') {
      // Auto-install via npm into the isolated directory
      await execaCommand('npm install --no-fund --no-audit pyright', {
        cwd: lspBinDir,
        timeout: 60_000,
      });
      return { available: true, command: localBinPath };
    }

    // For rust/go, we currently fallback to manual installation hints
    // as their toolchains (rustup, go install) are complex to sandbox cleanly.
    return { available: false, command: config.command };
  } catch (err) {
    // If auto-provisioning fails (e.g., npm not found), fail gracefully
    return { available: false, command: config.command };
  }
}
