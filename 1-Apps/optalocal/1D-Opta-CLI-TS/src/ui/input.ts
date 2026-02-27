import chalk from 'chalk';
import { probeLmxConnection } from '../lmx/connection.js';
import { resolveLmxEndpoint } from '../lmx/endpoints.js';
import { errorMessage } from '../utils/errors.js';

// --- Connection Status Indicator ---

let connectionStatus: 'connected' | 'degraded' | 'disconnected' = 'disconnected';
let connectionStatusDetail = '';
let connectionCheckInterval: ReturnType<typeof setInterval> | null = null;

export function getConnectionStatus(): 'connected' | 'degraded' | 'disconnected' {
  return connectionStatus;
}

export function getConnectionStatusDetail(): string {
  return connectionStatusDetail;
}

export function getConnectionDot(): string {
  switch (connectionStatus) {
    case 'connected': return chalk.green('\u25cf');
    case 'degraded': return chalk.yellow('\u25cf');
    case 'disconnected': return chalk.red('\u25cf');
  }
}

export async function checkConnection(
  host: string,
  port: number,
  fallbackHosts: string[] = [],
  adminKey?: string,
): Promise<void> {
  try {
    const endpoint = await resolveLmxEndpoint({
      host,
      fallbackHosts,
      port,
      adminKey,
    }, { timeoutMs: 1000 });
    const result = await probeLmxConnection(endpoint.host, port, { timeoutMs: 2000, adminKey });
    if (result.state === 'connected') {
      connectionStatus = 'connected';
      connectionStatusDetail = '';
    } else if (result.state === 'degraded') {
      connectionStatus = 'degraded';
      connectionStatusDetail = result.reason ? String(result.reason) : 'LMX reachable but not ready';
    } else {
      connectionStatus = 'disconnected';
      connectionStatusDetail = result.reason ? String(result.reason) : 'LMX disconnected';
    }
  } catch (err) {
    // Connection failed - set status to disconnected
    // Log details for debugging if in verbose mode
    if (process.env.OPTA_DEBUG) {
      console.error('Connection check failed:', err);
    }
    connectionStatus = 'disconnected';
    connectionStatusDetail = errorMessage(err);
  }
}

/**
 * Start periodic connection checks (every 60s).
 * Returns a cleanup function to stop the interval.
 */
export function startConnectionMonitor(
  host: string,
  port: number,
  fallbackHosts: string[] = [],
  adminKey?: string,
): () => void {
  // Run initial check immediately
  checkConnection(host, port, fallbackHosts, adminKey).catch((err: unknown) => {
    if (process.env.OPTA_DEBUG) {
      console.error('Initial connection check failed:', err);
    }
  });

  // Set up periodic checks
  connectionCheckInterval = setInterval(() => {
    checkConnection(host, port, fallbackHosts, adminKey).catch((err: unknown) => {
      if (process.env.OPTA_DEBUG) {
        console.error('Periodic connection check failed:', err);
      }
    });
  }, 60_000);

  return () => {
    if (connectionCheckInterval) {
      clearInterval(connectionCheckInterval);
      connectionCheckInterval = null;
    }
  };
}

// --- Input Editor ---

export interface InputEditorOptions {
  prompt: string;
  multiline?: boolean;
  mode?: 'normal' | 'shell' | 'plan' | 'auto';
}

export class InputEditor {
  private buffer = '';
  private cursor = 0;
  private options: Required<InputEditorOptions>;

  constructor(options: InputEditorOptions) {
    this.options = {
      prompt: options.prompt,
      multiline: options.multiline ?? false,
      mode: options.mode ?? 'normal',
    };
  }

  getBuffer(): string {
    return this.buffer;
  }

  getCursor(): number {
    return this.cursor;
  }

  setBuffer(text: string): void {
    this.buffer = text;
    this.cursor = text.length;
  }

  deleteBackward(): void {
    if (this.cursor === 0) return;
    this.buffer =
      this.buffer.slice(0, this.cursor - 1) + this.buffer.slice(this.cursor);
    this.cursor--;
  }

