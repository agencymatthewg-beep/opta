import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { join } from 'node:path';
import { access, writeFile, mkdir } from 'node:fs/promises';
import chalk from 'chalk';
import { saveConfig, loadConfig } from '../core/config.js';
import type { OptaConfig } from '../core/config.js';
import { isKeychainAvailable } from '../keychain/index.js';
import { storeAnthropicKey } from '../keychain/api-keys.js';
import { getConfigDir } from '../platform/paths.js';

// ── Onboard marker (first-run detection) ────────────────────────────────────

const ONBOARD_MARKER = join(getConfigDir(), '.onboarded');

export async function isFirstRun(): Promise<boolean> {
  try {
    await access(ONBOARD_MARKER);
    return false;
  } catch {
    return true;
  }
}

export async function markOnboarded(): Promise<void> {
  const dir = getConfigDir();
  await mkdir(dir, { recursive: true });
  await writeFile(ONBOARD_MARKER, new Date().toISOString(), 'utf-8');
}

type ProviderName = OptaConfig['provider']['active'];

export interface OnboardingProfileInput {
  provider?: ProviderName;
  lmxHost?: string;
  lmxPort?: number;
  anthropicApiKey?: string;
  autonomyLevel?: number;
  tuiDefault?: boolean;
}

export interface OnboardingProfileResult {
  ok: true;
  provider: ProviderName;
  connection: {
    host: string;
    port: number;
  };
  autonomyLevel: number;
  tuiDefault: boolean;
  anthropicKeyConfigured: boolean;
  onboarded: true;
}

function clampAutonomyLevel(level: number): number {
  if (!Number.isFinite(level)) return 2;
  return Math.max(1, Math.min(5, Math.trunc(level)));
}

function normalizePort(port: number): number {
  if (!Number.isFinite(port)) return 1234;
  const intPort = Math.trunc(port);
  if (intPort < 1 || intPort > 65_535) return 1234;
  return intPort;
}

export async function applyOnboardingProfile(
  input: OnboardingProfileInput = {}
): Promise<OnboardingProfileResult> {
  const existing = await loadConfig().catch(() => null);

  const provider: ProviderName = input.provider ?? existing?.provider?.active ?? 'lmx';
  const lmxHost = input.lmxHost?.trim() || existing?.connection?.host || '192.168.188.11';
  const lmxPort = normalizePort(input.lmxPort ?? existing?.connection?.port ?? 1234);
  const autonomyLevel = clampAutonomyLevel(input.autonomyLevel ?? existing?.autonomy?.level ?? 2);
  const tuiDefault = input.tuiDefault ?? existing?.tui?.default ?? false;
  const anthropicApiKey = (input.anthropicApiKey ?? existing?.provider?.anthropic?.apiKey ?? '').trim();

  await saveConfig({
    'provider.active': provider,
    ...(provider === 'lmx'
      ? { 'connection.host': lmxHost, 'connection.port': lmxPort }
      : { 'provider.anthropic.apiKey': anthropicApiKey }),
    'autonomy.level': autonomyLevel,
    'tui.default': tuiDefault,
  });

  await markOnboarded();

  return {
    ok: true,
    provider,
    connection: {
      host: lmxHost,
      port: lmxPort,
    },
    autonomyLevel,
    tuiDefault,
    anthropicKeyConfigured: anthropicApiKey.length > 0,
    onboarded: true,
  };
}

// ── Interactive prompt helpers ───────────────────────────────────────────────

/** Returns trimmed string, uses defaultValue if blank. */
async function ask(rl: readline.Interface, prompt: string, defaultValue?: string): Promise<string> {
  const hint = defaultValue ? chalk.dim(` [${defaultValue}]`) : '';
  const raw = await rl.question(`${prompt}${hint}: `);
  return raw.trim() || defaultValue || '';
}

/** Y/n prompt, defaults to yes when defaultYes is true. */
async function confirm(
  rl: readline.Interface,
  prompt: string,
  defaultYes = true
): Promise<boolean> {
  const hint = chalk.dim(defaultYes ? ' [Y/n]' : ' [y/N]');
  const raw = await rl.question(`${prompt}${hint}: `);
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return defaultYes;
  return trimmed.startsWith('y');
}

/** Presents a numbered list and returns the zero-based index of the chosen item. */
async function choose(
  rl: readline.Interface,
  prompt: string,
  choices: string[],
  defaultIndex = 0
): Promise<number> {
  if (prompt) console.log(prompt);
  choices.forEach((c, i) => {
    const marker = i === defaultIndex ? chalk.cyan('›') : ' ';
    console.log(`  ${marker} ${chalk.bold(String(i + 1))}. ${c}`);
  });
  const raw = await rl.question(chalk.dim(`  Choice [${defaultIndex + 1}]: `));
  const trimmed = raw.trim();
  if (!trimmed) return defaultIndex;
  const n = parseInt(trimmed, 10);
  if (isNaN(n) || n < 1 || n > choices.length) return defaultIndex;
  return n - 1;
}

