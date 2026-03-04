import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { join } from 'node:path';
import { access, writeFile, mkdir } from 'node:fs/promises';
import chalk from 'chalk';
import { saveConfig, loadConfig } from '../core/config.js';
import type { OptaConfig } from '../core/config.js';
import { isKeychainAvailable } from '../keychain/index.js';
import {
  storeAnthropicKey,
  storeGeminiKey,
  storeOpenaiKey,
  storeOpencodeZenKey,
} from '../keychain/api-keys.js';
import { getConfigDir } from '../platform/paths.js';
import { discoverLmxHosts } from '../lmx/mdns-discovery.js';
import { LmxApiError, LmxClient } from '../lmx/client.js';

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

export type OnboardingProvider = string;

function normalizeOnboardingProvider(input: string | undefined): OnboardingProvider {
  if (input === 'anthropic' || input === 'gemini' || input === 'openai' || input === 'opencode_zen') {
    return input;
  }
  return 'lmx';
}

interface ProviderFieldConfig {
  provider: OnboardingProvider;
  configured: boolean;
  storage: 'none' | 'config' | 'keychain';
  maskedSuffix?: string;
}

export interface OnboardingProfileInput {
  provider?: OnboardingProvider;
  lmxHost?: string;
  lmxPort?: number;
  lmxAdminKey?: string;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  openaiApiKey?: string;
  opencodeZenApiKey?: string;
  autonomyLevel?: number;
  tuiDefault?: boolean;
  providerKeyStorage?: 'none' | 'config' | 'keychain';
}

export interface OnboardingProfileResult {
  ok: true;
  provider: OnboardingProvider;
  connection: {
    host: string;
    port: number;
  };
  autonomyLevel: number;
  tuiDefault: boolean;
  keyConfigured: ProviderFieldConfig[];
  onboarded: true;
}

