import chalk from 'chalk';
import type { OptaConfig } from './config.js';
import { resolvePermission } from './tools.js';
import { debug } from './debug.js';
import { maskOldObservations, COMPACTION_PROMPT } from './context.js';
import { createSpinner } from '../ui/spinner.js';
import { renderMarkdown } from '../ui/markdown.js';

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

export interface AgentLoopOptions {
  existingMessages?: AgentMessage[];
  sessionId?: string;
  silent?: boolean;
  mode?: string;
  imageBase64?: string;
}

export interface AgentLoopResult {
  messages: AgentMessage[];
  toolCallCount: number;
}

// --- System Prompt ---

export async function buildSystemPrompt(config: OptaConfig, cwd?: string, mode?: string): Promise<string> {
  const workingDir = cwd ?? process.cwd();

  let prompt = `You are Opta, an AI coding assistant running locally on the user's machine. You help with coding tasks by using tools to read, edit, and search files, and run commands.

Rules:
- Read files before editing them
- Use edit_file for precise, targeted changes (not write_file to rewrite entire files)
- Use search_files and find_files to understand the codebase before making changes
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

  // Load export map
  try {
    const { scanExports, formatExportMap } = await import('../context/exports.js');
    const exportMap = await scanExports(workingDir);

    if (exportMap.entries.length > 0) {
      prompt += `\n\nCodebase exports:\n${formatExportMap(exportMap)}`;
    }
  } catch {
    // Export scanning failed — continue without map
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

  void config; // config used for future extensions
  return prompt;
}

// --- Token Estimation ---

function estimateTokens(messages: AgentMessage[]): number {
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

// --- Stream Collector ---

async function collectStream(
  stream: AsyncIterable<import('openai').default.Chat.Completions.ChatCompletionChunk>,
  onText: (text: string) => void
): Promise<{ text: string; toolCalls: ToolCallAccum[] }> {
  let text = '';
  const toolCallMap = new Map<number, ToolCallAccum>();

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    if (delta.content) {
      text += delta.content;
      onText(delta.content);
    }

    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const existing = toolCallMap.get(tc.index);
        if (!existing) {
          toolCallMap.set(tc.index, {
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

  return {
    text,
    toolCalls: [...toolCallMap.values()],
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
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    baseURL: `http://${config.connection.host}:${config.connection.port}/v1`,
    apiKey: 'opta-lmx',
  });

  const model = config.model.default;
  if (!model) {
    console.error(
      chalk.red('✗') +
        ' No model configured. Run ' +
        chalk.cyan('opta status') +
        ' to check your LMX connection.'
    );
    process.exit(3);
  }

  // Use existing messages (multi-turn) or start fresh (single-shot)
  const userMessage: AgentMessage = options?.imageBase64
    ? {
        role: 'user',
        content: [
          { type: 'text', text: task },
          { type: 'image_url', image_url: { url: options.imageBase64 } },
        ],
      }
    : { role: 'user', content: task };

  const messages: AgentMessage[] = options?.existingMessages
    ? [...options.existingMessages, userMessage]
    : [
        { role: 'system', content: await buildSystemPrompt(config, undefined, options?.mode) },
        userMessage,
      ];

  let toolCallCount = 0;
  const silent = options?.silent ?? false;
  const spinner = silent ? { start: () => {}, stop: () => {}, succeed: () => {} } : await createSpinner();
  const sessionId = options?.sessionId ?? 'unknown';
  let checkpointCount = 0;

  const { buildToolRegistry } = await import('../mcp/registry.js');
  const registry = await buildToolRegistry(config, options?.mode);

  while (true) {
    // 0. Observation masking (free context savings)
    const maskedMessages = maskOldObservations(messages, 4);
    messages.length = 0;
    messages.push(...maskedMessages);

    // 1. Context compaction
    const tokenEstimate = estimateTokens(messages);
    const threshold = config.model.contextLimit * config.safety.compactAt;
    if (tokenEstimate > threshold) {
      debug(`Token estimate ${tokenEstimate} exceeds threshold ${threshold}`);
      spinner.start('Compacting conversation history...');
      const compacted = await compactHistory(messages, client, model, config.model.contextLimit);
      messages.length = 0;
      messages.push(...compacted);
      spinner.succeed('Context compacted');
    }

    // 2. Call Opta LMX
    debug(`Sending ${messages.length} messages to ${model}`);
    spinner.start('Thinking...');

    const stream = await client.chat.completions.create({
      model,
      messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
      tools: registry.schemas as Parameters<typeof client.chat.completions.create>[0]['tools'],
      tool_choice: 'auto',
      stream: true,
    });

    spinner.stop();

    // 3. Stream tokens to terminal, collect tool calls
    let firstText = true;
    const { text, toolCalls } = await collectStream(stream, (chunk) => {
      if (silent) return;
      if (firstText) {
        console.log(); // blank line before response
        firstText = false;
      }
      process.stdout.write(chunk);
    });

    if (!silent && text && !firstText) {
      process.stdout.write('\n'); // newline after streamed text
    }

    // 4. No tool calls = task complete
    if (toolCalls.length === 0) {
      if (!silent && text) {
        await renderMarkdown(text);
      }
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

    // 6. Execute each tool call with permission checks
    for (const call of toolCalls) {
      const permission = resolvePermission(call.name, config);

      if (permission === 'deny') {
        messages.push({
          role: 'tool',
          content: 'Permission denied by configuration.',
          tool_call_id: call.id,
        });
        if (!silent) console.log(chalk.dim(`  ✗ ${call.name} — denied`));
        continue;
      }

      if (permission === 'ask') {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(call.args);
        } catch {
          args = { raw: call.args };
        }

        const approved = await promptToolApproval(call.name, args);
        if (!approved) {
          messages.push({
            role: 'tool',
            content: 'User declined this action.',
            tool_call_id: call.id,
          });
          continue;
        }
      }

      // Execute the tool
      spinner.start(`${call.name}...`);
      const result = await registry.execute(call.name, call.args);
      spinner.succeed(`${call.name}`);

      messages.push({
        role: 'tool',
        content: result,
        tool_call_id: call.id,
      });

      toolCallCount++;
      debug(`Tool call #${toolCallCount}: ${call.name} → ${result.slice(0, 100)}`);

      // Create checkpoint for file-modifying tools
      if (config.git.checkpoints && (call.name === 'edit_file' || call.name === 'write_file')) {
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
    const cb = config.safety.circuitBreaker;

    if (cb.hardStopAt > 0 && toolCallCount >= cb.hardStopAt) {
      if (!silent) console.log(chalk.red(`\n  Hard stop: ${cb.hardStopAt} tool calls reached.`));
      break;
    }

    if (cb.pauseAt > 0 && toolCallCount >= cb.pauseAt && toolCallCount % cb.pauseAt === 0) {
      if (silent) break;
      console.log(chalk.yellow(`\n  Reached ${toolCallCount} tool calls. Pausing.`));
      const { confirm } = await import('@inquirer/prompts');
      const shouldContinue = await confirm({ message: 'Continue?' });
      if (!shouldContinue) break;
    }

    if (cb.warnAt > 0 && toolCallCount === cb.warnAt && !silent) {
      console.log(chalk.dim(`\n  Note: ${cb.warnAt} tool calls used (pauses at ${cb.pauseAt})`));
    }
  }

  // Auto-commit if enabled and tools were used
  if (config.git.autoCommit && toolCallCount > 0 && options?.sessionId) {
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

  // Show token usage
  if (!silent) {
    const finalTokens = estimateTokens(messages);
    console.log(
      chalk.dim(`\n  ~${(finalTokens / 1000).toFixed(1)}K tokens · ${toolCallCount} tool calls`)
    );
  }

  await registry.close();

  return { messages, toolCallCount };
}