  deleteForward(): void {
    if (this.cursor >= this.buffer.length) return;
    this.buffer =
      this.buffer.slice(0, this.cursor) + this.buffer.slice(this.cursor + 1);
  }

  moveLeft(): void {
    if (this.cursor > 0) this.cursor--;
  }

  moveRight(): void {
    if (this.cursor < this.buffer.length) this.cursor++;
  }

  moveToStart(): void {
    // Move to start of current line
    const before = this.buffer.slice(0, this.cursor);
    const lastNewline = before.lastIndexOf('\n');
    this.cursor = lastNewline + 1;
  }

  moveToEnd(): void {
    // Move to end of current line
    const after = this.buffer.indexOf('\n', this.cursor);
    this.cursor = after === -1 ? this.buffer.length : after;
  }

  insertText(text: string): void {
    this.buffer =
      this.buffer.slice(0, this.cursor) + text + this.buffer.slice(this.cursor);
    this.cursor += text.length;
  }

  clear(): void {
    this.buffer = '';
    this.cursor = 0;
  }

  insertNewline(): void {
    if (!this.options.multiline) return;
    this.buffer =
      this.buffer.slice(0, this.cursor) + '\n' + this.buffer.slice(this.cursor);
    this.cursor += 1;
  }

  getLineCount(): number {
    return this.buffer.split('\n').length;
  }

  getCursorLine(): number {
    return this.buffer.slice(0, this.cursor).split('\n').length - 1;
  }

  getCursorCol(): number {
    const lines = this.buffer.slice(0, this.cursor).split('\n');
    return lines[lines.length - 1]!.length;
  }

  isShellMode(): boolean {
    return this.buffer.startsWith('!');
  }

  getShellCommand(): string | null {
    if (!this.isShellMode()) return null;
    return this.buffer.slice(1).trim();
  }

  private cancelled = false;

  handleEscape(): void {
    if (this.buffer.length > 0) {
      this.clear();
    } else {
      this.cancelled = true;
    }
  }

  shouldCancel(): boolean {
    return this.cancelled;
  }

  resetCancel(): void {
    this.cancelled = false;
  }

  private pastedContent: string | null = null;

  handlePaste(text: string): { isPaste: boolean; lineCount: number; abbreviated: string; fullContent: string } {
    const lines = text.split('\n');
    const isPaste = lines.length > 1;

    if (isPaste) {
      this.pastedContent = text;
      const abbreviated = `[Pasted ~${lines.length} lines]`;
      this.insertText(abbreviated);
      return { isPaste: true, lineCount: lines.length, abbreviated, fullContent: text };
    }

    this.insertText(text);
    return { isPaste: false, lineCount: 1, abbreviated: text, fullContent: text };
  }

  getSubmitText(): string {
    if (this.pastedContent) {
      return this.buffer.replace(/\[Pasted ~\d+ lines\]/, this.pastedContent);
    }
    return this.buffer;
  }

  setMode(mode: InputEditorOptions['mode']): void {
    this.options.mode = mode ?? 'normal';
  }

  getEffectiveMode(): string {
    if (this.isShellMode()) return 'shell';
    return this.options.mode;
  }

  getPromptDisplay(): string {
    const dot = getConnectionDot();
    const detail = getConnectionStatusDetail();
    const detailSuffix = detail && getConnectionStatus() !== 'connected'
      ? chalk.dim(` (${detail.slice(0, 40)})`)
      : '';
    const mode = this.getEffectiveMode();
    switch (mode) {
      case 'shell': return `${dot} ${chalk.yellow('!')}${chalk.dim(' >')}${detailSuffix}`;
      case 'plan': return `${dot} ${chalk.magenta('plan')}${chalk.dim(' >')}${detailSuffix}`;
      case 'auto': return `${dot} ${chalk.yellow('auto')}${chalk.dim(' >')}${detailSuffix}`;
      default: return `${dot} ${chalk.cyan('>')}${detailSuffix}`;
    }
  }
}
