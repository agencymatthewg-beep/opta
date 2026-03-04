import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import {
  BROWSER_CONTROL_ACTIONS,
  runBrowserControlAction,
  type BrowserControlAction,
} from '../browser/control-surface.js';
import {
  getBrowserLiveHostStatus,
  startBrowserLiveHost,
  stopBrowserLiveHost,
  type BrowserLiveHostStatus,
} from '../browser/live-host.js';
import { isPeekabooAvailable } from '../browser/peekaboo.js';
import { OptaError, ExitError, EXIT } from '../core/errors.js';

type BrowserCommandAction = BrowserControlAction;
type BrowserHostAction = 'status' | 'start' | 'stop';

interface BrowserCommandOptions {
  json?: boolean;
}

interface BrowserHostCommandOptions {
  range?: string;
  screen?: string;
  json?: boolean;
}

function isBrowserAction(value: string): value is BrowserCommandAction {
  return BROWSER_CONTROL_ACTIONS.includes(value as BrowserControlAction);
}

function parsePortRange(raw: string | undefined): { start: number; end: number } | null {
  if (!raw) return null;
  const match = raw.match(/^(\d+)-(\d+)$/);
  if (!match) return null;
  const startRaw = Number.parseInt(match[1] ?? '', 10);
  const endRaw = Number.parseInt(match[2] ?? '', 10);
  if (!Number.isInteger(startRaw) || !Number.isInteger(endRaw)) return null;
  if (startRaw < 1024 || endRaw < 1024 || startRaw > 65_535 || endRaw > 65_535) return null;
  const start = Math.min(startRaw, endRaw);
  const end = Math.max(startRaw, endRaw);
  if (end - start > 20_000) return null;
  return { start, end };
}

function maskToken(token: string | undefined): string {
  if (!token) return '-';
  if (token.length <= 10) return `${token.slice(0, 2)}***${token.slice(-2)}`;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function printLiveHostStatus(status: BrowserLiveHostStatus): void {
  if (!status.running) {
    console.log(chalk.dim('• Browser live host is stopped.'));
    return;
  }

  const controlUrl = status.controlPort ? `http://${status.host}:${status.controlPort}` : '(unknown)';
  console.log(chalk.green('✓') + ' browser live host running');
  console.log(chalk.dim(`  control: ${controlUrl}`));
  console.log(chalk.dim(`  viewer_token: ${maskToken(status.viewerAuthToken)}`));
  console.log(
    chalk.dim(
      `  safe_ports: ${status.safePorts.join(', ')}  scanned: ${status.scannedCandidateCount}  open_sessions: ${status.openSessionCount}`,
    ),
  );
  console.log(
    chalk.dim(
      `  slots: ${status.maxSessionSlots}  required_ports: ${status.requiredPortCount}  peekaboo_screen: ${String(status.includePeekabooScreen)}  screen_actions: ${String(status.screenActionsEnabled)}`,
    ),
  );

  for (const slot of status.slots) {
    const slotUrl = `http://${status.host}:${slot.port}`;
    const mapped = slot.sessionId
      ? `${chalk.cyan(slot.sessionId)} ${chalk.dim(slot.currentUrl ?? '(no-url)')}`
      : chalk.dim('idle');
    console.log(`  slot${slot.slotIndex + 1}: ${chalk.dim(slotUrl)} -> ${mapped}`);
  }
}

export async function browser(action: string | undefined, opts: BrowserCommandOptions): Promise<void> {
  const effectiveAction = (action ?? 'status').toLowerCase();
  if (!isBrowserAction(effectiveAction)) {
    throw new OptaError(
      `Unknown browser action: ${effectiveAction}`,
      EXIT.MISUSE,
      ['Valid actions: status, start, pause, resume, stop, kill'],
    );
  }

  const config = await loadConfig();
  const result = await runBrowserControlAction(effectiveAction, config);
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const marker = result.ok ? chalk.green('✓') : chalk.yellow('!');
  console.log(marker + ` ${result.message}`);
  console.log(
    chalk.dim(
      `  running=${result.health.running} paused=${result.health.paused} killed=${result.health.killed} sessions=${result.health.sessionCount}/${result.health.maxSessions}`,
    ),
  );
}

export async function browserHost(
  action: string | undefined,
  opts: BrowserHostCommandOptions,
): Promise<void> {
  const effectiveAction = (action ?? 'status').toLowerCase() as BrowserHostAction;
  if (!['status', 'start', 'stop'].includes(effectiveAction)) {
    throw new OptaError(
      `Unknown browser host action: ${effectiveAction}`,
      EXIT.MISUSE,
      ['Valid actions: status, start, stop'],
    );
  }

  if (effectiveAction === 'status') {
    const status = await getBrowserLiveHostStatus();
    if (opts.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    printLiveHostStatus(status);
    return;
  }

  if (effectiveAction === 'stop') {
    const status = await stopBrowserLiveHost();
    if (opts.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }
    printLiveHostStatus(status);
    return;
  }

  const range = parsePortRange(opts.range);
  if (opts.range && range === null) {
    throw new ExitError(EXIT.MISUSE);
  }

  const requestedScreen = opts.screen?.trim().toLowerCase();
  if (requestedScreen && requestedScreen !== 'peekaboo') {
    throw new OptaError(
      `Unsupported --screen mode: ${opts.screen}`,
      EXIT.MISUSE,
      ['Supported screen modes: peekaboo'],
    );
  }

  if (requestedScreen === 'peekaboo') {
    const available = await isPeekabooAvailable();
    if (!available) {
      throw new OptaError(
        'Peekaboo is required for --screen peekaboo',
        EXIT.MISUSE,
        ['Install with: brew install peekaboo'],
      );
    }
  }

  const config = await loadConfig();
  const maxSessionSlots = Math.max(
    1,
    Math.min(config.computerControl.background.maxHostedBrowserSessions, 5),
  );

  const status = await startBrowserLiveHost({
    config,
    maxSessionSlots,
    requiredPortCount: 6,
    includePeekabooScreen: requestedScreen === 'peekaboo',
    portRangeStart: range?.start,
    portRangeEnd: range?.end,
  });

  if (opts.json) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  printLiveHostStatus(status);
}
