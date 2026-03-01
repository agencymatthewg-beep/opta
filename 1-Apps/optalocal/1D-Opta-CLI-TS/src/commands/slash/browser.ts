import chalk from 'chalk';
import {
  browserApprovalLogPath,
  readRecentBrowserApprovalEvents,
} from '../../browser/approval-log.js';
import {
  browserCanaryEvidenceFileSize,
  browserCanaryLatestPath,
  buildBrowserCanaryEvidence,
  updateBrowserCanaryRollbackDrill,
  writeBrowserCanaryEvidence,
} from '../../browser/canary-evidence.js';
import {
  buildBrowserRunCorpusSummary,
  writeBrowserRunCorpusSummary,
} from '../../browser/run-corpus.js';
import { DEFAULT_BROWSER_BENCHMARK_THRESHOLDS } from '../../browser/quality-gates.js';
import {
  BROWSER_CONTROL_ACTIONS,
  runBrowserControlAction,
  type BrowserControlAction,
} from '../../browser/control-surface.js';
import {
  getBrowserLiveHostStatus,
  startBrowserLiveHost,
  stopBrowserLiveHost,
  type BrowserLiveHostStatus,
} from '../../browser/live-host.js';
import { isPeekabooAvailable } from '../../browser/peekaboo.js';
import {
  browserProfilesRootPath,
  listBrowserProfileDirs,
  pruneBrowserProfileDirs,
  resolveBrowserProfileRetentionPolicy,
  type BrowserProfileRetentionPolicy,
} from '../../browser/profile-store.js';
import { summarizeBrowserReplay } from '../../browser/replay.js';
import type { BrowserRuntimeProfilePruneHealth } from '../../browser/runtime-daemon.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

function printBrowserUsage(): void {
  console.log(chalk.dim('  Usage: /browser [status|pause|resume|stop|kill|replay <session_id>|approvals [limit]|profiles [prune [session_id]]|trends [hours] [limit]|canary [hours]|canary rollback <pass|fail> [notes]|host [start|status|stop] [--range start-end] [--screen peekaboo]]'));
  console.log(chalk.dim('    /browser status'));
  console.log(chalk.dim('    /browser pause'));
  console.log(chalk.dim('    /browser resume'));
  console.log(chalk.dim('    /browser stop'));
  console.log(chalk.dim('    /browser kill'));
  console.log(chalk.dim('    /browser replay <session_id>'));
  console.log(chalk.dim('    /browser approvals'));
  console.log(chalk.dim('    /browser approvals 20'));
  console.log(chalk.dim('    /browser profiles'));
  console.log(chalk.dim('    /browser profiles prune'));
  console.log(chalk.dim('    /browser profiles prune <session_id>'));
  console.log(chalk.dim('    /browser trends'));
  console.log(chalk.dim('    /browser trends 24 10'));
  console.log(chalk.dim('    /browser canary'));
  console.log(chalk.dim('    /browser canary 24'));
  console.log(chalk.dim('    /browser canary rollback pass Rehearsal completed.'));
  console.log(chalk.dim('    /browser host start --range 46000-47000'));
  console.log(chalk.dim('    /browser host start --screen peekaboo'));
  console.log(chalk.dim('    /browser host status'));
  console.log(chalk.dim('    /browser host stop'));
}

function printStatus(result: Awaited<ReturnType<typeof runBrowserControlAction>>): void {
  const health = result.health;
  const marker = result.ok ? chalk.green('\u2713') : chalk.yellow('!');
  console.log(marker + ` ${result.message}`);
  console.log(
    chalk.dim(
      `  running=${health.running} paused=${health.paused} killed=${health.killed} sessions=${health.sessionCount}/${health.maxSessions}`,
    ),
  );
  console.log(chalk.dim(formatProfilePruneStatus(health.profilePrune)));

  if (health.sessions.length === 0) {
    console.log(chalk.dim('  No active browser sessions.'));
    return;
  }

  for (const session of health.sessions) {
    const runtime = session.runtime.padEnd(11);
    const status = session.status.padEnd(6);
    const url = session.currentUrl ?? '(none)';
    console.log(`  ${chalk.cyan(session.sessionId)}  ${chalk.dim(status)}  ${chalk.dim(runtime)}  ${url}`);
  }
}

