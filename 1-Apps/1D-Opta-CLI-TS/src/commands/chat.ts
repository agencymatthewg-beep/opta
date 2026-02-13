import chalk from 'chalk';

interface ChatOptions {
  resume?: string;
  plan?: boolean;
  model?: string;
}

export async function startChat(_opts: ChatOptions): Promise<void> {
  console.log(chalk.yellow('chat') + ' — Not yet implemented (Phase 4)');
}
