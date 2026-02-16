#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from './core/version.js';
import { EXIT } from './core/errors.js';
import { setVerbose, setDebug } from './core/debug.js';

// --- SIGINT handler ---
let isShuttingDown = false;
process.on('SIGINT', () => {
  if (isShuttingDown) process.exit(EXIT.SIGINT);
  isShuttingDown = true;
  console.log('\n' + chalk.dim('Interrupted.'));
  process.exit(EXIT.SIGINT);
});

const program = new Command();

program
  .name('opta')
  .description('Agentic AI coding CLI powered by local LLMs')
  .version(VERSION, '-V, --version')
  .option('-v, --verbose', 'detailed output')
  .option('--debug', 'debug info including API calls')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts<{ verbose?: boolean; debug?: boolean }>();
    if (opts.verbose) setVerbose(true);
    if (opts.debug) setDebug(true);
  });

// Default action — show help when no command given
program.action(() => {
  program.outputHelp();
});

// --- Commands (lazy loaded) ---

program
  .command('chat')
  .description('Start an interactive AI chat session')
  .option('-r, --resume <id>', 'resume a previous session')
  .option('--plan', 'plan mode — all edits require approval')
  .option('-m, --model <name>', 'override default model')
  .action(async (opts) => {
    const { startChat } = await import('./commands/chat.js');
    await startChat(opts);
  });

program
  .command('do <task...>')
  .description('Execute a coding task using the agent loop')
  .option('-m, --model <name>', 'use specific model for this task')
  .action(async (task: string[], opts) => {
    const { executeTask } = await import('./commands/do.js');
    await executeTask(task, opts);
  });

program
  .command('status')
  .description('Check Opta LMX server health and loaded models')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { status } = await import('./commands/status.js');
    await status(opts);
  });

program
  .command('models')
  .description('List and manage loaded models')
  .argument('[action]', 'use | info | load | unload')
  .argument('[name]', 'model name')
  .option('--json', 'machine-readable output')
  .action(async (action, name, opts) => {
    const { models } = await import('./commands/models.js');
    await models(action, name, opts);
  });

program
  .command('config')
  .description('Manage configuration')
  .argument('[action]', 'get | set | list | reset')
  .argument('[key]', 'config key')
  .argument('[value]', 'config value')
  .action(async (action, key, value) => {
    const { config } = await import('./commands/config.js');
    await config(action, key, value);
  });

program
  .command('sessions')
  .description('Manage chat sessions')
  .argument('[action]', 'resume | delete | export')
  .argument('[id]', 'session id')
  .option('--json', 'machine-readable output')
  .action(async (action, id, opts) => {
    const { sessions } = await import('./commands/sessions.js');
    await sessions(action, id, opts);
  });

program
  .command('mcp')
  .description('Model Context Protocol tools (V2)')
  .action(async () => {
    const { mcp } = await import('./commands/mcp.js');
    await mcp();
  });

program
  .command('init')
  .description('Initialize Opta in a project (V2)')
  .option('--mode <mode>', 'initialization mode')
  .option('--force', 'overwrite existing config')
  .action(async () => {
    const { init } = await import('./commands/init.js');
    await init();
  });

program
  .command('diff')
  .description('Show changes made in a session (V2)')
  .option('-s, --session <id>', 'session to diff')
  .action(async (opts) => {
    const { diff } = await import('./commands/diff.js');
    await diff(opts);
  });

program
  .command('completions <shell>')
  .description('Generate shell completions (bash/zsh/fish)')
  .action(async (shell: string) => {
    const { completions } = await import('./commands/completions.js');
    await completions(shell);
  });

program.parse();
