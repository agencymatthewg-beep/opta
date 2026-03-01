/**
 * agent.ts — Main agent loop orchestrator.
 *
 * Delegates to focused modules:
 *   agent-setup.ts      — Client creation, system prompt, compaction
 *   agent-streaming.ts  — Stream collection + retry logic
 *   agent-permissions.ts — Tool approval flow
 *   agent-execution.ts  — Parallel tool dispatch with semaphore
 */

import chalk from 'chalk';
import type { OptaConfig } from './config.js';
import { ensureModel } from './errors.js';
import { debug } from './debug.js';
import { errorMessage } from '../utils/errors.js';
import { estimateMessageTokens } from '../utils/tokens.js';
import { createSpinner, type Spinner } from '../ui/spinner.js';
import { ThinkingRenderer } from '../ui/thinking.js';
import { StatusBar } from '../ui/statusbar.js';
import type { SubAgentContext } from './subagent.js';
import {
  createHookManager,
  fireSessionStart,
  fireSessionEnd,
  fireCompact,
  fireError,
  type SessionContext,
} from '../hooks/integration.js';

// --- Re-export sub-module types for consumers ---
export { resetClientCache, buildSystemPrompt } from './agent-setup.js';
export type { ToolCallAccum } from './agent-streaming.js';
export type { ToolDecision } from './agent-permissions.js';

// --- Types (public API — unchanged) ---

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[] | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface OnStreamCallbacks {
  onToken?: (text: string) => void;
  onToolStart?: (name: string, id: string, args: string) => void;
  onToolEnd?: (name: string, id: string, result: string) => void;
  onThinking?: (text: string) => void;
  /**
   * Called when a tool requires 'ask' permission.
   * The callback must return a Promise that resolves to true (allow) or false (deny).
   * If 'always' is chosen, the caller should persist the permission and return true.
   */
  onPermissionRequest?: (
    toolName: string,
    args: Record<string, unknown>
  ) => Promise<'allow' | 'deny' | 'always'>;
  /** Called when connection status changes during streaming (reconnection attempts). */
  onConnectionStatus?: (
    status: 'checking' | 'connected' | 'disconnected' | 'reconnecting',
    attempt?: number
  ) => void;
  /** Called with inference observability insights (performance, context, tool selection). */
  onInsight?: (insight: import('./insights.js').Insight) => void;
  /** Called when the API returns token usage data (from final streaming chunk). */
  onUsage?: (usage: { promptTokens: number; completionTokens: number }) => void;
  /** Called when Atpo supervisor state changes */
  onAtpoState?: (state: import('./atpo.js').AtpoState) => void;
}

export interface AgentLoopOptions {
  existingMessages?: AgentMessage[];
  sessionId?: string;
  silent?: boolean;
  mode?: string;
  imageBase64?: string;
  /** Multiple images for multimodal vision support. */
  images?: Array<{ base64: string; mimeType: string; name?: string }>;
  subAgentContext?: SubAgentContext;
  profile?: string;
  onStream?: OnStreamCallbacks;
  signal?: AbortSignal;
  /**
   * Optional override for standard local tool execution (used by daemon worker offload).
   * MCP/custom/sub-agent tool routing still occurs inside the registry.
   */
  toolExecutor?: (name: string, argsJson: string, signal?: AbortSignal) => Promise<string>;
  /** Called when a sub-agent is spawned (both spawn_agent and delegate_task subtasks). */
  onSubAgentSpawn?: (id: string, label: string, dependsOn?: number) => void;
  /** Called as a sub-agent progresses through phases. */
  onSubAgentProgress?: (event: import('./subagent-events.js').SubAgentProgressEvent) => void;
  /** Called when a sub-agent completes with its final result text. */
  onSubAgentDone?: (agentId: string, result: string) => void;
  /** Called after each successfully executed browser MCP action. Used to stream events to the TUI. */
  onBrowserEvent?: (toolName: string, sessionId: string) => void;
}

export interface AgentLoopResult {
  messages: AgentMessage[];
  toolCallCount: number;
  lastThinkingRenderer?: ThinkingRenderer;
}

type AutonomyRunCompletionStatus = import('./autonomy.js').AutonomyRunCompletionStatus;

export interface FinalReassessmentDecisionInput {
  autonomyLevel: number;
  objectiveReassessmentEnabled: boolean;
  alreadyForcedFinalPass: boolean;
}

