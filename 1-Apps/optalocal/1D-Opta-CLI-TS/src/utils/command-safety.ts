const UNSAFE_EXECUTABLE_CHARS = /[\0\r\n;&|`$<>]/;

/**
 * Returns a human-readable reason when an executable command token is unsafe.
 *
 * These checks protect command-launch paths that intentionally use spawn/stdio
 * (non-shell execution). We reject shell control characters up-front so config
 * values cannot be misread as shell snippets.
 */
export function getUnsafeExecutableReason(command: string): string | null {
  if (!command || command.trim().length === 0) {
    return 'command is empty';
  }

  if (UNSAFE_EXECUTABLE_CHARS.test(command)) {
    return 'command contains shell control characters';
  }

  return null;
}

export function assertSafeExecutableCommand(command: string, label: string): void {
  const reason = getUnsafeExecutableReason(command);
  if (!reason) return;
  throw new Error(`${label} command rejected: ${reason}`);
}
