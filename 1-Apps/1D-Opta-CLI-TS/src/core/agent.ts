import chalk from 'chalk';
import type { OptaConfig } from './config.js';
import { ensureModel } from './errors.js';
import { resolvePermission } from './tools/index.js';
import { debug } from './debug.js';
import { maskOldObservations, COMPACTION_PROMPT } from './context.js';
import { createSpinner, type Spinner } from '../ui/spinner.js';
import { ThinkingRenderer, stripThinkTags } from '../ui/thinking.js';
import { StatusBar } from '../ui/statusbar.js';
import { formatToolCall, formatToolResult } from '../ui/toolcards.js';
import type { SubAgentContext } from './subagent.js';
import {
  createHookManager,
  fireSessionStart,
  fireSessionEnd,
  fireToolPre,
  fireToolPost,
  fireCompact,
  fireError,
  type SessionContext,
} from '../hooks/integration.js';

// --- Provider-Based Client ---
// Uses the provider system (src/providers/) for multi-provider support.
// The provider manager caches clients internally.

async function getOrCreateClient(config: OptaConfig): Promise<import('openai').default> {
  const { getProvider } = await import('../providers/manager.js');
  const provider = await getProvider(config);
  debug(`Using provider: ${provider.name}`);
  return provider.getClient();
}

/** Reset the cached client (useful for testing). */
export function resetClientCache(): void {
  import('../providers/manager.js').then(({ resetProviderCache }) => resetProviderCache()).catch(() => {});
}

interface ToolCallAccum {
  id: string;
  name: string;
  args: string;
}

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
  onPermissionRequest?: (toolName: string, args: Record<string, unknown>) => Promise<'allow' | 'deny' | 'always'>;
  /** Called when connection status changes during streaming (reconnection attempts). */
  onConnectionStatus?: (status: 'checking' | 'connected' | 'disconnected' | 'reconnecting', attempt?: number) => void;
  /** Called with inference observability insights (performance, context, tool selection). */
  onInsight?: (insight: import('./insights.js').Insight) => void;
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
}

export interface AgentLoopResult {
  messages: AgentMessage[];
  toolCallCount: number;
  lastThinkingRenderer?: ThinkingRenderer;
}

// --- System Prompt ---