function formatProfilePruneStatus(prune: BrowserRuntimeProfilePruneHealth): string {
  if (!prune.enabled) {
    return '  profile_prune=disabled';
  }
  const base = `  profile_prune=enabled interval_ms=${prune.intervalMs ?? '-'} in_flight=${String(prune.inFlight)}`;
  if (!prune.lastRunAt || !prune.lastStatus) {
    return `${base} last_run=never`;
  }
  const counts = (
    typeof prune.lastListedCount === 'number' &&
    typeof prune.lastKeptCount === 'number' &&
    typeof prune.lastPrunedCount === 'number'
  )
    ? ` listed=${prune.lastListedCount} kept=${prune.lastKeptCount} pruned=${prune.lastPrunedCount}`
    : '';
  const error = prune.lastError ? ` error=${prune.lastError}` : '';
  return `${base} last_run=${prune.lastRunAt} reason=${prune.lastReason ?? '-'} status=${prune.lastStatus}${counts}${error}`;
}

function parseApprovalsLimit(raw: string | undefined): number | null {
  if (!raw) return 10;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return Math.min(parsed, 200);
}

function profilePolicyLine(policy: BrowserProfileRetentionPolicy): string {
  return `  policy: retentionDays=${policy.retentionDays} maxPersistedProfiles=${policy.maxPersistedProfiles}`;
}

async function printApprovals(limit: number): Promise<void> {
  const cwd = process.cwd();
  const events = await readRecentBrowserApprovalEvents(cwd, limit);
  const path = browserApprovalLogPath(cwd);

  if (events.length === 0) {
    console.log(chalk.dim('  No browser approval events found.'));
    console.log(chalk.dim(`  Log: ${path}`));
    return;
  }

  console.log(chalk.green('\u2713') + ` Recent browser approvals (${events.length}/${limit})`);
  console.log(chalk.dim(`  Log: ${path}`));
  for (const event of events) {
    const decision = event.decision === 'approved' ? chalk.green('approved') : chalk.red('denied');
    const sessionId = event.sessionId ?? '-';
    const risk = event.risk ? ` risk=${event.risk}` : '';
    const action = event.actionKey ? ` action=${event.actionKey}` : '';
    const target = event.targetHost
      ? ` target=${event.targetHost}`
      : event.target_origin
        ? ` target=${event.target_origin}`
        : '';
    const signalSummary = event.riskEvidence?.matchedSignals.length
      ? ` signals=${event.riskEvidence.matchedSignals.slice(0, 3).join('|')}`
      : '';
    console.log(
      `  ${chalk.dim(event.timestamp)}  ${decision}  ${chalk.cyan(event.tool)}  session=${chalk.dim(sessionId)}${risk}${action}${target}${signalSummary}`,
    );
    if (event.policyReason) {
      console.log(chalk.dim(`    reason=${event.policyReason}`));
    }
  }
}

async function printProfiles(ctx: SlashContext): Promise<void> {
  const cwd = process.cwd();
  const profiles = await listBrowserProfileDirs(cwd);
  const root = browserProfilesRootPath(cwd);
  const policy = resolveBrowserProfileRetentionPolicy({
    retentionDays: ctx.config.browser.runtime.profileRetentionDays,
    maxPersistedProfiles: ctx.config.browser.runtime.maxPersistedProfiles,
  });

  if (profiles.length === 0) {
    console.log(chalk.dim('  No persisted browser profiles found.'));
    console.log(chalk.dim(`  Root: ${root}`));
    console.log(chalk.dim(profilePolicyLine(policy)));
    return;
  }

  console.log(chalk.green('\u2713') + ` Persisted browser profiles (${profiles.length})`);
  console.log(chalk.dim(`  Root: ${root}`));
  console.log(chalk.dim(profilePolicyLine(policy)));
  for (const profile of profiles) {
    console.log(
      `  ${chalk.cyan(profile.sessionId)}  ${chalk.dim(profile.modifiedAt)}  ${chalk.dim(profile.relativePath)}`,
    );
  }
}