interface ProviderKeyPersistenceResult {
  configValue: string;
  configured: boolean;
  storage: 'none' | 'config' | 'keychain';
  maskedSuffix?: string;
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

async function resolveDefaultLmxConnection(
  existing: OptaConfig | null
): Promise<{ host: string; port: number }> {
  if (existing?.connection.host.trim()) {
    return {
      host: existing.connection.host.trim(),
      port: normalizePort(existing.connection.port),
    };
  }

  try {
    const discovered = await discoverLmxHosts(1200);
    const first = discovered[0];
    if (first?.host.trim()) {
      return {
        host: first.host.trim(),
        port: normalizePort(first.port),
      };
    }
  } catch {
    // Discovery is best effort.
  }

  return { host: 'localhost', port: 1234 };
}

export async function applyOnboardingProfile(
  input: OnboardingProfileInput = {}
): Promise<OnboardingProfileResult> {
  const existing = await loadConfig().catch(() => null);

  const provider: OnboardingProvider = normalizeOnboardingProvider(
    input.provider ?? existing?.provider.active
  );
  const defaultLmxConnection = await resolveDefaultLmxConnection(existing);
  const lmxHost = input.lmxHost?.trim() || defaultLmxConnection.host;
  const lmxPort = normalizePort(input.lmxPort ?? defaultLmxConnection.port);
  const autonomyLevel = clampAutonomyLevel(input.autonomyLevel ?? existing?.autonomy.level ?? 2);
  const tuiDefault = input.tuiDefault ?? existing?.tui.default ?? false;

  const configured: ProviderFieldConfig[] = [];

  const anthropicApiKey = (input.anthropicApiKey ?? existing?.provider.anthropic.apiKey ?? '').trim();
  const geminiApiKey = (input.geminiApiKey ?? existing?.provider.gemini.apiKey ?? '').trim();
  const openaiApiKey = (input.openaiApiKey ?? existing?.provider.openai.apiKey ?? '').trim();
  const opencodeZenApiKey = (
    input.opencodeZenApiKey ??
    existing?.provider.opencode_zen.apiKey ??
    ''
  ).trim();

  const configPatch: Record<string, unknown> = {
    'autonomy.level': autonomyLevel,
    'tui.default': tuiDefault,
    'provider.active': provider,
  };

  if (provider === 'lmx') {
    configPatch['connection.host'] = lmxHost;
    configPatch['connection.port'] = String(lmxPort);
    if (input.lmxAdminKey !== undefined) {
      configPatch['connection.adminKey'] = input.lmxAdminKey.trim();
    }
  } else {
    const providerKeyStorage = input.providerKeyStorage ?? 'config';
    const persistProviderKey = async (
      targetProvider: OnboardingProvider,
      apiKey: string
    ): Promise<ProviderKeyPersistenceResult> => {
      const trimmed = apiKey.trim();
      if (!trimmed) {
        return {
          configValue: '',
          configured: false,
          storage: 'none',
        };
      }

      if (providerKeyStorage === 'keychain' && isKeychainAvailable()) {
        const store = async (value: string): Promise<boolean> => {
          if (targetProvider === 'anthropic') return storeAnthropicKey(value);
          if (targetProvider === 'gemini') return storeGeminiKey(value);
          if (targetProvider === 'openai') return storeOpenaiKey(value);
          return storeOpencodeZenKey(value);
        };

        const stored = await store(trimmed);
        if (stored) {
          return {
            configValue: '',
            configured: true,
            storage: 'keychain',
            maskedSuffix: trimmed.slice(-4),
          };
        }
      }

      return {
        configValue: trimmed,
        configured: true,
        storage: 'config',
        maskedSuffix: trimmed.slice(-4),
      };
    };

    if (provider === 'anthropic') {
      const persisted = await persistProviderKey('anthropic', anthropicApiKey);
      configPatch['provider.anthropic.apiKey'] = persisted.configValue;
      configured.push({
        provider: 'anthropic',
        configured: persisted.configured,
        storage: persisted.storage,
        maskedSuffix: persisted.maskedSuffix,
      });
    } else if (provider === 'gemini') {
      const persisted = await persistProviderKey('gemini', geminiApiKey);
      configPatch['provider.gemini.apiKey'] = persisted.configValue;
      configured.push({
        provider: 'gemini',
        configured: persisted.configured,
        storage: persisted.storage,
        maskedSuffix: persisted.maskedSuffix,
      });
    } else if (provider === 'openai') {
      const persisted = await persistProviderKey('openai', openaiApiKey);
      configPatch['provider.openai.apiKey'] = persisted.configValue;
      configured.push({
        provider: 'openai',
        configured: persisted.configured,
        storage: persisted.storage,
        maskedSuffix: persisted.maskedSuffix,
      });
    } else {
      const persisted = await persistProviderKey('opencode_zen', opencodeZenApiKey);
      configPatch['provider.opencode_zen.apiKey'] = persisted.configValue;
      configured.push({
        provider: 'opencode_zen',
        configured: persisted.configured,
        storage: persisted.storage,
        maskedSuffix: persisted.maskedSuffix,
      });
    }
  }

  await saveConfig(configPatch);

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
    keyConfigured: configured,
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


type CloudKeyResult = {
  keyInput: string;
  keyForConfig: string;
  keyStorage: 'none' | 'config' | 'keychain';
};

async function promptProviderApiKey(
  rl: readline.Interface,
  provider: OnboardingProvider,
  label: string,
  existingKey: string,
): Promise<CloudKeyResult> {
  let keyStorage: 'none' | 'config' | 'keychain' = 'none';
  let keyInput = '';
  let keyForConfig = '';

  keyInput = await ask(rl, `  ${label} API key`, existingKey);
  const trimmed = keyInput.trim();

  if (!trimmed) {
    keyStorage = 'none';
    keyForConfig = '';
  } else if (isKeychainAvailable()) {
    const storeSecurely = await confirm(rl, '  Store key securely in OS keychain?', true);
    if (storeSecurely) {
      const store = async (value: string): Promise<boolean> => {
        if (provider === 'anthropic') return storeAnthropicKey(value);
        if (provider === 'gemini') return storeGeminiKey(value);
        if (provider === 'openai') return storeOpenaiKey(value);
        return storeOpencodeZenKey(value);
      };

      const stored = await store(trimmed);
      if (stored) {
        keyStorage = 'keychain';
        keyForConfig = '';
        console.log(chalk.green('  ✓ Key stored in keychain (not saved in plaintext config)'));
      } else {
        keyStorage = 'config';
        keyForConfig = trimmed;
        console.log(chalk.yellow('  ! Keychain write failed — saving key in config instead'));
      }
    } else {
      keyStorage = 'config';
      keyForConfig = trimmed;
    }
  } else {
    keyStorage = 'config';
    keyForConfig = trimmed;
  }

  return {
    keyInput: trimmed,
    keyForConfig,
    keyStorage,
  };
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
  console.log(chalk.bold.hex('#8b5cf6')('  OPTA CODE'));
  console.log(chalk.bold.hex('#a855f7')('  OPTA CODE'));
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
        'Local LMX  ' + chalk.dim('— Remote/local inference server (recommended)'),
        'Anthropic  ' + chalk.dim('— Cloud API with your API key'),
        'Gemini    ' + chalk.dim('— Google OpenAI-compatible endpoint (Gemini)'),
        'OpenAI    ' + chalk.dim('— OpenAI/Codex-compatible endpoint'),
        'Opencode Zen' + chalk.dim('— Alternative provider endpoint'),
      ],
      (() => {
        const active = normalizeOnboardingProvider(existing?.provider.active);
        if (active === 'anthropic') return 1;
        if (active === 'gemini') return 2;
        if (active === 'openai') return 3;
        if (active === 'opencode_zen') return 4;
        return 0;
      })(),
    );

