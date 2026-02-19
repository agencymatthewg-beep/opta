import type { OptaConfig } from './config.js';
import { errorMessage } from '../utils/errors.js';
import { estimateMessageTokens } from '../utils/tokens.js';

// --- Type Definitions ---

export interface SubAgentBudget {
  maxToolCalls: number;
  maxTokens: number;
  timeoutMs: number;
}

export interface SubAgentTask {
  id: string;
  description: string;
  scope?: string;
  budget?: Partial<SubAgentBudget>;
  tools?: string[];
  mode?: string;
}

export interface SubAgentResult {
  taskId: string;
  status: 'completed' | 'budget_exceeded' | 'timeout' | 'cancelled' | 'error';
  response: string;
  toolCallCount: number;
  tokenEstimate: number;
  filesRead: string[];
  filesModified: string[];
  durationMs: number;
}

export interface SubAgentContext {
  parentSessionId: string;
  depth: number;
  budget: SubAgentBudget;
  parentCwd: string;
}

// --- Task 1: Budget Validation & Defaults ---

export function resolveBudget(
  overrides: Partial<SubAgentBudget>,
  config: OptaConfig
): SubAgentBudget {
  const defaults = config.subAgent.defaultBudget;
  const hardStopAt = config.safety.circuitBreaker.hardStopAt;

  const maxToolCalls = Math.min(
    overrides.maxToolCalls ?? defaults.maxToolCalls,
    hardStopAt > 0 ? hardStopAt : Infinity
  );

  return {
    maxToolCalls,
    maxTokens: overrides.maxTokens ?? defaults.maxTokens,
    timeoutMs: overrides.timeoutMs ?? defaults.timeoutMs,
  };
}

export function validateBudget(budget: SubAgentBudget): void {
  if (budget.maxToolCalls <= 0) {
    throw new Error('maxToolCalls must be positive');
  }
  if (budget.maxTokens <= 0) {
    throw new Error('maxTokens must be positive');
  }
  if (budget.timeoutMs < 5000) {
    throw new Error('timeoutMs must be at least 5000');
  }
}

// --- Task 2: Context & Depth Tracking ---

export function createSubAgentContext(
  sessionId: string,
  parentContext: SubAgentContext | undefined,
  config: OptaConfig
): SubAgentContext {
  const depth = parentContext ? parentContext.depth + 1 : 1;
  const maxDepth = config.subAgent.maxDepth;

  if (depth > maxDepth) {
    throw new Error(`Maximum sub-agent depth (${maxDepth}) exceeded`);
  }

  return {
    parentSessionId: sessionId,
    depth,
    budget: resolveBudget({}, config),
    parentCwd: parentContext?.parentCwd ?? process.cwd(),
  };
}

// --- Task 3: System Prompt Generation ---

export function buildSubAgentPrompt(
  task: string,
  cwd: string,
  maxToolCalls: number
): string {
  return `You are a focused sub-agent assistant. You have been delegated a specific task to complete independently.

Your task: ${task}

Working directory: ${cwd}

Constraints:
- You have a budget of ${maxToolCalls} tool calls. Use them efficiently.
- Be concise in your responses. Your output will be consumed by a parent agent.
- Do not ask the user questions — you are running silently.
- Focus only on the task described above.
- Do NOT spawn further sub-agents unless absolutely necessary.

When finished, provide a structured summary:
1. What you found or did (key findings, code patterns, data points).
2. Files read — list every file path you examined.
3. Files modified — list every file path you created, edited, or deleted, with a one-line description of the change.
If no files were modified, state "No files modified."`;
}

// --- Task 4: Permission Derivation for Children ---

