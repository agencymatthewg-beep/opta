import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { agentLoop, buildSystemPrompt, estimateTokens } from '../core/agent.js';
import type { AgentMessage } from '../core/agent.js';
import { formatError, OptaError, EXIT } from '../core/errors.js';
import {
  createSession,
  loadSession,
  saveSession,
  generateTitle,
} from '../memory/store.js';
import { resolveFileRefs, buildContextWithRefs } from '../core/fileref.js';
import { box, kv, statusDot, fmtTokens, progressBar } from '../ui/box.js';
import { InputEditor } from '../ui/input.js';
import { InputHistory } from '../ui/history.js';
import type { Session } from '../memory/store.js';

interface ChatOptions {
  resume?: string;
  plan?: boolean;
  model?: string;
  commit?: boolean;
  checkpoints?: boolean;
  format?: string;
  auto?: boolean;
  dangerous?: boolean;
  yolo?: boolean;
  tui?: boolean;
}

export type OptaMode = 'normal' | 'plan' | 'auto-accept';

export interface ChatState {
  currentMode: OptaMode;
  agentProfile: string;
  lastThinkingRenderer?: import('../ui/thinking.js').ThinkingRenderer;
  thinkingExpanded?: boolean;
}

export async function startChat(opts: ChatOptions): Promise<void> {
  const overrides: Record<string, unknown> = {};
  if (opts.model) {
    overrides['model'] = { default: opts.model };
  }
  if (opts.commit === false) {
    overrides['git'] = { ...((overrides['git'] as Record<string, unknown>) ?? {}), autoCommit: false };
  }
  if (opts.checkpoints === false) {
    overrides['git'] = { ...((overrides['git'] as Record<string, unknown>) ?? {}), checkpoints: false };
  }

  if (opts.dangerous || opts.yolo) {
    overrides['defaultMode'] = 'dangerous';
  } else if (opts.auto) {
    overrides['defaultMode'] = 'auto';
  } else if (opts.plan) {
    overrides['defaultMode'] = 'plan';
  }

  const jsonMode = opts.format === 'json';
  let config = await loadConfig(overrides);

  if (!config.model.default) {
    console.error(
      chalk.red('✗') +
        ' No model configured\n\n' +
        chalk.dim('Run ') +
        chalk.cyan('opta status') +
        chalk.dim(' to check your LMX connection')
    );
    process.exit(EXIT.NO_CONNECTION);
  }

  // Create or resume session
  let session: Session;
  if (opts.resume) {
    try {
      session = await loadSession(opts.resume);
      if (!jsonMode) {
        const msgCount = session.messages.filter(m => m.role !== 'system').length;
        console.log('\n' + box('Opta', [
          kv('LMX', `${config.connection.host}:${config.connection.port} ${statusDot(true)}`),
          kv('Model', session.model),
          kv('Session', `${session.id.slice(0, 8)} ${chalk.dim('(resumed)')}`),
          ...(session.title ? [kv('Title', chalk.italic(session.title.slice(0, 40)))] : []),
          kv('Messages', String(msgCount)),
        ]));
      }
    } catch {
      console.error(
        chalk.red('✗') + ` Session not found: ${opts.resume}\n\n` +
        chalk.dim('Run ') + chalk.cyan('opta sessions') + chalk.dim(' to list available sessions')
      );
      process.exit(EXIT.NOT_FOUND);
    }
  } else {
    session = await createSession(config.model.default);
    // Initialize system prompt for new session
    const systemPrompt = await buildSystemPrompt(config);
    session.messages = [{ role: 'system', content: systemPrompt }];
    await saveSession(session);

    if (!jsonMode) {
      console.log('\n' + box('Opta', [
        kv('LMX', `${config.connection.host}:${config.connection.port} ${statusDot(true)}`),
        kv('Model', config.model.default),
        kv('Session', `${session.id.slice(0, 8)} ${chalk.dim('(new)')}`),
      ]));
    }
  }

  if (!jsonMode) {
    console.log(chalk.dim('  Type /help for commands, / to browse, /exit to quit\n'));
  }

  // TUI mode: full-screen Ink rendering (--tui flag or tui.default config)
  if (opts.tui || config.tui.default) {
    const { renderTUI } = await import('../tui/render.js');
    await renderTUI({
      model: config.model.default,
      sessionId: session.id,
      onMessage: async (text: string) => {
        const result = await agentLoop(text, config, {
          existingMessages: session.messages,
          sessionId: session.id,
          silent: true,
        });
        session.messages = result.messages;
        await saveSession(session);
        const last = result.messages.filter((m: AgentMessage) => m.role === 'assistant').pop();
        return typeof last?.content === 'string' ? last.content : '';
      },
    });
    return;
  }

  // Mode state
  const chatState: ChatState = {
    currentMode: opts.plan ? 'plan' : (opts.auto ? 'auto-accept' : 'normal'),
    agentProfile: 'default',
  };
  if (opts.dangerous || opts.yolo) chatState.currentMode = 'normal'; // dangerous handled by config mode

  // InputEditor for buffer management and mode detection
  const editor = new InputEditor({
    prompt: '>',
    mode: chatState.currentMode === 'plan' ? 'plan' : (chatState.currentMode === 'auto-accept' ? 'auto' : 'normal'),
  });

  // Input history with deduplication
  const history = new InputHistory();

  function getPromptMessage(): string {
    // Sync editor mode with chat state
    editor.setMode(
      chatState.currentMode === 'plan' ? 'plan' : (chatState.currentMode === 'auto-accept' ? 'auto' : 'normal')
    );
    return editor.getPromptDisplay();
  }

  // REPL loop
  const { input } = await import('@inquirer/prompts');

  while (true) {
    let userInput: string;
    try {
      userInput = await input({ message: getPromptMessage() });
    } catch {
      // Ctrl+C or EOF
      await saveSession(session);
      if (!jsonMode) {
        const msgCount = session.messages.filter(m => m.role !== 'system').length;
        console.log(
          '\n' + chalk.green('✓') + chalk.dim(` Session saved: ${session.id.slice(0, 8)} · ${msgCount} msgs`)
        );
      }
      break;
    }

    if (!userInput.trim()) continue;

    // Track input in history
    history.push(userInput);

    // Slash commands
    if (userInput.startsWith('/')) {
      const handled = await handleSlashCommand(userInput, session, config, chatState);
      if (handled === 'exit') {
        await saveSession(session);
        if (!jsonMode) {
          const msgCount = session.messages.filter(m => m.role !== 'system').length;
          console.log(
            chalk.green('✓') + chalk.dim(` Session saved: ${session.id.slice(0, 8)}`) +
            (session.title ? chalk.dim(` "${session.title}"`) : '') +
            chalk.dim(` · ${msgCount} msgs`)
          );
        }
        break;
      }
      if (handled === 'model-switched') {
        // Reload config to pick up model change
        config = await loadConfig(overrides);
      }
      continue;
    }

    // Shell mode: !command executes directly
    if (userInput.startsWith('!')) {
      const cmd = userInput.slice(1).trim();
      if (!cmd) continue;
      console.log(chalk.dim(`  $ ${cmd}`));
      try {
        const { execSync } = await import('node:child_process');
        const output = execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), timeout: 30000 });
        if (output.trim()) console.log(output);
        console.log(chalk.green('✓') + chalk.dim(' exit 0'));
      } catch (err: unknown) {
        const e = err as { status?: number; stderr?: string; stdout?: string };
        if (e.stdout) console.log(e.stdout);
        if (e.stderr) console.error(chalk.red(e.stderr));
        console.log(chalk.red('✗') + chalk.dim(` exit ${e.status ?? 1}`));
      }
      continue;
    }

    // Show @ file autocomplete hints (lightweight — full interactive autocomplete in Phase 2)
    if (userInput.includes('@') && !userInput.startsWith('/')) {
      const { getProjectFiles, getCompletions } = await import('../ui/autocomplete.js');
      const atMatch = userInput.match(/@(\S*)$/);
      if (atMatch?.[1]) {
        const files = await getProjectFiles(process.cwd());
        const matches = getCompletions(atMatch[1], files, 5);
        if (matches.length > 0 && matches[0] !== atMatch[1]) {
          console.log(chalk.dim('  Matches: ') + matches.map(f => chalk.cyan(`@${f}`)).join(chalk.dim(', ')));
        }
      }
    }

    // Resolve @file references
    const { refs } = await resolveFileRefs(userInput);
    const enrichedInput = buildContextWithRefs(userInput, refs);

    // Set title from first user message
    if (!session.title) {
      session.title = generateTitle(userInput);
    }

    try {
      const result = await agentLoop(enrichedInput, config, {
        existingMessages: session.messages,
        sessionId: session.id,
        silent: jsonMode,
        mode: chatState.currentMode === 'plan' ? 'plan' : undefined,
      });

      session.messages = result.messages;
      session.toolCallCount += result.toolCallCount;
      // Track thinking renderer for /expand toggle
      if (result.lastThinkingRenderer) {
        chatState.lastThinkingRenderer = result.lastThinkingRenderer;
        chatState.thinkingExpanded = false;
      }
      await saveSession(session);

      if (jsonMode) {
        const assistantMsgs = result.messages.filter((m: AgentMessage) => m.role === 'assistant');
        const lastMsg = assistantMsgs[assistantMsgs.length - 1];
        console.log(JSON.stringify({
          role: 'assistant',
          content: lastMsg?.content ?? '',
          tool_calls: lastMsg?.tool_calls ?? [],
        }));
      }
    } catch (err) {
      if (err instanceof OptaError) {
        console.error(formatError(err));
      } else {
        console.error(chalk.red('✗') + ` ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

// --- Slash Command Handler ---

type SlashResult = 'handled' | 'exit' | 'model-switched';

async function handleSlashCommand(
  input: string,
  session: Session,
  config: import('../core/config.js').OptaConfig,
  state: ChatState
): Promise<SlashResult> {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0]!.toLowerCase();
  const arg = parts.slice(1).join(' ');

  switch (cmd) {
    case '/exit':
    case '/quit':
    case '/q':
      return 'exit';

    case '/help':
    case '/h':
    case '/?': {
      const cmdLine = (cmd: string, desc: string) =>
        chalk.cyan(cmd.padEnd(16)) + chalk.dim(desc);
      console.log('\n' + box('Commands', [
        chalk.dim('Session'),
        cmdLine('/exit', 'Save and exit'),
        cmdLine('/model', 'Switch model (picker)'),
        cmdLine('/agent', 'Switch agent profile'),
        cmdLine('/plan', 'Toggle plan mode'),
        cmdLine('/sessions', 'List recent sessions'),
        cmdLine('/share', 'Export conversation'),
        cmdLine('/theme', 'Change UI theme'),
        '',
        chalk.dim('Tools'),
        cmdLine('/undo [n]', 'Reverse last checkpoint'),
        cmdLine('/compact', 'Force context compaction'),
        cmdLine('/image <path>', 'Analyze an image'),
        cmdLine('/editor', 'Open $EDITOR for input'),
        cmdLine('/init', 'Generate project context'),
        '',
        chalk.dim('Info'),
        cmdLine('/history', 'Conversation summary'),
        cmdLine('/status', 'System & LMX status'),
        cmdLine('/stats', 'Session analytics'),
        cmdLine('/diff', 'Uncommitted changes'),
        cmdLine('/cost', 'Token usage breakdown'),
        cmdLine('/expand', 'Toggle thinking display'),
        cmdLine('/clear', 'Clear screen'),
      ]));
      console.log(chalk.dim('  Tip: type / to browse commands interactively\n'));
      return 'handled';
    }

    case '/model': {
      if (arg) {
        // Direct switch: /model <name>
        try {
          const { saveConfig } = await import('../core/config.js');
          await saveConfig({ model: { default: arg } });
          session.model = arg;
          console.log(chalk.green('✓') + ` Switched to ${arg}`);
          return 'model-switched';
        } catch (err) {
          console.error(chalk.red('✗') + ` Failed to switch model: ${err}`);
          return 'handled';
        }
      }

      // Interactive model picker: fetch from LMX
      try {
        const { LmxClient } = await import('../lmx/client.js');
        const lmx = new LmxClient({
          host: config.connection.host,
          port: config.connection.port,
          adminKey: config.connection.adminKey,
        });
        const { models: loadedModels } = await lmx.models();

        if (loadedModels.length === 0) {
          console.log(chalk.dim('  No models loaded on LMX'));
          return 'handled';
        }

        const { select } = await import('@inquirer/prompts');
        const { lookupContextLimit } = await import('../lmx/client.js');
        const { fmtTokens: fmtTok } = await import('../ui/box.js');

        const choices = loadedModels.map(m => {
          const isCurrent = m.model_id === config.model.default;
          const dot = isCurrent ? chalk.green('● ') : '  ';
          const ctx = lookupContextLimit(m.model_id);
          const memStr = m.memory_bytes ? `${(m.memory_bytes / 1e9).toFixed(0)}GB` : '';
          const meta = chalk.dim([
            `${fmtTok(ctx)} ctx`,
            memStr,
            m.request_count !== undefined ? `${m.request_count} reqs` : '',
          ].filter(Boolean).join(' · '));
          return {
            name: `${dot}${m.model_id}  ${meta}`,
            value: m.model_id,
          };
        });

        let selectedModel: string;
        try {
          selectedModel = await select({
            message: chalk.dim('Select model'),
            choices,
          });
        } catch {
          return 'handled'; // Ctrl+C
        }

        if (selectedModel === config.model.default) {
          console.log(chalk.dim(`  Already using ${selectedModel}`));
          return 'handled';
        }

        const { saveConfig } = await import('../core/config.js');
        await saveConfig({ model: { default: selectedModel } });
        session.model = selectedModel;
        console.log(chalk.green('✓') + ` Switched to ${selectedModel}`);
        return 'model-switched';
      } catch {
        // Fallback: just show current model if LMX is unreachable
        console.log(chalk.dim(`  Current model: ${config.model.default}`));
        console.log(chalk.dim(`  LMX unreachable — use /model <name> to switch manually`));
        return 'handled';
      }
    }

    case '/history': {
      const userMessages = session.messages.filter(
        (m: AgentMessage) => m.role === 'user' || m.role === 'assistant'
      );
      if (userMessages.length === 0) {
        console.log(chalk.dim('  No messages yet'));
        return 'handled';
      }
      console.log();
      userMessages.forEach((m: AgentMessage, i: number) => {
        const role = m.role === 'user' ? chalk.cyan('user') : chalk.green('assistant');
        const rawContent = typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? '[multimodal]' : '';
        const content = rawContent.slice(0, 80).replace(/\n/g, ' ');
        const toolCount = m.tool_calls?.length;
        const suffix = toolCount ? chalk.dim(` (${toolCount} tool calls)`) : '';
        console.log(`  ${i + 1}. [${role}] ${content}${suffix}`);
      });
      console.log();
      return 'handled';
    }

    case '/compact': {
      console.log(chalk.dim('  Context compaction will happen automatically on next turn'));
      // Force compaction by setting messages to trigger threshold
      // The agent loop handles this automatically
      return 'handled';
    }

    case '/clear':
      console.clear();
      return 'handled';

    case '/undo': {
      try {
        const { isGitRepo } = await import('../git/utils.js');
        if (!(await isGitRepo(process.cwd()))) {
          console.log(chalk.dim('  Not in a git repository'));
          return 'handled';
        }

        if (arg === 'list') {
          const { listCheckpoints } = await import('../git/checkpoints.js');
          const checkpoints = await listCheckpoints(process.cwd(), session.id);
          if (checkpoints.length === 0) {
            console.log(chalk.dim('  No checkpoints in this session'));
          } else {
            console.log('\n' + chalk.bold('Checkpoints:'));
            for (const cp of checkpoints) {
              console.log(`  #${cp.n}  ${cp.tool}  ${cp.path}  ${chalk.dim(cp.timestamp)}`);
            }
            console.log();
          }
          return 'handled';
        }

        const { undoCheckpoint } = await import('../git/checkpoints.js');
        const n = arg ? parseInt(arg, 10) : undefined;
        await undoCheckpoint(process.cwd(), session.id, n);

        const label = n !== undefined ? `Checkpoint #${n}` : 'Last checkpoint';
        console.log(chalk.green('✓') + ` Undone: ${label}`);
        session.messages.push({
          role: 'user',
          content: `[System: User reversed ${label} — changes have been reverted. Adjust your approach accordingly.]`,
        });
      } catch (err) {
        console.error(chalk.red('✗') + ` Undo failed: ${err instanceof Error ? err.message : err}`);
      }
      return 'handled';
    }

    case '/plan': {
      if (arg === 'off' || (state.currentMode === 'plan' && !arg)) {
        state.currentMode = 'normal';
        console.log(chalk.green('\u2713') + ' Exited plan mode');
      } else {
        state.currentMode = 'plan';
        console.log(chalk.magenta('\u2713') + ' Entered plan mode \u2014 read-only exploration');
        console.log(chalk.dim('  Tools: read, search, list, find, ask, web_search, web_fetch'));
        console.log(chalk.dim('  Type /plan off to exit'));
      }
      return 'handled';
    }

    case '/status': {
      try {
        const res = await fetch(`http://${config.connection.host}:${config.connection.port}/admin/status`);
        const data = await res.json() as Record<string, unknown>;
        const model = (data.models as string[] | undefined)?.[0];
        const memory = data.memory as { used_gb?: number; total_gb?: number; usage_percent?: number } | undefined;
        const tokens = estimateTokens(session.messages);
        const uptimeSec = data.uptime_seconds as number | undefined;

        const lines: string[] = [
          kv('LMX', `${config.connection.host}:${config.connection.port} ${statusDot(true)}`),
        ];
        if (model) lines.push(kv('Model', model));
        if (memory) {
          const memBar = progressBar((memory.usage_percent ?? 0) / 100, 16);
          lines.push(kv('Memory', `${memory.used_gb?.toFixed(0)}/${memory.total_gb?.toFixed(0)} GB ${memBar}`));
        }
        lines.push(kv('Session', `${session.id.slice(0, 8)} (${session.messages.length} messages)`));
        lines.push(kv('Tokens', `~${fmtTokens(tokens)}`));
        if (uptimeSec !== undefined) lines.push(kv('Uptime', `${Math.floor(uptimeSec / 60)}m`));

        console.log('\n' + box('Status', lines));
      } catch {
        console.log(chalk.red('\n  ● LMX unreachable') + chalk.dim(` — ${config.connection.host}:${config.connection.port}`));
      }
      return 'handled';
    }

    case '/diff': {
      try {
        const { execFileSync } = await import('node:child_process');
        const { formatUnifiedDiff } = await import('../ui/diff.js');

        const stat = execFileSync('git', ['diff', '--stat'], { encoding: 'utf-8', cwd: process.cwd() });
        if (!stat.trim()) {
          console.log(chalk.dim('  No uncommitted changes'));
          return 'handled';
        }

        // Show stat summary in a box
        const statLines = stat.trim().split('\n');
        const summary = statLines[statLines.length - 1] ?? '';
        const fileLines = statLines.slice(0, -1).map(l => ' ' + l.trim());
        console.log('\n' + box('Changes', [...fileLines, '', chalk.dim(summary.trim())]));

        // If user passed a file, show full diff for that file
        if (arg) {
          const fullDiff = execFileSync('git', ['diff', '--', arg], { encoding: 'utf-8', cwd: process.cwd() });
          if (fullDiff.trim()) {
            console.log('\n' + formatUnifiedDiff(fullDiff));
          }
        } else {
          console.log(chalk.dim('  Tip: /diff <file> for inline diff'));
        }
      } catch {
        console.log(chalk.dim('  Not a git repository'));
      }
      return 'handled';
    }

    case '/cost': {
      const msgs = session.messages;
      let promptTok = 0;
      let completionTok = 0;
      for (const m of msgs) {
        const len = typeof m.content === 'string' ? m.content.length : 0;
        const tok = Math.ceil(len / 4);
        if (m.role === 'assistant') completionTok += tok;
        else promptTok += tok;
      }
      const total = promptTok + completionTok;
      const contextLimit = config.model.contextLimit ?? 128000;
      const usageRatio = total / contextLimit;

      console.log('\n' + box('Token Usage', [
        kv('Prompt', `~${fmtTokens(promptTok)} tokens`),
        kv('Completion', `~${fmtTokens(completionTok)} tokens`),
        kv('Total', `~${fmtTokens(total)} tokens`),
        kv('Context', `${progressBar(usageRatio, 16)} ${chalk.dim(`${fmtTokens(total)}/${fmtTokens(contextLimit)}`)}`),
        '',
        kv('Messages', String(msgs.length)),
        kv('Tool calls', String(session.toolCallCount)),
        kv('Cost', chalk.green('$0.00') + chalk.dim(' (local inference)')),
      ]));
      return 'handled';
    }

    case '/share': {
      const { writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { select } = await import('@inquirer/prompts');
      const { formatSessionExport } = await import('./share.js');
      type ExportFormat = import('./share.js').ExportFormat;

      let format: ExportFormat = 'markdown';
      try {
        format = await select<ExportFormat>({
          message: chalk.dim('Export format'),
          choices: [
            { name: 'Markdown (.md)', value: 'markdown' as ExportFormat },
            { name: 'JSON (.json)', value: 'json' as ExportFormat },
            { name: 'Plain text (.txt)', value: 'text' as ExportFormat },
          ],
        });
      } catch {
        return 'handled'; // Ctrl+C
      }

      const ext = format === 'json' ? 'json' : format === 'text' ? 'txt' : 'md';
      const filename = `opta-session-${session.id.slice(0, 8)}-${Date.now()}.${ext}`;
      const filepath = join(process.cwd(), filename);

      const content = formatSessionExport(session, format);
      await writeFile(filepath, content, 'utf-8');
      console.log(chalk.green('✓') + ` Exported to ${chalk.cyan(filename)}`);
      return 'handled';
    }

    case '/sessions': {
      const { listSessions, deleteSession } = await import('../memory/store.js');
      const { formatSessionExport } = await import('./share.js');
      const { select } = await import('@inquirer/prompts');
      const allSessions = await listSessions();
      if (allSessions.length === 0) {
        console.log(chalk.dim('  No saved sessions'));
        return 'handled';
      }

      const items = allSessions.slice(0, 15);
      const choices = items.map(s => {
        const isCurrent = s.id === session.id;
        const dot = isCurrent ? chalk.green('● ') : '  ';
        const title = (s.title || 'Untitled').slice(0, 30);
        const meta = chalk.dim(`${s.messageCount} msgs · ${new Date(s.created).toLocaleDateString()}`);
        return {
          name: `${dot}${s.id.slice(0, 8)}  ${title}  ${meta}`,
          value: s.id,
        };
      });

      let selectedId: string;
      try {
        selectedId = await select({
          message: chalk.dim('Select session'),
          choices,
        });
      } catch {
        return 'handled'; // Ctrl+C
      }

      // Action picker for selected session
      const isCurrent = selectedId === session.id;
      const actionChoices = [
        ...(isCurrent ? [] : [{ name: 'Resume this session', value: 'resume' }]),
        { name: 'Export session', value: 'export' },
        { name: 'Delete session', value: 'delete' },
        { name: 'Cancel', value: 'cancel' },
      ];

      let action: string;
      try {
        action = await select({
          message: chalk.dim(`Action for ${selectedId.slice(0, 8)}`),
          choices: actionChoices,
        });
      } catch {
        return 'handled';
      }

      switch (action) {
        case 'resume':
          console.log(chalk.dim(`  To resume, run: opta chat -r ${selectedId.slice(0, 8)}`));
          break;
        case 'export': {
          const { writeFile } = await import('node:fs/promises');
          const { join } = await import('node:path');
          const { loadSession: loadSess } = await import('../memory/store.js');
          const sess = await loadSess(selectedId);
          const content = formatSessionExport(sess, 'markdown');
          const filename = `opta-session-${selectedId.slice(0, 8)}-${Date.now()}.md`;
          await writeFile(join(process.cwd(), filename), content, 'utf-8');
          console.log(chalk.green('✓') + ` Exported to ${chalk.cyan(filename)}`);
          break;
        }
        case 'delete':
          if (isCurrent) {
            console.log(chalk.yellow('  Cannot delete current session'));
          } else {
            await deleteSession(selectedId);
            console.log(chalk.green('✓') + ` Deleted session ${selectedId.slice(0, 8)}`);
          }
          break;
        default:
          break;
      }
      return 'handled';
    }

    case '/init': {
      const { access } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const contextFile = join(process.cwd(), 'OPTA.md');

      try {
        await access(contextFile);
        console.log(chalk.yellow('  OPTA.md already exists. Delete it first to regenerate.'));
        return 'handled';
      } catch { /* doesn't exist, good */ }

      console.log(chalk.dim('  Analyzing project...'));
      session.messages.push({
        role: 'user',
        content: 'Analyze this project and generate an OPTA.md project context file. Include: project name, tech stack, architecture overview, key files, coding conventions, and any important notes for an AI assistant working on this codebase. Write it as a markdown file.',
      });
      console.log(chalk.dim('  Ask me to generate the OPTA.md file and I\'ll analyze the project.'));
      return 'handled';
    }

    case '/editor':
    case '/e': {
      const { editText } = await import('./editor.js');
      const text = await editText(arg || '');
      if (text) {
        console.log(chalk.dim(`  Editor returned ${text.split('\n').length} lines`));
        // Inject editor text as user message for processing
        session.messages.push({ role: 'user', content: text });
      } else {
        console.log(chalk.dim('  Editor cancelled (empty content)'));
      }
      return 'handled';
    }

    case '/image': {
      if (!arg) {
        console.log(chalk.dim('  Usage: /image <path> [question]'));
        console.log(chalk.dim('  Examples:'));
        console.log(chalk.dim('    /image screenshot.png What is this?'));
        console.log(chalk.dim('    /image ./designs/mockup.png Review this UI'));
        console.log(chalk.dim('  Supports: png, jpg, jpeg, gif, webp'));
        return 'handled';
      }

      const parts = arg.split(/\s+/);
      const imagePath = parts[0]!;
      const question = parts.slice(1).join(' ') || 'What is in this image?';

      try {
        const { readFile: readFs } = await import('node:fs/promises');
        const { resolve: resolvePath, extname } = await import('node:path');
        const fullPath = resolvePath(imagePath);
        const data = await readFs(fullPath);
        const base64 = data.toString('base64');
        const ext = extname(fullPath).slice(1).toLowerCase();
        const mime = ext === 'jpg' ? 'jpeg' : ext;

        // Set title from first image
        if (!session.title) {
          session.title = generateTitle(question);
        }

        const result = await agentLoop(question, config, {
          existingMessages: session.messages,
          sessionId: session.id,
          silent: false,
          mode: state.currentMode === 'plan' ? 'plan' : undefined,
          imageBase64: `data:image/${mime};base64,${base64}`,
        });

        session.messages = result.messages;
        session.toolCallCount += result.toolCallCount;
        await saveSession(session);
      } catch (err) {
        console.error(chalk.red('✗') + ` Failed to read image: ${err instanceof Error ? err.message : err}`);
      }
      return 'handled';
    }

    case '/stats':
    case '/analytics': {
      const { listSessions } = await import('../memory/store.js');
      const { SessionAnalytics } = await import('../memory/analytics.js');
      const allSessions = await listSessions();
      const analytics = new SessionAnalytics(allSessions);

      const modelLines = Object.entries(analytics.modelBreakdown)
        .sort(([, a], [, b]) => b - a)
        .map(([model, count]) => kv(model, `${count} sessions`, 20));

      console.log('\n' + box('Session Analytics', [
        kv('Total', `${analytics.totalSessions} sessions`, 14),
        kv('Messages', `${analytics.totalMessages} total`, 14),
        kv('Tool Calls', `${analytics.totalToolCalls} total`, 14),
        kv('Avg/Session', `${analytics.avgMessagesPerSession.toFixed(1)} msgs`, 14),
        kv('Today', `${analytics.sessionsToday()} sessions`, 14),
        '',
        chalk.dim('Model Usage:'),
        ...modelLines,
        '',
        kv('Cost', chalk.green('$0.00') + chalk.dim(' (local inference)'), 14),
      ]));
      return 'handled';
    }

    case '/': {
      const { select, Separator } = await import('@inquirer/prompts');
      const commands = [
        { name: '/status       System & LMX status', value: '/status' },
        { name: '/cost         Token usage breakdown', value: '/cost' },
        { name: '/stats        Session analytics', value: '/stats' },
        { name: '/diff         Uncommitted changes', value: '/diff' },
        { name: '/history      Conversation summary', value: '/history' },
        { name: '/expand       Toggle thinking display', value: '/expand' },
        new Separator(chalk.dim('──── Session ────')),
        { name: '/model        Switch model (picker)', value: '/model' },
        { name: '/agent        Switch agent profile', value: '/agent' },
        { name: '/sessions     List recent sessions', value: '/sessions' },
        { name: '/share        Export conversation', value: '/share' },
        { name: '/plan         Toggle plan mode', value: '/plan' },
        { name: '/theme        Change UI theme', value: '/theme' },
        new Separator(chalk.dim('──── Tools ────')),
        { name: '/undo         Reverse last checkpoint', value: '/undo' },
        { name: '/compact      Force compaction', value: '/compact' },
        { name: '/image        Analyze an image', value: '/image' },
        { name: '/editor       Open $EDITOR for input', value: '/editor' },
        { name: '/init         Generate project context', value: '/init' },
        new Separator(chalk.dim('────────────────')),
        { name: '/clear        Clear screen', value: '/clear' },
        { name: '/exit         Save and exit', value: '/exit' },
      ];
      try {
        const selected = await select({ message: chalk.dim('›'), choices: commands });
        return handleSlashCommand(selected, session, config, state);
      } catch {
        return 'handled';
      }
    }

    case '/theme': {
      const { getTheme, setTheme, listThemes } = await import('../ui/theme.js');
      if (!arg) {
        const themes = listThemes();
        const current = getTheme();
        console.log('\n' + box('Themes', themes.map(t =>
          (t.name === current.name ? chalk.green('● ') : chalk.dim('  ')) +
          chalk.cyan(t.name.padEnd(14)) + chalk.dim(t.description)
        )));
        console.log(chalk.dim('  Usage: /theme <name>\n'));
        return 'handled';
      }
      setTheme(arg);
      const theme = getTheme();
      if (theme.name === arg) {
        console.log(chalk.green('✓') + ` Theme: ${theme.primary(theme.name)}`);
      } else {
        console.log(chalk.yellow(`  Unknown theme: ${arg}. Try /theme to see options.`));
      }
      return 'handled';
    }

    case '/expand':
    case '/think': {
      if (!state.lastThinkingRenderer?.hasThinking()) {
        console.log(chalk.dim('  No thinking to display'));
        return 'handled';
      }
      if (state.thinkingExpanded) {
        console.log(state.lastThinkingRenderer.getCollapsedSummary());
        state.thinkingExpanded = false;
      } else {
        console.log(state.lastThinkingRenderer.getExpandedView());
        state.thinkingExpanded = true;
      }
      return 'handled';
    }

    case '/agent':
    case '/profile': {
      const { getAgentProfile, listAgentProfiles } = await import('../core/agent-profiles.js');

      if (arg) {
        // Direct switch: /agent <name>
        const profile = getAgentProfile(arg);
        if (!profile) {
          console.log(chalk.yellow(`  Unknown agent profile: ${arg}`) + chalk.dim(' (try /agent to see options)'));
          return 'handled';
        }
        state.agentProfile = profile.name;
        console.log(chalk.green('✓') + ` Agent: ${chalk.bold(profile.name)} — ${chalk.dim(profile.description)}`);
        console.log(chalk.dim(`  Tools: ${profile.tools.length} enabled`));
        return 'handled';
      }

      // Interactive picker
      const { select } = await import('@inquirer/prompts');
      const profiles = listAgentProfiles();
      const currentProfile = state.agentProfile;

      const choices = profiles.map(p => {
        const isCurrent = p.name === currentProfile;
        const dot = isCurrent ? chalk.green('● ') : '  ';
        return {
          name: `${dot}${chalk.bold(p.name.padEnd(14))} ${chalk.dim(p.description)}  ${chalk.dim(`(${p.tools.length} tools)`)}`,
          value: p.name,
        };
      });

      let selected: string;
      try {
        selected = await select({
          message: chalk.dim('Select agent profile'),
          choices,
        });
      } catch {
        return 'handled'; // Ctrl+C
      }

      const profile = getAgentProfile(selected);
      if (profile) {
        state.agentProfile = profile.name;
        console.log(chalk.green('✓') + ` Agent: ${chalk.bold(profile.name)} — ${chalk.dim(profile.description)}`);
        console.log(chalk.dim(`  Tools: ${profile.tools.length} enabled`));
      }
      return 'handled';
    }

    default:
      console.log(chalk.yellow(`  Unknown command: ${cmd}`) + chalk.dim(' (try /help)'));
      return 'handled';
  }
}
