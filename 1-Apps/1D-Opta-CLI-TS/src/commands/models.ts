import chalk from 'chalk';
import { loadConfig, saveConfig } from '../core/config.js';
import { formatError, OptaError, EXIT } from '../core/errors.js';
import { createSpinner } from '../ui/spinner.js';
import { connectToProvider } from '../providers/manager.js';

interface ModelsOptions {
  json?: boolean;
}

export async function models(
  action?: string,
  name?: string,
  opts?: ModelsOptions
): Promise<void> {
  const config = await loadConfig();
  const host = config.connection.host;
  const port = config.connection.port;

  if (action === 'use') {
    await useModel(name, config);
    return;
  }

  if (action === 'info') {
    await infoModel(name, host, port, opts);
    return;
  }

  // Default: list models
  await listModels(host, port, config.model.default, opts);
}

async function listModels(
  host: string,
  port: number,
  defaultModel: string,
  opts?: ModelsOptions
): Promise<void> {
  const spinner = await createSpinner();
  spinner.start('Fetching models...');

  try {
    const result = await connectToProvider(host, port);
    spinner.stop();

    if (opts?.json) {
      const output = result.models.map((m) => ({
        id: m.id,
        loaded: m.loaded,
        contextLength: m.contextLength,
        isDefault: m.id === defaultModel,
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(chalk.bold(`Models on ${host}:${port}\n`));

    for (const model of result.models) {
      const ctx = model.contextLength
        ? chalk.dim(` ${(model.contextLength / 1000).toFixed(0)}K context`)
        : '';
      const def = model.id === defaultModel ? chalk.green(' ★') : '';
      console.log(`  ${model.id}${ctx}${def}`);
    }

    if (result.models.length === 0) {
      console.log(chalk.dim('  No models loaded'));
    }

    console.log(
      '\n' + chalk.dim(`Use ${chalk.reset('opta models use <name>')} to switch default`)
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

async function useModel(
  name: string | undefined,
  config: Awaited<ReturnType<typeof loadConfig>>
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' +
      chalk.dim('Usage: opta models use <name>')
    );
    process.exit(EXIT.MISUSE);
  }

  // Verify the model exists
  const spinner = await createSpinner();
  spinner.start(`Checking model ${name}...`);

  try {
    const result = await connectToProvider(
      config.connection.host,
      config.connection.port
    );

    const found = result.models.find((m) => m.id === name);
    if (!found) {
      spinner.fail(`Model "${name}" not found`);
      console.log('\nAvailable models:');
      for (const m of result.models) {
        console.log(`  ${m.id}`);
      }
      process.exit(EXIT.NOT_FOUND);
    }

    spinner.succeed(`Default model set to ${name}`);

    await saveConfig({
      model: {
        default: name,
        contextLimit: found.contextLength ?? config.model.contextLimit,
      },
    });
  } catch (err) {
    spinner.stop();
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}

async function infoModel(
  name: string | undefined,
  host: string,
  port: number,
  opts?: ModelsOptions
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' +
      chalk.dim('Usage: opta models info <name>')
    );
    process.exit(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Fetching info for ${name}...`);

  try {
    const result = await connectToProvider(host, port);
    spinner.stop();

    const model = result.models.find((m) => m.id === name);
    if (!model) {
      console.error(chalk.red('✗') + ` Model "${name}" not found`);
      process.exit(EXIT.NOT_FOUND);
    }

    if (opts?.json) {
      console.log(JSON.stringify(model, null, 2));
      return;
    }

    console.log(chalk.bold(model.id));
    console.log(`  Loaded:  ${model.loaded ? chalk.green('yes') : chalk.red('no')}`);
    if (model.contextLength) {
      console.log(`  Context: ${model.contextLength.toLocaleString()} tokens`);
    }
    if (model.size) {
      console.log(`  Size:    ${model.size}`);
    }
  } catch (err) {
    spinner.stop();
    if (err instanceof OptaError) {
      console.error(formatError(err));
      process.exit(err.code);
    }
    throw err;
  }
}
