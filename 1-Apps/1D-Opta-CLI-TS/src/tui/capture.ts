/**
 * Console output capture for TUI mode.
 *
 * Slash command handlers use console.log/console.error for output, which
 * doesn't work in Ink's alternate-screen mode. This utility temporarily
 * redirects console output into a buffer so it can be displayed as a
 * system message in the TUI message list.
 */

/**
 * Capture all console.log and console.error output during an async operation.
 * Returns the captured output as a single string.
 */
export async function captureConsoleOutput<T>(
  fn: () => Promise<T>
): Promise<{ result: T; output: string }> {
  const lines: string[] = [];

  const origLog = console.log;
  const origError = console.error;
  const origClear = console.clear;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log = (...args: any[]) => {
    lines.push(args.map(String).join(' '));
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => {
    lines.push(args.map(String).join(' '));
  };
  console.clear = () => {
    // No-op in TUI mode — clear screen doesn't make sense
    lines.push('[screen cleared]');
  };

  try {
    const result = await fn();
    return { result, output: lines.join('\n') };
  } finally {
    console.log = origLog;
    console.error = origError;
    console.clear = origClear;
  }
}
