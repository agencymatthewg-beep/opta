import chalk from 'chalk';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';
import { estimateMessageTokens, estimateTokens, formatTokens } from '../../utils/tokens.js';
import { box, kv, progressBar } from '../../ui/box.js';
import { relative } from 'node:path';

const contextHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const action = args.trim().toLowerCase();

  if (action === 'map' || action === '') {
    const totalTokens = estimateMessageTokens(ctx.session.messages);
    const limit = ctx.config.model.contextLimit ?? 32768;
    const ratio = totalTokens / limit;

    const fileMap = new Map<string, number>();
    
    // Extract file contents from context to show weight
    // We look for <file path="...">...</file> blocks which are injected by @file
    // And also potentially tool_calls that read files
    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;

    for (const msg of ctx.session.messages) {
      if (typeof msg.content === 'string') {
        let match;
        while ((match = fileRegex.exec(msg.content)) !== null) {
          const path = match[1]!;
          const content = match[2]!;
          const tokens = estimateTokens(content);
          fileMap.set(path, (fileMap.get(path) ?? 0) + tokens);
        }
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text' && part.text) {
            let match;
            while ((match = fileRegex.exec(part.text)) !== null) {
              const path = match[1]!;
              const content = match[2]!;
              const tokens = estimateTokens(content);
              fileMap.set(path, (fileMap.get(path) ?? 0) + tokens);
            }
          }
        }
      }
    }

    const lines: string[] = [];
    
    lines.push(chalk.bold('Context Constellation'));
    lines.push(chalk.dim('─'.repeat(40)));
    lines.push(kv('Total', `${formatTokens(totalTokens)} / ${formatTokens(limit)} tokens`));
    lines.push(`Pressure:  ${progressBar(ratio, 25)}`);
    lines.push('');

    if (fileMap.size === 0) {
      lines.push(chalk.dim('  (No explicit file blocks in memory)'));
    } else {
      lines.push(chalk.bold('Loaded Files:'));
      const sortedFiles = Array.from(fileMap.entries())
        .map(([path, tokens]) => ({ path, tokens }))
        .sort((a, b) => b.tokens - a.tokens);

      for (const f of sortedFiles) {
        const relPath = relative(process.cwd(), f.path);
        const tokenStr = formatTokens(f.tokens).padStart(5);
        const pctStr = ((f.tokens / Math.max(1, totalTokens)) * 100).toFixed(1).padStart(4) + '%';
        
        // Color code based on relative size
        const fRatio = f.tokens / limit;
        let color = chalk.cyan;
        if (fRatio > 0.25) color = chalk.red;
        else if (fRatio > 0.1) color = chalk.yellow;
        else if (fRatio > 0.05) color = chalk.magenta;

        lines.push(`  ${color(tokenStr)} ${chalk.dim(`[${pctStr}]`)}  ${relPath}`);
      }
    }

    console.log('\\n' + box('Context Map', lines, { width: 55 }));
    if (ratio > 0.8) {
      console.log(chalk.yellow('  \u26a0 Context pressure is high. Consider using /compact to prune memory.'));
    }

    return 'handled';
  }

  console.log(chalk.dim('  Usage: /context map'));
  return 'handled';
};

export const contextCommands: SlashCommandDef[] = [
  {
    command: 'context',
    description: 'View context token mapping and memory pressure',
    handler: contextHandler,
    category: 'session',
    usage: '/context map',
    examples: ['/context map'],
  },
];