async function pruneProfiles(ctx: SlashContext, sessionId: string | undefined): Promise<void> {
  const policy = resolveBrowserProfileRetentionPolicy({
    retentionDays: ctx.config.browser.runtime.profileRetentionDays,
    maxPersistedProfiles: ctx.config.browser.runtime.maxPersistedProfiles,
  });

  const result = await pruneBrowserProfileDirs({
    cwd: process.cwd(),
    sessionId,
    policy,
  });

  if (result.pruned.length === 0) {
    if (sessionId) {
      console.log(chalk.dim(`  No persisted browser profile found for session "${sessionId}".`));
    } else {
      console.log(chalk.dim('  No browser profiles matched the prune policy.'));
    }
    console.log(chalk.dim(profilePolicyLine(result.policy)));
    console.log(chalk.dim(`  kept=${result.kept.length} root=${result.rootDir}`));
    return;
  }

  console.log(chalk.green('\u2713') + ` Pruned browser profiles (${result.pruned.length})`);
  for (const profile of result.pruned) {
    console.log(`  ${chalk.cyan(profile.sessionId)}  ${chalk.dim(profile.relativePath)}`);
  }
  console.log(chalk.dim(profilePolicyLine(result.policy)));
  console.log(chalk.dim(`  kept=${result.kept.length} root=${result.rootDir}`));
}

function parseCanaryWindowHours(raw: string | undefined): number | null {
  if (!raw) return 24;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 168) return null;
  return parsed;
}

function parseTrendsWindowHours(raw: string | undefined): number | null {
  if (!raw) return 168;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 720) return null;
  return parsed;
}

function parseTrendsLimit(raw: string | undefined): number | null {
  if (!raw) return 10;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) return null;
  return parsed;
}

function parsePortRange(raw: string | undefined): { start: number; end: number } | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+)-(\d+)$/);
  if (!match) return null;

  const [, startRaw, endRaw] = match;
  if (!startRaw || !endRaw) return null;

  const start = Number.parseInt(startRaw, 10);
  const end = Number.parseInt(endRaw, 10);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 1024 || end < 1024) return null;
  if (start > 65_535 || end > 65_535) return null;

  const min = Math.min(start, end);
  const max = Math.max(start, end);
  if (max - min > 20_000) return null;
  return { start: min, end: max };
}

function printBrowserLiveHostStatus(status: BrowserLiveHostStatus): void {
  if (!status.running) {
    console.log(chalk.dim('  Browser live host is stopped.'));
    return;
  }

  const controlUrl = status.controlPort
    ? `http://${status.host}:${status.controlPort}`
    : '(unknown)';
  console.log(chalk.green('\u2713') + ' Browser live host running.');
  console.log(chalk.dim(`  control=${controlUrl}`));
  console.log(
    chalk.dim(
      `  safe_ports=${status.safePorts.join(',')} scanned_candidates=${status.scannedCandidateCount} open_sessions=${status.openSessionCount}`,
    ),
  );
  console.log(
    chalk.dim(
      `  slots=${status.maxSessionSlots} required_ports=${status.requiredPortCount} peekaboo_screen=${String(status.includePeekabooScreen)} screen_actions=${String(status.screenActionsEnabled)}`,
    ),
  );

  for (const slot of status.slots) {
    const slotUrl = `http://${status.host}:${slot.port}`;
    const mapped = slot.sessionId
      ? `${chalk.cyan(slot.sessionId)} ${chalk.dim(slot.currentUrl ?? '(no-url)')}`
      : chalk.dim('idle');
    console.log(`  slot${slot.slotIndex + 1}: ${chalk.dim(slotUrl)} -> ${mapped}`);
  }

  if (status.includePeekabooScreen) {
    console.log(chalk.dim(`  screen=${controlUrl}/screen`));
  }
}

