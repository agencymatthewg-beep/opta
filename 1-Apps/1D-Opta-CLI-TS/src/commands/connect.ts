import chalk from 'chalk';
import { loadConfig, saveConfig } from '../core/config.js';
import { formatError, OptaError } from '../core/errors.js';
import { verbose } from '../core/debug.js';
import { createSpinner } from '../ui/spinner.js';
import { connectToProvider } from '../providers/manager.js';

interface ConnectOptions {
  host?: string;
  port?: string;
}

export async function connect(opts: ConnectOptions): Promise<void> {
  const config = await loadConfig();

  const host = opts.host ?? config.connection.host;
  const port = opts.port ? parseInt(opts.port, 10) : config.connection.port;

  const spinner = await createSpinner();
  spinner.start(`Connecting to LM Studio at ${host}:${port}...`);

  try {
    const result = await connectToProvider(host, port);

    spinner.succeed(`Connected to LM Studio at ${host}:${port}`);

    // Show loaded models
    console.log(
      '\n' + chalk.bold('Loaded models:')
    );
    for (const model of result.models) {
      const ctx = model.contextLength
        ? chalk.dim(` (${(model.contextLength / 1000).toFixed(0)}K context)`)
        : '';
      const isDefault = model.id === result.defaultModel ? chalk.green(' ← default') : '';
      console.log(`  ${model.id}${ctx}${isDefault}`);
    }

    // Validate default model
    spinner.start(`Validating ${result.defaultModel}...`);
    const valid = await result.provider.validate(result.defaultModel);

    if (valid) {
      spinner.succeed(`Model ${result.defaultModel} is ready`);
    } else {
      spinner.fail(`Model ${result.defaultModel} failed validation`);
      console.log(chalk.dim('  The model may still work — validation uses a minimal test prompt'));
    }

    // Save connection profile
    await saveConfig({
      connection: { host, port, protocol: 'http' },
      model: { default: result.defaultModel, contextLimit: result.contextLimit },
    });

    verbose(`Config saved: host=${host}, port=${port}, model=${result.defaultModel}`);

    console.log(
      '\n' + chalk.green('✓') + ' Connection saved. Run ' +
      chalk.cyan('opta chat') + ' to start coding.'
    );
  } catch (err) {
    spinner.stop();
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}
