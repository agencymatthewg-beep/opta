#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { VERSION } from './core/version.js';
import { EXIT, ExitError } from './core/errors.js';
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

// Default action — launch chat/menu in interactive terminals, help in non-interactive contexts.
program.action(async () => {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive) {
    program.outputHelp();
    return;
  }
  await runChat({ tui: true });
});

program.addHelpText('after', `
Examples:
  $ opta chat                    Start interactive session
  $ opta tui                     Start full-screen terminal UI
  $ opta do "fix the auth bug"   One-shot task
  $ opta embed "semantic query"  Generate an embedding via Opta LMX
  $ opta rerank "release notes" --documents "notes|commits|chat"
  $ opta benchmark --serve       Generate + host benchmark showcase apps
  $ opta env save laptop         Save current host/model as a named profile
  $ opta env use laptop          Switch to that profile
  $ opta update                  Update CLI, LMX, and Plus
  $ opta daemon start            Start background daemon
  $ opta status                  Check connection
  $ opta models                  Open interactive model manager
`);

// --- Commands (lazy loaded) ---

type ChatCommandOptions = {
  resume?: string;
  plan?: boolean;
  review?: boolean;
  research?: boolean;
  model?: string;
  device?: string;
  format?: string;
  commit?: boolean;
  checkpoints?: boolean;
  auto?: boolean;
  dangerous?: boolean;
  yolo?: boolean;
  tui?: boolean;
};

function addChatOptions(command: Command): Command {
  return command
    .option('-r, --resume <id>', 'resume a previous session')
    .option('--plan', 'plan mode — read-only, design implementation approach')
    .option('--review', 'code review mode — read-only, structured review output')
    .option('--research', 'research mode — explore ideas, gather information')
    .option('-m, --model <name>', 'override default model')
    .option('--device <host[:port]>', 'target LLM network device host (optionally with port)')
    .option('-f, --format <type>', 'output format: text (default) or json')
    .option('--no-commit', 'disable auto-commit at task end')
    .option('--no-checkpoints', 'disable checkpoint creation')
    .option('-a, --auto', 'auto-accept file edits without prompting')
    .option('--dangerous', 'bypass all permission prompts')
    .option('--yolo', 'alias for --dangerous')
    .option('--tui', 'use full-screen terminal UI');
}

async function runChat(opts: ChatCommandOptions): Promise<void> {
  const { startChat } = await import('./commands/chat.js');
  await startChat(opts);
}

interface DeviceOption {
  device?: string;
}

