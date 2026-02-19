/**
 * agent-permissions.ts — Tool approval flow.
 *
 * Extracted from agent.ts to isolate the permission checking logic,
 * the interactive approval prompt, and the "always allow" persistence.
 */

import chalk from 'chalk';
import type { OptaConfig } from './config.js';
import { resolvePermission } from './tools/index.js';
import { safeParseJson } from '../utils/json.js';
import { debug } from './debug.js';
import type { OnStreamCallbacks } from './agent.js';
import type { ToolCallAccum } from './agent-streaming.js';
import type { SessionContext } from '../hooks/integration.js';
import {
  fireToolPre,
  type HookManager,
} from '../hooks/integration.js';

// --- Types ---

export interface ToolDecision {
  call: ToolCallAccum;
  approved: boolean;
  denialReason?: string;
}

type PermissionResponse = 'once' | 'always' | 'deny';

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

  const { select } = await import('@inquirer/prompts');
  const choice = await select({
    message: 'Allow?',
    choices: [
      { name: 'Yes, allow this once', value: 'once' as const },
      { name: 'Always allow (persist)', value: 'always' as const },
      { name: 'Deny', value: 'deny' as const },
    ],
    default: 'once',
  });

  return choice;
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
  options: ResolvePermissionsOptions,
): Promise<ToolDecision[]> {
  const { isSubAgent, silent, saveConfig, streamCallbacks, hooks, sessionCtx } = options;
  const decisions: ToolDecision[] = [];

  for (const call of toolCalls) {
    const permission = resolvePermission(call.name, config);

    if (permission === 'deny') {
      decisions.push({ call, approved: false, denialReason: 'Permission denied by configuration.' });
      if (!silent) console.log(chalk.dim(`  \u2717 ${call.name} \u2014 denied`));
      continue;
    }

    if (permission === 'ask') {
      if (isSubAgent) {
        decisions.push({ call, approved: false, denialReason: 'Permission denied (sub-agent cannot prompt user).' });
        continue;
      }

      const args = safeParseJson<Record<string, unknown>>(call.args, { raw: call.args });

      if (streamCallbacks?.onPermissionRequest) {
        const decision = await streamCallbacks.onPermissionRequest(call.name, args);
        if (decision === 'always') {
          // Persist the permission so it won't be asked again
          try {
            await saveConfig({ permissions: { ...config.permissions, [call.name]: 'allow' } });
            config.permissions[call.name] = 'allow';
          } catch {
            // Persist failed — still allow this time
          }
        } else if (decision === 'deny') {
          decisions.push({ call, approved: false, denialReason: 'User declined this action.' });
          continue;
        }
      } else {
        const response = await promptToolApproval(call.name, args);
        if (response === 'always') {
          // Persist the permission so it won't be asked again
          try {
            await saveConfig({ permissions: { ...config.permissions, [call.name]: 'allow' } });
            config.permissions[call.name] = 'allow';
            if (!silent) console.log(chalk.dim(`  Permission for ${call.name} set to "allow" permanently.`));
          } catch {
            // Persist failed — still allow this time
          }
        } else if (response === 'deny') {
          decisions.push({ call, approved: false, denialReason: 'User declined this action.' });
          continue;
        }
      }
    }

    // Fire pre-tool hook (can cancel execution)
    const preResult = await fireToolPre(hooks, call.name, call.args, sessionCtx);
    if (preResult.cancelled) {
      decisions.push({ call, approved: false, denialReason: `Tool blocked by hook: ${preResult.reason ?? 'no reason given'}` });
      if (!silent) console.log(chalk.dim(`  \u2717 ${call.name} \u2014 blocked by hook`));
      continue;
    }

    decisions.push({ call, approved: true });
  }

  return decisions;
}
