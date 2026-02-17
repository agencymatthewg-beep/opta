import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { agentLoop, buildSystemPrompt } from '../core/agent.js';
import type { AgentMessage } from '../core/agent.js';
import { formatError, OptaError, EXIT } from '../core/errors.js';
import { buildConfigOverrides } from '../utils/config-helpers.js';
import {
  createSession,
  loadSession,
  saveSession,
  generateTitle,
} from '../memory/store.js';
import { resolveFileRefs, buildContextWithRefs } from '../core/fileref.js';
import { box, kv, statusDot } from '../ui/box.js';
import { InputEditor } from '../ui/input.js';
import { InputHistory } from '../ui/history.js';
import { dispatchSlashCommand } from './slash/index.js';
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

/**
 * Format the last assistant message as a JSON line (JSONL) for --format json.
 * Extracts the most recent assistant message from the conversation history.
 */
export function formatChatJsonLine(messages: AgentMessage[]): string {
  const assistantMsgs = messages.filter((m: AgentMessage) => m.role === 'assistant');
  const lastMsg = assistantMsgs[assistantMsgs.length - 1];
  return JSON.stringify({
    role: 'assistant',
    content: lastMsg?.content ?? '',
    tool_calls: lastMsg?.tool_calls ?? [],
  });
}

export interface ChatState {
  currentMode: OptaMode;
  agentProfile: string;
  lastThinkingRenderer?: import('../ui/thinking.js').ThinkingRenderer;
  thinkingExpanded?: boolean;
}

export async function startChat(opts: ChatOptions): Promise<void> {
  const overrides = buildConfigOverrides(opts);

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

  // Mode state (shared by both TUI and REPL modes)
  const chatState: ChatState = {
    currentMode: opts.plan ? 'plan' : (opts.auto ? 'auto-accept' : 'normal'),
    agentProfile: 'default',
  };
  if (opts.dangerous || opts.yolo) chatState.currentMode = 'normal'; // dangerous handled by config mode

  // TUI mode: full-screen Ink rendering (--tui flag or tui.default config)
  if (opts.tui || config.tui.default) {
    const { renderTUI } = await import('../tui/render.js');
    const { createTuiEmitter, runAgentWithEvents } = await import('../tui/adapter.js');
    const { captureConsoleOutput } = await import('../tui/capture.js');

    const emitter = createTuiEmitter();

    await renderTUI({
      model: config.model.default,
      sessionId: session.id,
      emitter,
      onSubmit: (text: string) => {
        // Fire-and-forget: the emitter events drive the TUI updates
        runAgentWithEvents(emitter, text, config, session)
          .then(async (result) => {
            session.messages = result.messages;
            session.toolCallCount += result.toolCallCount;
            await saveSession(session);
          })
          .catch(() => {
            // Error already emitted via emitter 'error' event
          });
      },
      onSlashCommand: async (input: string) => {
        // Bare `/` opens interactive browser in REPL mode, but in TUI mode
        // redirect to /help since @inquirer/prompts doesn't work here.
        const effectiveInput = input.trim() === '/' ? '/help' : input;

        const { result, output } = await captureConsoleOutput(async () => {
          return dispatchSlashCommand(effectiveInput, { session, config, chatState });
        });

        // Persist session after slash command (some modify session state)
        await saveSession(session);

        // If model was switched, reload config
        let newModel: string | undefined;
        if (result === 'model-switched') {
          config = await loadConfig(overrides);
          newModel = config.model.default;
        }

        return { result, output, newModel };
      },
    });
    return;
  }

  /** Map OptaMode to InputEditor mode string. */
  function toEditorMode(mode: OptaMode): 'normal' | 'plan' | 'auto' {
    if (mode === 'plan') return 'plan';
    if (mode === 'auto-accept') return 'auto';
    return 'normal';
  }

  // InputEditor for buffer management and mode detection
  const editor = new InputEditor({
    prompt: '>',
    mode: toEditorMode(chatState.currentMode),
  });

  // Input history with deduplication
  const history = new InputHistory();

  function getPromptMessage(): string {
    // Sync editor mode with chat state
    editor.setMode(toEditorMode(chatState.currentMode));
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
      const handled = await dispatchSlashCommand(userInput, { session, config, chatState });
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
        profile: chatState.agentProfile !== 'default' ? chatState.agentProfile : undefined,
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
        console.log(formatChatJsonLine(result.messages));
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
