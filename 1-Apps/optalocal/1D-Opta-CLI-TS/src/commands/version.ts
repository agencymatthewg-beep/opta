import chalk from 'chalk';
import { VERSION } from '../core/version.js';

export async function versionCommand(opts: { check?: boolean }): Promise<void> {
  if (!opts.check) {
    console.log(VERSION);
    return;
  }

  console.log(chalk.dim('Checking for updates...'));

  const latest = await fetchLatestVersion();
  if (!latest) {
    console.log(`Current: ${chalk.bold(VERSION)}`);
    console.log(chalk.dim('Could not check for updates (offline or registry unreachable)'));
    return;
  }

  const isUpToDate = VERSION === latest;
  if (isUpToDate) {
    console.log(
      `Current: ${chalk.bold(VERSION)} | Latest: ${chalk.bold(latest)} | ${chalk.green('Up to date')}`
    );
  } else {
    console.log(
      `Current: ${chalk.bold(VERSION)} | Latest: ${chalk.bold(chalk.green(latest))} | ${chalk.yellow('Update available')}`
    );
    console.log(chalk.dim(`  npm install -g opta-cli`));
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch('https://registry.npmjs.org/opta-cli/latest', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as { version?: string };
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}
