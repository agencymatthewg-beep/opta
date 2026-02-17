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
    const mode = this.getEffectiveMode();
    switch (mode) {
      case 'shell': return chalk.yellow('!') + chalk.dim(' >');
      case 'plan': return chalk.magenta('plan') + chalk.dim(' >');
      case 'auto': return chalk.yellow('auto') + chalk.dim(' >');
      default: return chalk.cyan('>');
    }
  }
}
