import chalk from 'chalk';
import { colorizeOptaWord } from './brand.js';

export const isTTY = process.stdout.isTTY;
export const forceColor = !!process.env['FORCE_COLOR'];
export const isCI = (process.env['CI'] === 'true' || !isTTY) && !forceColor;
export const noColor = 'NO_COLOR' in process.env;

/**
 * Re-evaluate color settings at runtime (e.g. after /theme changes NO_COLOR).
 * Safe to call multiple times — updates chalk.level based on current env.
 */
export function applyColorSettings(): void {
  const shouldDisable =
    process.env['NO_COLOR'] !== undefined
    || process.env['TERM'] === 'dumb'
    || (!isTTY && !forceColor)
    || (process.env['CI'] === 'true' && !forceColor);
  chalk.level = shouldDisable ? 0 : chalk.level || 3;
}

// Apply on module load
applyColorSettings();

export function success(message: string): void {
  console.log(chalk.green('✓') + ' ' + colorizeOptaWord(message));
}

export function warn(message: string): void {
  console.log(chalk.yellow('⚠') + ' ' + colorizeOptaWord(message));
}

export function info(message: string): void {
  console.log(chalk.dim('ℹ') + ' ' + colorizeOptaWord(message));
}

export function error(message: string): void {
  console.error(chalk.red('✗') + ' ' + colorizeOptaWord(message));
}

export function dim(text: string): string {
  return chalk.dim(colorizeOptaWord(text));
}

export function heading(text: string): void {
  console.log('\n' + chalk.bold(colorizeOptaWord(text)));
}