async function runLiveHost(tokens: string[], ctx: SlashContext): Promise<void> {
  const action = (tokens[1] ?? 'status').toLowerCase();
  const backgroundControl = ctx.config.computerControl.background;

  if (action === 'status') {
    try {
      printBrowserLiveHostStatus(await getBrowserLiveHostStatus());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.red('\u2717') + ` Browser live host status failed: ${message}`);
    }
    return;
  }

  if (action === 'stop') {
    try {
      const stopped = await stopBrowserLiveHost();
      printBrowserLiveHostStatus(stopped);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.red('\u2717') + ` Browser live host stop failed: ${message}`);
    }
    return;
  }

  if (action !== 'start') {
    printBrowserUsage();
    return;
  }

  let range: { start: number; end: number } | null = null;
  let screenMode: string | undefined;
  let sawScreenFlag = false;
  let sawRangeFlag = false;

  for (let index = 2; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token === '--range') {
      sawRangeFlag = true;
      const value = tokens[index + 1];
      range = parsePortRange(value);
      index += 1;
      continue;
    }
    if (token.startsWith('--range=')) {
      sawRangeFlag = true;
      range = parsePortRange(token.slice('--range='.length));
      continue;
    }
    if (token === '--screen') {
      sawScreenFlag = true;
      screenMode = tokens[index + 1];
      index += 1;
      continue;
    }
    if (token.startsWith('--screen=')) {
      sawScreenFlag = true;
      screenMode = token.slice('--screen='.length);
      continue;
    }
    printBrowserUsage();
    return;
  }

  if (sawScreenFlag && !screenMode?.trim()) {
    printBrowserUsage();
    return;
  }

  const normalizedScreenMode = screenMode?.trim().toLowerCase();
  if (normalizedScreenMode && normalizedScreenMode !== 'peekaboo') {
    printBrowserUsage();
    return;
  }

  if (sawRangeFlag && range === null) {
    printBrowserUsage();
    return;
  }

  if (!backgroundControl.allowScreenStreaming) {
    console.log(chalk.red('\u2717') + ' Background screen streaming is disabled.');
    console.log(chalk.dim('  Enable: computerControl.background.allowScreenStreaming'));
    return;
  }

  if (normalizedScreenMode === 'peekaboo') {
    const available = await isPeekabooAvailable();
    if (!available) {
      console.log(chalk.red('\u2717') + ' Peekaboo is required for screen mode.');
      console.log(chalk.dim('  Install: brew install peekaboo'));
      return;
    }
  }

  if (!backgroundControl.enabled) {
    console.log(chalk.red('\u2717') + ' Background computer control is disabled.');
    console.log(chalk.dim('  Enable: computerControl.background.enabled'));
    return;
  }

  if (!backgroundControl.allowBrowserSessionHosting) {
    console.log(chalk.red('\u2717') + ' Browser session hosting is disabled.');
    console.log(chalk.dim('  Enable: computerControl.background.allowBrowserSessionHosting'));
    return;
  }

  try {
    const maxSessionSlots = Math.max(
      1,
      Math.min(backgroundControl.maxHostedBrowserSessions, 5),
    );
    const started = await startBrowserLiveHost({
      config: ctx.config,
      maxSessionSlots,
      requiredPortCount: 6,
      includePeekabooScreen: normalizedScreenMode === 'peekaboo',
      portRangeStart: range?.start,
      portRangeEnd: range?.end,
    });
    printBrowserLiveHostStatus(started);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(chalk.red('\u2717') + ` Browser live host start failed: ${message}`);
  }
}

async function runTrendsCapture(hoursToken: string | undefined, limitToken: string | undefined): Promise<void> {
  const windowHours = parseTrendsWindowHours(hoursToken);
  const limit = parseTrendsLimit(limitToken);
  if (windowHours === null || limit === null) {
    printBrowserUsage();
    return;
  }

  const summary = await buildBrowserRunCorpusSummary(process.cwd(), {
    windowHours,
  });
  const paths = await writeBrowserRunCorpusSummary(process.cwd(), summary);

  console.log(chalk.green('\u2713') + ' Browser run trends captured.');
  console.log(chalk.dim(`  latest=${paths.latestPath}`));
  console.log(chalk.dim(`  snapshot=${paths.snapshotPath}`));
  console.log(chalk.dim(`  window_hours=${summary.windowHours} sessions=${summary.assessedSessionCount}`));
  console.log(
    chalk.dim(
      `  regression=${summary.regressionSessionCount} investigate=${summary.investigateSessionCount} max=${(summary.maxRegressionScore * 100).toFixed(1)}% mean=${(summary.meanRegressionScore * 100).toFixed(1)}%`,
    ),
  );

  if (summary.entries.length === 0) {
    console.log(chalk.dim('  No browser sessions in the selected window.'));
    return;
  }

  const ranked = [...summary.entries]
    .sort((left, right) => (
      right.regressionScore - left.regressionScore
      || Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      || left.sessionId.localeCompare(right.sessionId)
    ))
    .slice(0, limit);

  console.log(chalk.dim(`  top_sessions=${ranked.length}`));
  for (const entry of ranked) {
    const runSegment = entry.runId ? ` run=${entry.runId}` : '';
    console.log(
      `  ${chalk.cyan(entry.sessionId)}${runSegment} ${chalk.dim(
        `regression=${entry.regressionSignal}:${(entry.regressionScore * 100).toFixed(1)}% failures=${entry.failureCount} actions=${entry.actionCount} updated=${entry.updatedAt}`,
      )}`,
    );
  }
}

