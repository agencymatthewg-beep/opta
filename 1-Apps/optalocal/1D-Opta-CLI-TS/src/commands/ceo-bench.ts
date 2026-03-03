import { Command } from 'commander';
import chalk from 'chalk';
import { runCeoBenchmark } from '../benchmark/ceo/runner.js';
import { ExitError, EXIT } from '../core/errors.js';

export function registerCeoBenchCommand(program: Command): void {
  program
    .command('ceo-bench')
    .description('Run internal autonomous CEO benchmarking suite against the active model')
    .option('--model <id>', 'Override model to benchmark')
    .option('--filter <string>', 'Filter tasks by id')
    .option('--json', 'Output results as JSON')
    .action(async (opts) => {
      try {
        await runCeoBenchmark({
          filter: opts.filter,
          model: opts.model,
          json: opts.json,
        });
      } catch (err) {
        if (!opts.json) {
          console.error(chalk.red('✗') + ` Benchmark failed: ${err instanceof Error ? err.message : String(err)}`);
        } else {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
        throw new ExitError(EXIT.ERROR);
      }
    });
}
