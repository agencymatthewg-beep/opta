/**
 * Type definitions for the slash command registry.
 *
 * SlashHandler: each handler receives the args string and a context object,
 * returns a SlashResult indicating what the chat loop should do next.
 *
 * SlashContext: carries session, config, and mutable chat state so handlers
 * can modify the current mode, profile, etc.
 */

import type { Session } from '../../memory/store.js';
import type { OptaConfig } from '../../core/config.js';
import type { ChatState } from '../chat.js';

export type SlashResult = 'handled' | 'exit' | 'model-switched';

export interface SlashContext {
  session: Session;
  config: OptaConfig;
  chatState: ChatState;
}

export type SlashHandler = (args: string, ctx: SlashContext) => Promise<SlashResult>;

export interface SlashCommandDef {
  /** The command name WITHOUT the leading slash, e.g. 'exit' */
  command: string;
  /** Optional aliases (also without slash), e.g. ['quit', 'q'] */
  aliases?: string[];
  /** Human-readable description shown in /help and the browser */
  description: string;
  /** The handler function */
  handler: SlashHandler;
  /** Category for grouping in the interactive browser */
  category: 'session' | 'tools' | 'info' | 'server';
  /** Usage string shown in per-command help, e.g. '/model <name>' */
  usage?: string;
  /** Example commands, e.g. ['/model llama3', '/model'] */
  examples?: string[];
}
