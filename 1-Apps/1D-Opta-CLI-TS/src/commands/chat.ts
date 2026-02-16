import chalk from 'chalk';
import { loadConfig } from '../core/config.js';
import { agentLoop, buildSystemPrompt } from '../core/agent.js';
import type { AgentMessage } from '../core/agent.js';
import { formatError, OptaError, EXIT } from '../core/errors.js';
import {
  createSession,
  loadSession,
  saveSession,
  generateTitle,
} from '../memory/store.js';
import type { Session } from '../memory/store.js';

interface ChatOptions {
  resume?: string;
  plan?: boolean;
  model?: string;
}

export async function startChat(opts: ChatOptions): Promise<void> {
  const overrides: Record<string, unknown> = {};
  if (opts.model) {
    overrides['model'] = { default: opts.model };
  }

  let config = await loadConfig(overrides);

  if (!config.model.default) {
    console.error(
      chalk.red('✗') +
        ' No model configured\n\n' +
        chalk.dim('Run ') +
        chalk.cyan('opta status') +
        chalk.dim(' to check your LMX connection')
    );
    process.exit(EXIT.NO_CONNECTION);
  }

  // Create or resume session
  let session: Session;
  if (opts.resume) {
    try {
      session = await loadSession(opts.resume);
      console.log(
        chalk.dim(
          `opta · ${session.model} · ${config.connection.host}:${config.connection.port}`
        )
      );
      console.log(chalk.dim(`Session: ${session.id} (resumed)`));
      if (session.title) {
        console.log(chalk.dim(`  "${session.title}"`));
      }
    } catch {
      console.error(
        chalk.red('✗') + ` Session not found: ${opts.resume}\n\n` +
        chalk.dim('Run ') + chalk.cyan('opta sessions') + chalk.dim(' to list available sessions')
      );
      process.exit(EXIT.NOT_FOUND);
    }
  } else {
    session = await createSession(config.model.default);
    // Initialize system prompt for new session
    const systemPrompt = await buildSystemPrompt(config);
    session.messages = [{ role: 'system', content: systemPrompt }];
    await saveSession(session);

    console.log(
      chalk.dim(
        `opta · ${config.model.default} · ${config.connection.host}:${config.connection.port}`
      )
    );
    console.log(chalk.dim(`Session: ${session.id} (new)`));
  }

  console.log(
    chalk.dim('Type /help for commands, /exit to quit\n')
  );

  // REPL loop
  const { input } = await import('@inquirer/prompts');

  while (true) {
    let userInput: string;
    try {
      userInput = await input({ message: chalk.cyan('you:') });
    } catch {
      // Ctrl+C or EOF
      await saveSession(session);
      console.log(chalk.dim(`\nSession saved: ${session.id}`));
      break;
    }

    if (!userInput.trim()) continue;

    // Slash commands
    if (userInput.startsWith('/')) {
      const handled = await handleSlashCommand(userInput, session, config);
      if (handled === 'exit') {
        await saveSession(session);
        console.log(
          chalk.dim(`Session saved: ${session.id}`) +
            (session.title ? chalk.dim(` "${session.title}"`) : '')
        );
        break;
      }
      if (handled === 'model-switched') {
        // Reload config to pick up model change
        config = await loadConfig(overrides);
      }
      continue;
    }

    // Set title from first user message
    if (!session.title) {
      session.title = generateTitle(userInput);
    }

    try {
      const result = await agentLoop(userInput, config, {
        existingMessages: session.messages,
      });

      session.messages = result.messages;
      session.toolCallCount += result.toolCallCount;
      await saveSession(session);
    } catch (err) {
      if (err instanceof OptaError) {
        console.error(formatError(err));
      } else {
        console.error(chalk.red('✗') + ` ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

// --- Slash Command Handler ---

type SlashResult = 'handled' | 'exit' | 'model-switched';

async function handleSlashCommand(
  input: string,
  session: Session,
  config: import('../core/config.js').OptaConfig
): Promise<SlashResult> {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0]!.toLowerCase();
  const arg = parts.slice(1).join(' ');

  switch (cmd) {
    case '/exit':
    case '/quit':
    case '/q':
      return 'exit';

    case '/help':
    case '/h':
    case '/?':
      console.log('\n' + chalk.bold('Commands:'));
      console.log('  /exit         Save and exit');
      console.log('  /model <name> Switch model');
      console.log('  /history      Show conversation summary');
      console.log('  /compact      Force context compaction');
      console.log('  /clear        Clear screen');
      console.log('  /help         Show this help');
      console.log();
      return 'handled';

    case '/model':
      if (!arg) {
        console.log(chalk.dim(`  Current model: ${config.model.default}`));
        return 'handled';
      }
      try {
        const { saveConfig } = await import('../core/config.js');
        await saveConfig({ model: { default: arg } });
        session.model = arg;
        console.log(chalk.green('✓') + ` Switched to ${arg}`);
        return 'model-switched';
      } catch (err) {
        console.error(chalk.red('✗') + ` Failed to switch model: ${err}`);
        return 'handled';
      }

    case '/history': {
      const userMessages = session.messages.filter(
        (m: AgentMessage) => m.role === 'user' || m.role === 'assistant'
      );
      if (userMessages.length === 0) {
        console.log(chalk.dim('  No messages yet'));
        return 'handled';
      }
      console.log();
      userMessages.forEach((m: AgentMessage, i: number) => {
        const role = m.role === 'user' ? chalk.cyan('user') : chalk.green('assistant');
        const content = (m.content ?? '').slice(0, 80).replace(/\n/g, ' ');
        const toolCount = m.tool_calls?.length;
        const suffix = toolCount ? chalk.dim(` (${toolCount} tool calls)`) : '';
        console.log(`  ${i + 1}. [${role}] ${content}${suffix}`);
      });
      console.log();
      return 'handled';
    }

    case '/compact': {
      console.log(chalk.dim('  Context compaction will happen automatically on next turn'));
      // Force compaction by setting messages to trigger threshold
      // The agent loop handles this automatically
      return 'handled';
    }

    case '/clear':
      console.clear();
      return 'handled';

    default:
      console.log(chalk.yellow(`  Unknown command: ${cmd}`) + chalk.dim(' (try /help)'));
      return 'handled';
  }
}