export function deriveChildConfig(
  parentConfig: OptaConfig,
  modeOverride?: string,
  budget?: SubAgentBudget
): OptaConfig {
  const resolvedBudget = budget ?? {
    maxToolCalls: parentConfig.subAgent.defaultBudget.maxToolCalls,
    maxTokens: parentConfig.subAgent.defaultBudget.maxTokens,
    timeoutMs: parentConfig.subAgent.defaultBudget.timeoutMs,
  };

  const mode = modeOverride ??
    (parentConfig.subAgent.inheritMode ? parentConfig.defaultMode : 'safe');

  // Derive permissions: always deny ask_user for silent children
  const childPermissions = { ...parentConfig.permissions };
  childPermissions['ask_user'] = 'deny';

  return {
    ...parentConfig,
    defaultMode: mode as OptaConfig['defaultMode'],
    permissions: childPermissions,
    git: {
      autoCommit: false,
      checkpoints: false,
    },
    safety: {
      ...parentConfig.safety,
      circuitBreaker: {
        ...parentConfig.safety.circuitBreaker,
        hardStopAt: resolvedBudget.maxToolCalls,
        pauseAt: 0, // No interactive pausing for silent agents
        warnAt: 0,  // No warnings for silent agents
      },
    },
  };
}

// --- Task 5: Core spawnSubAgent Function ---

