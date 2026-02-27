import React from 'react';
import { render } from 'ink';
import chalk from 'chalk';
import { App } from './App.js';
import { ErrorBoundary } from './ErrorBoundary.js';
import type { TuiEmitter } from './adapter.js';
import type { SlashCommandResult } from './App.js';
import type { TuiMessage } from './App.js';
import { isTTY } from '../ui/output.js';
import { colorizeOptaWord } from '../ui/brand.js';

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
  onCancelTurn?: () => void;
  onSlashCommand?: (input: string) => Promise<SlashCommandResult>;
  initialMessages?: TuiMessage[];
  requireLoadedModel?: boolean;
  initialModelLoaded?: boolean;
  /** Initial session title (for resumed sessions). */
  title?: string;
  /** Called when user cycles workflow mode (Shift+Tab). */
  onModeChange?: (mode: string) => void;
}

type RenderOptions = LegacyRenderOptions | StreamingRenderOptions;

// Ink manages cursor/screen lifecycle; avoid manual ANSI control codes.

function isStreamingOptions(opts: RenderOptions): opts is StreamingRenderOptions {
  return 'emitter' in opts;
}

/**
 * Non-TTY fallback - renders a simple text-based UI instead of Ink.
 * Use this when stdin/stdout is not a terminal.
 */

export async function renderTUIFallback(options: RenderOptions): Promise<void> {
  console.log(`┌─ ${colorizeOptaWord('Opta')} CLI (fallback mode) ─────────────────┐`);
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

  const { model, sessionId } = options;
  const appProps = isStreamingOptions(options)
    ? {
      model,
      sessionId,
      emitter: options.emitter,
      onSubmit: options.onSubmit,
      onCancelTurn: options.onCancelTurn,
      onSlashCommand: options.onSlashCommand,
      initialMessages: options.initialMessages,
      requireLoadedModel: options.requireLoadedModel,
      initialModelLoaded: options.initialModelLoaded,
      title: options.title,
      onModeChange: options.onModeChange,
    }
    : { model, sessionId, onMessage: options.onMessage };

  const { waitUntilExit } = render(
    <ErrorBoundary label="Opta TUI">
      <App {...appProps} />
    </ErrorBoundary>,
    {
      // Let App/useKeyboard handle Ctrl+C so it can cancel in-flight turns first.
      exitOnCtrlC: false,
    }
  );

  await waitUntilExit();
}
