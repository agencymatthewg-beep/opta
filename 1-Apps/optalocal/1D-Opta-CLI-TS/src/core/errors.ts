import chalk from 'chalk';
import { NO_MODEL_ERROR } from '../utils/errors.js';

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

/**
 * Thrown instead of calling process.exit() so that command functions
 * remain testable.  The top-level CLI entry point catches this and
 * calls process.exit(code).
 */
export class ExitError extends Error {
  constructor(public readonly exitCode: ExitCode) {
    super(`exit ${exitCode}`);
    this.name = 'ExitError';
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
 * Used by agent.ts. Commands (chat.ts, do.ts) have format-aware inline
 * checks that provide JSON/quiet/text error output before calling agentLoop().
 */
export function ensureModel(model: string | undefined): asserts model is string {
  if (!model) {
    throw new OptaError(
      NO_MODEL_ERROR,
      EXIT.NO_CONNECTION,
      [],
      [
        'Load directly: opta models load <model-id>',
        'Set default: opta config set model.default <model-name>',
        'Discover models: opta models',
        'Run onboarding: opta onboard',
        'Run: opta connect <host>:<port>',
        'Check: opta status',
        'Diagnose: opta doctor',
      ],
    );
  }
}
