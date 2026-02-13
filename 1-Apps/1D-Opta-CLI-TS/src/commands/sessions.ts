import chalk from 'chalk';

interface SessionsOptions {
  json?: boolean;
}

export async function sessions(
  _action?: string,
  _id?: string,
  _opts?: SessionsOptions
): Promise<void> {
  console.log(chalk.yellow('sessions') + ' — Not yet implemented (Phase 4)');
}
