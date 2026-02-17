import type { OptaConfig } from './config.js';

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
  status: 'completed' | 'budget_exceeded' | 'timeout' | 'error';
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
- When done, provide a clear summary of your findings or actions taken.
- Do not ask the user questions — you are running silently.
- Focus only on the task described above.

After completing the task, respond with a concise summary of results. Include specific file paths, code patterns, or data points discovered.`;
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
  parentContext?: SubAgentContext
): Promise<SubAgentResult> {
  const startTime = Date.now();
  const budget = resolveBudget(task.budget ?? {}, config);

  try {
    validateBudget(budget);
  } catch (err) {
    return {
      taskId: task.id,
      status: 'error',
      response: `Budget validation failed: ${err instanceof Error ? err.message : String(err)}`,
      toolCallCount: 0,
      tokenEstimate: 0,
      filesRead: [],
      filesModified: [],
      durationMs: Date.now() - startTime,
    };
  }

  const childConfig = deriveChildConfig(config, task.mode, budget);
  const cwd = task.scope ?? parentContext?.parentCwd ?? process.cwd();
  const systemPrompt = buildSubAgentPrompt(task.description, cwd, budget.maxToolCalls);
  const model = config.model.default;

  const messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
    tool_call_id?: string;
  }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: task.description },
  ];

  let toolCallCount = 0;
  const filesRead: string[] = [];
  const filesModified: string[] = [];

  // Build the tool schemas to use (respect whitelist if provided)
  const toolSchemas = task.tools
    ? registry.schemas.filter(s => task.tools!.includes(s.function.name))
    : registry.schemas;

  // Import resolvePermission once outside the loop
  const { resolvePermission } = await import('./tools/index.js');

  // Set registry.parentContext so nested spawn_agent calls see correct depth.
  // Restored after the loop. Safe because sub-agents run sequentially.
  const previousContext = registry.parentContext;
  registry.parentContext = parentContext;

  // AbortController for cancelling inflight LLM requests on timeout
  const abortController = new AbortController();

  const runLoop = async (): Promise<SubAgentResult> => {
    while (true) {
      // Check budget before each LLM call
      if (toolCallCount >= budget.maxToolCalls) {
        const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
        return {
          taskId: task.id,
          status: 'budget_exceeded',
          response: typeof lastAssistantMsg?.content === 'string'
            ? lastAssistantMsg.content
            : `Budget exceeded after ${toolCallCount} tool calls.`,
          toolCallCount,
          tokenEstimate: estimateTokensSimple(messages),
          filesRead: [...new Set(filesRead)],
          filesModified: [...new Set(filesModified)],
          durationMs: Date.now() - startTime,
        };
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
        return {
          taskId: task.id,
          status: 'error',
          response: 'No response from model.',
          toolCallCount,
          tokenEstimate: estimateTokensSimple(messages),
          filesRead: [...new Set(filesRead)],
          filesModified: [...new Set(filesModified)],
          durationMs: Date.now() - startTime,
        };
      }

      const assistantMsg = choice.message;
      const text = assistantMsg.content ?? '';
      const toolCalls = assistantMsg.tool_calls ?? [];

      // No tool calls = task complete
      if (toolCalls.length === 0) {
        return {
          taskId: task.id,
          status: 'completed',
          response: text,
          toolCallCount,
          tokenEstimate: estimateTokensSimple(messages),
          filesRead: [...new Set(filesRead)],
          filesModified: [...new Set(filesModified)],
          durationMs: Date.now() - startTime,
        };
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

        // Execute the tool
        const result = await registry.execute(toolName, tc.function.arguments);
        messages.push({
          role: 'tool',
          content: result,
          tool_call_id: tc.id,
        });

        toolCallCount++;

        // Track files
        try {
          const args = JSON.parse(tc.function.arguments);
          const path = args.path ?? args.file;
          if (path) {
            if (['read_file', 'read_project_docs'].includes(toolName)) {
              filesRead.push(String(path));
            }
            if (['edit_file', 'write_file', 'multi_edit', 'delete_file'].includes(toolName)) {
              filesModified.push(String(path));
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
      return {
        taskId: task.id,
        status: 'timeout',
        response: `Sub-agent timed out after ${budget.timeoutMs}ms.`,
        toolCallCount,
        tokenEstimate: estimateTokensSimple(messages),
        filesRead: [...new Set(filesRead)],
        filesModified: [...new Set(filesModified)],
        durationMs: Date.now() - startTime,
      };
    }

    return {
      taskId: task.id,
      status: 'error',
      response: err instanceof Error ? err.message : String(err),
      toolCallCount,
      tokenEstimate: estimateTokensSimple(messages),
      filesRead: [...new Set(filesRead)],
      filesModified: [...new Set(filesModified)],
      durationMs: Date.now() - startTime,
    };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    registry.parentContext = previousContext;
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

// --- Utility ---

function estimateTokensSimple(messages: Array<{ content: string | null }>): number {
  return messages.reduce((sum, m) => {
    const len = typeof m.content === 'string' ? m.content.length : 0;
    return sum + Math.ceil(len / 4);
  }, 0);
}
