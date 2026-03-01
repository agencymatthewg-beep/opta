import chalk from 'chalk';
import { join } from 'node:path';
import { getConfigDir } from '../platform/paths.js';
import { loadConfig, saveConfig } from '../core/config.js';
import { agentLoop, buildSystemPrompt } from '../core/agent.js';
import type { AgentMessage } from '../core/agent.js';
import { formatError, OptaError, ExitError, EXIT } from '../core/errors.js';
import { buildConfigOverrides } from '../utils/config-helpers.js';
import { errorMessage, NO_MODEL_ERROR } from '../utils/errors.js';
import { diskHeadroomMbToBytes, ensureDiskHeadroom, isStorageRelatedError } from '../utils/disk.js';
import { modelIdsEqual, normalizeConfiguredModelId } from '../lmx/model-lifecycle.js';
import {
  createSession,
  loadSession,
  saveSession,
  generateTitle,
  searchSessions,
} from '../memory/store.js';
import { writeSessionLog } from '../journal/session-log.js';
import { resolveFileRefs, buildContextWithRefs, resolveImageRefs } from '../core/fileref.js';
import { box, kv, statusDot } from '../ui/box.js';
import { InputEditor, startConnectionMonitor } from '../ui/input.js';
import { InputHistory } from '../ui/history.js';
import { runConnectionDiagnostics, formatDiagnostics } from '../core/diagnostics.js';
import { dispatchSlashCommand } from './slash/index.js';
import type { Session } from '../memory/store.js';
import { runMenuPrompt } from '../ui/prompt-nav.js';
import type { TuiMessage } from '../tui/App.js';
import type { TuiErrorEvent, TuiErrorPayload } from '../tui/adapter.js';

interface ChatOptions {
  resume?: string;
  plan?: boolean;
  review?: boolean;
  research?: boolean;
  model?: string;
  initialPrompt?: string;
  commit?: boolean;
  checkpoints?: boolean;
  format?: string;
  auto?: boolean;
  dangerous?: boolean;
  yolo?: boolean;
  tui?: boolean;
}

export type OptaMode = 'normal' | 'plan' | 'review' | 'research' | 'auto-accept';

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
  autoAccept?: boolean;
  lastThinkingRenderer?: import('../ui/thinking.js').ThinkingRenderer;
  thinkingExpanded?: boolean;
}

/**
 * Truncate long stderr output to keep shell error display manageable.
 * Shows first 20 lines + last 10 lines with an omission notice in between.
 */
function truncateStderr(stderr: string): string {
  const lines = stderr.split('\n');
  if (lines.length <= 50) return stderr;
  const head = lines.slice(0, 20);
  const tail = lines.slice(-10);
  const omitted = lines.length - 30;
  return [...head, chalk.dim(`  ... (${omitted} lines omitted)`), ...tail].join('\n');
}

interface ModelPreflightStatus {
  modelLoaded: boolean;
  loadedModelIds: string[];
  error?: string;
}

const OPTA_CONFIG_DIR = getConfigDir();

function pickModelFlavor(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes('qwen')) return 'I can move fast on coding and shell workflows.';
  if (lower.includes('minimax'))
    return 'I can balance long-context reasoning with practical execution.';
  if (lower.includes('kimi')) return 'I can handle broad context windows and deep planning.';
  if (lower.includes('glm'))
    return 'I can keep responses concise while staying technically grounded.';
  if (lower.includes('claude'))
    return 'I can help with structured reasoning and high-quality edits.';
  return 'I can help with focused coding and terminal tasks.';
}

function buildStartupIntro(model: string, resumed: boolean, messageCount: number): string {
  const contextLine = resumed
    ? `Session resumed with ${messageCount} prior messages.`
    : 'New session initialized.';
  return [
    `Connected to ${model} and ready.`,
    pickModelFlavor(model),
    contextLine,
    'What do you want to do next?',
    '- Debug a specific issue',
    '- Load/switch models from Opta Menu',
    '- Start a focused build task',
  ].join('\n');
}

