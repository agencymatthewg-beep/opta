/**
 * Hook integration helpers for wiring HookManager into the agent loop.
 *
 * These functions provide a clean API for agent.ts to call without needing
 * to construct HookContext objects manually. The parent session will import
 * these helpers and call them at the appropriate lifecycle points.
 *
 * Usage in agent.ts (future integration):
 *
 *   import { createHookManager, fireToolPre, fireToolPost, ... } from '../hooks/integration.js';
 *
 *   const hooks = createHookManager(config);
 *   await fireSessionStart(hooks, { sessionId, cwd, model });
 *   // ... in tool loop:
 *   const preResult = await fireToolPre(hooks, toolName, toolArgs, { sessionId, cwd, model });
 *   if (preResult.cancelled) { /* skip tool, feed reason to model *\/ }
 *   // ... after tool:
 *   await fireToolPost(hooks, toolName, toolArgs, result, { sessionId, cwd, model });
 */

import {
  HookManager,
  type HookContext,
  type HookDefinition,
  type HookResult,
} from './manager.js';

// ── Session context (passed from agent loop) ────────────────────────────

export interface SessionContext {
  sessionId: string;
  cwd: string;
  model?: string;
}

// ── Config shape expected by createHookManager ──────────────────────────

export interface HookConfig {
  hooks?: HookDefinition[];
}

// ── Factory ─────────────────────────────────────────────────────────────

/**
 * Create a HookManager from the config's hooks array.
 * Returns NoOpHookManager when no hooks are configured.
 */
export function createHookManager(config: HookConfig): HookManager {
  return HookManager.create(config.hooks);
}

// ── Helper functions for each lifecycle event ───────────────────────────

function baseContext(session: SessionContext, event: HookContext['event']): HookContext {
  return {
    event,
    session_id: session.sessionId,
    cwd: session.cwd,
    model: session.model,
  };
}

export async function fireSessionStart(
  mgr: HookManager,
  session: SessionContext,
): Promise<HookResult> {
  return mgr.fire('session.start', baseContext(session, 'session.start'));
}

export async function fireSessionEnd(
  mgr: HookManager,
  session: SessionContext,
): Promise<HookResult> {
  return mgr.fire('session.end', baseContext(session, 'session.end'));
}

export async function fireToolPre(
  mgr: HookManager,
  toolName: string,
  toolArgs: string,
  session: SessionContext,
): Promise<HookResult> {
  return mgr.fire('tool.pre', {
    ...baseContext(session, 'tool.pre'),
    tool_name: toolName,
    tool_args: toolArgs,
  });
}

export async function fireToolPost(
  mgr: HookManager,
  toolName: string,
  toolArgs: string,
  toolResult: string,
  session: SessionContext,
): Promise<HookResult> {
  return mgr.fire('tool.post', {
    ...baseContext(session, 'tool.post'),
    tool_name: toolName,
    tool_args: toolArgs,
    tool_result: toolResult,
  });
}

export async function fireCompact(
  mgr: HookManager,
  session: SessionContext,
): Promise<HookResult> {
  return mgr.fire('compact', baseContext(session, 'compact'));
}

export async function fireError(
  mgr: HookManager,
  errorMessage: string,
  session: SessionContext,
): Promise<HookResult> {
  return mgr.fire('error', {
    ...baseContext(session, 'error'),
    error_message: errorMessage,
  });
}
