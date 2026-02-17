import chalk from 'chalk';

export const EXIT = {
  SUCCESS: 0,
  ERROR: 1,
  MISUSE: 2,
  NO_CONNECTION: 3,
  PERMISSION: 77,
  NOT_FOUND: 127,
  SIGINT: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class OptaError extends Error {
  constructor(
    message: string,
    public readonly code: ExitCode = EXIT.ERROR,
    public readonly causes?: string[],
    public readonly suggestions?: string[],
  ) {
    super(message);
    this.name = 'OptaError';
  }
}

export function formatError(error: OptaError): string {
  let output = chalk.red('✗') + ' ' + error.message;

  if (error.causes?.length) {
    output += '\n\n' + error.causes.map((c) => `  • ${c}`).join('\n');
  }

  if (error.suggestions?.length) {
    output += '\n\n' + chalk.dim('Try:');
    output += '\n' + error.suggestions.map((s) => `  • ${s}`).join('\n');
  }

  return output;
}

/**
 * Assert that a model is configured, or throw an actionable OptaError.
 *
 * TODO: chat.ts, do.ts, server.ts, agent.ts should use this instead of
 * inline "no model" checks with process.exit().
 */
export function ensureModel(model: string | undefined): asserts model is string {
  if (!model) {
    throw new OptaError(
      'No model configured. Run `opta connect` to set up your Opta-LMX connection, or `opta status` to check.',
      EXIT.NO_CONNECTION,
      [],
      [
        'Run: opta connect <host>:<port>',
        'Check: opta status',
        'Set manually: opta config set model <name>',
      ],
    );
  }
}