export async function spawnSubAgent(
  task: SubAgentTask,
  config: OptaConfig,
  client: import('openai').default,
  registry: import('../mcp/registry.js').ToolRegistry,
  parentContext?: SubAgentContext,
  signal?: AbortSignal
): Promise<SubAgentResult> {
  const startTime = Date.now();
  const budget = resolveBudget(task.budget ?? {}, config);

  // Mutable state captured by the builder closure
  let toolCallCount = 0;
  const filesRead: string[] = [];
  const filesModified: string[] = [];
  const messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
  }> = [];

  /** Build a SubAgentResult from the current closure state. */
  function buildResult(
    status: SubAgentResult['status'],
    response: string,
  ): SubAgentResult {
    return {
      taskId: task.id,
      status,
      response,
      toolCallCount,
      tokenEstimate: estimateMessageTokens(messages),
      filesRead: [...new Set(filesRead)],
      filesModified: [...new Set(filesModified)],
      durationMs: Date.now() - startTime,
    };
  }

  // Check if already cancelled before starting
  if (signal?.aborted) {
    return buildResult('cancelled', 'Sub-agent cancelled before starting.');
  }

  try {
    validateBudget(budget);
  } catch (err) {
    return buildResult('error', `Budget validation failed: ${errorMessage(err)}`);
  }

  const childConfig = deriveChildConfig(config, task.mode, budget);
  const cwd = task.scope ?? parentContext?.parentCwd ?? process.cwd();
  const systemPrompt = buildSubAgentPrompt(task.description, cwd, budget.maxToolCalls);
  const model = config.model.default;

  // Initialize messages array with system + user messages
  messages.push(
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task.description },
  );

  // Build the tool schemas to use (respect whitelist if provided)
  const toolSchemas = task.tools
    ? registry.schemas.filter(s => task.tools!.includes(s.function.name))
    : registry.schemas;

  // Import resolvePermission once outside the loop
  const { resolvePermission } = await import('./tools/index.js');

  // AbortController for cancelling inflight LLM requests on timeout or external cancellation
  const abortController = new AbortController();

  // Link external signal to internal abort
  if (signal) {
    const onAbort = () => abortController.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    // Clean up listener when done (handled in finally block via clearTimeout pattern)
  }

  const runLoop = async (): Promise<SubAgentResult> => {
    while (true) {
      // Check budget before each LLM call
      if (toolCallCount >= budget.maxToolCalls) {
        const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
        return buildResult(
          'budget_exceeded',
          typeof lastAssistantMsg?.content === 'string'
            ? lastAssistantMsg.content
            : `Budget exceeded after ${toolCallCount} tool calls.`,
        );
      }

      const response = await client.chat.completions.create({
        model,
        messages: messages as Parameters<typeof client.chat.completions.create>[0]['messages'],
        tools: toolSchemas.length > 0
          ? toolSchemas as Parameters<typeof client.chat.completions.create>[0]['tools']
          : undefined,
        tool_choice: toolSchemas.length > 0 ? 'auto' : undefined,
      }, { signal: abortController.signal });

      const choice = response.choices[0];
      if (!choice) {
        return buildResult('error', 'No response from model.');
      }

      const assistantMsg = choice.message;
      const text = assistantMsg.content ?? '';
      const toolCalls = assistantMsg.tool_calls ?? [];

      // No tool calls = task complete
      if (toolCalls.length === 0) {
        return buildResult('completed', text);
      }

      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: text || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      // Execute each tool call
      for (const tc of toolCalls) {
        // Check if timeout has fired between tool calls
        if (abortController.signal.aborted) {
          throw new Error('TIMEOUT');
        }

        const toolName = tc.function.name;

        // Check if tool is in whitelist (if whitelist exists)
        if (task.tools && !task.tools.includes(toolName)) {
          messages.push({
            role: 'tool',
            content: `Permission denied: tool "${toolName}" is not in the allowed tool list for this sub-agent.`,
            tool_call_id: tc.id,
          });
          toolCallCount++;
          continue;
        }

        // Check permission
        const permission = resolvePermission(toolName, childConfig);
        if (permission === 'deny' || permission === 'ask') {
          // Silent agents cannot prompt: ask becomes deny
          messages.push({
            role: 'tool',
            content: 'Permission denied by configuration.',
            tool_call_id: tc.id,
          });
          toolCallCount++;
          continue;
        }

        // Execute the tool (pass context explicitly for concurrency safety)
        const result = await registry.execute(toolName, tc.function.arguments, parentContext);
        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: tc.id,
        });

        toolCallCount++;

        // Track files
        try {
          const args = JSON.parse(tc.function.arguments);
          if (toolName === 'multi_edit' && Array.isArray(args.edits)) {
            for (const edit of args.edits) {
              if (edit && typeof edit.path === 'string') {
                filesModified.push(edit.path);
              }
            }
          } else {
            const path = args.path ?? args.file;
            if (path) {
              if (['read_file', 'read_project_docs'].includes(toolName)) {
                filesRead.push(String(path));
              }
              if (['edit_file', 'write_file', 'delete_file'].includes(toolName)) {
                filesModified.push(String(path));
              }
            }
          }
        } catch {
          // Ignore arg parse errors for tracking
        }

        // Check budget after each tool call
        if (toolCallCount >= budget.maxToolCalls) {
          break;
        }
      }
    }
  };

  // Wrap with timeout, always restore registry context
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      runLoop(),
      new Promise<SubAgentResult>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          abortController.abort(); // Cancel inflight LLM request
          reject(new Error('TIMEOUT'));
        }, budget.timeoutMs);
      }),
    ]);
    return result;
  } catch (err) {
    if (err instanceof Error && err.message === 'TIMEOUT') {
      // Distinguish external cancellation from internal timeout
      if (signal?.aborted) {
        return buildResult('cancelled', 'Sub-agent cancelled by parent.');
      }
      return buildResult('timeout', `Sub-agent timed out after ${budget.timeoutMs}ms.`);
    }

    // External cancellation may also surface as an AbortError
    if (signal?.aborted) {
      return buildResult('cancelled', 'Sub-agent cancelled by parent.');
    }

    return buildResult('error', errorMessage(err));
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

// --- Task 6: Tool Result Formatting ---

export function formatSubAgentResult(result: SubAgentResult): string {
  const statusPrefix = result.status === 'error'
    ? '[ERROR] '
    : result.status === 'budget_exceeded'
    ? '[BUDGET EXCEEDED] '
    : result.status === 'timeout'
    ? '[TIMEOUT] '
    : result.status === 'cancelled'
    ? '[CANCELLED] '
    : '';

  const lines: string[] = [];
  lines.push(`${statusPrefix}Sub-agent result (${result.toolCallCount} tool calls, ${(result.durationMs / 1000).toFixed(1)}s):`);
  lines.push('');
  lines.push(result.response);

  if (result.filesRead.length > 0) {
    lines.push('');
    lines.push(`Files read: ${result.filesRead.join(', ')}`);
  }
  if (result.filesModified.length > 0) {
    lines.push('');
    lines.push(`Files modified: ${result.filesModified.join(', ')}`);
  }

  return lines.join('\n');
}

