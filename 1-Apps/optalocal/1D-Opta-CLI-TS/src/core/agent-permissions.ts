/**
 * agent-permissions.ts — Tool approval flow.
 *
 * Extracted from agent.ts to isolate the permission checking logic,
 * the interactive approval prompt, and the "always allow" persistence.
 */

import chalk from 'chalk';
import type { OptaConfig } from './config.js';
import { resolveBrowserPolicyConfig } from './browser-policy-config.js';
import { resolvePermission } from './tools/index.js';
import { PolicyEngine } from '../policy/engine.js';
import type { PolicyConfig } from '../policy/types.js';
import { evaluateBrowserPolicyAction, isBrowserToolName } from '../browser/policy-engine.js';
import { appendBrowserApprovalEvent, extractBrowserSessionId } from '../browser/approval-log.js';
import { loadBrowserRunCorpusAdaptationHint } from '../browser/adaptation.js';
import { safeParseJson } from '../utils/json.js';
import { runMenuPrompt } from '../ui/prompt-nav.js';
import type { OnStreamCallbacks } from './agent.js';
import type { ToolCallAccum } from './agent-streaming.js';
import type { SessionContext } from '../hooks/integration.js';
import { fireToolPre, type HookManager } from '../hooks/integration.js';

// --- Types ---

export interface ToolDecision {
  call: ToolCallAccum;
  approved: boolean;
  denialReason?: string;
  executionArgsJson?: string;
}

type PermissionResponse = 'once' | 'always' | 'deny';

interface BrowserSessionScanResult {
  sessions: Array<{
    sessionId: string;
    currentUrl?: string;
  }>;
  sessionIds: string[];
  error?: string;
}

function resolveBrowserSpawnMode(config: OptaConfig): 'isolated' | 'attach' {
  if (config.browser.attach.enabled) return 'attach';
  return config.browser.mode ?? 'isolated';
}

function resolveBrowserAttachWsEndpoint(
  config: OptaConfig,
  mode: 'isolated' | 'attach',
): string | undefined {
  if (mode !== 'attach') return undefined;
  const endpoint = config.browser.attach.wsEndpoint.trim();
  return endpoint.length > 0 ? endpoint : undefined;
}

function isShellBrowserAutomationCommand(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const command = value.toLowerCase();
  if (!command.includes('osascript')) return false;
  return (
    command.includes('application "safari"') ||
    command.includes('application "google chrome"') ||
    command.includes('application "chrome"') ||
    command.includes('document.queryselector') ||
    command.includes('javascript')
  );
}

function mapPolicyFailureMode(
  failureMode: OptaConfig['policy']['failureMode']
): PolicyConfig['failureMode'] {
  if (failureMode === 'open') return 'open';
  // Engine accepts only open|closed; degraded-safe maps to fail-closed.
  return 'closed';
}

function mapPolicyConfig(policy: OptaConfig['policy']): PolicyConfig {
  return {
    enabled: policy.enabled,
    mode: policy.mode,
    gateAllAutonomy: policy.gateAllAutonomy,
    failureMode: mapPolicyFailureMode(policy.failureMode),
    audit: {
      enabled: policy.audit.enabled,
    },
  };
}

// --- Permission Prompt ---

async function promptToolApproval(
  toolName: string,
  args: Record<string, unknown>
): Promise<PermissionResponse> {
  // Non-interactive environments (CI, piped stdin) default to deny
  if (!process.stdin.isTTY || process.env['CI'] === 'true') {
    return 'deny';
  }

  console.log();
  console.log(chalk.yellow(`  Tool: ${toolName}`));

  // Show relevant details based on tool type
  if (toolName === 'edit_file') {
    console.log(chalk.dim(`  File: ${String(args['path'])}`));
    console.log(chalk.red(`  - ${String(args['old_text']).slice(0, 100)}`));
    console.log(chalk.green(`  + ${String(args['new_text']).slice(0, 100)}`));
  } else if (toolName === 'write_file') {
    console.log(chalk.dim(`  File: ${String(args['path'])}`));
    const contentVal = args['content'];
    const content =
      typeof contentVal === 'string'
        ? contentVal
        : typeof contentVal === 'object'
          ? JSON.stringify(contentVal)
          : String(contentVal as number | boolean | bigint | null | undefined);
    console.log(chalk.dim(`  ${content.length} bytes`));
  } else if (toolName === 'run_command') {
    console.log(chalk.dim(`  $ ${String(args['command'])}`));
  } else {
    console.log(chalk.dim(`  ${JSON.stringify(args)}`));
  }

  const { select } = await import('@inquirer/prompts');
  const choice = await runMenuPrompt(
    (context) =>
      select(
        {
          message: 'Allow?',
          choices: [
            { name: 'Yes, allow this once', value: 'once' as const },
            { name: 'Always allow (persist)', value: 'always' as const },
            { name: 'Deny', value: 'deny' as const },
          ],
          default: 'once',
        },
        context
      ),
    'select'
  );

  // Back key behaves like cancel/deny for safety.
  return choice ?? 'deny';
}

