import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { agentLoop } from '../core/agent.js';
import { formatError, OptaError, EXIT } from '../core/errors.js';

interface DoOptions {
  model?: string;
  commit?: boolean;
  checkpoints?: boolean;
  format?: string;
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

  const jsonMode = opts.format === 'json';

  try {
    const config = await loadConfig(overrides);

    if (!config.model.default) {
      if (jsonMode) {
        console.log(JSON.stringify({ error: 'No model configured' }));
      } else {
        console.error(
          chalk.red('✗') + ' No model configured\n\n' +
          chalk.dim('Run ') + chalk.cyan('opta status') + chalk.dim(' to check your LMX connection')
        );
      }
      process.exit(EXIT.NO_CONNECTION);
    }

    if (!jsonMode) {
      console.log(
        chalk.dim(`opta · ${config.model.default} · ${config.connection.host}`)
      );
    }

    const result = await agentLoop(taskStr, config, { silent: jsonMode });

    if (jsonMode) {
      // Extract final assistant message
      const assistantMsgs = result.messages.filter((m) => m.role === 'assistant');
      const finalMsg = assistantMsgs[assistantMsgs.length - 1];
      console.log(JSON.stringify({
        result: finalMsg?.content ?? '',
        tool_calls: result.toolCallCount,
        model: config.model.default,
      }));
    }
  } catch (err) {
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}