    const provider: OnboardingProvider =
      providerChoice === 0
        ? 'lmx'
        : providerChoice === 2
          ? 'gemini'
          : providerChoice === 3
            ? 'openai'
            : providerChoice === 4
              ? 'opencode_zen'
              : 'anthropic';

    let lmxHost = 'localhost';
    let lmxPort = 1234;
    let lmxAdminKey = '';
    let cloudKey = '';
    let cloudKeyForConfig = '';
    let cloudKeyStorage: 'none' | 'config' | 'keychain' = 'none';

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
        const firstDiscovered = discoveredHosts[0];
        if (!firstDiscovered) {
          throw new Error('Discovery list unexpectedly empty');
        }
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
          `  Use ${firstDiscovered.host}:${firstDiscovered.port}?`,
          true
        );
        if (useDiscovered) {
          lmxHost = firstDiscovered.host;
          lmxPort = firstDiscovered.port;
        } else {
          lmxHost = await ask(rl, '  LMX host', existing?.connection.host || 'localhost');
          const portStr = await ask(rl, '  LMX port', String(existing?.connection.port || 1234));
          lmxPort = parseInt(portStr, 10) || 1234;
        }
      } else {
        process.stdout.write(
          '\r' + chalk.dim('  No LMX servers found on LAN — enter address manually') + '         \n'
        );
        lmxHost = await ask(rl, '  LMX host', existing?.connection.host || 'localhost');
        const portStr = await ask(rl, '  LMX port', String(existing?.connection.port || 1234));
        lmxPort = parseInt(portStr, 10) || 1234;
      }
      lmxAdminKey = await ask(
        rl,
        '  LMX admin key (optional)',
        existing?.connection.adminKey || ''
      );

      const testConn = await confirm(rl, '  Test connection now?', true);
      if (testConn) {
        process.stdout.write(chalk.dim('  Checking LMX liveness…'));
        try {
          const client = new LmxClient({
            host: lmxHost,
            port: lmxPort,
            adminKey: lmxAdminKey.trim() || existing?.connection.adminKey,
            adminKeysByHost: existing?.connection.adminKeysByHost,
          });
          await client.health({ timeoutMs: 3_000, maxRetries: 0 });
          process.stdout.write(
            '\r' + chalk.green('  ✓ LMX reachable at ' + lmxHost + ':' + lmxPort) + '\n'
          );

          process.stdout.write(chalk.dim('  Checking admin endpoint access…'));
          try {
            await client.status({ timeoutMs: 3_000, maxRetries: 0 });
            process.stdout.write(
              '\r' + chalk.green('  ✓ Admin endpoints accessible') + '\n'
            );
          } catch (err) {
            if (
              err instanceof LmxApiError &&
              (err.code === 'unauthorized' || err.status === 401 || err.status === 403)
            ) {
              process.stdout.write(
                '\r' +
                chalk.yellow(
                  '  ! LMX is reachable but /admin endpoints are unauthorized (invalid or missing admin key)'
                ) +
                '\n'
              );
              console.log(
                chalk.dim(
                  '    Set key:   opta config set connection.adminKey <key>'
                )
              );
              console.log(
                chalk.dim(
                  '    Set map:   opta config set connection.adminKeysByHost \'{"host":"key"}\''
                )
              );
              console.log(
                chalk.dim(
                  '    Clear key: opta config delete connection.adminKey'
                )
              );
            } else {
              process.stdout.write(
                '\r' +
                chalk.yellow(
                  '  ! LMX reachable, but admin check could not be completed'
                ) +
                '\n'
              );
            }
          }
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
      const existingCloudKey =
        provider === 'anthropic'
          ? existing?.provider.anthropic.apiKey || ''
          : provider === 'gemini'
            ? existing?.provider.gemini.apiKey || ''
            : provider === 'openai'
              ? existing?.provider.openai.apiKey || ''
              : existing?.provider.opencode_zen.apiKey || '';

      const cloudPromptLabel =
        provider === 'anthropic'
          ? 'Anthropic'
          : provider === 'gemini'
            ? 'Gemini'
            : provider === 'openai'
              ? 'OpenAI/Codex'
              : 'Opencode Zen';

      const keyPrompt = await promptProviderApiKey(rl, provider, cloudPromptLabel, existingCloudKey);
      cloudKey = keyPrompt.keyInput;
      cloudKeyForConfig = keyPrompt.keyForConfig;
      cloudKeyStorage = keyPrompt.keyStorage;
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
      Math.max(0, Math.min(2, (existing?.autonomy.level ?? 2) - 1))
    );
    // autonomyChoice is 0/1/2, autonomyLevel is 1/2/3 matching the schema
    const autonomyLevel = autonomyChoice + 1;

    const tuiDefault = await confirm(
      rl,
      '  Enable TUI (full-screen mode) by default?',
      existing?.tui.default ?? false
    );

    // ── Step 3: Review & Confirm ───────────────────────────────────────────
    console.log('');
    console.log(chalk.bold.hex('#8b5cf6')('Step 3/3 — Review & Apply'));
    console.log('');
    console.log(chalk.dim('  Settings to save:'));
    const providerLabel =
      provider === 'lmx'
        ? 'Local LMX'
        : provider === 'anthropic'
          ? 'Anthropic Cloud'
          : provider === 'gemini'
            ? 'Gemini Cloud'
            : provider === 'openai'
              ? 'OpenAI/Codex Cloud'
              : 'Opencode Zen Cloud';

    console.log(`    Provider  : ${chalk.cyan(providerLabel)}`);
    if (provider === 'lmx') {
      console.log(`    LMX host  : ${chalk.cyan(lmxHost + ':' + lmxPort)}`);
    } else {
      const suffix = cloudKey ? '••••' + cloudKey.slice(-4) : '(not set)';
      const storageLabel =
        cloudKeyStorage === 'keychain'
          ? 'stored in keychain'
          : cloudKeyStorage === 'config'
            ? 'saved in config'
            : 'not set';
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
    await applyOnboardingProfile({
      provider,
      lmxHost,
      lmxPort,
      lmxAdminKey: provider === 'lmx' ? lmxAdminKey : undefined,
      anthropicApiKey: provider === 'anthropic' ? cloudKeyForConfig : undefined,
      geminiApiKey: provider === 'gemini' ? cloudKeyForConfig : undefined,
      openaiApiKey: provider === 'openai' ? cloudKeyForConfig : undefined,
      opencodeZenApiKey: provider === 'opencode_zen' ? cloudKeyForConfig : undefined,
      providerKeyStorage: cloudKeyStorage,
      autonomyLevel,
      tuiDefault,
    });

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

    // ── Step 4: Sync Vault (optional) ──────────────────────────────────────────
    console.log(chalk.bold.hex('#8b5cf6')('Sync Vault (optional)'));
    console.log(chalk.dim('  Sync API keys and AI rules from your Opta Accounts vault.'));
    console.log('');

    try {
      const { loadAccountState } = await import('../accounts/storage.js');
      const state = await loadAccountState();

      if (state?.session?.access_token) {
        const doVaultSync = await confirm(rl, '  Sync keys from Opta Vault now?', true);
        if (doVaultSync) {
          process.stdout.write(chalk.dim('  Syncing vault…'));
          const { syncVault } = await import('../accounts/vault.js');
          const { keys, rules } = await syncVault(state);
          process.stdout.write('\r');
          if (keys.synced > 0) {
            console.log(chalk.green(`  ✓ ${keys.synced} API keys synced to keychain`));
          }
          if (keys.skipped > 0) {
            console.log(chalk.yellow(`  ⚠ ${keys.skipped} keys skipped`));
          }
          if (rules.configured && rules.content) {
            console.log(chalk.green('  ✓ non-negotiables.md synced'));
          }
          if (keys.synced === 0 && !rules.configured) {
            console.log(chalk.dim('  — No keys or rules found in your vault yet.'));
            console.log(chalk.dim('    Add them at: ') + chalk.cyan('https://accounts.optalocal.com/keys'));
          }
        }
      } else {
        console.log(chalk.dim('  Not signed in — to sync your vault later, run:'));
        console.log(chalk.cyan('    opta account login --oauth'));
        console.log(chalk.cyan('    opta vault pull'));
      }
    } catch {
      // Vault sync is best-effort — don't break onboarding
      console.log(chalk.dim('  Vault sync skipped (not signed in or network unavailable).'));
    }

    console.log('');
  } finally {
    rl.close();
  }
}
