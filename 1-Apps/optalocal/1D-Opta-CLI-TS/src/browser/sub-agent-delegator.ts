import { errorMessage } from '../utils/errors.js';
import type { OptaConfig } from '../core/config.js';

export interface BrowserSubAgentOptions {
  goal: string;
  config: OptaConfig;
  preferredSessionId?: string;
  /** Optional summary from the main agent's current context window. */
  inheritedContext?: string;
}

export interface BrowserSubAgentResult {
  ok: boolean;
  summary: string;
  sessionId?: string;
  artifactPaths: string[];
  error?: string;
}

const BROWSER_SPECIALIST_PROMPT = `You are a browser automation specialist with access to the full Playwright MCP tool surface.

Your role:
- Execute the browser goal you are given using browser_* tools
- Always start with browser_snapshot to understand page state before interacting
- Take a browser_screenshot when the goal involves visual verification
- Respect policy gating — if a tool call is denied, report it and stop
- When complete, provide a concise summary of what you accomplished

Available tools include: browser_navigate, browser_click, browser_type, browser_select_option, browser_hover, browser_scroll, browser_snapshot, browser_screenshot, browser_evaluate, browser_go_back, browser_go_forward, browser_tab_new, browser_press_key, browser_handle_dialog, browser_wait_for_element, and more.

IMPORTANT: Do not write files or run shell commands. Focus only on browser automation.`;

export async function delegateToBrowserSubAgent(
  options: BrowserSubAgentOptions,
): Promise<BrowserSubAgentResult> {
  const { goal, config, preferredSessionId, inheritedContext } = options;

  try {
    const { spawnSubAgent, formatSubAgentResult, createSubAgentContext } =
      await import('../core/subagent.js');
    const { default: OpenAI } = await import('openai');
    const { resolveLmxApiKey } = await import('../lmx/api-key.js');
    const { buildToolRegistry } = await import('../mcp/registry.js');

    const sessionNote = preferredSessionId
      ? `\n\nReuse browser session ID: ${preferredSessionId}`
      : '';
    const contextNote = inheritedContext
      ? `\n\nContext from main session:\n${inheritedContext}`
      : '';
    const taskDescription = `${BROWSER_SPECIALIST_PROMPT}${sessionNote}${contextNote}\n\n---\n\nGoal: ${goal}`;

    const childContext = createSubAgentContext(preferredSessionId ?? 'browser-agent', undefined, config);

    const client = new OpenAI({
      baseURL: `http://${config.connection.host}:${config.connection.port}/v1`,
      apiKey: resolveLmxApiKey(config.connection),
    });

    const subRegistry = await buildToolRegistry(config, 'normal');

    let spawnResult;
    try {
      spawnResult = await spawnSubAgent(
        {
          id: preferredSessionId ?? `browser-${Date.now()}`,
          description: taskDescription,
          budget: { maxToolCalls: 30 },
        },
        config,
        client,
        subRegistry,
        childContext,
      );
    } finally {
      await subRegistry.close();
    }

    const summary = formatSubAgentResult(spawnResult);
    const ok = spawnResult.status === 'completed';

    return {
      ok,
      summary,
      sessionId: preferredSessionId,
      artifactPaths: [],
    };
  } catch (err) {
    return {
      ok: false,
      summary: '',
      artifactPaths: [],
      error: errorMessage(err),
    };
  }
}
