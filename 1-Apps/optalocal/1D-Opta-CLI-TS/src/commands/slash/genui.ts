import chalk from 'chalk';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';
import { OPTA_AESTHETIC_PROMPT } from '../../prompts/opta-aesthetic.js';

const GENUI_INTRO = `You are a UI generation expert. Please generate a complete, standalone, production-ready HTML document.`;

async function canUseGenUI(ctx: SlashContext): Promise<boolean> {
  // Read genui.enabled and default to true if undefined
  const raw = ctx.config.genui?.enabled;
  const enabled = raw !== false;
  if (!enabled) {
    console.log(chalk.red('✗') + ' GenUI output is disabled in settings.');
    console.log(chalk.dim('  Enable it in the Actions page via the settings menu.'));
  }
  return enabled;
}

const guHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!(await canUseGenUI(ctx))) return 'handled';
  if (!args) {
    console.log(chalk.dim('  Usage: /gu [prompt]'));
    return 'handled';
  }

  const prompt = `${GENUI_INTRO}

${OPTA_AESTHETIC_PROMPT}

USER PROMPT:
Generate a UI artifact for the following request:
${args}
`;
  return { type: 'generate', prompt };
};

const improveHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!(await canUseGenUI(ctx))) return 'handled';
  if (!args) {
    console.log(chalk.dim('  Usage: /improve [file]'));
    return 'handled';
  }

  const prompt = `${GENUI_INTRO}

${OPTA_AESTHETIC_PROMPT}

USER PROMPT:
Please improve and iterate on the UI in this file. Fix any layout bugs, enhance visual hierarchy, and ensure it fully adheres to the Opta Aesthetic.
Target file: ${args}
`;
  return { type: 'generate', prompt };
};

const perfectHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!(await canUseGenUI(ctx))) return 'handled';
  if (!args) {
    console.log(chalk.dim('  Usage: /perfect [file]'));
    return 'handled';
  }

  const prompt = `${GENUI_INTRO}

${OPTA_AESTHETIC_PROMPT}

USER PROMPT:
Please perfect the UI in this file. Focus on micro-interactions, precise spacing, perfect alignment, and final visual polish.
Target file: ${args}
`;
  return { type: 'generate', prompt };
};

const atpoHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!(await canUseGenUI(ctx))) return 'handled';

  const prompt = `${GENUI_INTRO}

${OPTA_AESTHETIC_PROMPT}

USER PROMPT:
Generate a GenUI dashboard summarizing the current Autonomous Task Planning & Orchestration (ATPO) state for this session. Make it visually rich and informative.
`;
  return { type: 'generate', prompt };
};

const codereviewHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!(await canUseGenUI(ctx))) return 'handled';

  const prompt = `${GENUI_INTRO}

${OPTA_AESTHETIC_PROMPT}

USER PROMPT:
Analyze the current context or git diff and generate a rich, interactive HTML code review report using the Opta Aesthetic.
`;
  return { type: 'generate', prompt };
};

const planGenUIHandler = async (_args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!(await canUseGenUI(ctx))) return 'handled';

  const prompt = `${GENUI_INTRO}

${OPTA_AESTHETIC_PROMPT}

USER PROMPT:
Analyze the project's APP.md or current plan and generate a beautiful HTML milestone/progress tracker dashboard using the Opta Aesthetic.
`;
  return { type: 'generate', prompt };
};

export const genuiCommands: SlashCommandDef[] = [
  {
    command: 'gu',
    description: 'Generate a rich UI artifact',
    handler: guHandler,
    category: 'tools',
    usage: '/gu <prompt>',
    examples: ['/gu a dashboard for managing API keys'],
  },
  {
    command: 'improve',
    description: 'Iterate and improve a UI file',
    handler: improveHandler,
    category: 'tools',
    usage: '/improve <file>',
    examples: ['/improve src/index.html'],
  },
  {
    command: 'perfect',
    description: 'Polish a UI file to perfection',
    handler: perfectHandler,
    category: 'tools',
    usage: '/perfect <file>',
    examples: ['/perfect src/index.html'],
  },
  {
    command: 'atpo',
    description: 'Generate ATPO status dashboard',
    handler: atpoHandler,
    category: 'tools',
    usage: '/atpo',
    examples: ['/atpo'],
  },
  {
    command: 'codereview',
    description: 'Generate a rich code review report',
    handler: codereviewHandler,
    category: 'tools',
    usage: '/codereview',
    examples: ['/codereview'],
  },
  {
    command: 'plan',
    description: 'Generate a visual milestone tracker',
    handler: planGenUIHandler,
    category: 'tools',
    usage: '/plan',
    examples: ['/plan'],
  }
];
