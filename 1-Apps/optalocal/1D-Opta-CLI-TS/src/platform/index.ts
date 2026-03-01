import { execFile } from 'node:child_process';
import { chmod } from 'node:fs/promises';
import { homedir as osHomedir } from 'node:os';
import { sep } from 'node:path';
import { promisify } from 'node:util';
import { OptaError } from '../core/errors.js';

const execFileAsync = promisify(execFile);

export const isWindows: boolean = process.platform === 'win32';
export const isMacOS: boolean = process.platform === 'darwin';
export const isLinux: boolean = process.platform === 'linux';

export function homedir(): string {
  return osHomedir();
}

export const pathSep: string = sep;

export function requiresPosixPlatform(commandName: string): void {
  if (!isWindows) return;
  throw new OptaError(
    `${commandName} requires macOS or Linux.\n\n` +
      `This command manages Opta LMX infrastructure that is currently POSIX-only.\n\n` +
      `On Windows, run core CLI workflows with Anthropic provider, or execute this command from a macOS/Linux host.`
  );
}

export function shellArgs(): [string, string] {
  return isWindows ? ['cmd', '/c'] : ['sh', '-c'];
}

export async function isBinaryAvailable(command: string): Promise<boolean> {
  const lookupCommand = isWindows ? 'where' : 'which';
  try {
    await execFileAsync(lookupCommand, [command]);
    return true;
  } catch {
    return false;
  }
}

export async function restrictFileToCurrentUser(filePath: string): Promise<void> {
  try {
    if (isWindows) {
      const username = process.env['USERNAME'] ?? process.env['USER'];
      if (!username) return;
      await execFileAsync('icacls', [filePath, '/inheritance:r']);
      await execFileAsync('icacls', [filePath, '/grant:r', `${username}:(R,W)`]);
      return;
    }
    await chmod(filePath, 0o600);
  } catch {
    // Best-effort only.
  }
}
