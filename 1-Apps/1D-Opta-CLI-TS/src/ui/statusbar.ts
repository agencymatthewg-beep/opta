import chalk from 'chalk';
import { isTTY } from './output.js';

export interface StatusBarConfig {
  model: string;
  sessionId: string;
}

/**
 * StatusBar — inline summary after each response.
 * Does NOT use persistent bottom-of-terminal rendering (causes flicker with streaming).
 * Instead: silent during streaming, prints summary line after each turn.
 */
export class StatusBar {
  private config: StatusBarConfig;
  private completionTokens = 0;
  private promptTokens = 0;
  private toolCalls = 0;
  private startTime = 0;
  private cumulativeTokens = 0;
  private cumulativeTools = 0;
  private enabled: boolean;

  constructor(config: StatusBarConfig) {
    this.config = config;
    this.enabled = isTTY;
  }

  private shortModel(): string {
    const m = this.config.model;
    if (m.includes('MiniMax-M2.5')) {
      const quant = m.match(/([\d]+bit)/)?.[1] ?? '';
      return `M2.5${quant ? '-' + quant : ''}`;
    }
    if (m.includes('GLM-5')) return 'GLM-5';
    const last = m.split('/').pop() ?? m;
    return last.length > 20 ? last.slice(0, 20) : last;
  }

  private formatTokens(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
  }

  newTurn(): void {
    this.completionTokens = 0;
    this.promptTokens = 0;
    this.toolCalls = 0;
    this.startTime = 0;
  }

  markStart(): void {
    if (!this.startTime) this.startTime = Date.now();
  }

  update(tokenDelta: number): void {
    this.completionTokens += tokenDelta;
  }

  setPromptTokens(n: number): void {
    this.promptTokens = n;
  }

  addToolCall(): void {
    this.toolCalls++;
    this.cumulativeTools++;
  }

  finalizeTurn(): void {
    this.cumulativeTokens += this.promptTokens + this.completionTokens;
  }

  /** No-op — no persistent bar to clear. */
  render(_force = false): void {}
  clear(): void {}

  /** Print a summary line after the response completes. */
  printSummary(): void {
    if (!this.enabled) return;
    const elapsed = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
    const speed = elapsed > 0.1 ? this.completionTokens / elapsed : 0;
    const total = this.promptTokens + this.completionTokens;

    const parts: string[] = [];
    parts.push(`~${this.formatTokens(total)} tokens`);
    parts.push(`${this.toolCalls} tool call${this.toolCalls !== 1 ? 's' : ''}`);
    if (speed > 0) parts.push(`${speed.toFixed(0)} t/s`);
    if (elapsed > 0) parts.push(`${elapsed.toFixed(1)}s`);

    console.log(chalk.dim(`  ${parts.join(' · ')}`));
  }
}
