import chalk from 'chalk';
import { colorizeOptaWord } from '../ui/brand.js';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { access, writeFile, mkdir } from 'node:fs/promises';
import { diskHeadroomMbToBytes, ensureDiskHeadroom } from '../utils/disk.js';

const ONBOARD_MARKER = join(homedir(), '.config', 'opta', '.onboarded');

export async function isFirstRun(): Promise<boolean> {
  try {
    await access(ONBOARD_MARKER);
    return false;
  } catch {
    return true;
  }
}

export async function markOnboarded(): Promise<void> {
  const dir = join(homedir(), '.config', 'opta');
  await mkdir(dir, { recursive: true });
  await writeFile(ONBOARD_MARKER, new Date().toISOString(), 'utf-8');
}

export async function runOnboarding(): Promise<void> {
  console.log();
  console.log(chalk.bold(colorizeOptaWord('  Welcome to Opta CLI!')));
  console.log(chalk.dim('  Let\'s get you set up.\n'));

  // Step 1: Connection setup
  console.log(chalk.cyan('  1. ') + 'LMX Connection');

  const { saveConfig, loadConfig } = await import('../core/config.js');
  const config = await loadConfig();
  await ensureDiskHeadroom(join(homedir(), '.config', 'opta'), {
    minFreeBytes: diskHeadroomMbToBytes(config.safety?.diskHeadroomMb),
  });

  // Try current connection
  let connected = false;
  try {
    const res = await fetch(`http://${config.connection.host}:${config.connection.port}/v1/models`, {
      signal: AbortSignal.timeout(3000),
    });
    connected = res.ok;
  } catch { /* not connected */ }

  if (connected) {
    console.log(chalk.green('     ✓') + ` Connected to LMX at ${config.connection.host}:${config.connection.port}`);
  } else {
    console.log(chalk.yellow('     ⚠') + ` Cannot reach LMX at ${config.connection.host}:${config.connection.port}`);

    // Try common ports
    const ports = [1234, 10001, 8080, 11434];
    for (const port of ports) {
      if (port === config.connection.port) continue;
      try {
        const res = await fetch(`http://${config.connection.host}:${port}/v1/models`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          console.log(chalk.green('     ✓') + ` Found LMX on port ${port}! Updating config...`);
          await saveConfig({ connection: { ...config.connection, port } });
          connected = true;
          break;
        }
      } catch { /* try next */ }
    }

    if (!connected) {
      console.log(chalk.dim('     Next steps:'));
      console.log(chalk.dim('       1) Start/verify LMX, then run: opta doctor'));
      console.log(chalk.dim('       2) Local LMX (default): opta config set connection.host localhost'));
      console.log(chalk.dim('       3) Remote LMX:         opta config set connection.host <hostname-or-ip>'));
      console.log(chalk.dim('       4) If needed:          opta config set connection.port <port>'));
    }
  }

  // Step 2: Check for Anthropic API key
  console.log();
  console.log(chalk.cyan('  2. ') + 'Cloud Provider (optional)');
  const hasKey = config.provider.anthropic.apiKey || process.env['ANTHROPIC_API_KEY'];
  if (hasKey) {
    console.log(chalk.green('     ✓') + ' Anthropic API key detected');
  } else {
    console.log(chalk.dim('     No Anthropic API key found (optional for cloud models)'));
    console.log(chalk.dim('     Set later: opta config set provider.anthropic.apiKey <key>'));
  }

  // Step 3: Quick tips
  console.log();
  console.log(chalk.cyan('  3. ') + 'Quick Tips');
  console.log(chalk.dim('     • Type /help for all commands'));
  console.log(chalk.dim('     • Type / to browse commands interactively'));
  console.log(chalk.dim('     • Use Tab to autocomplete commands'));
  console.log(chalk.dim('     • Run opta doctor to check your environment'));
  console.log();

  await markOnboarded();
  console.log(chalk.green('  ✓') + ' Setup complete! Starting chat...\n');
}
