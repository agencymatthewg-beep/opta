import chalk from 'chalk';
import { loadConfig, saveConfig } from '../core/config.js';
import { formatError, OptaError, EXIT } from '../core/errors.js';
import { createSpinner } from '../ui/spinner.js';
import { LmxClient, lookupContextLimit } from '../lmx/client.js';

interface ModelsOptions {
  json?: boolean;
}

export async function models(
  action?: string,
  name?: string,
  opts?: ModelsOptions
): Promise<void> {
  const config = await loadConfig();
  const { host, port } = config.connection;
  const client = new LmxClient({ host, port, adminKey: config.connection.adminKey });

  switch (action) {
    case 'use':
      await useModel(name, client, config);
      return;
    case 'info':
      await infoModel(name, client, opts);
      return;
    case 'load':
      await loadModel(name, client);
      return;
    case 'unload':
      await unloadModel(name, client);
      return;
    default:
      await listModels(client, config.model.default, opts);
  }
}

async function listModels(
  client: LmxClient,
  defaultModel: string,
  opts?: ModelsOptions
): Promise<void> {
  const spinner = await createSpinner();
  spinner.start('Fetching models...');

  try {
    const result = await client.models();
    spinner.stop();

    if (opts?.json) {
      const output = result.models.map((m) => ({
        id: m.model_id,
        status: m.status,
        contextLength: m.context_length ?? lookupContextLimit(m.model_id),
        memoryBytes: m.memory_bytes,
        isDefault: m.model_id === defaultModel || m.is_default,
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(chalk.bold('Models\n'));

    for (const model of result.models) {
      const ctx = model.context_length ?? lookupContextLimit(model.model_id);
      const ctxStr = chalk.dim(` ${(ctx / 1000).toFixed(0)}K context`);
      const def = (model.model_id === defaultModel || model.is_default)
        ? chalk.green(' ★')
        : '';
      const mem = model.memory_bytes
        ? chalk.dim(` ${(model.memory_bytes / 1e9).toFixed(1)}GB`)
        : '';
      console.log(`  ${model.model_id}${ctxStr}${mem}${def}`);
    }

    if (result.models.length === 0) {
      console.log(chalk.dim('  No models loaded'));
    }

    console.log(
      '\n' + chalk.dim(`Use ${chalk.reset('opta models use <name>')} to switch default`)
    );
    console.log(
      chalk.dim(`Use ${chalk.reset('opta models load <name>')} to load a model`)
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
  client: LmxClient,
  _config: Awaited<ReturnType<typeof loadConfig>>
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' +
      chalk.dim('Usage: opta models use <name>')
    );
    process.exit(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Checking model ${name}...`);

  try {
    const result = await client.models();
    const found = result.models.find((m) => m.model_id === name);

    if (!found) {
      spinner.fail(`Model "${name}" not found`);
      console.log('\nLoaded models:');
      for (const m of result.models) {
        console.log(`  ${m.model_id}`);
      }
      process.exit(EXIT.NOT_FOUND);
    }

    const contextLimit = found.context_length ?? lookupContextLimit(name);

    await saveConfig({
      model: { default: name, contextLimit },
    });

    spinner.succeed(`Default model set to ${name}`);
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
  client: LmxClient,
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
    const result = await client.models();
    spinner.stop();

    const model = result.models.find((m) => m.model_id === name);
    if (!model) {
      console.error(chalk.red('✗') + ` Model "${name}" not found`);
      process.exit(EXIT.NOT_FOUND);
    }

    if (opts?.json) {
      console.log(JSON.stringify(model, null, 2));
      return;
    }

    const ctx = model.context_length ?? lookupContextLimit(model.model_id);

    console.log(chalk.bold(model.model_id));
    console.log(`  Status:  ${model.status === 'loaded' ? chalk.green('loaded') : chalk.yellow(model.status)}`);
    console.log(`  Context: ${ctx.toLocaleString()} tokens`);
    if (model.memory_bytes) {
      console.log(`  Memory:  ${(model.memory_bytes / 1e9).toFixed(1)} GB`);
    }
    if (model.request_count != null) {
      console.log(`  Requests: ${model.request_count}`);
    }
    if (model.loaded_at) {
      console.log(`  Loaded:  ${model.loaded_at}`);
    }
    if (model.is_default) {
      console.log(`  Default: ${chalk.green('yes')}`);
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

async function loadModel(
  name: string | undefined,
  client: LmxClient
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' +
      chalk.dim('Usage: opta models load <name>')
    );
    process.exit(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Loading ${name}...`);

  try {
    const result = await client.loadModel(name);
    spinner.succeed(`Loaded ${result.model_id}`);

    if (result.memory_bytes) {
      console.log(chalk.dim(`  Memory: ${(result.memory_bytes / 1e9).toFixed(1)} GB`));
    }
    if (result.load_time_seconds) {
      console.log(chalk.dim(`  Load time: ${result.load_time_seconds.toFixed(1)}s`));
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

async function unloadModel(
  name: string | undefined,
  client: LmxClient
): Promise<void> {
  if (!name) {
    console.error(
      chalk.red('✗') + ' Missing model name\n\n' +
      chalk.dim('Usage: opta models unload <name>')
    );
    process.exit(EXIT.MISUSE);
  }

  const spinner = await createSpinner();
  spinner.start(`Unloading ${name}...`);

  try {
    const result = await client.unloadModel(name);
    spinner.succeed(`Unloaded ${result.model_id}`);

    if (result.freed_bytes) {
      console.log(chalk.dim(`  Freed: ${(result.freed_bytes / 1e9).toFixed(1)} GB`));
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
