import chalk from 'chalk';

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

  getPromptDisplay(): string {
    switch (this.options.mode) {
      case 'shell': return chalk.yellow('!') + chalk.dim(' >');
      case 'plan': return chalk.magenta('plan') + chalk.dim(' >');
      case 'auto': return chalk.yellow('auto') + chalk.dim(' >');
      default: return chalk.cyan('>');
    }
  }
}