export async function buildSystemPrompt(config: OptaConfig, cwd?: string, mode?: string): Promise<string> {
  const workingDir = cwd ?? process.cwd();

  let prompt = `You are Opta, an AI coding assistant running locally on the user's machine. You help with coding tasks by using tools to read, edit, and search files, and run commands.

Rules:
- Read files before editing them
- Use edit_file for precise, targeted changes (not write_file to rewrite entire files)
- Use search_files and find_files to understand the codebase before making changes
- web_fetch: Fetch and read web pages (documentation, APIs, references)
- Explain your reasoning before each action
- When the task is complete, respond with a final summary (no tool calls)

Working directory: ${workingDir}`;

  // Load OPIS context
  try {
    const { loadOpisContext } = await import('../context/opis.js');
    const opisCtx = await loadOpisContext(workingDir);

    if (opisCtx.hasOpis && opisCtx.summary) {
      prompt += `\n\n${opisCtx.summary}`;
    } else if (opisCtx.fallbackMemory) {
      prompt += `\n\nProject knowledge:\n${opisCtx.fallbackMemory}`;
    } else {
      prompt += `\n\nTip: Run \`opta init\` to set up project documentation for better context.`;
    }
  } catch {
    // OPIS loading failed — continue without context
  }

  // Load export map (gated by config.context.exportMap)
  if (config.context.exportMap) {
    try {
      const { scanExports, formatExportMap } = await import('../context/exports.js');
      const exportMap = await scanExports(workingDir);

      if (exportMap.entries.length > 0) {
        prompt += `\n\nCodebase exports:\n${formatExportMap(exportMap)}`;
      }
    } catch {
      // Export scanning failed — continue without map
    }
  }

  // Warn about dirty working tree
  try {
    const { isGitRepo, isDirty } = await import('../git/utils.js');
    if (await isGitRepo(workingDir) && await isDirty(workingDir)) {
      prompt += '\n\nNote: Working tree has uncommitted changes from outside this session.';
    }
  } catch {
    // Git utils unavailable — skip
  }

  if (mode === 'plan') {
    prompt += `\n\nYou are in PLAN MODE. You are a software architect helping design an implementation approach.

CRITICAL CONSTRAINTS:
- You are READ-ONLY. You MUST NOT call edit_file, write_file, multi_edit, delete_file, or run_command.
- You CAN use: read_file, list_dir, search_files, find_files, ask_user, web_search, web_fetch
- Your goal is to explore the codebase and produce a clear implementation plan.

PLANNING PROCESS:
1. Understand the request — ask ONE clarifying question at a time if needed
2. Explore the codebase — read relevant files, search for patterns
3. Propose 2-3 approaches with trade-offs, lead with your recommendation
4. Present the plan in sections, checking after each
5. Conclude with: critical files to modify, estimated scope, risks

When your plan is complete, say: "Plan complete. Ready to implement?"`;
  }

  if (mode === 'review') {
    prompt += `\n\nYou are in CODE REVIEW MODE. You are a senior engineer performing a thorough code review.

CRITICAL CONSTRAINTS:
- You are READ-ONLY. You MUST NOT call edit_file, write_file, multi_edit, delete_file, or run_command.
- You CAN use: read_file, list_dir, search_files, find_files, ask_user, web_search, web_fetch
- Do NOT suggest fixes as tool calls — only describe what should change.

REVIEW CHECKLIST:
1. **Bugs** — Logic errors, edge cases, off-by-one, null handling
2. **Security** — Injection, auth bypass, data exposure, unsafe operations
3. **Performance** — N+1 queries, unnecessary allocations, blocking operations
4. **Style** — Naming, consistency, dead code, complexity
5. **Architecture** — Coupling, abstraction level, separation of concerns

Format findings as: [SEVERITY] Category — Description — Location`;
  }

  if (mode === 'research') {
    prompt += `\n\nYou are in RESEARCH MODE. You are exploring ideas, searching for information, and taking notes.

CONSTRAINTS:
- You MUST NOT call edit_file, write_file, multi_edit, or delete_file.
- You CAN use: read_file, list_dir, search_files, find_files, run_command, ask_user, web_search, web_fetch
- Focus on gathering information, exploring approaches, and documenting findings.
- Summarize your research findings clearly for later reference.`;
  }

  return prompt;
}

// --- Token Estimation ---

export function estimateTokens(messages: AgentMessage[]): number {
  return messages.reduce((sum, m) => {
    let contentLen = 0;
    if (typeof m.content === 'string') {
      contentLen = m.content.length;
    } else if (Array.isArray(m.content)) {
      contentLen = m.content.reduce((s, p) => {
        if (p.type === 'text') return s + p.text.length;
        if (p.type === 'image_url') return s + 1000; // estimate image tokens
        return s;
      }, 0);
    }
    const toolCallsStr = m.tool_calls ? JSON.stringify(m.tool_calls) : '';
    return sum + Math.ceil((contentLen + toolCallsStr.length) / 4);
  }, 0);
}

// --- Context Compaction ---

