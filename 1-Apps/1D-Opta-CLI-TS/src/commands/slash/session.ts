/**
 * Session-related slash commands: /exit, /clear, /save, /share, /export, /sessions, /init, /editor, /image
 */

import chalk from 'chalk';
import { errorMessage } from '../../utils/errors.js';
import { agentLoop } from '../../core/agent.js';
import { generateTitle, saveSession } from '../../memory/store.js';
import { estimateTokens, formatTokens } from '../../utils/tokens.js';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

const exitHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  return 'exit';
};

const clearHandler = async (_args: string, _ctx: SlashContext): Promise<SlashResult> => {
  console.clear();
  return 'handled';
};

const shareHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { select } = await import('@inquirer/prompts');
  const { formatSessionExport } = await import('../share.js');
  type ExportFormat = import('../share.js').ExportFormat;

  let format: ExportFormat = 'markdown';
  try {
    format = await select<ExportFormat>({
      message: chalk.dim('Export format'),
      choices: [
        { name: 'Markdown (.md)', value: 'markdown' as ExportFormat },
        { name: 'JSON (.json)', value: 'json' as ExportFormat },
        { name: 'Plain text (.txt)', value: 'text' as ExportFormat },
      ],
    });
  } catch {
    return 'handled'; // Ctrl+C
  }

  const ext = format === 'json' ? 'json' : format === 'text' ? 'txt' : 'md';
  const filename = `opta-session-${ctx.session.id.slice(0, 8)}-${Date.now()}.${ext}`;
  const filepath = join(process.cwd(), filename);

  const content = formatSessionExport(ctx.session, format);
  await writeFile(filepath, content, 'utf-8');
  console.log(chalk.green('\u2713') + ` Exported to ${chalk.cyan(filename)}`);
  return 'handled';
};

const sessionsHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { listSessions, deleteSession, loadSession: loadSess } = await import('../../memory/store.js');
  const { formatSessionExport } = await import('../share.js');
  const { select } = await import('@inquirer/prompts');
  const allSessions = await listSessions();
  if (allSessions.length === 0) {
    console.log(chalk.dim('  No saved sessions'));
    return 'handled';
  }

  const items = allSessions.slice(0, 15);
  const choices = items.map(s => {
    const isCurrent = s.id === ctx.session.id;
    const dot = isCurrent ? chalk.green('\u25cf ') : '  ';
    const title = (s.title || 'Untitled').slice(0, 30);
    const meta = chalk.dim(`${s.messageCount} msgs \u00b7 ${new Date(s.created).toLocaleDateString()}`);
    return {
      name: `${dot}${s.id.slice(0, 8)}  ${title}  ${meta}`,
      value: s.id,
    };
  });

  let selectedId: string;
  try {
    selectedId = await select({
      message: chalk.dim('Select session'),
      choices,
    });
  } catch {
    return 'handled'; // Ctrl+C
  }

  // Action picker for selected session
  const isCurrent = selectedId === ctx.session.id;
  const actionChoices = [
    ...(isCurrent ? [] : [{ name: 'Resume this session', value: 'resume' }]),
    { name: 'Export session', value: 'export' },
    { name: 'Delete session', value: 'delete' },
    { name: 'Cancel', value: 'cancel' },
  ];

  let action: string;
  try {
    action = await select({
      message: chalk.dim(`Action for ${selectedId.slice(0, 8)}`),
      choices: actionChoices,
    });
  } catch {
    return 'handled';
  }

  switch (action) {
    case 'resume':
      console.log(chalk.dim(`  To resume, run: opta chat -r ${selectedId.slice(0, 8)}`));
      break;
    case 'export': {
      const { writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const sess = await loadSess(selectedId);
      const content = formatSessionExport(sess, 'markdown');
      const filename = `opta-session-${selectedId.slice(0, 8)}-${Date.now()}.md`;
      await writeFile(join(process.cwd(), filename), content, 'utf-8');
      console.log(chalk.green('\u2713') + ` Exported to ${chalk.cyan(filename)}`);
      break;
    }
    case 'delete':
      if (isCurrent) {
        console.log(chalk.yellow('  Cannot delete current session'));
      } else {
        await deleteSession(selectedId);
        console.log(chalk.green('\u2713') + ` Deleted session ${selectedId.slice(0, 8)}`);
      }
      break;
    default:
      break;
  }
  return 'handled';
};

const initHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { access } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const contextFile = join(process.cwd(), 'OPTA.md');

  try {
    await access(contextFile);
    console.log(chalk.yellow('  OPTA.md already exists. Delete it first to regenerate.'));
    return 'handled';
  } catch { /* doesn't exist, good */ }

  console.log(chalk.dim('  Analyzing project...'));
  ctx.session.messages.push({
    role: 'user',
    content: 'Analyze this project and generate an OPTA.md project context file. Include: project name, tech stack, architecture overview, key files, coding conventions, and any important notes for an AI assistant working on this codebase. Write it as a markdown file.',
  });
  console.log(chalk.dim('  Ask me to generate the OPTA.md file and I\'ll analyze the project.'));
  return 'handled';
};

const editorHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { editText } = await import('../editor.js');
  const text = await editText(args || '');
  if (text) {
    console.log(chalk.dim(`  Editor returned ${text.split('\n').length} lines`));
    // Inject editor text as user message for processing
    ctx.session.messages.push({ role: 'user', content: text });
  } else {
    console.log(chalk.dim('  Editor cancelled (empty content)'));
  }
  return 'handled';
};

const imageHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!args) {
    console.log(chalk.dim('  Usage: /image <path> [question]'));
    console.log(chalk.dim('  Examples:'));
    console.log(chalk.dim('    /image screenshot.png What is this?'));
    console.log(chalk.dim('    /image ./designs/mockup.png Review this UI'));
    console.log(chalk.dim('  Supports: png, jpg, jpeg, gif, webp'));
    return 'handled';
  }

  const parts = args.split(/\s+/);
  const imagePath = parts[0]!;
  const question = parts.slice(1).join(' ') || 'What is in this image?';

  try {
    const { readFile: readFs } = await import('node:fs/promises');
    const { resolve: resolvePath, extname } = await import('node:path');
    const fullPath = resolvePath(imagePath);
    const data = await readFs(fullPath);
    const base64 = data.toString('base64');
    const ext = extname(fullPath).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;

    // Set title from first image
    if (!ctx.session.title) {
      ctx.session.title = generateTitle(question);
    }

    const result = await agentLoop(question, ctx.config, {
      existingMessages: ctx.session.messages,
      sessionId: ctx.session.id,
      silent: false,
      mode: ctx.chatState.currentMode === 'plan' ? 'plan' : undefined,
      imageBase64: `data:image/${mime};base64,${base64}`,
    });

    ctx.session.messages = result.messages;
    ctx.session.toolCallCount += result.toolCallCount;
    await saveSession(ctx.session);
  } catch (err) {
    console.error(chalk.red('\u2717') + ` Failed to read image: ${errorMessage(err)}`);
  }
  return 'handled';
};

const tagHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { tagSession, untagSession } = await import('../../memory/store.js');
  const parts = args.trim().split(/\s+/);
  const subcommand = parts[0]?.toLowerCase();

  // /tag (no args) or /tag list — show current tags
  if (!subcommand || subcommand === 'list') {
    const tags = ctx.session.tags ?? [];
    if (tags.length === 0) {
      console.log(chalk.dim('  No tags on this session. Use /tag add <tag> to add one.'));
    } else {
      console.log(chalk.dim('  Tags: ') + tags.map(t => chalk.cyan(t)).join(', '));
    }
    return 'handled';
  }

  if (subcommand === 'add') {
    const tagsToAdd = parts.slice(1).filter(Boolean);
    if (tagsToAdd.length === 0) {
      console.log(chalk.dim('  Usage: /tag add <tag1> [tag2] ...'));
      return 'handled';
    }
    await tagSession(ctx.session.id, tagsToAdd);
    ctx.session.tags = [...new Set([...(ctx.session.tags ?? []), ...tagsToAdd])];
    console.log(chalk.green('\u2713') + ` Added tags: ${tagsToAdd.map(t => chalk.cyan(t)).join(', ')}`);
    return 'handled';
  }

  if (subcommand === 'remove' || subcommand === 'rm') {
    const tagsToRemove = parts.slice(1).filter(Boolean);
    if (tagsToRemove.length === 0) {
      console.log(chalk.dim('  Usage: /tag remove <tag1> [tag2] ...'));
      return 'handled';
    }
    await untagSession(ctx.session.id, tagsToRemove);
    ctx.session.tags = (ctx.session.tags ?? []).filter(t => !tagsToRemove.includes(t));
    console.log(chalk.green('\u2713') + ` Removed tags: ${tagsToRemove.map(t => chalk.cyan(t)).join(', ')}`);
    return 'handled';
  }

  // If the subcommand isn't recognized, treat the entire args as tags to add
  const tagsToAdd = parts.filter(Boolean);
  await tagSession(ctx.session.id, tagsToAdd);
  ctx.session.tags = [...new Set([...(ctx.session.tags ?? []), ...tagsToAdd])];
  console.log(chalk.green('\u2713') + ` Added tags: ${tagsToAdd.map(t => chalk.cyan(t)).join(', ')}`);
  return 'handled';
};

const renameHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!args.trim()) {
    console.log(chalk.dim('  Usage: /rename <new title>'));
    return 'handled';
  }
  const { renameSession } = await import('../../memory/store.js');
  await renameSession(ctx.session.id, args.trim());
  ctx.session.title = args.trim();
  console.log(chalk.green('\u2713') + ` Session renamed: ${args.trim()}`);
  return 'handled';
};

const costHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  const messages = ctx.session.messages;
  const isLocal = ctx.config.provider.active === 'lmx';

  let inputTokens = 0;
  let outputTokens = 0;

  for (const msg of messages) {
    // Extract text content from string or ContentPart[] format
    let text = '';
    if (typeof msg.content === 'string') {
      text = msg.content;
    } else if (Array.isArray(msg.content)) {
      text = msg.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map(p => p.text)
        .join('');
    }

    const tokens = estimateTokens(text);

    // Tool call arguments also count as output tokens
    const toolTokens = msg.tool_calls
      ? msg.tool_calls.reduce((sum, tc) => sum + estimateTokens(tc.function.arguments), 0)
      : 0;

    if (msg.role === 'assistant') {
      outputTokens += tokens + toolTokens;
    } else {
      inputTokens += tokens;
    }
  }

  const totalTokens = inputTokens + outputTokens;

  console.log();
  console.log(chalk.dim('  Session Token Usage'));
  console.log(chalk.dim('  ' + '\u2500'.repeat(32)));
  console.log(`  Input tokens:   ${chalk.cyan(formatTokens(inputTokens))}`);
  console.log(`  Output tokens:  ${chalk.cyan(formatTokens(outputTokens))}`);
  console.log(`  Total tokens:   ${chalk.cyan(formatTokens(totalTokens))}`);
  console.log(`  Messages:       ${chalk.cyan(String(messages.length))}`);
  console.log(`  Tool calls:     ${chalk.cyan(String(ctx.session.toolCallCount))}`);
  console.log(chalk.dim('  ' + '\u2500'.repeat(32)));

  if (isLocal) {
    console.log(`  Cost:           ${chalk.green('Free')} ${chalk.dim('(local inference via Opta-LMX)')}`);
  } else {
    // Rough cost estimate for Anthropic Claude models
    // claude-sonnet-4-5: $3/M input, $15/M output
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    const totalCost = inputCost + outputCost;

    const model = ctx.config.provider.anthropic.model || 'claude-sonnet';
    console.log(`  Provider:       ${chalk.dim('Anthropic')} ${chalk.dim(`(${model})`)}`);
    console.log(`  Est. cost:      ${chalk.yellow('~$' + totalCost.toFixed(4) + ' USD')}`);
    console.log(chalk.dim('  Note: Estimates based on approximate token counts'));
  }

  console.log();
  return 'handled';
};

export const sessionCommands: SlashCommandDef[] = [
  {
    command: 'exit',
    aliases: ['quit', 'q'],
    description: 'Save and exit',
    handler: exitHandler,
    category: 'session',
    usage: '/exit',
    examples: ['/exit', '/quit', '/q'],
  },
  {
    command: 'clear',
    description: 'Clear screen',
    handler: clearHandler,
    category: 'session',
    usage: '/clear',
    examples: ['/clear'],
  },
  {
    command: 'share',
    description: 'Export conversation',
    handler: shareHandler,
    category: 'session',
    usage: '/share',
    examples: ['/share'],
  },
  {
    command: 'sessions',
    description: 'List recent sessions',
    handler: sessionsHandler,
    category: 'session',
    usage: '/sessions',
    examples: ['/sessions'],
  },
  {
    command: 'init',
    description: 'Generate project context',
    handler: initHandler,
    category: 'session',
    usage: '/init',
    examples: ['/init'],
  },
  {
    command: 'editor',
    aliases: ['e'],
    description: 'Open $EDITOR for input',
    handler: editorHandler,
    category: 'session',
    usage: '/editor [initial-text]',
    examples: ['/editor', '/editor Fix the login bug'],
  },
  {
    command: 'image',
    description: 'Analyze an image',
    handler: imageHandler,
    category: 'session',
    usage: '/image <path> [question]',
    examples: ['/image screenshot.png What is this?', '/image ./designs/mockup.png Review this UI'],
  },
  {
    command: 'tag',
    aliases: ['t'],
    description: 'Manage session tags',
    handler: tagHandler,
    category: 'session',
    usage: '/tag [add|remove|list] [tags...]',
    examples: ['/tag', '/tag add bugfix urgent', '/tag remove urgent', '/tag list'],
  },
  {
    command: 'rename',
    aliases: ['title'],
    description: 'Rename current session',
    handler: renameHandler,
    category: 'session',
    usage: '/rename <new title>',
    examples: ['/rename Auth refactor session', '/title Fix login bug'],
  },
  {
    command: 'cost',
    aliases: ['tokens', 'usage'],
    description: 'Show session token usage and cost estimate',
    handler: costHandler,
    category: 'session',
    usage: '/cost',
    examples: ['/cost', '/tokens', '/usage'],
  },
];
