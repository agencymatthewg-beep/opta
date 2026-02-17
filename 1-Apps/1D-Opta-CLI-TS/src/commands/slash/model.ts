/**
 * Model and agent profile slash commands: /model, /agent
 */

import chalk from 'chalk';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';

const modelHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  if (args) {
    // Direct switch: /model <name>
    try {
      const { saveConfig } = await import('../../core/config.js');
      await saveConfig({ model: { default: args } });
      ctx.session.model = args;
      console.log(chalk.green('\u2713') + ` Switched to ${args}`);
      return 'model-switched';
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Failed to switch model: ${err}`);
      return 'handled';
    }
  }

  // Interactive model picker: fetch from LMX
  try {
    const { LmxClient } = await import('../../lmx/client.js');
    const lmx = new LmxClient({
      host: ctx.config.connection.host,
      port: ctx.config.connection.port,
      adminKey: ctx.config.connection.adminKey,
    });
    const { models: loadedModels } = await lmx.models();

    if (loadedModels.length === 0) {
      console.log(chalk.dim('  No models loaded on LMX'));
      return 'handled';
    }

    const { select } = await import('@inquirer/prompts');
    const { lookupContextLimit } = await import('../../lmx/client.js');
    const { fmtTokens: fmtTok } = await import('../../ui/box.js');

    const choices = loadedModels.map(m => {
      const isCurrent = m.model_id === ctx.config.model.default;
      const dot = isCurrent ? chalk.green('\u25cf ') : '  ';
      const ctxLimit = lookupContextLimit(m.model_id);
      const memStr = m.memory_bytes ? `${(m.memory_bytes / 1e9).toFixed(0)}GB` : '';
      const meta = chalk.dim([
        `${fmtTok(ctxLimit)} ctx`,
        memStr,
        m.request_count !== undefined ? `${m.request_count} reqs` : '',
      ].filter(Boolean).join(' \u00b7 '));
      return {
        name: `${dot}${m.model_id}  ${meta}`,
        value: m.model_id,
      };
    });

    let selectedModel: string;
    try {
      selectedModel = await select({
        message: chalk.dim('Select model'),
        choices,
      });
    } catch {
      return 'handled'; // Ctrl+C
    }

    if (selectedModel === ctx.config.model.default) {
      console.log(chalk.dim(`  Already using ${selectedModel}`));
      return 'handled';
    }

    const { saveConfig } = await import('../../core/config.js');
    await saveConfig({ model: { default: selectedModel } });
    ctx.session.model = selectedModel;
    console.log(chalk.green('\u2713') + ` Switched to ${selectedModel}`);
    return 'model-switched';
  } catch {
    // Fallback: just show current model if LMX is unreachable
    console.log(chalk.dim(`  Current model: ${ctx.config.model.default}`));
    console.log(chalk.dim(`  LMX unreachable \u2014 use /model <name> to switch manually`));
    return 'handled';
  }
};

const agentHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { getAgentProfile, listAgentProfiles } = await import('../../core/agent-profiles.js');

  if (args) {
    // Direct switch: /agent <name>
    const profile = getAgentProfile(args);
    if (!profile) {
      console.log(chalk.yellow(`  Unknown agent profile: ${args}`) + chalk.dim(' (try /agent to see options)'));
      return 'handled';
    }
    ctx.chatState.agentProfile = profile.name;
    console.log(chalk.green('\u2713') + ` Agent: ${chalk.bold(profile.name)} \u2014 ${chalk.dim(profile.description)}`);
    console.log(chalk.dim(`  Tools: ${profile.tools.length} enabled`));
    return 'handled';
  }

  // Interactive picker
  const { select } = await import('@inquirer/prompts');
  const profiles = listAgentProfiles();
  const currentProfile = ctx.chatState.agentProfile;

  const choices = profiles.map(p => {
    const isCurrent = p.name === currentProfile;
    const dot = isCurrent ? chalk.green('\u25cf ') : '  ';
    return {
      name: `${dot}${chalk.bold(p.name.padEnd(14))} ${chalk.dim(p.description)}  ${chalk.dim(`(${p.tools.length} tools)`)}`,
      value: p.name,
    };
  });

  let selected: string;
  try {
    selected = await select({
      message: chalk.dim('Select agent profile'),
      choices,
    });
  } catch {
    return 'handled'; // Ctrl+C
  }

  const profile = getAgentProfile(selected);
  if (profile) {
    ctx.chatState.agentProfile = profile.name;
    console.log(chalk.green('\u2713') + ` Agent: ${chalk.bold(profile.name)} \u2014 ${chalk.dim(profile.description)}`);
    console.log(chalk.dim(`  Tools: ${profile.tools.length} enabled`));
  }
  return 'handled';
};

export const modelCommands: SlashCommandDef[] = [
  {
    command: 'model',
    description: 'Switch model (picker)',
    handler: modelHandler,
    category: 'session',
  },
  {
    command: 'agent',
    aliases: ['profile'],
    description: 'Switch agent profile',
    handler: agentHandler,
    category: 'session',
  },
];
