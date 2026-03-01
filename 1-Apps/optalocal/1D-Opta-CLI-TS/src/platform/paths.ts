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