// ── Main wizard ──────────────────────────────────────────────────────────────

export async function runOnboarding(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  // Header
  console.log('');
  console.log(chalk.bold.hex('#8b5cf6')('  ██████╗ ██████╗ ████████╗ █████╗ '));
  console.log(chalk.bold.hex('#a855f7')('  ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗'));
  console.log(chalk.bold.hex('#8b5cf6')('  ██║  ██║██████╔╝   ██║   ███████║'));
  console.log(chalk.bold.hex('#a855f7')('  ██║  ██║██╔═══╝    ██║   ██╔══██║'));
  console.log(chalk.bold.hex('#8b5cf6')('  ██████╔╝██║        ██║   ██║  ██║'));
  console.log(chalk.dim('  ╚═════╝ ╚═╝        ╚═╝   ╚═╝  ╚═╝'));
  console.log('');
  console.log(chalk.bold('  Setup Wizard') + chalk.dim(' — Configure Opta CLI for first use'));
  console.log('');

  try {
    // Load existing config for pre-populated defaults
    const existing = await loadConfig().catch(() => null);

    // ── Step 1: Provider ───────────────────────────────────────────────────
    console.log(chalk.bold.hex('#8b5cf6')('Step 1/3 — AI Provider'));
    console.log(chalk.dim('  Choose how Opta connects to AI models'));
    console.log('');

    const providerChoice = await choose(
      rl,
      '',
      [
        'Local LMX  ' + chalk.dim('— Mac Studio inference server (recommended)'),
        'Anthropic  ' + chalk.dim('— Cloud API with your API key'),
      ],
      existing?.provider?.active === 'anthropic' ? 1 : 0
    );

    const provider: 'lmx' | 'anthropic' | 'gemini' | 'openai' | 'opencode_zen' = providerChoice === 0 ? 'lmx' : 'anthropic';

    let lmxHost = '192.168.188.11';
    let lmxPort = 1234;
    let anthropicKey = '';
    let anthropicKeyForConfig = '';
    let anthropicKeyStorage: 'none' | 'config' | 'keychain' = 'none';

    if (provider === 'lmx') {
      console.log('');

      // Auto-discover LMX servers on LAN
      process.stdout.write(chalk.dim('  Scanning LAN for Opta-LMX servers...'));
      let discoveredHosts: Array<{ host: string; port: number; latencyMs: number }> = [];
      try {
        const { discoverLmxHosts } = await import('../lmx/mdns-discovery.js');
        discoveredHosts = await discoverLmxHosts(2000);
      } catch { /* discovery is best-effort */ }

      if (discoveredHosts.length > 0) {
        process.stdout.write(
          '\r' +
            chalk.green(`  Found ${discoveredHosts.length} LMX server${discoveredHosts.length !== 1 ? 's' : ''} on LAN`) +
            '                    \n'
        );
        for (const d of discoveredHosts) {
          console.log(
            chalk.dim(`    ${d.host}:${d.port}`) +
              chalk.dim(` (${d.latencyMs}ms)`)
          );
        }
        console.log('');

        const useDiscovered = await confirm(
          rl,
          `  Use ${discoveredHosts[0]!.host}:${discoveredHosts[0]!.port}?`,
          true
        );
        if (useDiscovered) {
          lmxHost = discoveredHosts[0]!.host;
          lmxPort = discoveredHosts[0]!.port;
        } else {
          lmxHost = await ask(rl, '  LMX host', existing?.connection?.host || '192.168.188.11');
          const portStr = await ask(rl, '  LMX port', String(existing?.connection?.port || 1234));
          lmxPort = parseInt(portStr, 10) || 1234;
        }
      } else {
        process.stdout.write(
          '\r' + chalk.dim('  No LMX servers found on LAN — enter address manually') + '         \n'
        );
        lmxHost = await ask(rl, '  LMX host', existing?.connection?.host || '192.168.188.11');
        const portStr = await ask(rl, '  LMX port', String(existing?.connection?.port || 1234));
        lmxPort = parseInt(portStr, 10) || 1234;
      }

      const testConn = await confirm(rl, '  Test connection now?', true);
      if (testConn) {
        process.stdout.write(chalk.dim('  Connecting…'));
        try {
          const net = await import('node:net');
          await new Promise<void>((resolve, reject) => {
            const socket = new net.Socket();
            socket.setTimeout(3000);
            socket.connect(lmxPort, lmxHost, () => {
              socket.destroy();
              resolve();
            });
            socket.on('error', reject);
            socket.on('timeout', () => reject(new Error('timeout')));
          });
          process.stdout.write(
            '\r' + chalk.green('  ✓ Connected to ' + lmxHost + ':' + lmxPort) + '\n'
          );
        } catch {
          process.stdout.write(
            '\r' +
              chalk.red('  ✗ Could not reach ' + lmxHost + ':' + lmxPort) +
              chalk.dim(' (saved anyway)') +
              '\n'
          );
        }
      }
    } else {
      console.log('');
      anthropicKey = await ask(
        rl,
        '  Anthropic API key',
        existing?.provider?.anthropic?.apiKey || ''
      );
      const trimmed = anthropicKey.trim();

      if (!trimmed) {
        anthropicKeyStorage = 'none';
        anthropicKeyForConfig = '';
      } else if (isKeychainAvailable()) {
        const storeSecurely = await confirm(
          rl,
          '  Store key securely in OS keychain?',
          true
        );

        if (storeSecurely) {
          const stored = await storeAnthropicKey(trimmed);
          if (stored) {
            anthropicKeyStorage = 'keychain';
            anthropicKeyForConfig = '';
            console.log(chalk.green('  ✓ Key stored in keychain (not saved in plaintext config)'));
          } else {
            anthropicKeyStorage = 'config';
            anthropicKeyForConfig = trimmed;
            console.log(
              chalk.yellow('  ! Keychain write failed — saving key in config instead')
            );
          }
        } else {
          anthropicKeyStorage = 'config';
          anthropicKeyForConfig = trimmed;
        }
      } else {
        anthropicKeyStorage = 'config';
        anthropicKeyForConfig = trimmed;
      }
    }

    // ── Step 2: Preferences ────────────────────────────────────────────────
    console.log('');
    console.log(chalk.bold.hex('#8b5cf6')('Step 2/3 — Preferences'));
    console.log('');

    const autonomyChoice = await choose(
      rl,
      '  Default autonomy level',
      [
        'Supervised  ' + chalk.dim('— Ask before every write, edit, or run'),
        'Balanced    ' + chalk.dim('— Ask for risky actions only (recommended)'),
        'Autonomous  ' + chalk.dim('— Auto-approve safe operations'),
      ],
      Math.max(0, Math.min(2, (existing?.autonomy?.level ?? 2) - 1))
    );
    // autonomyChoice is 0/1/2, autonomyLevel is 1/2/3 matching the schema
    const autonomyLevel = autonomyChoice + 1;

    const tuiDefault = await confirm(
      rl,
      '  Enable TUI (full-screen mode) by default?',
      existing?.tui?.default ?? false
    );

    // ── Step 3: Review & Confirm ───────────────────────────────────────────
    console.log('');
    console.log(chalk.bold.hex('#8b5cf6')('Step 3/3 — Review & Apply'));
    console.log('');
    console.log(chalk.dim('  Settings to save:'));
    console.log(
      `    Provider  : ${chalk.cyan(provider === 'lmx' ? 'Local LMX' : 'Anthropic Cloud')}`
    );
    if (provider === 'lmx') {
      console.log(`    LMX host  : ${chalk.cyan(lmxHost + ':' + lmxPort)}`);
    } else {
      const suffix = anthropicKey ? '••••' + anthropicKey.slice(-4) : '(not set)';
      const storageLabel = (
        anthropicKeyStorage === 'keychain'
          ? 'stored in keychain'
          : anthropicKeyStorage === 'config'
            ? 'saved in config'
            : 'not set'
      );
      console.log(`    API key   : ${chalk.cyan(`${suffix} (${storageLabel})`)}`);
    }
    const autonomyLabels = ['Supervised', 'Balanced', 'Autonomous'];
    console.log(`    Autonomy  : ${chalk.cyan(autonomyLabels[autonomyLevel - 1])}`);
    console.log(`    TUI mode  : ${chalk.cyan(tuiDefault ? 'enabled by default' : 'disabled')}`);
    console.log('');

    const proceed = await confirm(rl, '  Save configuration?', true);

    if (!proceed) {
      console.log('');
      console.log(chalk.dim('  Setup cancelled. Run `opta onboard` again to reconfigure.'));
      rl.close();
      return;
    }

    // Persist config
    await saveConfig({
      'provider.active': provider,
      ...(provider === 'lmx'
        ? { 'connection.host': lmxHost, 'connection.port': lmxPort }
        : { 'provider.anthropic.apiKey': anthropicKeyForConfig }),
      'autonomy.level': autonomyLevel,
      'tui.default': tuiDefault,
    });

    await markOnboarded();

    console.log('');
    console.log(chalk.green('  ✓ Configuration saved'));
    console.log('');
    console.log(chalk.bold("  You're ready to use Opta!"));
    console.log('');
    console.log(chalk.dim('  Quick start:'));
    console.log(chalk.cyan('    opta') + chalk.dim('          — Interactive session'));
    console.log(chalk.cyan('    opta do "..."') + chalk.dim(' — One-shot agent task'));
    console.log(chalk.cyan('    opta status') + chalk.dim('   — Check connection'));
    console.log('');
  } finally {
    rl.close();
  }
}
