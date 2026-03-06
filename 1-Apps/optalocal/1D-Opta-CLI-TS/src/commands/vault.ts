/**
 * commands/vault.ts — Opta Sync Vault CLI command.
 *
 * Subcommands:
 *   pull         Sync all keys and rules from Opta Accounts to local keychain
 *   pull-keys    Sync only API keys
 *   pull-rules   Sync only non-negotiables.md
 *   push-rules   Push local non-negotiables.md to the Accounts vault
 *   status       Show vault sync status
 */

import chalk from 'chalk';
import { loadAccountState } from '../accounts/storage.js';
import {
    syncVault,
    pullVaultKeys,
    pullVaultRules,
    pushVaultRules,
    readCachedRules,
} from '../accounts/vault.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getConfigDir } from '../platform/paths.js';

type VaultAction = 'pull' | 'pull-keys' | 'pull-rules' | 'push-rules' | 'status';

export async function runVaultCommand(
    action: VaultAction,
    file?: string,
): Promise<void> {
    const state = await loadAccountState();

    if (!state?.session?.access_token) {
        console.error(chalk.red('Not signed in. Run `opta auth login` first.'));
        process.exitCode = 1;
        return;
    }

    switch (action) {
        case 'pull':
            await handlePull(state);
            break;
        case 'pull-keys':
            await handlePullKeys(state);
            break;
        case 'pull-rules':
            await handlePullRules(state);
            break;
        case 'push-rules':
            await handlePushRules(state, file);
            break;
        case 'status':
            await handleStatus(state);
            break;
        default: {
            const _exhaustive: never = action;
            console.error(chalk.red(`Unknown vault action: ${String(_exhaustive)}`));
            process.exitCode = 1;
        }
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handlePull(state: Awaited<ReturnType<typeof loadAccountState>>): Promise<void> {
    console.log(chalk.dim('Syncing from Opta Vault...'));

    const { keys, rules } = await syncVault(state);

    if (keys.synced > 0) {
        console.log(chalk.green(`  ✓ ${keys.synced} API keys synced to keychain`));
    } else {
        console.log(chalk.dim('  — No new API keys to sync'));
    }

    if (keys.skipped > 0) {
        console.log(chalk.yellow(`  ⚠ ${keys.skipped} keys skipped (keychain unavailable or unrecognized provider)`));
    }
    if (keys.errors.length > 0) {
        console.log(chalk.red(`  ✗ ${keys.errors.length} errors:`));
        for (const e of keys.errors) {
            console.log(chalk.dim(`    ${e}`));
        }
    }

    if (rules.configured && rules.content) {
        console.log(chalk.green(`  ✓ non-negotiables.md synced locally`));
    } else {
        console.log(chalk.dim('  — No global rules configured in vault'));
    }

    console.log('');
    console.log(chalk.green('Vault sync complete.'));
}

async function handlePullKeys(
    state: Awaited<ReturnType<typeof loadAccountState>>,
): Promise<void> {
    console.log(chalk.dim('Pulling API keys from vault...'));
    const result = await pullVaultKeys(state);
    console.log(chalk.green(`  ✓ ${result.synced} synced`));
    if (result.skipped > 0) console.log(chalk.yellow(`  ⚠ ${result.skipped} skipped`));
    if (result.errors.length > 0) {
        for (const e of result.errors) console.log(chalk.red(`  ✗ ${e}`));
    }
}

async function handlePullRules(
    state: Awaited<ReturnType<typeof loadAccountState>>,
): Promise<void> {
    console.log(chalk.dim('Pulling non-negotiables.md from vault...'));
    const result = await pullVaultRules(state);
    if (result.configured && result.content) {
        console.log(chalk.green(`  ✓ non-negotiables.md synced to ${join(getConfigDir(), 'non-negotiables.md')}`));
        console.log('');
        console.log(chalk.dim('─────────────────────────────'));
        console.log(result.content.slice(0, 500) + (result.content.length > 500 ? '\n...' : ''));
    } else {
        console.log(chalk.dim('  — No global rules configured. Visit accounts.optalocal.com/rules to set them.'));
    }
}

async function handlePushRules(
    state: Awaited<ReturnType<typeof loadAccountState>>,
    file?: string,
): Promise<void> {
    const sourcePath = file ?? join(getConfigDir(), 'non-negotiables.md');
    let content: string;
    try {
        content = await readFile(sourcePath, 'utf-8');
    } catch {
        console.error(chalk.red(`Could not read ${sourcePath}. Does the file exist?`));
        process.exitCode = 1;
        return;
    }

    console.log(chalk.dim(`Pushing ${sourcePath} to vault...`));
    const result = await pushVaultRules(state, content);
    if (result.ok) {
        console.log(chalk.green('  ✓ Rules pushed to Opta Vault.'));
    } else if (result.conflict) {
        console.error(chalk.red('  ✗ Conflict: vault was updated remotely. Pull first, then push.'));
        process.exitCode = 1;
    } else {
        console.error(chalk.red('  ✗ Failed to push rules. Check your connection.'));
        process.exitCode = 1;
    }
}

async function handleStatus(
    state: Awaited<ReturnType<typeof loadAccountState>>,
): Promise<void> {
    console.log(
        `Signed in as ${chalk.cyan(state?.user?.email ?? state?.user?.id ?? 'unknown')}`,
    );
    console.log('');

    const rules = await readCachedRules();
    if (rules) {
        const lines = rules.split('\n').length;
        console.log(chalk.green(`  ✓ non-negotiables.md cached locally (${lines} lines)`));
    } else {
        console.log(chalk.dim('  — non-negotiables.md: not cached. Run `opta vault pull-rules`.'));
    }

    console.log('');
    console.log(
        chalk.dim('Manage your vault at ') + chalk.cyan('https://accounts.optalocal.com/rules'),
    );
}
