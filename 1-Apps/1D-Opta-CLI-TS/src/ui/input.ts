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

  getPromptDisplay(): string {
    switch (this.options.mode) {
      case 'shell': return chalk.yellow('!') + chalk.dim(' >');
      case 'plan': return chalk.magenta('plan') + chalk.dim(' >');
      case 'auto': return chalk.yellow('auto') + chalk.dim(' >');
      default: return chalk.cyan('>');
    }
  }
}
