import chalk from 'chalk';

export async function completions(shell: string): Promise<void> {
  console.log(
    chalk.yellow('completions') +
      ` — Shell completion generation for ${shell} not yet implemented (Phase 5)`
  );
}
