/**
 * Account-related slash commands: /whoami, /logout
 *
 * These provide quick identity inspection and sign-out from inside the REPL
 * without leaving the chat session. They lazy-import account modules so that
 * startup time is unaffected when the commands are not invoked.
 */

import chalk from 'chalk';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

// ---------------------------------------------------------------------------
// /whoami — show current identity and token status
// ---------------------------------------------------------------------------

const whoamiHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const { loadAccountState } = await import('../../accounts/storage.js');
  const { resolveSupabaseAuthConfig } = await import('../../accounts/supabase.js');

  const config = resolveSupabaseAuthConfig();
  if (!config) {
    console.log(chalk.dim('  Account features disabled — OPTA_SUPABASE_URL not configured'));
    return 'handled';
  }

  const state = await loadAccountState();

  if (!state || (!state.user && !state.session)) {
    console.log(chalk.dim('  Not authenticated — run opta account login'));
    return 'handled';
  }

  // Identity line
  const identifier =
    state.user?.email ??
    state.user?.phone ??
    (state.session?.user as Record<string, unknown> | undefined)?.['email'] as string | undefined ??
    'Unknown user';
  console.log(chalk.green('\u2713') + ' ' + chalk.bold(identifier));

  // Project line
  console.log(chalk.dim('  Project: ' + state.project));

  // Token status
  if (state.session) {
    const expiresAt = state.session.expires_at;
    if (expiresAt !== undefined) {
      const nowSecs = Date.now() / 1000;
      const diffSecs = expiresAt - nowSecs;
      if (diffSecs <= 0) {
        console.log(chalk.red('  Token: Expired'));
      } else if (diffSecs < 3600) {
        const mins = Math.ceil(diffSecs / 60);
        console.log(chalk.yellow(`  Token: Valid (expires in ${mins}m)`));
      } else {
        const hours = Math.floor(diffSecs / 3600);
        console.log(chalk.dim(`  Token: Valid (expires in ${hours}h)`));
      }
    } else {
      console.log(chalk.dim('  Token: Valid'));
    }
  } else {
    console.log(chalk.yellow('  Token: None — run opta account login'));
  }

  return 'handled';
};

// ---------------------------------------------------------------------------
// /logout — sign out and clear local account state
// ---------------------------------------------------------------------------

const logoutHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  const { loadAccountState, clearAccountState } = await import('../../accounts/storage.js');
  const { logoutSession, resolveSupabaseAuthConfig } = await import('../../accounts/supabase.js');

  const state = await loadAccountState();

  if (!state) {
    console.log(chalk.dim('  Not logged in'));
    return 'handled';
  }

  // Attempt remote sign-out — best effort, network errors are silently ignored
  if (state.session?.access_token) {
    const config = resolveSupabaseAuthConfig();
    if (config) {
      try {
        await logoutSession(config, state.session.access_token);
      } catch {
        // Ignore network failures — local state will be cleared regardless
      }
    }
  }

  await clearAccountState();
  console.log(chalk.green('\u2713') + ' Logged out');
  return 'handled';
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const accountCommands: SlashCommandDef[] = [
  {
    command: 'whoami',
    description: 'Show current account identity and token status',
    handler: whoamiHandler,
    category: 'session',
    usage: '/whoami',
    examples: ['/whoami'],
  },
  {
    command: 'logout',
    description: 'Sign out and clear local account state',
    handler: logoutHandler,
    category: 'session',
    usage: '/logout',
    examples: ['/logout'],
  },
];
