import chalk from 'chalk';
import { isTTY } from './output.js';
import { estimateTokens } from '../utils/tokens.js';

/**
 * ThinkingRenderer — displays model thinking/reasoning in a distinct dim block.
 *
 * Handles two patterns:
 * 1. `<think>...</think>` — explicit tags (non-streaming or some models)
 * 2. No opening tag, but `</think>` appears — everything before it was thinking
 *    (MiniMax M2.5 streaming behavior)
 *
 * Approach: Buffer ALL content until we see `</think>` or enough non-thinking
 * content to know thinking is over. This avoids showing thinking as normal text
 * then trying to retract it.
 */
export class ThinkingRenderer {
  private buffer = '';
  private thinkingDone = false;
  private thinkText = '';
  private headerPrinted = false;
  private thinkingDisplayed = false;

  /**
   * Process a streaming chunk. Returns visible (non-thinking) content.
   */
  process(chunk: string): string {
    // Once thinking is done, pass through everything
    if (this.thinkingDone) {
      return this.cleanOutput(chunk);
    }

    this.buffer += chunk;

    // Check for </think> in the accumulated buffer
    const endIdx = this.buffer.indexOf('</think>');
    if (endIdx !== -1) {
      // Everything before </think> is thinking
      let thinkContent = this.buffer.slice(0, endIdx);
      // Strip opening <think> tag if present
      if (thinkContent.startsWith('<think>')) {
        thinkContent = thinkContent.slice(7);
      }
      this.thinkText = thinkContent;
      this.displayThinking(thinkContent);
      this.thinkingDone = true;

      // Everything after </think> is real content
      const after = this.buffer.slice(endIdx + 8);
      this.buffer = '';
      return this.cleanOutput(after);
    }

    // Haven't seen </think> yet. If buffer is getting large (>2000 chars)
    // and no </think>, this model probably doesn't use thinking tags.
    // Release the buffer as normal content.
    if (this.buffer.length > 2000) {
      this.thinkingDone = true;
      const content = this.buffer;
      this.buffer = '';
      return this.cleanOutput(content);
    }

    // Still buffering — show thinking indicator once if we have content
    // Don't stream every chunk - that causes shaking
    if (this.buffer.length > 100 && !this.headerPrinted && isTTY) {
      process.stdout.write(chalk.dim('\n  ⚙ thinking...\n'));
      this.headerPrinted = true;
      this.thinkingDisplayed = true;
    }
    // Skip streaming individual chunks - just buffer until complete
    // This prevents the "shaking" effect from rapid stdout updates

    return ''; // Buffer everything until we know
  }

  /** Flush at end of stream. */
  flush(): string {
    if (this.thinkingDone) {
      return this.cleanOutput(this.buffer);
    }
    // Stream ended without </think> — this wasn't thinking, release as content
    const content = this.buffer;
    this.buffer = '';
    this.thinkingDone = true;
    return this.cleanOutput(content);
  }

  get isThinking(): boolean {
    return !this.thinkingDone;
  }

  private displayThinking(text: string): void {
    if (!isTTY) return;

    const tokens = estimateTokens(text);

    // Simply show the thinking indicator - don't try to clear/replace lines (causes shaking)
    // The final thinking will be shown when complete via getCollapsedSummary()
    if (!this.thinkingDisplayed) {
      process.stdout.write(chalk.dim(`  ⚙ thinking (${tokens} tokens)\n`));
      this.thinkingDisplayed = true;
    }
  }

  /** Get the raw thinking text (for toggle display). */
  getThinkingText(): string {
    return this.thinkText;
  }

  /** Whether the renderer captured any thinking content. */
  hasThinking(): boolean {
    return this.thinkText.length > 0;
  }

  /** Generate a one-line collapsed summary showing token count. */
  getCollapsedSummary(): string {
    const tokens = estimateTokens(this.thinkText);
    return chalk.dim(`  ⚙ thinking (${tokens} tokens) `) + chalk.dim.italic('[/expand to view]');
  }

  /** Generate a full expanded view of the thinking content. */
  getExpandedView(): string {
    const lines = this.thinkText.split('\n');
    const formatted = lines.map(l => chalk.dim('  │ ') + chalk.dim.italic(l)).join('\n');
    const tokens = estimateTokens(this.thinkText);
    return chalk.dim(`  ⚙ thinking (${tokens} tokens)\n`) + formatted + '\n' + chalk.dim('  └─');
  }

  /** Clean output text of any residual tags. */
  private cleanOutput(text: string): string {
    return text
      .replace(/<\/?think>/g, '')
      .replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/g, '')
      .replace(/<minimax:tool_call>[\s\S]*/g, ''); // unclosed tool_call at end
  }
}

/**
 * Strip thinking and tool call XML from text (for message history).
 */
export function stripThinkTags(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/g, '')
    .replace(/[\s\S]*<\/think>/g, '') // Handle no opening tag case
    .trim();
}