async function compactHistory(
  messages: AgentMessage[],
  client: import('openai').default,
  model: string,
  contextLimit: number
): Promise<AgentMessage[]> {
  const systemPrompt = messages[0]!;
  const recentCount = Math.max(6, Math.min(Math.floor(contextLimit / 4000), 20));
  const recent = messages.slice(-recentCount);
  const middle = messages.slice(1, -recentCount);

  if (middle.length === 0) return messages;

  debug(`Compacting ${middle.length} messages (keeping last ${recentCount})`);

  const summaryBudget = Math.max(500, Math.min(Math.floor(contextLimit * 0.05), 2000));

  const middleText = middle
    .filter((m) => m.content)
    .map((m) => `[${m.role}] ${m.content}`)
    .join('\n');

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: COMPACTION_PROMPT,
        },
        { role: 'user', content: middleText },
      ],
      max_tokens: summaryBudget,
    });

    const summary = response.choices[0]?.message?.content ?? '';
    debug(`Compacted to ${summary.length} chars (budget: ${summaryBudget} tokens)`);

    return [
      systemPrompt,
      {
        role: 'user' as const,
        content: `[Previous conversation summary]\n${summary}`,
      },
      ...recent,
    ];
  } catch (err) {
    debug(`Compaction failed: ${err}`);
    return messages; // Keep original if compaction fails
  }
}

// --- Streaming Retry ---

/** Retryable errors: network failures, timeouts, 5xx server errors. */
function isRetryableError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('etimedout') ||
        msg.includes('fetch failed') || msg.includes('network') || msg.includes('socket hang up')) {
      return true;
    }
  }
  // OpenAI SDK wraps HTTP errors with a status property
  const status = (err as { status?: number }).status;
  if (status && status >= 500) return true;
  return false;
}