export function shouldForceFinalReassessmentPass(input: FinalReassessmentDecisionInput): boolean {
  return (
    input.autonomyLevel >= 3 && input.objectiveReassessmentEnabled && !input.alreadyForcedFinalPass
  );
}

function makeAbortError(message = 'Turn cancelled'): Error {
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

function queueLearningCapture(
  config: OptaConfig,
  event: import('../learning/hooks.js').CaptureLearningEventInput
): void {
  if (!config.learning.enabled) return;
  void import('../learning/hooks.js')
    .then(({ captureLearningEvent }) => captureLearningEvent(config, event))
    .catch(() => {});
}

async function buildLearningRetrievalBlock(
  task: string,
  config: OptaConfig
): Promise<string | null> {
  if (!config.learning.enabled) return null;

  try {
    const { readLedgerEntries } = await import('../learning/ledger.js');
    const { buildRetrievalPromptBlock } = await import('../learning/retrieval.js');
    const entries = await readLedgerEntries();
    if (entries.length === 0) return null;

    const block = buildRetrievalPromptBlock(task, entries, 4);
    if (block.includes('No matching prior learning found.')) {
      return null;
    }
    return block;
  } catch {
    return null;
  }
}

// --- Main Agent Loop ---

export async function agentLoop(
  task: string,
  config: OptaConfig,
  options?: AgentLoopOptions
): Promise<AgentLoopResult> {
  // --- Imports from sub-modules ---
  const {
    getOrCreateClient,
    buildSystemPrompt,
    compactHistory,
    maskOldObservations,
    buildCapabilityManifest,
    injectCapabilityManifest,
  } = await import('./agent-setup.js');
  const { createStreamWithRetry, collectStream } = await import('./agent-streaming.js');
  const { resolveToolDecisions } = await import('./agent-permissions.js');
  const { executeToolCalls } = await import('./agent-execution.js');
  const {
    applyAutonomyRuntimeProfile,
    buildAutonomyCycleCheckpoint,
    buildAutonomyStageCheckpointGuidance,
    buildCeoAutonomyReport,
  } = await import('./autonomy.js');

  const isSubAgent = !!options?.subAgentContext;
  const profiledConfig = applyAutonomyRuntimeProfile(config);

  // When running as a sub-agent, apply derived config overrides
  let effectiveConfig: OptaConfig;
  if (isSubAgent) {
    const { deriveChildConfig } = await import('./subagent.js');
    effectiveConfig = deriveChildConfig(
      profiledConfig,
      options?.mode,
      options?.subAgentContext?.budget
    );
  } else {
    effectiveConfig = profiledConfig;
  }

  const client = await getOrCreateClient(effectiveConfig);
  const transportProviderName =
    (client as import('openai').default & { __optaProviderName?: string }).__optaProviderName ??
    effectiveConfig.provider.active;

  const model = effectiveConfig.model.default;
  ensureModel(model);

  // Use existing messages (multi-turn) or start fresh (single-shot)
  // Build multimodal content if images are provided (single or multiple)
  const allImages: Array<{ base64: string; mimeType: string; name?: string }> = [];
  if (options?.imageBase64) {
    allImages.push({ base64: options.imageBase64, mimeType: 'image/png' });
  }
  if (options?.images) {
    allImages.push(...options.images);
  }

  const userMessage: AgentMessage =
    allImages.length > 0
      ? {
          role: 'user',
          content: [
            { type: 'text', text: task },
            ...allImages.map((img) => ({
              type: 'image_url' as const,
              image_url: {
                url: img.base64.startsWith('data:')
                  ? img.base64
                  : `data:${img.mimeType};base64,${img.base64}`,
              },
            })),
          ],
        }
      : { role: 'user', content: task };

  let systemPrompt: string;
  if (isSubAgent) {
    // Sub-agents get a lightweight prompt without OPIS/export map
    const { buildSubAgentPrompt } = await import('./subagent.js');
    const cwd = options?.subAgentContext?.parentCwd ?? process.cwd();
    const maxToolCalls = options?.subAgentContext?.budget.maxToolCalls ?? 15;
    systemPrompt = buildSubAgentPrompt(task, cwd, maxToolCalls);
  } else {
    systemPrompt = await buildSystemPrompt(effectiveConfig, undefined, options?.mode);
  }

  // If an agent profile is active, append its system prompt suffix
  if (options?.profile) {
    const { getAgentProfile } = await import('./agent-profiles.js');
    const activeProfile = getAgentProfile(options.profile);
    if (activeProfile?.systemPromptSuffix) {
      systemPrompt += '\n\n' + activeProfile.systemPromptSuffix;
    }
  }

  const messages: AgentMessage[] = options?.existingMessages
    ? [...options.existingMessages, userMessage]
    : [{ role: 'system', content: systemPrompt }, userMessage];

  let toolCallCount = 0;
  let toolCallTurns = 0;
  const enforceAutonomyStages = effectiveConfig.autonomy.level >= 3;
  const objectiveReassessmentEnabled = effectiveConfig.autonomy.objectiveReassessment;
  let forcedFinalReassessmentTriggered = false;
  let pendingFinalReassessmentPass = false;
  let autonomyTurnCount = 0;
  let lastAutonomyCheckpoint = buildAutonomyCycleCheckpoint(0);
  let completionStatus: AutonomyRunCompletionStatus = 'stopped';
  let completionMessage: string | undefined;
  // Sub-agents are always silent
  const silent = isSubAgent || (options?.silent ?? false);
  const noopSpinner: Spinner = {
    start: () => {},
    stop: () => {},
    succeed: () => {},
    fail: () => {},
  };
  const spinner = silent ? noopSpinner : await createSpinner();
  const sessionId = options?.sessionId ?? 'unknown';

  // Status bar for real-time stats
  const statusBar = silent
    ? null
    : new StatusBar({
        model,
        sessionId,
        provider: effectiveConfig.provider.active,
      });
  let checkpointCount = 0;
  let pseudoToolProtocolRetryCount = 0;
  let lastThinkingRenderer: ThinkingRenderer | undefined;
  const streamCallbacks = options?.onStream;

  // Insight engine for REPL mode (non-TUI, non-silent)
  // TUI mode uses its own InsightEngine wired through the adapter.
  let insightEngine: import('./insights.js').InsightEngine | null = null;
  if (!silent && !streamCallbacks?.onInsight && effectiveConfig.insights.enabled) {
    const { InsightEngine } = await import('./insights.js');
    const { formatInsight } = await import('../ui/insights.js');
    insightEngine = new InsightEngine((insight) => {
      console.log(formatInsight(insight));
    });
    insightEngine.setModel(model);
    insightEngine.setContextLimit(effectiveConfig.model.contextLimit);
  }

  // Initialize background process manager (skip for sub-agents to avoid replacing parent's)
  const { initProcessManager, shutdownProcessManager } = await import('./tools/index.js');
  if (!isSubAgent) {
    initProcessManager(effectiveConfig);
  }

  const { buildToolRegistry } = await import('../mcp/registry.js');
  const registry = await buildToolRegistry(effectiveConfig, options?.mode, {
    executeLocalTool: options?.toolExecutor,
    onSubAgentSpawn: options?.onSubAgentSpawn,
    onSubAgentProgress: options?.onSubAgentProgress,
    onSubAgentDone: options?.onSubAgentDone,
    onBrowserEvent: options?.onBrowserEvent,
  });

  const { getAgentProfile, filterToolsForMode } = await import('./agent-profiles.js');

  // Filter tool schemas by agent profile (if active)
  let activeSchemas = registry.schemas;
  if (options?.profile) {
    const activeProfile = getAgentProfile(options.profile);
    if (activeProfile?.tools && activeProfile.tools.length > 0) {
      const allowedTools = new Set(activeProfile.tools);
      activeSchemas = activeSchemas.filter((s: { function: { name: string } }) =>
        allowedTools.has(s.function.name)
      );
      debug(
        `Profile "${options.profile}" filtered tools: ${activeSchemas.length}/${registry.schemas.length}`
      );
    }
  }

  const activeMode = options?.mode ?? effectiveConfig.defaultMode;
  const preModeCount = activeSchemas.length;
  activeSchemas = filterToolsForMode(activeSchemas, activeMode);
  if (activeSchemas.length !== preModeCount) {
    debug(`Mode "${activeMode}" filtered tools: ${activeSchemas.length}/${preModeCount}`);
  }

  // Inject a concise runtime capability manifest after tool filtering.
  if (!isSubAgent) {
    const manifest = buildCapabilityManifest(effectiveConfig, {
      activeToolSchemas: activeSchemas,
      mode: activeMode,
      profile: options?.profile,
    });

    let systemMessage = messages.find(
      (message) => message.role === 'system' && typeof message.content === 'string'
    );
    if (systemMessage && typeof systemMessage.content === 'string') {
      systemMessage.content = injectCapabilityManifest(systemMessage.content, manifest);
    } else if (!options?.existingMessages) {
      messages.unshift({
        role: 'system',
        content: injectCapabilityManifest(systemPrompt, manifest),
      });
      systemMessage = messages[0];
    }

    const learningBlock = await buildLearningRetrievalBlock(task, effectiveConfig);
    if (
      learningBlock &&
      systemMessage &&
      typeof systemMessage.content === 'string' &&
      !systemMessage.content.includes('### Relevant learning context')
    ) {
      systemMessage.content = `${systemMessage.content}\n\n${learningBlock}`;
    }

    const { readToolCompatibilityEntry, buildToolCompatibilityInstruction } =
      await import('./tool-compatibility.js');
    const compatibilityEntry = await readToolCompatibilityEntry(process.cwd(), {
      model,
      provider: transportProviderName,
    }).catch(() => null);
    const compatibilityInstruction = buildToolCompatibilityInstruction(compatibilityEntry);
    if (
      compatibilityInstruction &&
      systemMessage &&
      typeof systemMessage.content === 'string' &&
      !systemMessage.content.includes('### Tool-Call Compatibility')
    ) {
      systemMessage.content = `${systemMessage.content}\n\n${compatibilityInstruction}`;
    }

    if (effectiveConfig.browser.enabled) {
      const { buildBrowserAvailabilityInstruction } = await import('../browser/intent-router.js');
      const mcpEnabled = effectiveConfig.browser.mcp?.enabled ?? false;
      const explicitRequest = task.toLowerCase().includes('browser');
      const browserInstruction = buildBrowserAvailabilityInstruction(explicitRequest, mcpEnabled);
      if (
        browserInstruction &&
        systemMessage &&
        typeof systemMessage.content === 'string' &&
        !systemMessage.content.includes('### Browser Tools Available')
      ) {
        systemMessage.content = `${systemMessage.content}\n\n${browserInstruction}`;
      }
    }
  }

  // Initialize hook manager (no-op when no hooks configured)
  const hooks = createHookManager(effectiveConfig);
  const sessionCtx: SessionContext = {
    sessionId,
    cwd: process.cwd(),
    model,
  };
  if (!isSubAgent) {
    await fireSessionStart(hooks, sessionCtx);
  }

  // Hoist dynamic imports used inside the loop to avoid per-iteration await overhead
  const { saveConfig: saveConfigFn } = await import('./config.js');
  const gitUtilsMod = await import('../git/utils.js');
  const gitCheckpointsMod = await import('../git/checkpoints.js');
  const gitCommitMod = await import('../git/commit.js');
  const { detectPseudoToolMarkup, buildPseudoToolCorrectionMessage } =
    await import('./tool-protocol.js');
  const { recordToolCompatibilityEvent } = await import('./tool-compatibility.js');
  const loopStartedAtMs = Date.now();

  // --- LMX Watchdog: continuous health monitor ---
  // Only active for top-level (non-sub-agent) sessions running against LMX.
  let watchdog: { stop(): void } | undefined;
  const isLmxActive = (effectiveConfig.provider?.active ?? 'lmx') === 'lmx';
  if (isLmxActive && !isSubAgent) {
    const { LmxWatchdog } = await import('../lmx/watchdog.js');
    const { LmxClient } = await import('../lmx/client.js');
    const tempClient = new LmxClient({
      host: effectiveConfig.connection.host,
      fallbackHosts: effectiveConfig.connection.fallbackHosts,
      port: effectiveConfig.connection.port,
      adminKey: effectiveConfig.connection.adminKey,
      timeoutMs: 4_000,
      maxRetries: 0,
    });
    const wd = new LmxWatchdog(tempClient, () => {
      if (!silent) {
        console.log(
          chalk.yellow(
            '\n  Warning: LMX unreachable — provider may degrade. Run `opta doctor` if this persists.'
          )
        );
      }
    });
    wd.start(15_000);
    watchdog = wd;
  }

  // Persistent transport options shared across all turns.
  // Mutations (e.g. lmxWsUnavailable) carry forward so a WS failure on turn 1
  // prevents repeated WebSocket attempts on turns 2–N, eliminating the noisy
  // 3-attempt reconnect overhead when LMX has no WebSocket endpoint.
  const streamTransport: import('./agent-streaming.js').StreamTransportOptions = {
    config: effectiveConfig,
    providerName: transportProviderName,
    signal: options?.signal,
  };

  const { AtpoSupervisor } = await import('./atpo.js');
  const atpo = new AtpoSupervisor({
    config: effectiveConfig,
    emitState: options?.onStream?.onAtpoState,
    emitLog: options?.silent ? undefined : (msg) => debug(msg),
  });

  try {
    while (true) {
      if (options?.signal?.aborted) {
        throw makeAbortError();
      }

      // --- ATPO SUPERVISOR CHECK ---
      if (atpo.isEnabled && await atpo.checkThresholds(messages)) {
        const intervention = await atpo.intervene(messages);
        if (intervention) {
          messages.push(intervention);
          continue; // Restart loop with the Atpo correction in context
        }
      }

      const maxDurationMs = effectiveConfig.safety.circuitBreaker.maxDuration;
      if (maxDurationMs > 0) {
        const elapsedMs = Date.now() - loopStartedAtMs;
        if (elapsedMs >= maxDurationMs) {
          const elapsedMinutes = (elapsedMs / 60_000).toFixed(1);
          const budgetMinutes = (maxDurationMs / 60_000).toFixed(1);
          if (!silent) {
            console.log(
              chalk.yellow(
                `\n  Autonomous runtime budget reached (${elapsedMinutes}/${budgetMinutes} min). Stopping turn.`
              )
            );
          }
          completionStatus = 'runtime_budget_reached';
          messages.push({
            role: 'assistant',
            content: `Autonomy runtime budget reached (${elapsedMinutes}/${budgetMinutes} min). Returning the best complete state so far.`,
          });
          statusBar?.clear();
          break;
        }
      }

      // 0. Observation masking (free context savings)
      const maskedMessages = maskOldObservations(messages, 4);
      messages.splice(0, messages.length, ...maskedMessages);

      // 1. Context compaction
      const tokenEstimate = estimateMessageTokens(messages);
      insightEngine?.contextUpdate(tokenEstimate);
      const threshold = effectiveConfig.model.contextLimit * effectiveConfig.safety.compactAt;
      if (tokenEstimate > threshold) {
        debug(`Token estimate ${tokenEstimate} exceeds threshold ${threshold}`);
        spinner.start('Compacting conversation history...');
        const preCompactCount = messages.length;
        const compacted = await compactHistory(
          messages,
          client,
          model,
          effectiveConfig.model.contextLimit
        );
        const recoveredTokens = tokenEstimate - estimateMessageTokens(compacted);
        messages.splice(0, messages.length, ...compacted);
        spinner.succeed('Context compacted');
        insightEngine?.compaction(preCompactCount, recoveredTokens);
        await fireCompact(hooks, sessionCtx);
      }

      const stageCheckpoint = buildAutonomyCycleCheckpoint(autonomyTurnCount);
      lastAutonomyCheckpoint = stageCheckpoint;
      if (enforceAutonomyStages) {
        messages.push({
          role: 'system',
          content: buildAutonomyStageCheckpointGuidance(stageCheckpoint, {
            finalReassessment: pendingFinalReassessmentPass,
          }),
        });
      }
      pendingFinalReassessmentPass = false;
      autonomyTurnCount += 1;

      // 2. Call Opta LMX
      insightEngine?.turnStart();
      debug(`Sending ${messages.length} messages to ${model}`);
      spinner.start('Thinking...');

      // Reconnection status handler: use TUI callback if available, otherwise log to console
      const reconnectHandler =
        streamCallbacks?.onConnectionStatus ??
        (silent
          ? undefined
          : (
              status: 'checking' | 'connected' | 'disconnected' | 'reconnecting',
              attempt?: number
            ) => {
              if (status === 'reconnecting') {
                spinner.stop();
                console.log(
                  chalk.dim(
                    `  Connection interrupted, reconnecting... (attempt ${attempt ?? '?'}/${effectiveConfig.connection.retry.maxRetries})`
                  )
                );
                spinner.start('Reconnecting...');
              } else if (status === 'connected') {
                spinner.stop();
                console.log(chalk.green('  \u2713') + chalk.dim(' Reconnected'));
                spinner.start('Thinking...');
              } else if (status === 'disconnected') {
                spinner.stop();
              }
            });

      const stream = await createStreamWithRetry(
        client,
        {
          model,
          messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
          tools: activeSchemas as Parameters<typeof client.chat.completions.create>[0]['tools'],
          tool_choice: 'auto',
        },
        effectiveConfig.connection.retry,
        reconnectHandler,
        streamTransport
      );

      spinner.stop();

      // 3. Stream tokens to terminal, collect tool calls
      statusBar?.newTurn();
      let firstText = true;
      const streamStartTime = Date.now();
      const {
        text,
        toolCalls,
        thinkingRenderer: lastThinking,
        usage,
        finishReason,
      } = await collectStream(
        stream,
        (chunk) => {
          if (silent) return;
          if (firstText) {
            console.log(); // blank line before response
            firstText = false;
            // Fire first-token insight for REPL mode
            insightEngine?.firstToken(Date.now() - streamStartTime);
          }
          process.stdout.write(chunk);
        },
        statusBar,
        streamCallbacks
      );

      // Track last thinking renderer for expand/collapse toggle
      lastThinkingRenderer = lastThinking;

      // Set prompt tokens from API usage data (if available)
      if (usage) {
        statusBar?.setPromptTokens(usage.promptTokens);
        streamCallbacks?.onUsage?.(usage);
      }

      // Truncation detection: warn if response was cut off by max_tokens
      if (finishReason === 'length') {
        const truncationWarning = chalk.yellow('  ⚠ Response truncated (hit max_tokens limit)');
        if (!silent) {
          process.stdout.write('\n' + truncationWarning + '\n');
        }
        debug('Response truncated: finish_reason=length');
      }

      if (!silent && text && !firstText) {
        process.stdout.write('\n'); // newline after streamed text
      }

      // Print turn summary (tokens, speed, tool calls)
      statusBar?.finalizeTurn();
      if (!silent) statusBar?.printSummary();

      if (toolCalls.length === 0 && text) {
        const detection = detectPseudoToolMarkup(text);
        if (detection.detected) {
          if (!isSubAgent) {
            await recordToolCompatibilityEvent(process.cwd(), {
              model,
              provider: transportProviderName,
              status: 'pseudo_failure',
              pseudoTags: detection.toolTags,
            }).catch(() => {});
          }

          messages.push({
            role: 'assistant',
            content: text,
          });

          if (pseudoToolProtocolRetryCount < 1) {
            pseudoToolProtocolRetryCount += 1;
            const correction = buildPseudoToolCorrectionMessage(
              detection,
              effectiveConfig.browser.enabled
            );
            if (!silent) {
              console.log(
                chalk.yellow(
                  '  ⚠ Invalid pseudo tool markup detected; retrying with protocol correction.'
                )
              );
            }
            messages.push({
              role: 'system',
              content: correction,
            });
            continue;
          }

          const guidance = [
            'Tool-call protocol error: model returned pseudo tool tags instead of executable tool calls.',
            'Switch to a tool-calling compatible model/provider and retry.',
            'Browser note: use browser_* tool calls; do not use shell GUI automation.',
          ].join(' ');
          if (!silent) {
            console.log(chalk.red(`\n  ${guidance}\n`));
          }
          messages.push({
            role: 'assistant',
            content: guidance,
          });
          completionStatus = 'stopped';
          statusBar?.clear();
          break;
        }
      }

      // 4. No tool calls = task complete
      if (toolCalls.length === 0) {
        // Persist the final assistant response so callers (e.g. opta do --format json)
        // can reliably read it from message history.
        messages.push({
          role: 'assistant',
          content: text || null,
        });

        // Fire turn-end insight for REPL mode
        const turnElapsed = (Date.now() - streamStartTime) / 1000;
        const turnTokens = estimateMessageTokens([{ role: 'assistant', content: text }]);
        const turnSpeed = turnElapsed > 0.1 ? turnTokens / turnElapsed : 0;
        insightEngine?.turnEnd({
          tokens: turnTokens,
          toolCalls: 0,
          elapsed: turnElapsed,
          speed: turnSpeed,
          firstTokenLatencyMs: null,
        });

        if (
          shouldForceFinalReassessmentPass({
            autonomyLevel: effectiveConfig.autonomy.level,
            objectiveReassessmentEnabled,
            alreadyForcedFinalPass: forcedFinalReassessmentTriggered,
          })
        ) {
          forcedFinalReassessmentTriggered = true;
          pendingFinalReassessmentPass = true;
          if (!silent) {
            console.log(
              chalk.dim(
                '  Autonomy checkpoint: forcing final review/reassessment pass before completion.'
              )
            );
          }
          statusBar?.clear();
          continue;
        }

        completionStatus = 'completed';
        if (text && text.trim() && toolCallCount > 0) {
          queueLearningCapture(effectiveConfig, {
            kind: 'solution',
            topic: 'Tool-assisted turn completed',
            content: text.slice(0, 1600),
            tags: ['completion', 'tool-assisted', activeMode],
            evidence: [{ label: 'session', uri: `session://${sessionId}` }],
            metadata: {
              mode: activeMode,
              profile: options?.profile ?? 'default',
              toolCallCount,
            },
            verified: true,
          });
        }

        statusBar?.clear();
        break;
      }

      toolCallTurns += 1;

      // 5. Append assistant message with tool calls
      if (!isSubAgent) {
        await recordToolCompatibilityEvent(process.cwd(), {
          model,
          provider: transportProviderName,
          status: 'success',
        }).catch(() => {});
      }

      messages.push({
        role: 'assistant',
        content: text || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      });
      pseudoToolProtocolRetryCount = 0;

      // 6. Resolve permissions then execute tools
      const decisions = await resolveToolDecisions(toolCalls, effectiveConfig, {
        isSubAgent,
        silent,
        saveConfig: saveConfigFn,
        streamCallbacks,
        hooks,
        sessionCtx,
      });

      const msgsLenBefore = messages.length;
      const execResult = await executeToolCalls(
        decisions,
        messages,
        {
          config: effectiveConfig,
          spinner,
          silent,
          isSubAgent,
          sessionId,
          streamCallbacks,
          insightEngine,
          hooks,
          sessionCtx,
          registry,
          signal: options?.signal,
        },
        toolCallCount,
        checkpointCount
      );

      // Inspect tool results for Atpo
      if (atpo.isEnabled) {
        const addedMsgs = messages.slice(msgsLenBefore);
        for (const m of addedMsgs) {
          if (m.role === 'tool') {
            atpo.onToolStart();
            const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
            if (content.toLowerCase().startsWith('error:') || content.includes('Failed to')) {
              atpo.onToolError();
            } else {
              atpo.onToolSuccess();
            }
          }
        }
      }

      toolCallCount += execResult.toolCallsDelta;
      checkpointCount = execResult.checkpointCount;

      // 7. Progressive circuit breaker
      const cb = effectiveConfig.safety.circuitBreaker;

      if (cb.hardStopAt > 0 && toolCallCount >= cb.hardStopAt) {
        if (!silent) console.log(chalk.red(`\n  Hard stop: ${cb.hardStopAt} tool calls reached.`));
        completionStatus = 'hard_stop';
        break;
      }

      if (cb.pauseAt > 0 && toolCallCount >= cb.pauseAt && toolCallCount % cb.pauseAt === 0) {
        const isNonInteractive = !process.stdout.isTTY || process.env['CI'] === 'true';
        const canContinueHeadless =
          isNonInteractive &&
          effectiveConfig.autonomy.headlessContinue &&
          effectiveConfig.autonomy.level >= 4;

        if (canContinueHeadless) {
          // Headless continue: log a checkpoint and keep running without user prompt
          if (!silent) {
            console.log(
              chalk.dim(
                `\n  ⟳ Headless checkpoint at ${toolCallCount} tool calls — continuing autonomously`
              )
            );
          }
          queueLearningCapture(effectiveConfig, {
            kind: 'plan',
            topic: 'Headless circuit breaker checkpoint',
            content: `Session auto-continued at ${toolCallCount} tool calls (headlessContinue=true, level=${effectiveConfig.autonomy.level})`,
            tags: ['agent-loop', 'headless', 'circuit-breaker'],
            verified: true,
          });
        } else if (silent || isNonInteractive) {
          completionStatus = 'paused';
          break;
        } else {
          console.log(chalk.yellow(`\n  Reached ${toolCallCount} tool calls. Pausing.`));
          const { confirm } = await import('@inquirer/prompts');
          const shouldContinue = await confirm({ message: 'Continue?' });
          if (!shouldContinue) {
            completionStatus = 'paused';
            break;
          }
        }
      }

      if (cb.warnAt > 0 && toolCallCount === cb.warnAt && !silent) {
        console.log(chalk.dim(`\n  Note: ${cb.warnAt} tool calls used (pauses at ${cb.pauseAt})`));
      }

      // R3: Periodic recovery checkpoint every 10 tool calls
      if (sessionId && sessionId !== 'unknown' && toolCallCount > 0 && toolCallCount % 10 === 0) {
        const { writeRecoveryCheckpoint } = await import('../memory/recovery.js');
        void writeRecoveryCheckpoint(sessionId, messages, toolCallCount).catch(() => {});
      }
    }
  } catch (err) {
    // Fire the error hook so lifecycle hooks can observe failures
    completionStatus = err instanceof Error && err.name === 'AbortError' ? 'aborted' : 'error';
    const errMsg = errorMessage(err);
    completionMessage = errMsg;
    queueLearningCapture(effectiveConfig, {
      kind: 'problem',
      topic: 'Agent loop error',
      content: errMsg,
      tags: ['agent-loop', 'error', activeMode],
      evidence: [{ label: 'session', uri: `session://${sessionId}` }],
      metadata: {
        mode: activeMode,
        profile: options?.profile ?? 'default',
      },
      verified: false,
    });
    await fireError(hooks, errMsg, sessionCtx).catch(() => {});
    throw err; // Re-throw so callers (chat.ts, do.ts, server.ts) handle it
  } finally {
    // Cleanup runs whether the loop completes normally or throws

    if (!isSubAgent && effectiveConfig.autonomy.mode === 'ceo') {
      try {
        const reportCheckpoint =
          autonomyTurnCount > 0
            ? buildAutonomyCycleCheckpoint(autonomyTurnCount - 1)
            : lastAutonomyCheckpoint;
        const reportStage = forcedFinalReassessmentTriggered
          ? 'reassessment'
          : reportCheckpoint.stage;
        const report = buildCeoAutonomyReport({
          objective: task,
          completionStatus,
          completionMessage,
          turnCount: autonomyTurnCount,
          cycle: reportCheckpoint.cycle,
          phase: reportCheckpoint.phase,
          stage: reportStage,
          toolCallCount,
          toolCallTurns,
          objectiveReassessmentEnabled,
          forcedFinalReassessment: forcedFinalReassessmentTriggered,
        });
        const { writeUpdateLog } = await import('../journal/update-log.js');
        await writeUpdateLog({
          summary: report.summary,
          slug: report.slug,
          commandInputs: report.commandInputs,
          steps: report.steps,
          cwd: process.cwd(),
          logsDir: effectiveConfig.journal.updateLogsDir,
          timezone: effectiveConfig.journal.timezone,
          author: effectiveConfig.journal.author,
          promoted: false,
          category: 'autonomy',
        });
      } catch {
        // Fail-open by design: logging must never break agent loop completion.
      }
    }

    // Auto-commit if enabled and tools were used (skip for sub-agents)
    if (!isSubAgent && effectiveConfig.git.autoCommit && toolCallCount > 0 && options?.sessionId) {
      try {
        if (await gitUtilsMod.isGitRepo(process.cwd())) {
          const modifiedFiles = await gitUtilsMod.getModifiedFiles(process.cwd());
          if (modifiedFiles.length > 0) {
            const commitMsg = await gitCommitMod.generateCommitMessage(messages, client, model);
            const committed = await gitCommitMod.commitSessionChanges(
              process.cwd(),
              modifiedFiles,
              commitMsg
            );
            if (committed && !silent) {
              console.log(chalk.green('\u2713') + chalk.dim(` Committed: ${commitMsg}`));
            }
            await gitCheckpointsMod.cleanupCheckpoints(process.cwd(), options.sessionId);
          }
        }
      } catch (err) {
        // Auto-commit failed — non-fatal
        if (process.env.OPTA_DEBUG) console.error('Auto-commit failed:', err);
      }
    }

    // Token usage shown by statusBar.printSummary() per turn

    // Stop health watchdog (no-op if not started)
    watchdog?.stop();

    // R3: Delete recovery checkpoint on non-crash exit
    if (sessionId && sessionId !== 'unknown' && completionStatus !== 'error') {
      const { deleteRecoveryCheckpoint } = await import('../memory/recovery.js');
      void deleteRecoveryCheckpoint(sessionId).catch(() => {});
    }

    await registry.close();

    // Shutdown background processes (skip for sub-agents to avoid killing parent's)
    if (!isSubAgent) {
      shutdownProcessManager();
    }

    // Fire session end hook
    if (!isSubAgent) {
      await fireSessionEnd(hooks, sessionCtx);
    }
  }

  return { messages, toolCallCount, lastThinkingRenderer };
}
