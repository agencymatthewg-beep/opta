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

  // Interactive model picker: scan LMX loaded + on-disk + Anthropic
  try {
    const { LmxClient, lookupContextLimit } = await import('../../lmx/client.js');
    const { select, Separator } = await import('@inquirer/prompts');

    const lmx = new LmxClient({
      host: ctx.config.connection.host,
      port: ctx.config.connection.port,
      adminKey: ctx.config.connection.adminKey,
    });

    // Fetch loaded + available in parallel
    const [loadedRes, availRes, cloudModels] = await Promise.all([
      lmx.models().catch(() => null),
      lmx.available().catch(() => null),
      (async () => {
        const hasKey = ctx.config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY'];
        if (!hasKey) return [];
        try {
          const { getProvider } = await import('../../providers/manager.js');
          const cfg = { ...ctx.config, provider: { ...ctx.config.provider, active: 'anthropic' as const } };
          const p = await getProvider(cfg);
          return p.listModels();
        } catch { return []; }
      })(),
    ]);

    const loadedModels = loadedRes?.models ?? [];
    const loadedIds = new Set(loadedModels.map(m => m.model_id));
    const onDisk = (availRes ?? []).filter(a => !loadedIds.has(a.repo_id));

    if (loadedModels.length === 0 && onDisk.length === 0 && cloudModels.length === 0) {
      console.log(chalk.dim('  No models found (LMX unreachable, no Anthropic key)'));
      return 'handled';
    }

    type Choice = { name: string; value: string } | typeof Separator.prototype;
    const choices: Choice[] = [];

    // Loaded models
    if (loadedModels.length > 0) {
      choices.push(new Separator(chalk.dim('\u2500\u2500 Loaded \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')));
      for (const m of loadedModels) {
        const isCurrent = m.model_id === ctx.config.model.default;
        const dot = isCurrent ? chalk.green('\u25cf ') : '  ';
        const ctxLimit = m.context_length ?? lookupContextLimit(m.model_id);
        const memStr = m.memory_bytes ? `${(m.memory_bytes / 1e9).toFixed(0)}GB` : '';
        const reqStr = m.request_count ? `${m.request_count} reqs` : '';
        const meta = chalk.dim([`${(ctxLimit / 1000).toFixed(0)}K ctx`, memStr, reqStr].filter(Boolean).join(' \u00b7 '));
        choices.push({ name: `${dot}${m.model_id}  ${meta}`, value: m.model_id });
      }
    }

    // On-disk models (not loaded)
    if (onDisk.length > 0) {
      choices.push(new Separator(chalk.dim('\u2500\u2500 On Disk \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')));
      for (const a of onDisk) {
        const ctxLimit = lookupContextLimit(a.repo_id);
        const sizeStr = a.size_bytes > 0 ? `${(a.size_bytes / 1e9).toFixed(1)}GB` : '';
        const meta = chalk.dim([`${(ctxLimit / 1000).toFixed(0)}K ctx`, sizeStr, 'not loaded'].filter(Boolean).join(' \u00b7 '));
        choices.push({ name: `  ${a.repo_id}  ${meta}`, value: a.repo_id });
      }
    }

    // Cloud models
    if (cloudModels.length > 0) {
      choices.push(new Separator(chalk.dim('\u2500\u2500 Anthropic \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')));
      for (const m of cloudModels) {
        const ctxStr = m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}K ctx` : '';
        const meta = chalk.dim([m.name ?? '', ctxStr].filter(Boolean).join(' \u00b7 '));
        choices.push({ name: `  ${chalk.blue('\u2601')} ${m.id}  ${meta}`, value: m.id });
      }
    }

    let selectedModel: string;
    try {
      selectedModel = await select({ message: chalk.dim('Select model'), choices });
    } catch {
      return 'handled'; // Ctrl+C
    }

    if (selectedModel === ctx.config.model.default) {
      console.log(chalk.dim(`  Already using ${selectedModel}`));
      return 'handled';
    }

    // If selected model is on disk but not loaded, offer to load it
    if (onDisk.some(a => a.repo_id === selectedModel)) {
      console.log(chalk.dim(`  Loading ${selectedModel}...`));
      try {
        await lmx.loadModel(selectedModel);
        console.log(chalk.green('\u2713') + ` Loaded ${selectedModel}`);
      } catch (err) {
        console.error(chalk.red('\u2717') + ` Failed to load: ${err}`);
        return 'handled';
      }
    }

    // If selected model is a cloud model, switch provider
    if (cloudModels.some(m => m.id === selectedModel)) {
      const { saveConfig } = await import('../../core/config.js');
      await saveConfig({
        provider: { ...ctx.config.provider, active: 'anthropic' },
        model: { default: selectedModel, contextLimit: 200000 },
      });
      ctx.session.model = selectedModel;
      console.log(chalk.green('\u2713') + ` Switched to ${selectedModel} ${chalk.dim('(Anthropic)')}`);
      return 'model-switched';
    }

    const { saveConfig } = await import('../../core/config.js');
    const ctxLimit = lookupContextLimit(selectedModel);
    await saveConfig({ model: { default: selectedModel, contextLimit: ctxLimit } });
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
    usage: '/model [name]',
    examples: ['/model llama3', '/model claude-sonnet-4-20250514', '/model'],
  },
  {
    command: 'agent',
    aliases: ['profile'],
    description: 'Switch agent profile',
    handler: agentHandler,
    category: 'session',
    usage: '/agent [profile-name]',
    examples: ['/agent coder', '/agent researcher', '/agent'],
  },
];