function toTuiTurnError(payload: unknown): TuiErrorEvent {
  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }

  const record =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : undefined;
  const message =
    typeof record?.['message'] === 'string' && record['message'].length > 0
      ? record['message']
      : 'Turn failed';
  const code =
    typeof record?.['code'] === 'string' && record['code'].length > 0 ? record['code'] : undefined;

  const structured: TuiErrorPayload = code ? { message, code } : { message };
  return structured;
}

async function probeModelPreflight(
  config: Awaited<ReturnType<typeof loadConfig>>,
  modelId: string
): Promise<ModelPreflightStatus> {
  // When running on Anthropic (zero-config fallback or explicit config), the
  // model is always "loaded" from the CLI's perspective — no LMX probe needed.
  if ((config.provider?.active ?? 'lmx') === 'anthropic') {
    return { modelLoaded: true, loadedModelIds: [modelId] };
  }

  try {
    const { LmxClient } = await import('../lmx/client.js');
    const lmx = new LmxClient({
      host: config.connection.host,
      fallbackHosts: config.connection.fallbackHosts,
      port: config.connection.port,
      adminKey: config.connection.adminKey,
      timeoutMs: 8_000,
      maxRetries: 0,
    });
    const loaded = await lmx.models();
    const loadedModelIds = loaded.models.map((item) => item.model_id);
    const modelLoaded = loadedModelIds.some((candidate) => modelIdsEqual(candidate, modelId));
    return { modelLoaded, loadedModelIds };
  } catch (err) {
    return { modelLoaded: false, loadedModelIds: [], error: errorMessage(err) };
  }
}

async function runChatDiskPreflight(
  config: Awaited<ReturnType<typeof loadConfig>>,
  jsonMode: boolean
): Promise<void> {
  try {
    await ensureDiskHeadroom(OPTA_CONFIG_DIR, {
      minFreeBytes: diskHeadroomMbToBytes(config.safety?.diskHeadroomMb),
    });
  } catch (err) {
    if (!isStorageRelatedError(err)) throw err;
    const message = errorMessage(err);
    if (!jsonMode) {
      console.error(chalk.red('✗') + ` ${message}`);
      console.error(chalk.dim('  Free disk space and rerun the command.'));
    }
    throw new ExitError(EXIT.ERROR);
  }
}