async function applyDeviceOption(opts?: DeviceOption): Promise<void> {
  const raw = opts?.device?.trim();
  if (!raw) return;

  const { applyDeviceTargetEnv } = await import('./core/device-target.js');
  try {
    applyDeviceTargetEnv(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid --device value';
    console.error(chalk.red('✗') + ` ${message}`);
    throw new ExitError(EXIT.MISUSE);
  }
}

addChatOptions(
  program
    .command('chat')
  .description('Start an interactive AI chat session')
)
  .addHelpText('after', `
Examples:
  $ opta chat                    New session
  $ opta chat --resume abc123    Resume session
  $ opta chat --model qwen2.5    Use specific model
  $ opta chat --device mono512:1234
  $ opta chat --tui              Full-screen mode
`)
  .action(async (opts: ChatCommandOptions) => {
    await applyDeviceOption(opts);
    await runChat(opts);
  });

addChatOptions(
  program
    .command('tui')
    .description('Start full-screen terminal UI (alias for `opta chat --tui`)')
)
  .addHelpText('after', `
Examples:
  $ opta tui                     New full-screen session
  $ opta tui --resume abc123     Resume session in full-screen mode
  $ opta tui --model qwen2.5     Use specific model in full-screen mode
  $ opta tui --device mono512
`)
  .action(async (opts: ChatCommandOptions) => {
    await applyDeviceOption(opts);
    await runChat({ ...opts, tui: true });
  });

program
  .command('do <task...>')
  .description('Execute a coding task using the agent loop')
  .option('-m, --model <name>', 'use specific model for this task')
  .option('--device <host[:port]>', 'target LLM network device host (optionally with port)')
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
  $ opta do "summarize repository" --device mono512:1234
  $ opta do "run tests" --format json
`)
  .action(async (task: string[], opts) => {
    await applyDeviceOption(opts);
    const { executeTask } = await import('./commands/do.js');
    await executeTask(task, opts);
  });

program
  .command('embed <text...>')
  .description('Create embeddings via Opta LMX helper nodes')
  .option('-m, --model <id>', 'embedding model id')
  .option('--device <host[:port]>', 'target LLM network device host (optionally with port)')
  .option('--json', 'machine-readable output')
  .addHelpText('after', `
Examples:
  $ opta embed "hello world"
  $ opta embed "hello world" --device 192.168.1.20
  $ opta embed "semantic search query" --model snowflake/arctic-embed-m-v2.0
`)
  .action(async (text: string[], opts) => {
    await applyDeviceOption(opts);
    const { embed } = await import('./commands/embed.js');
    await embed(text, opts);
  });

program
  .command('rerank <query...>')
  .description('Rerank candidate documents via Opta LMX')
  .requiredOption('-d, --documents <docs>', 'pipe-separated documents, e.g. "doc1|doc2|doc3"')
  .option('-m, --model <id>', 'reranker model id')
  .option('--device <host[:port]>', 'target LLM network device host (optionally with port)')
  .option('-k, --top-k <n>', 'return top N results')
  .option('--json', 'machine-readable output')
  .addHelpText('after', `
Examples:
  $ opta rerank "what changed?" --documents "release notes|commit log|meeting notes"
  $ opta rerank "auth failures" --documents "ticket|postmortem|chat" --device mono512
  $ opta rerank "auth failures" --documents "ticket|postmortem|chat" --top-k 2 --json
`)
  .action(async (query: string[], opts: { documents: string; model?: string; device?: string; topK?: string; json?: boolean }) => {
    await applyDeviceOption(opts);
    const { rerank } = await import('./commands/rerank.js');
    await rerank(query, opts);
  });

program
  .command('benchmark')
  .description('Generate Opta benchmark suite apps (landing, chess, AI-news research)')
  .option('-o, --output <dir>', 'output directory (default: ./apps/opta-benchmark-suite)')
  .option('--query <text>', 'override AI news research query')
  .option('--words <n>', 'minimum words for AI news report (>=500)', '650')
  .option('--max-results <n>', 'max research results/citations to request', '10')
  .option('--provider-order <list>', 'comma-separated provider order (tavily,gemini,exa,brave,groq)')
  .option('--serve', 'serve generated suite over local HTTP')
  .option('--host <host>', 'host for --serve (default: 127.0.0.1)', '127.0.0.1')
  .option('--port <port>', 'port for --serve (default: 4789)', '4789')
  .option('--force', 'allow using an existing output directory')
  .option('--json', 'machine-readable output')
  .addHelpText('after', `
Examples:
  $ opta benchmark
  $ opta benchmark --serve
  $ opta benchmark --output ./apps/demo-suite --words 800
  $ opta benchmark --provider-order tavily,exa,brave
`)
  .action(async (opts) => {
    const { benchmark } = await import('./commands/benchmark.js');
    await benchmark(opts);
  });

program
  .command('status')
  .description('Check Opta LMX server health and loaded models')
  .option('--device <host[:port]>', 'target LLM network device host (optionally with port)')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    await applyDeviceOption(opts);
    const { status } = await import('./commands/status.js');
    await status(opts);
  });

program
  .command('models')
  .description('List and manage loaded models')
  .argument('[action]', 'list | manage | dashboard | scan | use | info | load | unload | stop | swap | alias | aliases | unalias | download | delete | benchmark | predictor | helpers | quantize | agents | skills | rag | health | browse-local | browse-library')
  .argument('[args...]', 'model query args (for swap: <running> <replacement>)')
  .option('--device <host[:port]>', 'target LLM network device host (optionally with port)')
  .option('--json', 'machine-readable output')
  .addHelpText('after', `
Examples:
  $ opta models                     Interactive manager (TTY) or list output
  $ opta models --device mono512
  $ opta models manage              Force interactive manager
  $ opta models use                 Pick default model via keyboard
  $ opta models load minimax        Fuzzy match and load a model
  $ opta models swap                Interactive swap (choose old/new)
  $ opta models dashboard           At-a-glance model health + aliases
  $ opta models predictor           Predictor stats and next-model guess
  $ opta models helpers             Helper node health dashboard
  $ opta models quantize list       List quantization jobs
  $ opta models quantize start mistralai/Mistral-7B-Instruct-v0.3 --bits 4
  $ opta models agents list --status running
  $ opta models agents start --prompt "triage failures" --roles planner,executor
  $ opta models skills tools
  $ opta models skills run ai26-3c-productivity-writing-plans --args '{"topic":"routing"}'
  $ opta models rag collections
  $ opta models rag ingest docs --file ./README.md --chunking markdown_headers
  $ opta models health --ready --admin
  $ opta models alias glm5 inferencerlabs/GLM-5-MLX-4.8bit
  $ opta models scan                Full local/cloud model inventory
  $ opta models browse-local        Browse downloaded models + history
  $ opta models browse-library      Browse full downloadable library
`)
  .action(async (action, args, opts) => {
    await applyDeviceOption(opts);
    const rawArgs = (args as string[] | undefined) ?? [];
    const query = rawArgs.length > 0 ? rawArgs.join(' ') : undefined;
    const first = rawArgs[0];
    const rest = rawArgs.slice(1).join(' ').trim();
    const swapFrom = first;
    const swapTo = rest || undefined;

    const { models } = await import('./commands/models/index.js');
    const expectsSplitArgs = action === 'swap' || action === 'alias';
    await models(action, expectsSplitArgs ? swapFrom : query, expectsSplitArgs ? swapTo : undefined, opts);
  });

program
  .command('env')
  .description('Manage named environment profiles')
  .argument('[action]', 'list | show | save | use | delete')
  .argument('[name]', 'profile name')
  .option('--host <host>', 'override connection host when saving')
  .option('--port <port>', 'override connection port when saving')
  .option('--admin-key <key>', 'override connection admin key when saving (empty string clears)')
  .option('--model <id>', 'override default model when saving')
  .option('--provider <name>', 'provider for profile (lmx|anthropic)')
  .option('--mode <name>', 'default mode (safe|auto|plan|review|research|dangerous|ci)')
  .option('--json', 'machine-readable output')
  .addHelpText('after', `
Examples:
  $ opta env                         List all environment profiles
  $ opta env save laptop             Save current settings as "laptop"
  $ opta env save mono --host 192.168.188.11 --port 1234
  $ opta env use laptop              Apply a saved profile
  $ opta env show laptop             Show profile details
  $ opta env delete old-server       Remove a profile
`)
  .action(async (action, name, opts) => {
    const { envCommand } = await import('./commands/env.js');
    await envCommand(action, name, opts);
  });

program
  .command('config')
  .description('Manage configuration')
  .argument('[action]', 'get | set | list | reset | menu')
  .argument('[key]', 'config key')
  .argument('[value]', 'config value')
  .option('--json', 'output as JSON')
  .action(async (action, key, value, opts) => {
    const { config } = await import('./commands/config.js');
    await config(action, key, value, opts);
  });

const accountCmd = program
  .command('account')
  .description('Manage Supabase-native account authentication');

accountCmd
  .command('signup')
  .description('Create an account using email or phone + password')
  .requiredOption('--identifier <emailOrPhone>', 'email or phone')
  .option('--name <name>', 'display name')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { accountSignup } = await import('./commands/account.js');
    await accountSignup(opts);
  });

accountCmd
  .command('login')
  .description('Log in with email or phone + password')
  .requiredOption('--identifier <emailOrPhone>', 'email or phone')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { accountLogin } = await import('./commands/account.js');
    await accountLogin(opts);
  });

accountCmd
  .command('status')
  .description('Show local account session status')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { accountStatus } = await import('./commands/account.js');
    await accountStatus(opts);
  });

const keyCmd = program
  .command('key')
  .description('Manage Opta inference API keys for OpenAI-compatible clients');

keyCmd
  .command('create')
  .description('Create or rotate inference API key and sync to Studio LMX')
  .option('--value <key>', 'use explicit key value instead of generating one')
  .option('--no-remote', 'skip syncing key to Studio LMX config')
  .option('--no-copy', 'skip copying key to clipboard')
  .option('--json', 'machine-readable output')
  .addHelpText('after', `
Examples:
  $ opta key create
  $ opta key create --no-remote
  $ opta key create --value opta_sk_custom_123
`)
  .action(async (opts) => {
    const { keyCreate } = await import('./commands/key.js');
    await keyCreate(opts);
  });

keyCmd
  .command('show')
  .description('Show current inference API key (masked by default)')
  .option('--reveal', 'print full key value')
  .option('--copy', 'copy key to clipboard')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { keyShow } = await import('./commands/key.js');
    await keyShow(opts);
  });

keyCmd
  .command('copy')
  .description('Copy current inference API key to clipboard')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { keyCopy } = await import('./commands/key.js');
    await keyCopy(opts);
  });

accountCmd
  .command('logout')
  .description('Log out and clear local account session')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { accountLogout } = await import('./commands/account.js');
    await accountLogout(opts);
  });

program
  .command('sessions')
  .description('Manage chat sessions')
  .argument('[action]', 'resume | delete | export | search')
  .argument('[id]', 'session id or search query')
  .option('--json', 'machine-readable output')
  .option('--model <name>', 'filter by model name')
  .option('--source <mode>', 'session source: local | lmx | hybrid (default: hybrid)', 'hybrid')
  .option('--since <date>', 'filter sessions after date (ISO or relative: 7d, 2w, 1m)')
  .option('--tag <tag>', 'filter by tag')
  .option('--limit <n>', 'limit results (default 20)')
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
  .command('add-playwright')
  .description('Add a Playwright MCP server using browser config defaults')
  .option('--name <name>', 'server name (default: playwright)')
  .option('--mode <mode>', 'browser mode: isolated|attach')
  .option('--command <command>', 'command runner (default: npx)')
  .option('--package <name>', 'MCP package name (default: @playwright/mcp@latest)')
  .option('--allowed-hosts <hosts>', 'comma-separated host allowlist')
  .option('--blocked-origins <origins>', 'comma-separated origin blocklist')
  .option('--env <pairs>', 'environment variables (KEY=VAL,KEY2=VAL2)')
  .action(async (opts: {
    name?: string;
    mode?: string;
    command?: string;
    package?: string;
    allowedHosts?: string;
    blockedOrigins?: string;
    env?: string;
  }) => {
    const { mcpAddPlaywright } = await import('./commands/mcp.js');
    await mcpAddPlaywright({
      name: opts.name,
      mode: opts.mode === 'attach' ? 'attach' : opts.mode === 'isolated' ? 'isolated' : undefined,
      command: opts.command,
      packageName: opts.package,
      allowedHosts: opts.allowedHosts?.split(',').map((value) => value.trim()).filter(Boolean),
      blockedOrigins: opts.blockedOrigins?.split(',').map((value) => value.trim()).filter(Boolean),
      env: opts.env,
    });
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
  .command('update')
  .description('Update Opta components (CLI, LMX, Plus; optional Web) on local/remote targets')
  .option('-c, --components <list>', 'comma-separated components: cli,lmx,plus,web (default: cli,lmx,plus)')
  .option('-t, --target <mode>', 'target mode: auto|local|remote|both (default: auto)', 'auto')
  .option('--remote-host <host>', 'override remote host (default: connection.host)')
  .option('--remote-user <user>', 'override SSH user (default: connection.ssh.user)')
  .option('--identity-file <path>', 'override SSH identity file (default: connection.ssh.identityFile)')
  .option('--local-root <path>', 'override local 1-Apps root')
  .option('--remote-root <path>', 'override remote 1-Apps root')
  .option('--dry-run', 'show planned commands without executing')
  .option('--no-build', 'skip build/install/restart steps')
  .option('--no-pull', 'skip git fetch/pull steps')
  .option('--json', 'machine-readable output')
  .addHelpText('after', `
Examples:
  $ opta update
  $ opta update --components web --target local
  $ opta update --components lmx --target both
  $ opta update --target remote --remote-host Mono512
  $ opta update --dry-run --json
`)
  .action(async (opts) => {
    const { updateCommand } = await import('./commands/update.js');
    await updateCommand(opts);
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

const daemonCmd = program
  .command('daemon')
  .description('Manage Opta Level 3 daemon runtime');

daemonCmd
  .command('start')
  .description('Start daemon in background (or attach if already running)')
  .option('--host <host>', 'bind host', '127.0.0.1')
  .option('--port <port>', 'preferred port', '9999')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { daemonStart } = await import('./commands/daemon.js');
    await daemonStart(opts);
  });

daemonCmd
  .command('run')
  .description('Run daemon in foreground (internal)')
  .option('--host <host>', 'bind host', '127.0.0.1')
  .option('--port <port>', 'preferred port', '9999')
  .option('--token <token>', 'daemon session token')
  .option('--model <name>', 'model override for this daemon process')
  .action(async (opts: { host: string; port: string; token?: string; model?: string }) => {
    const { daemonRun } = await import('./commands/daemon.js');
    await daemonRun(opts);
  });

daemonCmd
  .command('stop')
  .description('Stop daemon')
  .action(async (opts) => {
    const { daemonStop } = await import('./commands/daemon.js');
    await daemonStop(opts);
  });

daemonCmd
  .command('status')
  .description('Show daemon status')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { daemonStatusCommand } = await import('./commands/daemon.js');
    await daemonStatusCommand(opts);
  });

daemonCmd
  .command('logs')
  .description('Show daemon logs')
  .option('--json', 'machine-readable output')
  .action(async (opts) => {
    const { daemonLogs } = await import('./commands/daemon.js');
    await daemonLogs(opts);
  });

program
  .command('doctor')
  .description('Check Opta setup, inference auth, and host failover')
  .option('--json', 'machine-readable output')
  .option('-f, --format <type>', 'output format (text, json)')
  .action(async (opts) => {
    // --json is the canonical flag; --format json is kept for backwards compat
    const effectiveOpts = { format: opts.json ? 'json' : opts.format };
    const { runDoctor } = await import('./commands/doctor.js');
    await runDoctor(effectiveOpts);
  });

program
  .command('completions <shell>')
  .description('Generate shell completions (bash/zsh/fish)')
  .action(async (shell: string) => {
    const { completions } = await import('./commands/completions.js');
    await completions(shell);
  });

const keychainCmd = program
  .command('keychain')
  .description('Manage API keys in the OS secure keychain (macOS Keychain / Linux secret-tool)');

keychainCmd
  .command('status')
  .description('Show keychain availability and stored key presence')
  .action(async () => {
    const { runKeychainCommand } = await import('./commands/keychain.js');
    await runKeychainCommand('status');
  });

keychainCmd
  .command('set-anthropic <key>')
  .description('Store an Anthropic API key in the OS keychain')
  .action(async (key: string) => {
    const { runKeychainCommand } = await import('./commands/keychain.js');
    await runKeychainCommand('set-anthropic', key);
  });

keychainCmd
  .command('set-lmx <key>')
  .description('Store an LMX API key in the OS keychain')
  .action(async (key: string) => {
    const { runKeychainCommand } = await import('./commands/keychain.js');
    await runKeychainCommand('set-lmx', key);
  });

keychainCmd
  .command('delete-anthropic')
  .description('Remove the Anthropic API key from the OS keychain')
  .action(async () => {
    const { runKeychainCommand } = await import('./commands/keychain.js');
    await runKeychainCommand('delete-anthropic');
  });

keychainCmd
  .command('delete-lmx')
  .description('Remove the LMX API key from the OS keychain')
  .action(async () => {
    const { runKeychainCommand } = await import('./commands/keychain.js');
    await runKeychainCommand('delete-lmx');
  });

program.parseAsync().catch((err: unknown) => {
  if (err instanceof ExitError) {
    process.exit(err.exitCode);
  }
  throw err;
});
