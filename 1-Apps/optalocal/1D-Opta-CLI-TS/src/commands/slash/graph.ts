import chalk from 'chalk';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';
import { OPTA_AESTHETIC_PROMPT } from '../../prompts/opta-aesthetic.js';

const GENUI_INTRO = `You are a UI generation expert. Please generate a complete, standalone, production-ready HTML document.`;

async function canUseGenUI(ctx: SlashContext): Promise<boolean> {
  const raw = ctx.config.genui?.enabled;
  const enabled = raw !== false;
  if (!enabled) {
    console.log(chalk.red('✗') + ' GenUI output is disabled in settings.');
  }
  return enabled;
}

const graphHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (!(await canUseGenUI(ctx))) return 'handled';
  if (!args) {
    console.log(chalk.dim('  Usage: /graph <file-or-directory>'));
    return 'handled';
  }

  const prompt = `${GENUI_INTRO}

${OPTA_AESTHETIC_PROMPT}

USER PROMPT:
Analyze the dependencies, structure, and exports of the following target: ${args}
Use your tools (like \`lsp_document_symbols\`, \`read_file\`, or \`list_dir\`) to understand its architecture.
Then, generate a beautiful HTML dashboard containing a MermaidJS graph (or custom CSS node tree) mapping out its dependencies and structural flow. 
Use the Opta Aesthetic.
`;
  return { type: 'generate', prompt };
};

export const graphCommands: SlashCommandDef[] = [
  {
    command: 'graph',
    description: 'Generate a visual architecture graph for a file or directory',
    handler: graphHandler,
    category: 'tools',
    usage: '/graph <file>',
    examples: ['/graph src/core/agent.ts'],
  }
];
