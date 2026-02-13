import chalk from 'chalk';

export const isTTY = process.stdout.isTTY === true;
export const isCI = process.env['CI'] === 'true' || !isTTY;
export const noColor = 'NO_COLOR' in process.env;

if (noColor) {
  chalk.level = 0;
}

export function success(message: string): void {
  console.log(chalk.green('✓') + ' ' + message);
}

export function warn(message: string): void {
  console.log(chalk.yellow('⚠') + ' ' + message);
}

export function info(message: string): void {
  console.log(chalk.dim('ℹ') + ' ' + message);
}

export function error(message: string): void {
  console.error(chalk.red('✗') + ' ' + message);
}

export function dim(text: string): string {
  return chalk.dim(text);
}

export function heading(text: string): void {
  console.log('\n' + chalk.bold(text));
}
