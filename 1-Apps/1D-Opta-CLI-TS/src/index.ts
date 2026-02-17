#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from './core/version.js';
import { EXIT } from './core/errors.js';
import { setVerbose, setDebug } from './core/debug.js';

// --- SIGINT handler ---
export let isShuttingDown = false;

async function cleanup(): Promise<void> {
  try {
    const { shutdownProcessManager, forceKillAllProcesses } = await import('./core/tools/index.js');
    forceKillAllProcesses();
    await shutdownProcessManager();
  } catch {
    // Best effort cleanup
  }
}

process.on('SIGINT', () => {
  if (isShuttingDown) process.exit(EXIT.SIGINT); // Second SIGINT = force kill
  isShuttingDown = true;
  console.log('\n' + chalk.dim('Interrupted.'));

  // Grace timeout: force exit after 3 seconds if cleanup hangs
  const graceTimer = setTimeout(() => {
    process.exit(EXIT.SIGINT);
  }, 3000);
  graceTimer.unref(); // Don't keep process alive just for this timer

  cleanup().finally(() => {
    clearTimeout(graceTimer);
    process.exit(EXIT.SIGINT);
  });
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

program.addHelpText('after', `
Examples:
  $ opta chat                    Start interactive session
  $ opta do "fix the auth bug"   One-shot task
  $ opta status                  Check connection
  $ opta models                  List available models
`);

// --- Commands (lazy loaded) ---

program
  .command('chat')
  .description('Start an interactive AI chat session')
  .option('-r, --resume <id>', 'resume a previous session')
  .option('--plan', 'plan mode — read-only, design implementation approach')
  .option('--review', 'code review mode — read-only, structured review output')
  .option('--research', 'research mode — explore ideas, gather information')
  .option('-m, --model <name>', 'override default model')
  .option('-f, --format <type>', 'output format: text (default) or json')
  .option('--no-commit', 'disable auto-commit at task end')
  .option('--no-checkpoints', 'disable checkpoint creation')
  .option('-a, --auto', 'auto-accept file edits without prompting')
  .option('--dangerous', 'bypass all permission prompts')
  .option('--yolo', 'alias for --dangerous')
  .option('--tui', 'use full-screen terminal UI')
  .addHelpText('after', `
Examples:
  $ opta chat                    New session
  $ opta chat --resume abc123    Resume session
  $ opta chat --model qwen2.5    Use specific model
  $ opta chat --tui              Full-screen mode
`)
  .action(async (opts) => {
    const { startChat } = await import('./commands/chat.js');
    await startChat(opts);
  });

program
  .command('do <task...>')
  .description('Execute a coding task using the agent loop')
  .option('-m, --model <name>', 'use specific model for this task')
  .option('-f, --format <type>', 'output format: text (default) or json')
  .option('-q, --quiet', 'suppress output (exit code only, errors to stderr)')
  .option('-o, --output <path>', 'write result to file')
  .option('--no-commit', 'disable auto-commit at task end')
  .option('--no-checkpoints', 'disable checkpoint creation')
  .option('-a, --auto', 'auto-accept file edits without prompting')
  .option('--dangerous', 'bypass all permission prompts')
  .option('--yolo', 'alias for --dangerous')
  .addHelpText('after', `
Examples:
  $ opta do "refactor auth module"
  $ opta do "fix bug in utils.ts" --model qwen2.5
  $ opta do "run tests" --format json
`)
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
  .argument('[action]', 'scan | use | info | load | unload')
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
  .option('--json', 'output as JSON')
  .action(async (action, key, value, opts) => {
    const { config } = await import('./commands/config.js');
    await config(action, key, value, opts);
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

const mcpCmd = program
  .command('mcp')
  .description('Manage MCP (Model Context Protocol) servers');

mcpCmd
  .command('list')
  .description('Show configured MCP servers')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { mcpList } = await import('./commands/mcp.js');
    await mcpList(opts);
  });

mcpCmd
  .command('add <name> <command>')
  .description('Add a stdio MCP server')
  .option('--env <pairs>', 'environment variables (KEY=VAL,KEY2=VAL2)')
  .action(async (name: string, command: string, opts) => {
    const { mcpAdd } = await import('./commands/mcp.js');
    await mcpAdd(name, command, opts);
  });

mcpCmd
  .command('remove <name>')
  .description('Remove an MCP server')
  .action(async (name: string) => {
    const { mcpRemove } = await import('./commands/mcp.js');
    await mcpRemove(name);
  });

mcpCmd
  .command('test <name>')
  .description('Test connection to an MCP server')
  .action(async (name: string) => {
    const { mcpTest } = await import('./commands/mcp.js');
    await mcpTest(name);
  });

program
  .command('init')
  .description('Initialize OPIS project intelligence docs')
  .option('-y, --yes', 'skip prompts, use defaults (CI mode)')
  .option('--force', 'overwrite existing APP.md')
  .action(async (opts) => {
    const { init } = await import('./commands/init.js');
    await init(opts);
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
  .command('serve')
  .description('Manage the remote Opta LMX inference server')
  .argument('[action]', 'start | stop | restart | logs (default: status)')
  .option('--json', 'machine-readable output')
  .action(async (action, opts) => {
    const { serve } = await import('./commands/serve.js');
    await serve(action, opts);
  });

program
  .command('server')
  .description('Start an HTTP API server for non-interactive use')
  .option('-p, --port <port>', 'server port', '3456')
  .option('--host <host>', 'server bind address', '127.0.0.1')
  .option('-m, --model <name>', 'override default model')
  .action(async (opts) => {
    const { startServer } = await import('./commands/server.js');
    await startServer({
      port: parseInt(opts.port, 10),
      host: opts.host,
      model: opts.model,
    });
  });

program
  .command('doctor')
  .description('Check Opta setup and connectivity')
  .option('-f, --format <type>', 'output format (text, json)')
  .action(async (opts) => {
    const { runDoctor } = await import('./commands/doctor.js');
    await runDoctor(opts);
  });

program
  .command('completions <shell>')
  .description('Generate shell completions (bash/zsh/fish)')
  .action(async (shell: string) => {
    const { completions } = await import('./commands/completions.js');
    await completions(shell);
  });

program.parse();