async function persistToolPermissionAllow(
  toolName: string,
  config: OptaConfig,
  saveConfig: (partial: Record<string, unknown>) => Promise<void>,
  silent: boolean
): Promise<void> {
  try {
    await saveConfig({ permissions: { ...config.permissions, [toolName]: 'allow' } });
    config.permissions[toolName] = 'allow';
    if (!silent) console.log(chalk.dim(`  Permission for ${toolName} set to "allow" permanently.`));
  } catch (error) {
    if (process.env.OPTA_DEBUG) console.error('Failed to persist permission:', error);
  }
}

async function getBrowserRuntimeDaemon(config: OptaConfig, cwd: string) {
  const { getSharedBrowserRuntimeDaemon } = await import('../browser/runtime-daemon.js');
  return getSharedBrowserRuntimeDaemon({
    cwd,
    maxSessions: config.browser.runtime.maxSessions,
    persistSessions: config.browser.runtime.persistSessions,
    persistProfileContinuity: config.browser.runtime.persistProfileContinuity,
    profileRetentionPolicy: {
      retentionDays: config.browser.runtime.profileRetentionDays,
      maxPersistedProfiles: config.browser.runtime.maxPersistedProfiles,
    },
    profilePruneIntervalMs: config.browser.runtime.profilePruneIntervalHours * 60 * 60 * 1_000,
    artifactPrune: {
      enabled: config.browser.artifacts.retention.enabled,
      policy: {
        retentionDays: config.browser.artifacts.retention.retentionDays,
        maxPersistedSessions: config.browser.artifacts.retention.maxPersistedSessions,
      },
      intervalMs: config.browser.artifacts.retention.pruneIntervalHours * 60 * 60 * 1_000,
    },
    runCorpusRefresh: {
      enabled: config.browser.runtime.runCorpus.enabled,
      windowHours: config.browser.runtime.runCorpus.windowHours,
    },
  });
}