async function runCanaryCapture(hoursToken: string | undefined): Promise<void> {
  const windowHours = parseCanaryWindowHours(hoursToken);
  if (windowHours === null) {
    printBrowserUsage();
    return;
  }

  const evidence = await buildBrowserCanaryEvidence(process.cwd(), {
    windowHours,
    thresholds: DEFAULT_BROWSER_BENCHMARK_THRESHOLDS,
  });
  const paths = await writeBrowserCanaryEvidence(process.cwd(), evidence);
  const [latestBytes, snapshotBytes] = await Promise.all([
    browserCanaryEvidenceFileSize(paths.latestPath),
    browserCanaryEvidenceFileSize(paths.snapshotPath),
  ]);

  const statusColor = evidence.overallStatus === 'pass' ? chalk.green : chalk.red;
  console.log(chalk.green('\u2713') + ' Browser canary evidence captured.');
  console.log(chalk.dim(`  latest=${paths.latestPath}`));
  console.log(chalk.dim(`  snapshot=${paths.snapshotPath}`));
  console.log(chalk.dim(`  window_hours=${evidence.windowHours} sessions=${evidence.assessedSessionCount}`));
  console.log(statusColor(`  overall=${evidence.overallStatus} pass=${evidence.passCount} fail=${evidence.failCount}`));
  console.log(chalk.dim(`  rollback_drill=${evidence.rollbackDrill.status}`));
  console.log(chalk.dim(`  proof latest_bytes=${latestBytes ?? '-'} snapshot_bytes=${snapshotBytes ?? '-'}`));
}

async function runCanaryRollback(
  statusToken: string | undefined,
  notesTokens: string[],
): Promise<void> {
  const normalizedStatus = (statusToken ?? '').toLowerCase();
  if (normalizedStatus !== 'pass' && normalizedStatus !== 'fail') {
    printBrowserUsage();
    return;
  }

  const updated = await updateBrowserCanaryRollbackDrill(process.cwd(), {
    status: normalizedStatus,
    notes: notesTokens.join(' ').trim() || undefined,
  });

  if (!updated) {
    console.log(chalk.dim('  No canary evidence found. Run /browser canary first.'));
    console.log(chalk.dim(`  Expected: ${browserCanaryLatestPath(process.cwd())}`));
    return;
  }

  const latestPath = browserCanaryLatestPath(process.cwd());
  const latestBytes = await browserCanaryEvidenceFileSize(latestPath);

  const statusColor = normalizedStatus === 'pass' ? chalk.green : chalk.red;
  console.log(chalk.green('\u2713') + ' Canary rollback drill updated.');
  console.log(chalk.dim(`  latest=${latestPath}`));
  console.log(statusColor(`  rollback_drill=${normalizedStatus}`));
  if (updated.rollbackDrill.executedAt) {
    console.log(chalk.dim(`  executed_at=${updated.rollbackDrill.executedAt}`));
  }
  if (updated.rollbackDrill.notes) {
    console.log(chalk.dim(`  notes=${updated.rollbackDrill.notes}`));
  }
  console.log(chalk.dim(`  proof latest_bytes=${latestBytes ?? '-'}`));
}

const browserHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const action = (tokens[0] ?? 'status').toLowerCase();

  if (action === 'host') {
    await runLiveHost(tokens, ctx);
    return 'handled';
  }

  if (action === 'profiles') {
    const subcommand = (tokens[1] ?? '').toLowerCase();

    if (!subcommand) {
      await printProfiles(ctx);
      return 'handled';
    }

    if (subcommand !== 'prune' || tokens.length > 3) {
      printBrowserUsage();
      return 'handled';
    }

    const sessionId = tokens[2];
    if (sessionId && (sessionId.includes('/') || sessionId.includes('\\'))) {
      printBrowserUsage();
      return 'handled';
    }

    try {
      await pruneProfiles(ctx, sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Invalid browser profile session id')) {
        printBrowserUsage();
        return 'handled';
      }
      throw error;
    }
    return 'handled';
  }

  if (action === 'approvals') {
    if (tokens.length > 2) {
      printBrowserUsage();
      return 'handled';
    }

    const limit = parseApprovalsLimit(tokens[1]);
    if (limit === null) {
      printBrowserUsage();
      return 'handled';
    }

    await printApprovals(limit);
    return 'handled';
  }

  if (action === 'canary') {
    const subcommand = (tokens[1] ?? '').toLowerCase();
    if (!subcommand) {
      await runCanaryCapture(undefined);
      return 'handled';
    }

    if (subcommand === 'rollback') {
      await runCanaryRollback(tokens[2], tokens.slice(3));
      return 'handled';
    }

    await runCanaryCapture(subcommand);
    return 'handled';
  }

  if (action === 'trends') {
    if (tokens.length > 3) {
      printBrowserUsage();
      return 'handled';
    }
    await runTrendsCapture(tokens[1], tokens[2]);
    return 'handled';
  }

  if (action === 'replay') {
    const sessionId = tokens[1];
    if (!sessionId) {
      printBrowserUsage();
      return 'handled';
    }

    const replay = await summarizeBrowserReplay(process.cwd(), sessionId);
    if (!replay) {
      console.log(chalk.yellow(`  Replay not found for browser session "${sessionId}".`));
      return 'handled';
    }

    console.log(chalk.green('\u2713') + ` Replay summary for ${chalk.cyan(replay.sessionId)}`);
    const runSegment = replay.runId ? ` run=${replay.runId}` : '';
    console.log(chalk.dim(`  status=${replay.status} runtime=${replay.runtime}${runSegment}`));
    console.log(chalk.dim(`  actions=${replay.actionCount} failures=${replay.failureCount} artifacts=${replay.artifactCount}`));
    const regressionScorePct = `${(replay.regressionScore * 100).toFixed(1)}%`;
    console.log(chalk.dim(`  regression=${replay.regressionSignal} score=${regressionScorePct} pairs=${replay.regressionPairCount}`));
    console.log(chalk.dim(`  last_action=${replay.lastActionAt}`));
    console.log(chalk.dim(`  updated=${replay.lastUpdatedAt}`));
    return 'handled';
  }

  if (!BROWSER_CONTROL_ACTIONS.includes(action as BrowserControlAction)) {
    printBrowserUsage();
    return 'handled';
  }

  const result = await runBrowserControlAction(action as BrowserControlAction, ctx.config);
  printStatus(result);
  return 'handled';
};

export const browserCommands: SlashCommandDef[] = [
  {
    command: 'browser',
    aliases: ['br'],
    description: 'Browser runtime controls and approval log view',
    handler: browserHandler,
    category: 'tools',
    usage: '/browser [status|pause|resume|stop|kill|replay <session_id>|approvals [limit]|profiles [prune [session_id]]|trends [hours] [limit]|canary [hours]|canary rollback <pass|fail> [notes]|host [start|status|stop] [--range start-end] [--screen peekaboo]]',
    examples: [
      '/browser',
      '/browser status',
      '/browser pause',
      '/browser resume',
      '/browser kill',
      '/browser replay sess-001',
      '/browser approvals',
      '/browser approvals 20',
      '/browser profiles',
      '/browser profiles prune',
      '/browser profiles prune sess-001',
      '/browser trends',
      '/browser trends 24 10',
      '/browser canary',
      '/browser canary 24',
      '/browser canary rollback pass Rehearsal completed in 3m',
      '/browser host start',
      '/browser host start --range 46000-47000',
      '/browser host start --screen peekaboo',
      '/browser host status',
      '/browser host stop',
    ],
  },
];
