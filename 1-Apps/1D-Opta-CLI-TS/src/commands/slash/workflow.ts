/**
 * Workflow slash commands: /plan, /diff, /undo, /compact, /status
 */

import chalk from 'chalk';
import { box, kv, statusDot, fmtTokens, progressBar } from '../../ui/box.js';
import { estimateTokens } from '../../core/agent.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

const planHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (args === 'off' || (ctx.chatState.currentMode === 'plan' && !args)) {
    ctx.chatState.currentMode = 'normal';
    console.log(chalk.green('\u2713') + ' Exited plan mode');
  } else {
    ctx.chatState.currentMode = 'plan';
    console.log(chalk.magenta('\u2713') + ' Entered plan mode \u2014 read-only exploration');
    console.log(chalk.dim('  Tools: read, search, list, find, ask, web_search, web_fetch'));
    console.log(chalk.dim('  Type /plan off to exit'));
  }
  return 'handled';
};

const diffHandler = async (args: string, _ctx: SlashContext): Promise<SlashResult> => {
  try {
    const { execFileSync } = await import('node:child_process');
    const { formatUnifiedDiff } = await import('../../ui/diff.js');

    const stat = execFileSync('git', ['diff', '--stat'], { encoding: 'utf-8', cwd: process.cwd() });
    if (!stat.trim()) {
      console.log(chalk.dim('  No uncommitted changes'));
      return 'handled';
    }

    // Show stat summary in a box
    const statLines = stat.trim().split('\n');
    const summary = statLines[statLines.length - 1] ?? '';
    const fileLines = statLines.slice(0, -1).map(l => ' ' + l.trim());
    console.log('\n' + box('Changes', [...fileLines, '', chalk.dim(summary.trim())]));

    // If user passed a file, show full diff for that file
    if (args) {
      const fullDiff = execFileSync('git', ['diff', '--', args], { encoding: 'utf-8', cwd: process.cwd() });
      if (fullDiff.trim()) {
        console.log('\n' + formatUnifiedDiff(fullDiff));
      }
    } else {
      console.log(chalk.dim('  Tip: /diff <file> for inline diff'));
    }
  } catch {
    console.log(chalk.dim('  Not a git repository'));
  }
  return 'handled';
};

const undoHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  try {
    const { isGitRepo } = await import('../../git/utils.js');
    if (!(await isGitRepo(process.cwd()))) {
      console.log(chalk.dim('  Not in a git repository'));
      return 'handled';
    }

    const { listCheckpoints, readPatchContent, patchStat, undoCheckpoint, undoAllCheckpoints } = await import('../../git/checkpoints.js');
    const { formatTruncatedDiff, formatPatchStat } = await import('../../ui/diff.js');

    // --- /undo list (or /checkpoint alias) ---
    if (args === 'list') {
      const checkpoints = await listCheckpoints(process.cwd(), ctx.session.id);
      if (checkpoints.length === 0) {
        console.log(chalk.dim('  No checkpoints in this session'));
      } else {
        const lines: string[] = [];
        for (const cp of checkpoints) {
          const patch = await readPatchContent(process.cwd(), ctx.session.id, cp.n);
          const stat = patchStat(patch);
          const ts = new Date(cp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          lines.push(
            `  ${chalk.bold(`#${cp.n}`)}  ${chalk.cyan(cp.tool.padEnd(12))} ${cp.path}  ${formatPatchStat(stat.additions, stat.deletions)}  ${chalk.dim(ts)}`
          );
        }
        console.log('\n' + box('Checkpoints', lines));
        console.log(chalk.dim('  Tip: /undo N to revert a specific checkpoint\n'));
      }
      return 'handled';
    }

    // --- /undo all ---
    if (args === 'all') {
      const checkpoints = await listCheckpoints(process.cwd(), ctx.session.id);
      if (checkpoints.length === 0) {
        console.log(chalk.dim('  No checkpoints in this session'));
        return 'handled';
      }

      const { confirm } = await import('@inquirer/prompts');
      const ok = await confirm({
        message: `Revert all ${checkpoints.length} checkpoint${checkpoints.length === 1 ? '' : 's'}?`,
        default: false,
      });
      if (!ok) {
        console.log(chalk.dim('  Cancelled'));
        return 'handled';
      }

      const undone = await undoAllCheckpoints(process.cwd(), ctx.session.id);
      console.log(chalk.green('\u2713') + ` Undone: ${undone} checkpoint${undone === 1 ? '' : 's'}`);
      ctx.session.messages.push({
        role: 'user',
        content: `[System: User reversed all ${undone} checkpoints \u2014 all changes have been reverted. Adjust your approach accordingly.]`,
      });
      return 'handled';
    }

    // --- /undo N (specific checkpoint, no confirmation) ---
    if (args && !isNaN(parseInt(args, 10))) {
      const n = parseInt(args, 10);
      await undoCheckpoint(process.cwd(), ctx.session.id, n);

      console.log(chalk.green('\u2713') + ` Undone: Checkpoint #${n}`);
      ctx.session.messages.push({
        role: 'user',
        content: `[System: User reversed Checkpoint #${n} \u2014 changes have been reverted. Adjust your approach accordingly.]`,
      });
      return 'handled';
    }

    // --- /undo (no args): preview last checkpoint, then confirm ---
    const checkpoints = await listCheckpoints(process.cwd(), ctx.session.id);
    if (checkpoints.length === 0) {
      console.log(chalk.dim('  No checkpoints in this session'));
      return 'handled';
    }

    const last = checkpoints[checkpoints.length - 1]!;
    const patch = await readPatchContent(process.cwd(), ctx.session.id, last.n);
    const stat = patchStat(patch);

    console.log();
    console.log(
      chalk.bold(`  Checkpoint #${last.n}`) +
      chalk.dim(` \u2014 ${last.tool} \u2014 `) +
      formatPatchStat(stat.additions, stat.deletions)
    );
    console.log();
    if (patch) {
      console.log(formatTruncatedDiff(patch, last.path, 20));
      console.log();
    }

    const { confirm } = await import('@inquirer/prompts');
    const ok = await confirm({
      message: 'Revert this checkpoint?',
      default: true,
    });
    if (!ok) {
      console.log(chalk.dim('  Cancelled'));
      return 'handled';
    }

    await undoCheckpoint(process.cwd(), ctx.session.id);
    console.log(chalk.green('\u2713') + ' Undone: Last checkpoint');
    ctx.session.messages.push({
      role: 'user',
      content: `[System: User reversed Checkpoint #${last.n} \u2014 changes have been reverted. Adjust your approach accordingly.]`,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('ExitPromptError')) {
      console.log(chalk.dim('  Cancelled'));
      return 'handled';
    }
    console.error(chalk.red('\u2717') + ` Undo failed: ${err instanceof Error ? err.message : err}`);
  }
  return 'handled';
};

const compactHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  console.log(chalk.dim('  Context compaction will happen automatically on next turn'));
  // Force compaction by setting messages to trigger threshold
  // The agent loop handles this automatically
  return 'handled';
};

const statusHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  try {
    const res = await fetch(`http://${ctx.config.connection.host}:${ctx.config.connection.port}/admin/status`);
    const data = await res.json() as Record<string, unknown>;
    const model = (data.models as string[] | undefined)?.[0];
    const memory = data.memory as { used_gb?: number; total_gb?: number; usage_percent?: number } | undefined;
    const tokens = estimateTokens(ctx.session.messages);
    const uptimeSec = data.uptime_seconds as number | undefined;

    const lines: string[] = [
      kv('LMX', `${ctx.config.connection.host}:${ctx.config.connection.port} ${statusDot(true)}`),
    ];
    if (model) lines.push(kv('Model', model));
    if (memory) {
      const memBar = progressBar((memory.usage_percent ?? 0) / 100, 16);
      lines.push(kv('Memory', `${memory.used_gb?.toFixed(0)}/${memory.total_gb?.toFixed(0)} GB ${memBar}`));
    }
    lines.push(kv('Session', `${ctx.session.id.slice(0, 8)} (${ctx.session.messages.length} messages)`));
    lines.push(kv('Tokens', `~${fmtTokens(tokens)}`));
    if (uptimeSec !== undefined) lines.push(kv('Uptime', `${Math.floor(uptimeSec / 60)}m`));

    // Checkpoint count
    try {
      const { listCheckpoints } = await import('../../git/checkpoints.js');
      const checkpoints = await listCheckpoints(process.cwd(), ctx.session.id);
      if (checkpoints.length > 0) {
        lines.push(kv('Checkpoints', `${checkpoints.length} (session ${ctx.session.id.slice(0, 8)})`));
      }
    } catch {
      // Ignore — checkpoints are optional
    }

    console.log('\n' + box('Status', lines));
  } catch {
    console.log(chalk.red('\n  \u25cf LMX unreachable') + chalk.dim(` \u2014 ${ctx.config.connection.host}:${ctx.config.connection.port}`));
  }
  return 'handled';
};

/** Handler for /checkpoint — alias for /undo list */
const checkpointHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  return undoHandler('list', ctx);
};

export const workflowCommands: SlashCommandDef[] = [
  {
    command: 'plan',
    description: 'Toggle plan mode',
    handler: planHandler,
    category: 'session',
  },
  {
    command: 'diff',
    description: 'Uncommitted changes',
    handler: diffHandler,
    category: 'tools',
  },
  {
    command: 'undo',
    description: 'Undo checkpoint (list|all|N)',
    handler: undoHandler,
    category: 'tools',
  },
  {
    command: 'checkpoint',
    aliases: ['cp'],
    description: 'List checkpoints',
    handler: checkpointHandler,
    category: 'tools',
  },
  {
    command: 'compact',
    description: 'Force context compaction',
    handler: compactHandler,
    category: 'tools',
  },
  {
    command: 'status',
    description: 'System & LMX status',
    handler: statusHandler,
    category: 'info',
  },
];
