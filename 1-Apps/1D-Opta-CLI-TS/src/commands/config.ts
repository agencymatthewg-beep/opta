import chalk from 'chalk';

export async function config(
  _action?: string,
  _key?: string,
  _value?: string
): Promise<void> {
  console.log(chalk.yellow('config') + ' — Not yet implemented (Phase 5)');
}