async function createStreamWithRetry(
  client: import('openai').default,
  params: Parameters<import('openai').default['chat']['completions']['create']>[0],
  retryConfig: { maxRetries: number; backoffMs: number; backoffMultiplier: number },
  onStatus?: (status: 'checking' | 'connected' | 'disconnected' | 'reconnecting', attempt?: number) => void,
): Promise<AsyncIterable<import('openai').default.Chat.Completions.ChatCompletionChunk>> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        onStatus?.('reconnecting', attempt);
        const delay = retryConfig.backoffMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
        debug(`Retry attempt ${attempt}/${retryConfig.maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const stream = await client.chat.completions.create({
        ...params,
        stream: true,
      });

      if (attempt > 0) {
        onStatus?.('connected');
      }

      return stream as AsyncIterable<import('openai').default.Chat.Completions.ChatCompletionChunk>;
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === retryConfig.maxRetries) {
        if (attempt > 0) onStatus?.('disconnected');
        throw err;
      }
    }
  }

  throw lastError;
}

// --- Stream Collector ---

async function collectStream(
  stream: AsyncIterable<import('openai').default.Chat.Completions.ChatCompletionChunk>,
  onVisibleText: (chunk: string) => void,
  statusBar?: StatusBar | null,
  onStream?: OnStreamCallbacks
): Promise<{ text: string; toolCalls: ToolCallAccum[]; thinkingRenderer: ThinkingRenderer }> {
  let text = '';
  const toolCallMap = new Map<number, ToolCallAccum>();
  const thinking = new ThinkingRenderer();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      text += delta.content;
      statusBar?.markStart();

      // ThinkingRenderer handles <think> display and returns non-thinking content
      const visible = thinking.process(delta.content);
      if (visible) {
        onVisibleText(visible);
        // Emit token event for TUI streaming
        onStream?.onToken?.(visible);
      }

      // Emit thinking content if we're still in thinking mode
      if (!visible && thinking.isThinking) {
        onStream?.onThinking?.(delta.content);
      }

      // Update status bar with token estimate
      const tokenDelta = Math.ceil(delta.content.length / 4);
      statusBar?.update(tokenDelta);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const existing = toolCallMap.get(idx);
        if (!existing) {
          toolCallMap.set(idx, {
            id: tc.id ?? '',
            name: tc.function?.name ?? '',
            args: tc.function?.arguments ?? '',
          });
        } else {
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments) existing.args += tc.function.arguments;
        }
      }
    }
  }

  // Flush any remaining buffered text from thinking renderer
  const remaining = thinking.flush();
  if (remaining) {
    onVisibleText(remaining);
    onStream?.onToken?.(remaining);
  }

  // Strip <think> tags from the full collected text (for message history)
  text = stripThinkTags(text);

  return {
    text,
    toolCalls: [...toolCallMap.values()],
    thinkingRenderer: thinking,
  };
}

// --- Permission Prompt ---

async function promptToolApproval(
  toolName: string,
  args: Record<string, unknown>
): Promise<boolean> {
  console.log();
  console.log(chalk.yellow(`  Tool: ${toolName}`));

  // Show relevant details based on tool type
  if (toolName === 'edit_file') {
    console.log(chalk.dim(`  File: ${args['path']}`));
    console.log(chalk.red(`  - ${String(args['old_text']).slice(0, 100)}`));
    console.log(chalk.green(`  + ${String(args['new_text']).slice(0, 100)}`));
  } else if (toolName === 'write_file') {
    console.log(chalk.dim(`  File: ${args['path']}`));
    const content = String(args['content'] ?? '');
    console.log(chalk.dim(`  ${content.length} bytes`));
  } else if (toolName === 'run_command') {
    console.log(chalk.dim(`  $ ${args['command']}`));
  } else {
    console.log(chalk.dim(`  ${JSON.stringify(args)}`));
  }

  const { confirm } = await import('@inquirer/prompts');
  return confirm({ message: 'Allow?', default: true });
}

// --- Main Agent Loop ---

export async function agentLoop(
  task: string,
  config: OptaConfig,
  options?: AgentLoopOptions
): Promise<AgentLoopResult> {
  const isSubAgent = !!options?.subAgentContext;

  // When running as a sub-agent, apply derived config overrides
  let effectiveConfig: OptaConfig;
  if (isSubAgent) {
    const { deriveChildConfig } = await import('./subagent.js');
    effectiveConfig = deriveChildConfig(config, options?.mode, options?.subAgentContext?.budget);
  } else {
    effectiveConfig = config;
  }

  const client = await getOrCreateClient(effectiveConfig);

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

  const userMessage: AgentMessage = allImages.length > 0
    ? {
        role: 'user',
        content: [
          { type: 'text', text: task },
          ...allImages.map(img => ({
            type: 'image_url' as const,
            image_url: { url: img.base64.startsWith('data:') ? img.base64 : `data:${img.mimeType};base64,${img.base64}` },
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
    : [
        { role: 'system', content: systemPrompt },
        userMessage,
      ];

  let toolCallCount = 0;
  // Sub-agents are always silent
  const silent = isSubAgent || (options?.silent ?? false);
  const noopSpinner: Spinner = { start: () => {}, stop: () => {}, succeed: () => {}, fail: () => {} };
  const spinner = silent ? noopSpinner : await createSpinner();
  const sessionId = options?.sessionId ?? 'unknown';

  // Status bar for real-time stats
  const statusBar = silent ? null : new StatusBar({
    model,
    sessionId,
  });
  let checkpointCount = 0;
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
  const registry = await buildToolRegistry(effectiveConfig, options?.mode);

  // Filter tool schemas by agent profile (if active)
  let activeSchemas = registry.schemas;
  if (options?.profile) {
    const { getAgentProfile } = await import('./agent-profiles.js');
    const activeProfile = getAgentProfile(options.profile);
    if (activeProfile?.tools && activeProfile.tools.length > 0) {
      const allowedTools = new Set(activeProfile.tools);
      activeSchemas = registry.schemas.filter(
        (s: { function: { name: string } }) => allowedTools.has(s.function.name)
      );
      debug(`Profile "${options.profile}" filtered tools: ${activeSchemas.length}/${registry.schemas.length}`);
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

  try {
    while (true) {
      // 0. Observation masking (free context savings)
      const maskedMessages = maskOldObservations(messages, 4);
      messages.length = 0;
      messages.push(...maskedMessages);

      // 1. Context compaction
      const tokenEstimate = estimateTokens(messages);
      insightEngine?.contextUpdate(tokenEstimate);
      const threshold = effectiveConfig.model.contextLimit * effectiveConfig.safety.compactAt;
      if (tokenEstimate > threshold) {
        debug(`Token estimate ${tokenEstimate} exceeds threshold ${threshold}`);
        spinner.start('Compacting conversation history...');
        const preCompactCount = messages.length;
        const compacted = await compactHistory(messages, client, model, effectiveConfig.model.contextLimit);
        const recoveredTokens = tokenEstimate - estimateTokens(compacted);
        messages.length = 0;
        messages.push(...compacted);
        spinner.succeed('Context compacted');
        insightEngine?.compaction(preCompactCount, recoveredTokens);
        await fireCompact(hooks, sessionCtx);
      }

      // 2. Call Opta LMX
      insightEngine?.turnStart();
      debug(`Sending ${messages.length} messages to ${model}`);
      spinner.start('Thinking...');

      // Reconnection status handler: use TUI callback if available, otherwise log to console
      const reconnectHandler = streamCallbacks?.onConnectionStatus ?? (
        silent ? undefined : (status: 'checking' | 'connected' | 'disconnected' | 'reconnecting', attempt?: number) => {
          if (status === 'reconnecting') {
            spinner.stop();
            console.log(chalk.dim(`  Connection interrupted, reconnecting... (attempt ${attempt ?? '?'}/${effectiveConfig.connection.retry.maxRetries})`));
            spinner.start('Reconnecting...');
          } else if (status === 'connected') {
            spinner.stop();
            console.log(chalk.green('  ✓') + chalk.dim(' Reconnected'));
            spinner.start('Thinking...');
          } else if (status === 'disconnected') {
            spinner.stop();
          }
        }
      );

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
      );

      spinner.stop();

      // 3. Stream tokens to terminal, collect tool calls
      statusBar?.newTurn();
      let firstText = true;
      const streamStartTime = Date.now();
      const { text, toolCalls, thinkingRenderer: lastThinking } = await collectStream(stream, (chunk) => {
        if (silent) return;
        if (firstText) {
          console.log(); // blank line before response
          firstText = false;
          // Fire first-token insight for REPL mode
          insightEngine?.firstToken(Date.now() - streamStartTime);
        }
        process.stdout.write(chunk);
      }, statusBar, streamCallbacks);

      // Track last thinking renderer for expand/collapse toggle
      lastThinkingRenderer = lastThinking;

      if (!silent && text && !firstText) {
        process.stdout.write('\n'); // newline after streamed text
      }

      // Print turn summary (tokens, speed, tool calls)
      statusBar?.finalizeTurn();
      if (!silent) statusBar?.printSummary();

      // 4. No tool calls = task complete
      if (toolCalls.length === 0) {
        // Fire turn-end insight for REPL mode
        const turnElapsed = (Date.now() - streamStartTime) / 1000;
        const turnTokens = estimateTokens([{ role: 'assistant', content: text }]);
        const turnSpeed = turnElapsed > 0.1 ? turnTokens / turnElapsed : 0;
        insightEngine?.turnEnd({
          tokens: turnTokens,
          toolCalls: 0,
          elapsed: turnElapsed,
          speed: turnSpeed,
          firstTokenLatencyMs: null,
        });
        statusBar?.clear();
        break;
      }

      // 5. Append assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: text || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      });

      // 6. Execute tool calls with permission checks (parallel where possible)
      //
      // Phase 1: Resolve permissions sequentially (prompts must be one-at-a-time)
      // Phase 2: Execute approved calls in parallel with concurrency limit
      // Phase 3: Collect results in original order for model context coherence
      const maxParallel = effectiveConfig.safety.maxParallelTools;

      type ToolDecision = { call: ToolCallAccum; approved: boolean; denialReason?: string };
      const decisions: ToolDecision[] = [];

      for (const call of toolCalls) {
        const permission = resolvePermission(call.name, effectiveConfig);

        if (permission === 'deny') {
          decisions.push({ call, approved: false, denialReason: 'Permission denied by configuration.' });
          if (!silent) console.log(chalk.dim(`  ✗ ${call.name} — denied`));
          continue;
        }

        if (permission === 'ask') {
          if (isSubAgent) {
            decisions.push({ call, approved: false, denialReason: 'Permission denied (sub-agent cannot prompt user).' });
            continue;
          }

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(call.args);
          } catch {
            args = { raw: call.args };
          }

          if (streamCallbacks?.onPermissionRequest) {
            const decision = await streamCallbacks.onPermissionRequest(call.name, args);
            if (decision === 'deny') {
              decisions.push({ call, approved: false, denialReason: 'User declined this action.' });
              continue;
            }
          } else {
            const approved = await promptToolApproval(call.name, args);
            if (!approved) {
              decisions.push({ call, approved: false, denialReason: 'User declined this action.' });
              continue;
            }
          }
        }

        // Fire pre-tool hook (can cancel execution)
        const preResult = await fireToolPre(hooks, call.name, call.args, sessionCtx);
        if (preResult.cancelled) {
          decisions.push({ call, approved: false, denialReason: `Tool blocked by hook: ${preResult.reason ?? 'no reason given'}` });
          if (!silent) console.log(chalk.dim(`  ✗ ${call.name} — blocked by hook`));
          continue;
        }

        decisions.push({ call, approved: true });
      }

      // Phase 2: Execute approved calls in parallel (bounded concurrency)
      const approvedCalls = decisions.filter(d => d.approved);

      // Simple semaphore for bounded concurrency
      let running = 0;
      const queue: Array<() => void> = [];
      const acquire = () => new Promise<void>(resolve => {
        if (running < maxParallel) { running++; resolve(); }
        else queue.push(() => { running++; resolve(); });
      });
      const release = () => { running--; const next = queue.shift(); if (next) next(); };

      const executionResults = new Map<string, { result: string; error?: undefined } | { result?: undefined; error: string }>();

      // Display tool cards for approved calls
      for (const { call } of approvedCalls) {
        if (!silent) {
          let parsedArgs: Record<string, unknown>;
          try {
            parsedArgs = JSON.parse(call.args);
          } catch {
            parsedArgs = { raw: call.args };
          }
          console.log(formatToolCall(call.name, parsedArgs));
        }
        streamCallbacks?.onToolStart?.(call.name, call.id, call.args);
        insightEngine?.toolStart(call.name, call.args);
      }

      // Execute in parallel with semaphore
      if (approvedCalls.length > 0) {
        spinner.start(`Running ${approvedCalls.length} tool${approvedCalls.length > 1 ? 's' : ''}...`);
        await Promise.all(
          approvedCalls.map(async ({ call }) => {
            await acquire();
            try {
              const result = await registry.execute(call.name, call.args);
              executionResults.set(call.id, { result });
              streamCallbacks?.onToolEnd?.(call.name, call.id, result);
              await fireToolPost(hooks, call.name, call.args, result, sessionCtx);
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : String(err);
              executionResults.set(call.id, { error: `Error: ${errMsg}` });
              streamCallbacks?.onToolEnd?.(call.name, call.id, `Error: ${errMsg}`);
            } finally {
              release();
            }
          })
        );
        spinner.succeed(`${approvedCalls.length} tool${approvedCalls.length > 1 ? 's' : ''} done`);
      }

      // Phase 3: Collect results in original order
      for (const decision of decisions) {
        const { call } = decision;

        if (!decision.approved) {
          messages.push({
            role: 'tool',
            content: decision.denialReason ?? 'Permission denied.',
            tool_call_id: call.id,
          });
          continue;
        }

        const execResult = executionResults.get(call.id);
        const result = execResult?.result ?? execResult?.error ?? 'Error: no result';

        if (!silent && result) {
          console.log(formatToolResult(call.name, result));
        }

        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: call.id,
        });

        toolCallCount++;
        debug(`Tool call #${toolCallCount}: ${call.name} → ${result.slice(0, 100)}`);

        // Create checkpoint for file-modifying tools (skip for sub-agents)
        if (!isSubAgent && effectiveConfig.git.checkpoints && (call.name === 'edit_file' || call.name === 'write_file')) {
          try {
            const { isGitRepo } = await import('../git/utils.js');
            if (await isGitRepo(process.cwd())) {
              const { createCheckpoint } = await import('../git/checkpoints.js');
              let parsedArgs: Record<string, unknown>;
              try {
                parsedArgs = JSON.parse(call.args);
              } catch {
                parsedArgs = {};
              }
              checkpointCount++;
              await createCheckpoint(process.cwd(), sessionId, checkpointCount, call.name, String(parsedArgs['path'] ?? 'unknown'));
            }
          } catch {
            // Checkpoint creation failed — non-fatal
          }
        }
      }

      // 7. Progressive circuit breaker
      const cb = effectiveConfig.safety.circuitBreaker;

      if (cb.hardStopAt > 0 && toolCallCount >= cb.hardStopAt) {
        if (!silent) console.log(chalk.red(`\n  Hard stop: ${cb.hardStopAt} tool calls reached.`));
        break;
      }

      if (cb.pauseAt > 0 && toolCallCount >= cb.pauseAt && toolCallCount % cb.pauseAt === 0) {
        // In CI or non-TTY, prompting would hang forever — just stop
        const isNonInteractive = !process.stdout.isTTY || process.env['CI'] === 'true';
        if (silent || isNonInteractive) break;
        console.log(chalk.yellow(`\n  Reached ${toolCallCount} tool calls. Pausing.`));
        const { confirm } = await import('@inquirer/prompts');
        const shouldContinue = await confirm({ message: 'Continue?' });
        if (!shouldContinue) break;
      }

      if (cb.warnAt > 0 && toolCallCount === cb.warnAt && !silent) {
        console.log(chalk.dim(`\n  Note: ${cb.warnAt} tool calls used (pauses at ${cb.pauseAt})`));
      }
    }
  } catch (err) {
    // Fire the error hook so lifecycle hooks can observe failures
    const errMsg = err instanceof Error ? err.message : String(err);
    await fireError(hooks, errMsg, sessionCtx).catch(() => {});
    throw err; // Re-throw so callers (chat.ts, do.ts, server.ts) handle it
  } finally {
    // Cleanup runs whether the loop completes normally or throws

    // Auto-commit if enabled and tools were used (skip for sub-agents)
    if (!isSubAgent && effectiveConfig.git.autoCommit && toolCallCount > 0 && options?.sessionId) {
      try {
        const { isGitRepo, getModifiedFiles } = await import('../git/utils.js');
        if (await isGitRepo(process.cwd())) {
          const modifiedFiles = await getModifiedFiles(process.cwd());
          if (modifiedFiles.length > 0) {
            const { generateCommitMessage, commitSessionChanges } = await import('../git/commit.js');
            const commitMsg = await generateCommitMessage(messages, client, model);
            const committed = await commitSessionChanges(process.cwd(), modifiedFiles, commitMsg);
            if (committed && !silent) {
              console.log(chalk.green('✓') + chalk.dim(` Committed: ${commitMsg}`));
            }
            const { cleanupCheckpoints } = await import('../git/checkpoints.js');
            await cleanupCheckpoints(process.cwd(), options.sessionId);
          }
        }
      } catch {
        // Auto-commit failed — non-fatal
      }
    }

    // Token usage shown by statusBar.printSummary() per turn

    await registry.close();

    // Shutdown background processes (skip for sub-agents to avoid killing parent's)
    if (!isSubAgent) {
      await shutdownProcessManager();
    }

    // Fire session end hook
    if (!isSubAgent) {
      await fireSessionEnd(hooks, sessionCtx);
    }
  }

  return { messages, toolCallCount, lastThinkingRenderer };
}