async function scanActiveBrowserSessions(
  config: OptaConfig,
  cwd: string
): Promise<BrowserSessionScanResult> {
  try {
    const daemon = await getBrowserRuntimeDaemon(config, cwd);
    // Ensure persisted sessions are recovered before scanning health.
    await daemon.start();
    const sessions = daemon
      .health()
      .sessions.filter((session) => session.status === 'open')
      .map((session) => ({
        sessionId: session.sessionId.trim(),
        currentUrl: session.currentUrl?.trim() || undefined,
      }))
      .filter((session) => session.sessionId.length > 0);
    return {
      sessions,
      sessionIds: sessions.map((session) => session.sessionId),
    };
  } catch (error) {
    return {
      sessions: [],
      sessionIds: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// --- Resolve Tool Decisions ---

export interface ResolvePermissionsOptions {
  isSubAgent: boolean;
  silent: boolean;
  saveConfig: (partial: Record<string, unknown>) => Promise<void>;
  streamCallbacks?: OnStreamCallbacks;
  hooks: HookManager;
  sessionCtx: SessionContext;
}

/**
 * Resolves permissions for each tool call sequentially (prompts must be one-at-a-time).
 * Returns a ToolDecision[] indicating which calls are approved or denied.
 */
export async function resolveToolDecisions(
  toolCalls: ToolCallAccum[],
  config: OptaConfig,
  options: ResolvePermissionsOptions
): Promise<ToolDecision[]> {
  const { isSubAgent, silent, saveConfig, streamCallbacks, hooks, sessionCtx } = options;
  const decisions: ToolDecision[] = [];
  const isDangerousMode = (config.defaultMode ?? '').toLowerCase() === 'dangerous';
  let browserAdaptationHint: Awaited<ReturnType<typeof loadBrowserRunCorpusAdaptationHint>> | null =
    null;
  if (config.browser.adaptation.enabled) {
    try {
      browserAdaptationHint = await loadBrowserRunCorpusAdaptationHint(
        sessionCtx.cwd,
        config.browser.adaptation
      );
    } catch (error) {
      if (process.env.OPTA_DEBUG) {
        console.error('Failed to load browser adaptation hint:', error);
      }
    }
  }

  const policyEngine = new PolicyEngine(mapPolicyConfig(config.policy), {
    cwd: sessionCtx.cwd,
  });

  // Cache the browser session scan result for the entire turn so we call the daemon
  // at most once regardless of how many browser tool calls are in this batch.
  let _cachedBrowserSessionScan: BrowserSessionScanResult | null = null;
  async function getActiveBrowserSessionsOnce(): Promise<BrowserSessionScanResult> {
    if (_cachedBrowserSessionScan === null) {
      _cachedBrowserSessionScan = await scanActiveBrowserSessions(config, sessionCtx.cwd);
    }
    return _cachedBrowserSessionScan;
  }

  for (const call of toolCalls) {
    const parsedArgs = safeParseJson<Record<string, unknown>>(call.args, { raw: call.args });
    let parsedArgsMutated = false;
    let requiresBrowserApproval = false;
    let browserSessionId: string | undefined;
    let browserPolicyDecision: ReturnType<typeof evaluateBrowserPolicyAction> | null = null;

    const logBrowserApprovalDecision = async (decision: 'approved' | 'denied'): Promise<void> => {
      if (!requiresBrowserApproval) return;
      try {
        await appendBrowserApprovalEvent({
          cwd: sessionCtx.cwd,
          tool: call.name,
          sessionId: browserSessionId,
          decision,
          risk: browserPolicyDecision?.risk,
          actionKey: browserPolicyDecision?.actionKey,
          targetHost: browserPolicyDecision?.targetHost,
          targetOrigin: browserPolicyDecision?.targetOrigin,
          policyReason: browserPolicyDecision?.reason,
          riskEvidence: browserPolicyDecision?.riskEvidence,
        });
      } catch (error) {
        if (process.env.OPTA_DEBUG) {
          console.error('Failed to append browser approval event:', error);
        }
      }
    };

    if (config.browser.enabled && call.name === 'run_command') {
      const command = parsedArgs['command'];
      if (isShellBrowserAutomationCommand(command)) {
        decisions.push({
          call,
          approved: false,
          denialReason: 'Denied shell browser automation command; use browser_* tools instead.',
        });
        if (!silent)
          console.log(
            chalk.dim(`  ✗ ${call.name} — use browser_* tools instead of shell browser automation`)
          );
        continue;
      }
    }

    if (isBrowserToolName(call.name)) {
      browserSessionId = extractBrowserSessionId(parsedArgs);
      let activeBrowserSessions: BrowserSessionScanResult['sessions'] = [];
      if (config.browser.enabled && call.name !== 'browser_open') {
        const scanResult = await getActiveBrowserSessionsOnce();
        if (scanResult.error) {
          decisions.push({
            call,
            approved: false,
            denialReason: `Browser runtime session scan failed: ${scanResult.error}`,
          });
          if (!silent) console.log(chalk.dim(`  ✗ ${call.name} — browser session scan failed`));
          continue;
        }
        activeBrowserSessions = scanResult.sessions;

        if (scanResult.sessionIds.length === 0 && !browserSessionId) {
          if (isSubAgent) {
            decisions.push({
              call,
              approved: false,
              denialReason: 'Permission denied (sub-agent cannot prompt browser spawn).',
            });
            continue;
          }

          const spawnMode = resolveBrowserSpawnMode(config);
          const spawnWsEndpoint = resolveBrowserAttachWsEndpoint(config, spawnMode);
          if (spawnMode === 'attach' && !spawnWsEndpoint) {
            decisions.push({
              call,
              approved: false,
              denialReason:
                'Cannot spawn Opta Browser attach session: browser.attach.wsEndpoint is not configured.',
            });
            if (!silent) {
              console.log(
                chalk.dim(`  ✗ ${call.name} — browser attach requires browser.attach.wsEndpoint`)
              );
            }
            continue;
          }

          const browserOpenPermission = resolvePermission('browser_open', config);
          if (browserOpenPermission === 'deny') {
            decisions.push({
              call,
              approved: false,
              denialReason:
                'Cannot spawn Opta Browser (browser_open permission is denied by config).',
            });
            if (!silent)
              console.log(chalk.dim(`  ✗ ${call.name} — browser_open denied by configuration`));
            continue;
          }

          const spawnPromptArgs: Record<string, unknown> = {
            mode: spawnMode,
            __opta_spawn_prompt: true,
            __opta_spawn_reason: 'No active Opta Browser sessions were found in the runtime scan.',
            __opta_spawn_trigger_tool: call.name,
            __opta_session_scan_count: 0,
          };
          if (spawnWsEndpoint) {
            spawnPromptArgs['ws_endpoint'] = spawnWsEndpoint;
          }

          if (streamCallbacks?.onPermissionRequest) {
            const spawnDecision = await streamCallbacks.onPermissionRequest(
              'browser_open',
              spawnPromptArgs
            );
            if (spawnDecision === 'deny') {
              decisions.push({
                call,
                approved: false,
                denialReason: 'User declined spawning an Opta Browser session.',
              });
              continue;
            }
            if (spawnDecision === 'always' && browserOpenPermission === 'ask') {
              await persistToolPermissionAllow('browser_open', config, saveConfig, silent);
            }
          } else {
            const spawnResponse = await promptToolApproval('browser_open', spawnPromptArgs);
            if (spawnResponse === 'deny') {
              decisions.push({
                call,
                approved: false,
                denialReason: 'User declined spawning an Opta Browser session.',
              });
              continue;
            }
            if (spawnResponse === 'always' && browserOpenPermission === 'ask') {
              await persistToolPermissionAllow('browser_open', config, saveConfig, silent);
            }
          }

          try {
            const daemon = await getBrowserRuntimeDaemon(config, sessionCtx.cwd);
            const openResult = await daemon.openSession({
              sessionId: browserSessionId,
              mode: spawnMode,
              wsEndpoint: spawnWsEndpoint,
            });
            if (!openResult.ok || !openResult.data) {
              const reason =
                openResult.error?.message ?? 'Browser runtime could not open a new session.';
              decisions.push({
                call,
                approved: false,
                denialReason: `Failed to spawn Opta Browser session: ${reason}`,
              });
              if (!silent)
                console.log(chalk.dim(`  ✗ ${call.name} — failed to spawn browser session`));
              continue;
            }

            browserSessionId = openResult.data.id;
            parsedArgs['session_id'] = browserSessionId;
            parsedArgsMutated = true;
            // Always require approval when a session was spawned — user must confirm the first action
            requiresBrowserApproval = true;
            if (!silent)
              console.log(chalk.dim(`  Spawned Opta Browser session: ${browserSessionId}`));
          } catch (error) {
            decisions.push({
              call,
              approved: false,
              denialReason: `Failed to spawn Opta Browser session: ${error instanceof Error ? error.message : String(error)}`,
            });
            if (!silent) console.log(chalk.dim(`  ✗ ${call.name} — browser spawn failed`));
            continue;
          }
        } else if (!browserSessionId) {
          browserSessionId = scanResult.sessionIds[0];
          if (browserSessionId) {
            parsedArgs['session_id'] = browserSessionId;
            parsedArgsMutated = true;
            // Require approval so the user confirms the action with the auto-assigned session
            requiresBrowserApproval = true;
          }
        }
      }

      if (browserSessionId && (call.name === 'browser_click' || call.name === 'browser_type')) {
        const hasExplicitUrl =
          typeof parsedArgs['url'] === 'string' && parsedArgs['url'].trim().length > 0;
        if (!hasExplicitUrl) {
          const activeSession = activeBrowserSessions.find(
            (session) => session.sessionId === browserSessionId
          );
          if (activeSession?.currentUrl) {
            parsedArgs['url'] = activeSession.currentUrl;
            parsedArgsMutated = true;
          }
        }
      }

      browserPolicyDecision = evaluateBrowserPolicyAction(resolveBrowserPolicyConfig(config), {
        toolName: call.name,
        args: parsedArgs,
        adaptationHint: browserAdaptationHint?.policy,
      });

      if (browserPolicyDecision.decision === 'deny') {
        try {
          await appendBrowserApprovalEvent({
            cwd: sessionCtx.cwd,
            tool: call.name,
            sessionId: browserSessionId,
            decision: 'denied',
            risk: browserPolicyDecision.risk,
            actionKey: browserPolicyDecision.actionKey,
            targetHost: browserPolicyDecision.targetHost,
            targetOrigin: browserPolicyDecision.targetOrigin,
            policyReason: browserPolicyDecision.reason,
            riskEvidence: browserPolicyDecision.riskEvidence,
          });
        } catch (error) {
          if (process.env.OPTA_DEBUG) {
            console.error('Failed to append browser deny event:', error);
          }
        }
        decisions.push({
          call,
          approved: false,
          denialReason: `Denied by browser policy: ${browserPolicyDecision.reason}`,
        });
        if (!silent)
          console.log(chalk.dim(`  \u2717 ${call.name} \u2014 denied by browser policy`));
        continue;
      }

      requiresBrowserApproval = requiresBrowserApproval || browserPolicyDecision.decision === 'gate';
    }

    const policyDecision = await policyEngine.decide({
      action: call.name,
      // Dangerous mode explicitly bypasses approval prompts.
      // Mark tool calls as non-autonomous so gate-all policy does not block unattended runs.
      autonomous: !isDangerousMode,
      actor: isSubAgent ? 'sub-agent' : 'agent',
      metadata: {
        toolCallId: call.id,
      },
    });

    if (policyDecision.decision === 'deny') {
      decisions.push({
        call,
        approved: false,
        denialReason: `Denied by policy: ${policyDecision.reason}`,
      });
      if (!silent) console.log(chalk.dim(`  \u2717 ${call.name} \u2014 denied by policy`));
      continue;
    }

    const requiresApproval = policyDecision.decision === 'gate' || requiresBrowserApproval;
    const permission = resolvePermission(call.name, config);
    let executionArgsJson = parsedArgsMutated ? JSON.stringify(parsedArgs) : call.args;

    if (permission === 'deny') {
      decisions.push({
        call,
        approved: false,
        denialReason: 'Permission denied by configuration.',
      });
      if (!silent) console.log(chalk.dim(`  \u2717 ${call.name} \u2014 denied`));
      continue;
    }

    if (permission === 'ask' || requiresApproval) {
      if (isSubAgent) {
        await logBrowserApprovalDecision('denied');
        decisions.push({
          call,
          approved: false,
          denialReason: 'Permission denied (sub-agent cannot prompt user).',
        });
        continue;
      }

      if (streamCallbacks?.onPermissionRequest) {
        const decision = await streamCallbacks.onPermissionRequest(call.name, parsedArgs);
        if (decision === 'always' && permission === 'ask') {
          await persistToolPermissionAllow(call.name, config, saveConfig, silent);
        } else if (decision === 'deny') {
          await logBrowserApprovalDecision('denied');
          decisions.push({ call, approved: false, denialReason: 'User declined this action.' });
          continue;
        }
        await logBrowserApprovalDecision('approved');
      } else {
        const response = await promptToolApproval(call.name, parsedArgs);
        if (response === 'always' && permission === 'ask') {
          await persistToolPermissionAllow(call.name, config, saveConfig, silent);
        } else if (response === 'deny') {
          await logBrowserApprovalDecision('denied');
          decisions.push({ call, approved: false, denialReason: 'User declined this action.' });
          continue;
        }
        await logBrowserApprovalDecision('approved');
      }

      if (requiresBrowserApproval) {
        executionArgsJson = JSON.stringify({ ...parsedArgs, __browser_approved: true });
      }
    }

    // Fire pre-tool hook (can cancel execution)
    const preResult = await fireToolPre(hooks, call.name, executionArgsJson, sessionCtx);
    if (preResult.cancelled) {
      decisions.push({
        call,
        approved: false,
        denialReason: `Tool blocked by hook: ${preResult.reason ?? 'no reason given'}`,
      });
      if (!silent) console.log(chalk.dim(`  \u2717 ${call.name} \u2014 blocked by hook`));
      continue;
    }

    decisions.push({ call, approved: true, executionArgsJson });
  }

  return decisions;
}
