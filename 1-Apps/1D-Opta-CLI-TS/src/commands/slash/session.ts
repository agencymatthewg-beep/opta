/**
 * Session-related slash commands: /exit, /clear, /save, /share, /export, /sessions, /init, /editor, /image
 */

import chalk from 'chalk';
import { box, kv } from '../../ui/box.js';
import { agentLoop } from '../../core/agent.js';
import { generateTitle, saveSession } from '../../memory/store.js';
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
    console.error(chalk.red('\u2717') + ` Failed to read image: ${err instanceof Error ? err.message : err}`);
  }
  return 'handled';
};

export const sessionCommands: SlashCommandDef[] = [
  {
    command: 'exit',
    aliases: ['quit', 'q'],
    description: 'Save and exit',
    handler: exitHandler,
    category: 'session',
  },
  {
    command: 'clear',
    description: 'Clear screen',
    handler: clearHandler,
    category: 'session',
  },
  {
    command: 'share',
    description: 'Export conversation',
    handler: shareHandler,
    category: 'session',
  },
  {
    command: 'sessions',
    description: 'List recent sessions',
    handler: sessionsHandler,
    category: 'session',
  },
  {
    command: 'init',
    description: 'Generate project context',
    handler: initHandler,
    category: 'session',
  },
  {
    command: 'editor',
    aliases: ['e'],
    description: 'Open $EDITOR for input',
    handler: editorHandler,
    category: 'session',
  },
  {
    command: 'image',
    description: 'Analyze an image',
    handler: imageHandler,
    category: 'session',
  },
];
