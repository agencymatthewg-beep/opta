/**
 * Hook system for Opta CLI lifecycle events.
 *
 * Users configure shell commands that fire at lifecycle points (session start/end,
 * tool pre/post, compaction, errors). Zero hooks configured = zero cost via
 * NoOpHookManager singleton.
 */

import { execa } from 'execa';

// ── Types ───────────────────────────────────────────────────────────────

export type HookEvent =
  | 'session.start'
  | 'session.end'
  | 'tool.pre'
  | 'tool.post'
  | 'compact'
  | 'error';

export interface HookDefinition {
  event: HookEvent;
  command: string;
  matcher?: string;
  timeout?: number;
  background?: boolean;
}

export interface HookContext {
  event: HookEvent;
  session_id: string;
  cwd: string;
  tool_name?: string;
  tool_args?: string;
  tool_result?: string;
  error_message?: string;
  model?: string;
}

export interface HookResult {
  cancelled: boolean;
  reason?: string;
}

// ── Constants ───────────────────────────────────────────────────────────

const NOOP_RESULT: HookResult = Object.freeze({ cancelled: false });
const DEFAULT_TIMEOUT = 10_000;

/** Only these env vars are passed to hook subprocesses (security: prevents API key leaks). */
export const ALLOWED_ENV_KEYS = new Set([
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'TERM',
  'LANG',
  'LC_ALL',
  'NODE_ENV',
  'TMPDIR',
]);

// ── Compiled hook (internal) ────────────────────────────────────────────

interface CompiledHook extends HookDefinition {
  matcherRegex?: RegExp;
}

// ── HookManager ─────────────────────────────────────────────────────────

export class HookManager {
  protected readonly hooks: CompiledHook[];

  constructor(definitions: HookDefinition[]) {
    this.hooks = definitions.map((def) => ({
      ...def,
      matcherRegex: def.matcher ? new RegExp(def.matcher) : undefined,
    }));
  }

  /**
   * Factory: returns NoOpHookManager when no hooks are configured,
   * or a full HookManager when hooks exist.
   */
  static create(definitions?: HookDefinition[]): HookManager {
    if (!definitions || definitions.length === 0) {
      return noopSingleton;
    }
    return new HookManager(definitions);
  }

  /**
   * Fire all hooks matching the given event + context.
   * For tool.pre: non-zero exit code = cancellation.
   */
  async fire(event: HookEvent, context: HookContext): Promise<HookResult> {
    const matching = this.hooks.filter((h) => {
      if (h.event !== event) return false;
      // Matcher only applies to tool.pre / tool.post
      if (h.matcherRegex && context.tool_name) {
        return h.matcherRegex.test(context.tool_name);
      }
      // If hook has a matcher but no tool_name in context, skip
      if (h.matcherRegex && !context.tool_name) return false;
      return true;
    });

    for (const hook of matching) {
      if (hook.background) {
        // Fire and forget
        this.runHook(hook, context).catch(() => {});
        continue;
      }

      const result = await this.runHook(hook, context);
      // Only tool.pre can cancel
      if (event === 'tool.pre' && result.cancelled) {
        return result;
      }
    }

    return NOOP_RESULT;
  }

  /**
   * Execute a single hook command with env vars from context.
   */
  protected async runHook(hook: CompiledHook, context: HookContext): Promise<HookResult> {
    const env = this.buildEnv(context);
    const timeout = hook.timeout ?? DEFAULT_TIMEOUT;

    try {
      const [shell, shellFlag] = (await import('../platform/index.js')).shellArgs();
      const result = await execa(shell, [shellFlag, hook.command], {
        env,
        extendEnv: false,
        timeout,
        reject: false,
      });

      // Timeout — do not treat as cancellation
      if (result.timedOut) {
        return NOOP_RESULT;
      }

      // Only tool.pre hooks can cancel via non-zero exit
      if (context.event === 'tool.pre' && result.exitCode !== 0) {
        return {
          cancelled: true,
          reason: result.stderr?.trim() || 'Hook exited with non-zero status',
        };
      }
    } catch {
      // Timeout or other error — do not cancel, just swallow
    }

    return NOOP_RESULT;
  }

  /**
   * Build environment variables from HookContext.
   * Only passes an allowlist of safe env vars (PATH, HOME, etc.) plus OPTA_* vars.
   * This prevents leaking API keys or secrets to hook subprocesses.
   */
  protected buildEnv(context: HookContext): Record<string, string> {
    const env: Record<string, string> = {};

    // Only pass safe env vars from the allowlist
    for (const key of ALLOWED_ENV_KEYS) {
      const val = process.env[key];
      if (val !== undefined) env[key] = val;
    }

    // Also pass OPTA_* vars from process.env
    for (const [key, val] of Object.entries(process.env)) {
      if (key.startsWith('OPTA_') && val !== undefined) env[key] = val;
    }

    // Add hook-specific OPTA_ vars
    env.OPTA_EVENT = context.event;
    env.OPTA_SESSION_ID = context.session_id;
    env.OPTA_CWD = context.cwd;

    if (context.model) env['OPTA_MODEL'] = context.model;
    if (context.tool_name) env['OPTA_TOOL_NAME'] = context.tool_name;
    if (context.tool_args) env['OPTA_TOOL_ARGS'] = context.tool_args;
    if (context.tool_result) env['OPTA_TOOL_RESULT'] = context.tool_result.slice(0, 2048);
    if (context.error_message) env['OPTA_ERROR'] = context.error_message;

    return env;
  }
}

// ── NoOpHookManager ─────────────────────────────────────────────────────

export class NoOpHookManager extends HookManager {
  constructor() {
    super([]);
  }

  override fire(_event: HookEvent, _context: HookContext): Promise<HookResult> {
    return Promise.resolve(NOOP_RESULT);
  }
}

const noopSingleton = new NoOpHookManager();
