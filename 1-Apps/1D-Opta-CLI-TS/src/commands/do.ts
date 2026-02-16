import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { agentLoop } from '../core/agent.js';
import { formatError, OptaError, EXIT } from '../core/errors.js';

interface DoOptions {
  model?: string;
  commit?: boolean;
  checkpoints?: boolean;
}

export async function executeTask(task: string[], opts: DoOptions): Promise<void> {
  const taskStr = task.join(' ');

  if (!taskStr.trim()) {
    console.error(chalk.red('✗') + ' No task specified\n');
    console.log(chalk.dim('Usage: opta do <task...>'));
    console.log(chalk.dim('Example: opta do "fix the authentication bug"'));
    process.exit(EXIT.MISUSE);
  }

  const overrides: Record<string, unknown> = {};
  if (opts.model) {
    overrides['model'] = { default: opts.model };
  }
  if (opts.commit === false) {
    overrides['git'] = { ...((overrides['git'] as Record<string, unknown>) ?? {}), autoCommit: false };
  }
  if (opts.checkpoints === false) {
    overrides['git'] = { ...((overrides['git'] as Record<string, unknown>) ?? {}), checkpoints: false };
  }

  try {
    const config = await loadConfig(overrides);

    if (!config.model.default) {
      console.error(
        chalk.red('✗') + ' No model configured\n\n' +
        chalk.dim('Run ') + chalk.cyan('opta status') + chalk.dim(' to check your LMX connection')
      );
      process.exit(EXIT.NO_CONNECTION);
    }

    console.log(
      chalk.dim(`opta · ${config.model.default} · ${config.connection.host}`)
    );

    await agentLoop(taskStr, config);
  } catch (err) {
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}
