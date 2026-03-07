/**
 * Centralized cross-platform config/data directory resolution.
 *
 * Windows:  %APPDATA%\opta        (e.g. C:\Users\<name>\AppData\Roaming\opta)
 * macOS:    ~/.config/opta
 * Linux:    $XDG_CONFIG_HOME/opta  (defaults to ~/.config/opta)
 */

import { join } from 'node:path';
import { homedir as osHomedir } from 'node:os';
import { isWindows } from './index.js';

function resolveConfigRoot(): string {
  const xdg = process.env['XDG_CONFIG_HOME'];
  if (xdg) return xdg;
  if (isWindows) {
    const appData = process.env['APPDATA'];
    if (appData) return appData;
  }
  return join(osHomedir(), '.config');
}

/** Root config directory: ~/.config/opta (POSIX) or %APPDATA%\opta (Windows). */
export function getConfigDir(): string {
  return join(resolveConfigRoot(), 'opta');
}

/** Sessions directory: <configDir>/sessions/ */
export function getSessionsDir(): string {
  return join(getConfigDir(), 'sessions');
}

/** Daemon data directory: <configDir>/daemon/ */
export function getDaemonDir(): string {
  return join(getConfigDir(), 'daemon');
}

/** Themes directory: <configDir>/themes/ */
export function getThemesDir(): string {
  return join(getConfigDir(), 'themes');
}

/** LSP isolated binary directory: <configDir>/lsp-bin/ */
export function getLspBinDir(): string {
  return join(getConfigDir(), 'lsp-bin');
}

/** Init wizard config file: <configDir>/opta-init-config.json */
export function getInitConfigPath(): string {
  return join(getConfigDir(), 'opta-init-config.json');
}

/**
 * Resolve the Opta Workspace root.
 * Reads workspacePath from opta-init-config.json, falls back to ~/Documents/Opta Workspace.
 */
export async function getWorkspaceRoot(): Promise<string> {
  const { readFile } = await import('node:fs/promises');
  try {
    const raw = await readFile(getInitConfigPath(), 'utf-8');
    const config = JSON.parse(raw) as { workspacePath?: unknown };
    if (typeof config.workspacePath === 'string' && config.workspacePath.trim()) {
      return config.workspacePath.trim();
    }
  } catch {
    // Config not found or unreadable — use default
  }
  return join(osHomedir(), 'Documents', 'Opta Workspace');
}
