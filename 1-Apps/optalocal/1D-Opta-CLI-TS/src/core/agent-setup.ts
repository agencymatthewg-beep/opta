/**
 * agent-setup.ts — Client creation, system prompt, config.
 *
 * Extracted from agent.ts to isolate the OpenAI client lifecycle,
 * system prompt construction, and context compaction.
 */

import type OpenAI from 'openai';
import type { OptaConfig } from './config.js';
import { debug } from './debug.js';
import { COMPACTION_PROMPT } from './context.js';
import { buildAutonomyPromptBlock } from './autonomy.js';
import type { AgentMessage } from './agent.js';

interface ToolSchemaLike {
  function: {
    name: string;
  };
}

export interface CapabilityManifestRuntimeContext {
  activeToolSchemas?: ToolSchemaLike[];
  profile?: string;
  mode?: string;
}

const CAPABILITY_MARKER = '\n\nActive capabilities:\n';

function onOff(enabled: boolean): string {
  return enabled ? 'on' : 'off';
}

export function buildCapabilityManifest(
  config: OptaConfig,
  runtime: CapabilityManifestRuntimeContext = {},
): string {
  const toolNames = new Set((runtime.activeToolSchemas ?? []).map((schema) => schema.function.name));
  const mode = runtime.mode ?? config.defaultMode;
  const profile = runtime.profile ?? 'default';

  const hasWebTools = toolNames.has('web_search') || toolNames.has('web_fetch');
  const hasResearchTool = hasWebTools || Array.from(toolNames).some((name) => name.startsWith('research_'));
  const hasBrowserTool = Array.from(toolNames).some((name) => name.startsWith('browser_') || name.includes('playwright'));
  const hasLearningTool = [
    'save_memory',
    'learning_log',
    'learning_summary',
    'learning_retrieve',
  ].some((name) => toolNames.has(name));
  const toolCount = runtime.activeToolSchemas?.length ?? 0;

  return [
    `- session: mode=${mode}, profile=${profile}, tools=${toolCount}`,
    `- research: ${onOff(config.research.enabled)} provider=${config.research.defaultProvider} tools=${hasResearchTool ? 'yes' : 'no'}`,
    `- browser: ${onOff(config.browser.enabled)} mode=${config.browser.mode} automation=${hasBrowserTool ? 'yes' : 'no'}`,
    `- learning: ${onOff(config.learning.enabled)} capture=${config.learning.captureLevel} tool=${hasLearningTool ? 'yes' : 'no'}`,
    `- policy: ${onOff(config.policy.enabled)} mode=${config.policy.mode} gate-all=${onOff(config.policy.gateAllAutonomy)} failure=${config.policy.failureMode}`,
  ].join('\n');
}

export function injectCapabilityManifest(prompt: string, manifest: string): string {
  const markerIndex = prompt.indexOf(CAPABILITY_MARKER);
  const basePrompt = markerIndex >= 0
    ? prompt.slice(0, markerIndex).trimEnd()
    : prompt.trimEnd();

  return `${basePrompt}${CAPABILITY_MARKER}${manifest}`;
}

// --- Provider-Based Client ---

export async function getOrCreateClient(config: OptaConfig): Promise<OpenAI> {
  const { getProvider } = await import('../providers/manager.js');
  const provider = await getProvider(config);
  debug(`Using provider: ${provider.name}`);
  const client = await provider.getClient() as OpenAI & { __optaProviderName?: string };
  client.__optaProviderName = provider.name;
  return client;
}

/** Reset the cached client (useful for testing). */
export async function resetClientCache(): Promise<void> {
  const { resetProviderCache } = await import('../providers/manager.js');
  resetProviderCache();
}

// --- System Prompt ---

export async function buildSystemPrompt(
  config: OptaConfig,
  cwd?: string,
  mode?: string,
  runtime?: CapabilityManifestRuntimeContext,
): Promise<string> {
  const workingDir = cwd ?? process.cwd();

  let prompt = `You are Opta, an AI coding assistant running locally on the user's machine. You help with coding tasks by using tools to read, edit, and search files, and run commands.

Rules:
- Read files before editing them
- Use edit_file for precise, targeted changes (not write_file to rewrite entire files)
- Use search_files and find_files to understand the codebase before making changes
- web_fetch: Fetch and read web pages (documentation, APIs, references)
- Use native tool calls only; never emit pseudo tool tags like <execute_command>...</execute_command> in assistant text
- If browser tools are available, prefer browser_* tools over shell GUI automation (e.g., osascript/xdotool)
- Explain your reasoning before each action
- When the task is complete, respond with a final summary (no tool calls)

Working directory: ${workingDir}`;

  if (config.autonomy.level > 1 || config.autonomy.mode === 'ceo') {
    prompt += `\n\n${buildAutonomyPromptBlock(config)}`;
  }

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

  if (runtime) {
    prompt = injectCapabilityManifest(
      prompt,
      buildCapabilityManifest(config, { ...runtime, mode: mode ?? runtime.mode }),
    );
  }

  return prompt;
}

// --- Compaction Constants ---

/** Minimum number of recent messages to preserve during compaction. */
const MIN_COMPACTION_WINDOW = 6;
/** Maximum recent messages to keep (scales with context limit). */
const MAX_COMPACTION_WINDOW = 20;
/** Divisor for scaling compaction window to context limit. */
const COMPACTION_WINDOW_SCALE = 4000;
/** Minimum tokens allocated for conversation summary during compaction. */
const MIN_SUMMARY_BUDGET = 500;
/** Maximum tokens allocated for conversation summary. */
const MAX_SUMMARY_BUDGET = 2000;
/** Fraction of context limit allocated to summary budget. */
const SUMMARY_BUDGET_RATIO = 0.05;

// --- Context Compaction ---

export async function compactHistory(
  messages: AgentMessage[],
  client: OpenAI,
  model: string,
  contextLimit: number
): Promise<AgentMessage[]> {
  const systemPrompt = messages[0]!;
  const recentCount = Math.max(MIN_COMPACTION_WINDOW, Math.min(Math.floor(contextLimit / COMPACTION_WINDOW_SCALE), MAX_COMPACTION_WINDOW));
  const recent = messages.slice(-recentCount);
  const middle = messages.slice(1, -recentCount);

  if (middle.length === 0) return messages;

  debug(`Compacting ${middle.length} messages (keeping last ${recentCount})`);

  const summaryBudget = Math.max(MIN_SUMMARY_BUDGET, Math.min(Math.floor(contextLimit * SUMMARY_BUDGET_RATIO), MAX_SUMMARY_BUDGET));

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

// --- Observation Masking (re-export for agent.ts convenience) ---

export { maskOldObservations } from './context.js';
