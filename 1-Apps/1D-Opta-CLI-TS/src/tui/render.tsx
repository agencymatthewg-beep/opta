import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import type { TuiEmitter } from './adapter.js';
import type { SlashCommandResult } from './App.js';
import { isTTY } from '../ui/output.js';

/** Legacy render options — waits for full response before display. */
interface LegacyRenderOptions {
  model: string;
  sessionId: string;
  onMessage: (text: string) => Promise<string>;
}

/** Streaming render options — event-driven real-time display. */
interface StreamingRenderOptions {
  model: string;
  sessionId: string;
  emitter: TuiEmitter;
  onSubmit: (text: string) => void;
  onSlashCommand?: (input: string) => Promise<SlashCommandResult>;
  /** Initial session title (for resumed sessions). */
  title?: string;
  /** Called when user cycles workflow mode (Shift+Tab). */
  onModeChange?: (mode: string) => void;
}

type RenderOptions = LegacyRenderOptions | StreamingRenderOptions;

// ANSI escape sequences for alternate screen buffer management
const ANSI_ENTER_ALT_BUFFER = '\x1b[?1049h';
const ANSI_LEAVE_ALT_BUFFER = '\x1b[?1049l';
const ANSI_HIDE_CURSOR = '\x1b[?25l';
const ANSI_SHOW_CURSOR = '\x1b[?25h';

function isStreamingOptions(opts: RenderOptions): opts is StreamingRenderOptions {
  return 'emitter' in opts;
}

/**
 * Non-TTY fallback - renders a simple text-based UI instead of Ink.
 * Use this when stdin/stdout is not a terminal.
 */
import chalk from 'chalk';

export async function renderTUIFallback(options: RenderOptions): Promise<void> {
  console.log('┌─ Opta CLI (fallback mode) ─────────────────┐');
  console.log('│ TTY not available - using text mode        │');
  console.log('└────────────────────────────────────────────┘\n');
  
  console.log('Type /help for commands, /exit to quit\n');
  
  // Simple input loop for fallback mode
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('> ', async (input) => {
      const trimmed = input.trim();
      
      if (trimmed === '/exit' || trimmed === 'exit' || trimmed === 'quit') {
        rl.close();
        resolve();
        return;
      }
      
      if (trimmed.startsWith('/')) {
        // Handle slash commands in fallback mode
        const { dispatchSlashCommand } = await import('../commands/slash/index.js');
        // Note: slash commands need chatState which isn't available here
        console.log(chalk.yellow('Slash commands not available in fallback mode'));
      }
      
      rl.close();
      resolve();
    });
  });
}

export async function renderTUI(options: RenderOptions): Promise<void> {
  // Check for TTY and fallback if not available
  if (!isTTY) {
    console.log('⚠️  Not running in a terminal - using fallback mode');
    return renderTUIFallback(options);
  }

  process.stdout.write(ANSI_ENTER_ALT_BUFFER);
  process.stdout.write(ANSI_HIDE_CURSOR);

  const { model, sessionId } = options;
  const appProps = isStreamingOptions(options)
    ? { model, sessionId, emitter: options.emitter, onSubmit: options.onSubmit, onSlashCommand: options.onSlashCommand, title: options.title, onModeChange: options.onModeChange }
    : { model, sessionId, onMessage: options.onMessage };

  const { waitUntilExit } = render(
    <App {...appProps} />,
    {
      exitOnCtrlC: true,
    }
  );

  await waitUntilExit();

  process.stdout.write(ANSI_SHOW_CURSOR);
  process.stdout.write(ANSI_LEAVE_ALT_BUFFER);
}