export async function startChat(opts: ChatOptions): Promise<void> {
  const overrides = buildConfigOverrides(opts);

  const jsonMode = opts.format === 'json';
  let config = await loadConfig(overrides);
  await runChatDiskPreflight(config, jsonMode);

  // First-run onboarding
  if (!jsonMode) {
    const { isFirstRun, runOnboarding } = await import('./onboard.js');
    if (await isFirstRun()) {
      await runOnboarding();
      // Reload config in case onboarding changed connection settings
      config = await loadConfig(overrides);
    }
  }

  // Zero-config fallback: probe LMX before the first turn.
  // If LMX is unreachable and ANTHROPIC_API_KEY is set, silently switch to
  // Anthropic so fresh installs with only an API key work out of the box.
  // Only probe when provider is 'lmx' (default) — skip if user explicitly
  // configured Anthropic or if we're in JSON (pipe) mode where silence matters.
  if ((config.provider?.active ?? 'lmx') === 'lmx') {
    try {
      const { probeProvider } = await import('../providers/manager.js');
      const probed = await probeProvider(config);
      if (probed.name === 'anthropic') {
        // LMX unreachable — route the whole session through Anthropic.
        // Always derive the model from provider.anthropic.model (or the
        // well-known default) so we don't keep an LMX model string.
        const anthropicDefault = config.provider.anthropic?.model || 'claude-sonnet-4-5-20250929';
        config = {
          ...config,
          provider: {
            ...config.provider,
            active: 'anthropic',
          },
          model: {
            ...config.model,
            default: anthropicDefault,
            contextLimit: 200_000,
          },
        };
      }
    } catch (err) {
      // probeProvider threw — means both LMX unreachable AND no ANTHROPIC_API_KEY.
      // Re-throw so the CLI framework handles graceful exit with cleanup.
      throw err;
    }
  }

  let effectiveModel = normalizeConfiguredModelId(config.model.default);
  if (effectiveModel !== config.model.default) {
    await saveConfig({
      'model.default': effectiveModel,
      'model.contextLimit': effectiveModel ? config.model.contextLimit : 32768,
    }).catch(() => {});
    config = {
      ...config,
      model: {
        ...config.model,
        default: effectiveModel,
        contextLimit: effectiveModel ? config.model.contextLimit : 32768,
      },
    };
  }

  if (!effectiveModel) {
    try {
      const { LmxClient, lookupContextLimit } = await import('../lmx/client.js');
      const lmx = new LmxClient({
        host: config.connection.host,
        fallbackHosts: config.connection.fallbackHosts,
        port: config.connection.port,
        adminKey: config.connection.adminKey,
        timeoutMs: 5_000,
        maxRetries: 0,
      });
      const loaded = await lmx.models();
      const fallback = loaded.models[0]?.model_id;
      if (fallback) {
        effectiveModel = fallback;
        await saveConfig({
          'model.default': fallback,
          'model.contextLimit': lookupContextLimit(fallback),
        }).catch(() => {});
        config = {
          ...config,
          model: {
            ...config.model,
            default: fallback,
            contextLimit: lookupContextLimit(fallback),
          },
        };
        if (!jsonMode) {
          console.log(chalk.yellow('!') + ` No default model set; using loaded model ${fallback}`);
        }
      }
    } catch {
      // Ignore model discovery failures; we'll show actionable guidance below.
    }
  }

  if (!effectiveModel) {
    console.error(chalk.red('✗') + ' ' + NO_MODEL_ERROR);
    console.error('');
    console.error(chalk.dim('  Fix options:'));
    console.error(
      chalk.dim('    1. Set a default model:  ') +
        chalk.cyan('opta config set model.default <model-name>')
    );
    console.error(chalk.dim('    2. Discover models:      ') + chalk.cyan('opta models'));
    console.error(chalk.dim('    3. Check LMX status:     ') + chalk.cyan('opta status'));
    console.error(chalk.dim('    4. Run diagnostics:      ') + chalk.cyan('opta doctor'));
    console.error('');
    throw new ExitError(EXIT.NO_CONNECTION);
  }

  // Create or resume session
  let session: Session;
  let startupModelLoaded = false;
  let startupPreflightError: string | undefined;
  if (opts.resume) {
    try {
      session = await loadSession(opts.resume);
    } catch {
      // Exact ID not found — try fuzzy search
      const matches = await searchSessions(opts.resume);
      if (matches.length === 1) {
        session = await loadSession(matches[0]!.id);
      } else if (matches.length > 1) {
        try {
          const { select } = await import('@inquirer/prompts');
          const choice = await runMenuPrompt(
            (context) =>
              select(
                {
                  message: chalk.dim(`Multiple sessions match "${opts.resume}"`),
                  choices: matches.slice(0, 10).map((m) => ({
                    name: `${m.title || m.id.slice(0, 8)}  ${chalk.dim(m.model || '')}  ${chalk.dim(new Date(m.created).toLocaleDateString())}${m.tags?.length ? '  ' + chalk.cyan(m.tags.join(', ')) : ''}`,
                    value: m.id,
                  })),
                },
                context
              ),
            'select'
          );
          if (!choice) return;
          session = await loadSession(choice);
        } catch {
          // Ctrl+C — exit gracefully
          return;
        }
      } else {
        console.error(
          chalk.red('✗') +
            ` Session not found: ${opts.resume}\n\n` +
            chalk.dim('Run ') +
            chalk.cyan('opta sessions') +
            chalk.dim(' to list available sessions')
        );
        throw new ExitError(EXIT.NOT_FOUND);
      }
    }
    const startupPreflight = await probeModelPreflight(config, session.model);
    startupModelLoaded = startupPreflight.modelLoaded;
    startupPreflightError = startupPreflight.error;

    if (!jsonMode) {
      const msgCount = session.messages.filter((m) => m.role !== 'system').length;
      const providerLabel =
        (config.provider?.active ?? 'lmx') === 'anthropic' ? 'Anthropic' : 'LMX';
      const providerValue =
        (config.provider?.active ?? 'lmx') === 'anthropic'
          ? `api.anthropic.com ${statusDot(startupModelLoaded)}`
          : `${config.connection.host}:${config.connection.port} ${statusDot(startupModelLoaded)}`;
      console.log(
        '\n' +
          box('Opta', [
            kv(providerLabel, providerValue),
            kv('Model', session.model),
            kv('Session', `${session.id.slice(0, 8)} ${chalk.dim('(resumed)')}`),
            ...(session.title ? [kv('Title', chalk.italic(session.title.slice(0, 40)))] : []),
            kv('Messages', String(msgCount)),
          ])
      );
    }
  } else {
    session = await createSession(config.model.default);
    // Initialize system prompt for new session
    const systemPrompt = await buildSystemPrompt(config);
    session.messages = [{ role: 'system', content: systemPrompt }];
    await saveSession(session);

    const startupPreflight = await probeModelPreflight(config, session.model);
    startupModelLoaded = startupPreflight.modelLoaded;
    startupPreflightError = startupPreflight.error;

    if (!jsonMode) {
      const providerLabel =
        (config.provider?.active ?? 'lmx') === 'anthropic' ? 'Anthropic' : 'LMX';
      const providerValue =
        (config.provider?.active ?? 'lmx') === 'anthropic'
          ? `api.anthropic.com ${statusDot(startupModelLoaded)}`
          : `${config.connection.host}:${config.connection.port} ${statusDot(startupModelLoaded)}`;
      console.log(
        '\n' +
          box('Opta', [
            kv(providerLabel, providerValue),
            kv('Model', session.model),
            kv('Session', `${session.id.slice(0, 8)} ${chalk.dim('(new)')}`),
          ])
      );
    }
  }

  if (!jsonMode) {
    console.log(chalk.dim('  Type /help for commands, / to browse, /exit to quit\n'));
  }

  // Non-blocking startup connection check (fire-and-forget)
  if (!jsonMode) {
    const { host, port } = config.connection;
    runConnectionDiagnostics(host, port)
      .then((results) => {
        const hasError = results.some((r) => r.status === 'error');
        const hasWarning = results.some((r) => r.status === 'warning');
        if (hasError || hasWarning) {
          console.log(formatDiagnostics(results));
          console.log('');
        }
      })
      .catch(() => {
        // Silently ignore diagnostic failures — don't disrupt the REPL
      });
  }

  // Mode state (shared by both TUI and REPL modes)
  const chatState: ChatState = {
    currentMode: opts.plan
      ? 'plan'
      : opts.review
        ? 'review'
        : opts.research
          ? 'research'
          : opts.auto
            ? 'auto-accept'
            : 'normal',
    agentProfile: 'default',
  };
  if (opts.dangerous || opts.yolo) chatState.currentMode = 'normal'; // dangerous handled by config mode

  async function saveSessionWithJournal(): Promise<string | null> {
    await saveSession(session);

    const journal = config.journal;
    // loadConfig returns defaults in production, but treat missing journal config
    // as enabled to preserve backward-compatible session logging in partial test stubs.
    if ((journal?.enabled ?? true) === false) return null;

    try {
      const written = await writeSessionLog(session, {
        cwd: session.cwd || process.cwd(),
        logsDir: journal?.sessionLogsDir,
        timezone: journal?.timezone,
        user: journal?.author,
      });
      return written.path;
    } catch {
      return null;
    }
  }

  // TUI mode: full-screen Ink rendering (--tui flag or tui.default config)
  if (opts.tui || config.tui.default) {
    const { renderTUI } = await import('../tui/render.js');
    const { createTuiEmitter } = await import('../tui/adapter.js');
    const { captureConsoleOutput } = await import('../tui/capture.js');
    const { DaemonClient } = await import('../daemon/client.js');
    const { nanoid } = await import('nanoid');

    const emitter = createTuiEmitter();
    const daemon = await DaemonClient.connect();
    const clientId = `tui-${process.pid}-${nanoid(6)}`;
    const writerId = `writer-${nanoid(6)}`;
    const nonSystemMessageCount = session.messages.filter((m) => m.role !== 'system').length;
    const startupMessages: TuiMessage[] = startupModelLoaded
      ? [
          {
            role: 'assistant',
            content: buildStartupIntro(session.model, Boolean(opts.resume), nonSystemMessageCount),
            createdAt: Date.now(),
          },
        ]
      : [
          {
            role: 'error',
            content: startupPreflightError
              ? `No Model Loaded - Use Opta Menu to begin.\nLMX preflight failed: ${startupPreflightError}`
              : 'No Model Loaded - Use Opta Menu to begin.',
            createdAt: Date.now(),
          },
        ];
    await daemon.createSession({
      sessionId: session.id,
      model: session.model,
      title: session.title,
      messages: session.messages,
    });

    // Track the current workflow mode set by the TUI (Shift+Tab).
    // Updated via onModeChange callback and used on next agent call.
    let currentTuiMode = 'normal';
    let turnInFlight = false;
    let activeTurnId: string | undefined;
    let lastSeq = 0;
    let closed = false;
    let closeSocket = () => {};
    let reconnectDelayMs = 500;
    let reconnectTimerId: ReturnType<typeof setTimeout> | undefined;
    const MAX_RECONNECT_DELAY_MS = 5000;

    const reconnect = () => {
      emitter.emit('connection:status', 'reconnecting');
      if (closed) return;
      const conn = daemon.connectWebSocket(session.id, lastSeq, {
        onOpen: () => {
          reconnectDelayMs = 500;
          if (reconnectTimerId !== undefined) {
            clearTimeout(reconnectTimerId);
            reconnectTimerId = undefined;
          }
          emitter.emit('connection:status', 'connected');
        },
        onClose: () => {
          if (closed) return;
          emitter.emit('connection:status', 'disconnected');
          const delay = reconnectDelayMs;
          reconnectDelayMs = Math.min(Math.floor(reconnectDelayMs * 1.6), MAX_RECONNECT_DELAY_MS);
          if (reconnectTimerId !== undefined) {
            clearTimeout(reconnectTimerId);
          }
          reconnectTimerId = setTimeout(reconnect, delay);
        },
        onError: (err) => {
          emitter.emit('error', `Daemon stream error: ${errorMessage(err)}`);
        },
        onEvent: (event) => {
          lastSeq = Math.max(lastSeq, event.seq);
          const payload = event.payload as Record<string, unknown>;
          switch (event.event) {
            case 'turn.queued': {
              const turnId = typeof payload['turnId'] === 'string' ? payload['turnId'] : undefined;
              if (turnId) activeTurnId = turnId;
              break;
            }
            case 'turn.start':
              activeTurnId =
                typeof payload['turnId'] === 'string' ? payload['turnId'] : activeTurnId;
              emitter.emit('turn:start');
              break;
            case 'turn.token':
              if (typeof payload['text'] === 'string') {
                emitter.emit('token', payload['text']);
              }
              break;
            case 'turn.thinking':
              if (typeof payload['text'] === 'string') {
                emitter.emit('thinking', payload['text']);
              }
              break;
            case 'tool.start':
              emitter.emit(
                'tool:start',
                typeof payload['name'] === 'string' ? payload['name'] : 'tool',
                typeof payload['id'] === 'string' ? payload['id'] : 'tool',
                typeof payload['args'] === 'string' ? payload['args'] : '{}'
              );
              break;
            case 'tool.end':
              emitter.emit(
                'tool:end',
                typeof payload['name'] === 'string' ? payload['name'] : 'tool',
                typeof payload['id'] === 'string' ? payload['id'] : 'tool',
                typeof payload['result'] === 'string' ? payload['result'] : ''
              );
              break;
            case 'permission.request':
              emitter.emit('permission:request', {
                id: typeof payload['requestId'] === 'string' ? payload['requestId'] : '',
                toolName: typeof payload['toolName'] === 'string' ? payload['toolName'] : 'tool',
                args: (payload['args'] as Record<string, unknown>) ?? {},
              });
              break;
            case 'turn.done': {
              turnInFlight = false;
              activeTurnId = undefined;
              const stats = payload['stats'] as Record<string, unknown> | undefined;
              emitter.emit('turn:end', {
                tokens: Number(stats?.['tokens'] ?? 0),
                promptTokens: Number(stats?.['promptTokens'] ?? 0),
                completionTokens: Number(stats?.['completionTokens'] ?? 0),
                toolCalls: Number(stats?.['toolCalls'] ?? 0),
                elapsed: Number(stats?.['elapsed'] ?? 0),
                speed: Number(stats?.['speed'] ?? 0),
                firstTokenLatencyMs:
                  stats?.['firstTokenLatencyMs'] == null
                    ? null
                    : Number(stats['firstTokenLatencyMs']),
              });
              void daemon
                .getSession(session.id)
                .then((remote) => {
                  const remoteMessages = (remote.messages ?? []) as AgentMessage[];
                  session.messages = remoteMessages;
                  session.toolCallCount = remote.toolCallCount ?? session.toolCallCount;
                  return saveSession(session);
                })
                .catch(() => {});
              break;
            }
            case 'turn.error':
              turnInFlight = false;
              activeTurnId = undefined;
              emitter.emit('error', toTuiTurnError(payload));
              break;
            case 'session.cancelled':
              turnInFlight = false;
              activeTurnId = undefined;
              emitter.emit('error', '⏹ Turn cancelled');
              break;
            default:
              break;
          }
        },
      });
      closeSocket = conn.close;
    };

    reconnect();

    const onPermissionResponse = (
      id: string,
      decision: import('../tui/PermissionPrompt.js').PermissionDecision
    ) => {
      const mapped = decision === 'deny' ? 'deny' : 'allow';
      void daemon
        .resolvePermission(session.id, {
          requestId: id,
          decision: mapped,
          decidedBy: clientId,
        })
        .catch((err: unknown) => {
          emitter.emit('error', `Permission resolution failed: ${errorMessage(err)}`);
        });
    };
    emitter.on('permission:response', onPermissionResponse);

    await renderTUI({
      model: session.model,
      sessionId: session.id,
      emitter,
      initialMessages: startupMessages,
      requireLoadedModel: true,
      initialModelLoaded: startupModelLoaded,
      title: session.title,
      onModeChange: (mode) => {
        currentTuiMode = mode;
      },
      onCancelTurn: () => {
        if (!turnInFlight) return;
        void daemon
          .cancel(session.id, { turnId: activeTurnId, writerId })
          .then((res) => {
            if (res.cancelled > 0) {
              emitter.emit('error', '⏹ Turn cancelled');
            }
          })
          .catch((err: unknown) => {
            emitter.emit('error', `Cancel failed: ${errorMessage(err)}`);
          });
      },
      onSubmit: (text: string) => {
        if (turnInFlight) {
          emitter.emit(
            'error',
            'A turn is already running. Wait for it to finish before sending another message.'
          );
          return;
        }
        // Fire-and-forget: the emitter events drive the TUI updates
        (async () => {
          turnInFlight = true;
          // Resolve @file and @image references before sending to agent
          const { refs } = await resolveFileRefs(text);
          const { cleanMessage, images } = await resolveImageRefs(text);
          const enrichedInput = buildContextWithRefs(images.length > 0 ? cleanMessage : text, refs);

          // Generate session title from first user message
          if (!session.title) {
            session.title = generateTitle(text);
            emitter.emit('title', session.title);
          }

          const queued = await daemon.submitTurn(session.id, {
            clientId,
            writerId,
            content: enrichedInput,
            mode: 'chat',
            metadata: {
              workflowMode: currentTuiMode,
              imageCount: images.length,
            },
          });
          activeTurnId = queued.turnId;
        })()
          .catch(() => {
            turnInFlight = false;
            emitter.emit('error', 'Failed to submit turn to daemon');
          })
          .finally(() => {
            // Reset happens on turn.done / turn.error to preserve in-flight guard.
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
    closed = true;
    emitter.off('permission:response', onPermissionResponse);
    closeSocket();

    const logPath = await saveSessionWithJournal();
    if (!jsonMode) {
      const msgCount = session.messages.filter((m) => m.role !== 'system').length;
      console.log(
        '\n' +
          chalk.green('✓') +
          chalk.dim(` Session saved: ${session.id.slice(0, 8)} · ${msgCount} msgs`)
      );
      if (logPath) {
        console.log(chalk.dim(`  Session log: ${logPath}`));
      }
    }
    return;
  }

  /** Map OptaMode to InputEditor mode string. */
  function toEditorMode(mode: OptaMode): 'normal' | 'plan' | 'auto' {
    if (mode === 'plan' || mode === 'review' || mode === 'research') return 'plan';
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

  // Start periodic connection monitor for REPL prompt indicator (text REPL only)
  const stopConnectionMonitor = jsonMode
    ? () => {}
    : startConnectionMonitor(
        config.connection.host,
        config.connection.port,
        config.connection.fallbackHosts,
        config.connection.adminKey
      );

  // Initialize slash command TAB completion cache (non-blocking)
  import('../ui/autocomplete.js')
    .then(({ initSlashCompletionCache }) => {
      initSlashCompletionCache().catch(() => {});
    })
    .catch(() => {});

  // REPL loop
  const { input } = await import('@inquirer/prompts');
  let queuedInput = opts.initialPrompt?.trim() ?? '';

  while (true) {
    let userInput: string;
    if (queuedInput) {
      userInput = queuedInput;
      queuedInput = '';
      if (!jsonMode) {
        console.log(chalk.dim(`${getPromptMessage()} ${userInput}`));
      }
    } else {
      try {
        userInput = await input({ message: getPromptMessage() });
      } catch {
        // Ctrl+C or EOF
        stopConnectionMonitor();
        const logPath = await saveSessionWithJournal();
        if (!jsonMode) {
          const msgCount = session.messages.filter((m) => m.role !== 'system').length;
          console.log(
            '\n' +
              chalk.green('✓') +
              chalk.dim(` Session saved: ${session.id.slice(0, 8)} · ${msgCount} msgs`)
          );
          if (logPath) {
            console.log(chalk.dim(`  Session log: ${logPath}`));
          }
        }
        break;
      }
    }

    if (!userInput.trim()) continue;

    // Track input in history
    history.push(userInput);

    // Slash commands
    if (userInput.startsWith('/')) {
      const handled = await dispatchSlashCommand(userInput, { session, config, chatState });
      if (handled === 'exit') {
        stopConnectionMonitor();
        const logPath = await saveSessionWithJournal();
        if (!jsonMode) {
          const msgCount = session.messages.filter((m) => m.role !== 'system').length;
          console.log(
            chalk.green('✓') +
              chalk.dim(` Session saved: ${session.id.slice(0, 8)}`) +
              (session.title ? chalk.dim(` "${session.title}"`) : '') +
              chalk.dim(` · ${msgCount} msgs`)
          );
          if (logPath) {
            console.log(chalk.dim(`  Session log: ${logPath}`));
          }
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
        if (e.stderr) {
          let stderr = e.stderr;
          // Strip ANSI codes if output is not a TTY
          if (!process.stdout.isTTY) {
            stderr = stderr.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
          }
          console.error(chalk.red(truncateStderr(stderr)));
        }
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
          console.log(
            chalk.dim('  Matches: ') + matches.map((f) => chalk.cyan(`@${f}`)).join(chalk.dim(', '))
          );
        }
      }
    }

    // Resolve @file and @image references
    const { refs } = await resolveFileRefs(userInput);
    const { cleanMessage, images } = await resolveImageRefs(userInput);
    const enrichedInput = buildContextWithRefs(images.length > 0 ? cleanMessage : userInput, refs);

    // Set title from first user message
    if (!session.title) {
      session.title = generateTitle(userInput);
    }

    try {
      const result = await agentLoop(enrichedInput, config, {
        existingMessages: session.messages,
        sessionId: session.id,
        silent: jsonMode,
        mode:
          chatState.currentMode !== 'normal' && chatState.currentMode !== 'auto-accept'
            ? chatState.currentMode
            : undefined,
        profile: chatState.agentProfile !== 'default' ? chatState.agentProfile : undefined,
        images:
          images.length > 0
            ? images.map((img) => ({ base64: img.base64, mimeType: img.mimeType, name: img.name }))
            : undefined,
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
        console.error(chalk.red('✗') + ` ${errorMessage(err)}`);
      }
    }
  }
}
