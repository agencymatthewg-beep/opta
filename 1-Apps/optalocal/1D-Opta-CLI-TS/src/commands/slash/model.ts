/**
 * Model and agent profile slash commands: /model, /agent
 */

import chalk from 'chalk';
import type { SlashCommandDef, SlashContext, SlashResult } from './types.js';
import { runMenuPrompt } from '../../ui/prompt-nav.js';
import { NO_MODELS_LOADED } from '../../utils/errors.js';

const STABLE_MODEL_LOAD_TIMEOUT_MS = 300_000;

import type { ModelGroup } from '../../lmx/model-catalog.js';

type ModelConfigExtended = { favourites?: string[]; groups?: ModelGroup[] };

/** Toggle a model ID in the favourites list and persist to config. */
async function toggleFavourite(modelId: string, current: string[]): Promise<string[]> {
  const { saveConfig } = await import('../../core/config.js');
  const normalised = modelId.trim();
  const exists = current.some((f) => f === normalised);
  const updated = exists ? current.filter((f) => f !== normalised) : [...current, normalised];
  await saveConfig({ 'model.favourites': updated });
  return updated;
}

/** Persist an updated groups array to config. */
async function saveGroups(groups: ModelGroup[]): Promise<void> {
  const { saveConfig } = await import('../../core/config.js');
  await saveConfig({ 'model.groups': groups });
}

const groupHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const { DEFAULT_GROUPS } = await import('../../lmx/model-catalog.js');
  const modelCfg = ctx.config.model as ModelConfigExtended;
  const currentGroups: ModelGroup[] = modelCfg.groups ?? DEFAULT_GROUPS;

  const parts = args.trim().split(/\s+/);
  const sub = parts[0] ?? '';

  if (!sub) {
    // List groups
    console.log(
      chalk.bold('Model groups') + chalk.dim(modelCfg.groups ? '' : '  (built-in defaults)')
    );
    for (const g of currentGroups) {
      const pats = g.patterns.length
        ? chalk.dim(`  [${g.patterns.join(', ')}]`)
        : chalk.dim('  [catch-all]');
      const color = g.color ?? '#94a3b8';
      console.log(`  ${chalk.hex(color)(g.label.padEnd(20))} ${chalk.dim(g.name)}${pats}`);
    }
    console.log(chalk.dim('\n  /model group add <name> <label>'));
    console.log(chalk.dim('  /model group rm <name>'));
    console.log(chalk.dim('  /model group pattern <name> <pattern>'));
    console.log(chalk.dim('  /model group reset  — restore built-in defaults'));
    return 'handled';
  }

  if (sub === 'reset') {
    await saveGroups([]);
    const { saveConfig } = await import('../../core/config.js');
    // Remove override entirely so defaults kick in
    await saveConfig({ 'model.groups': undefined });
    console.log(chalk.green('✓') + ' Model groups reset to built-in defaults');
    return 'handled';
  }

  if (sub === 'add') {
    const name = parts[1];
    const label = parts.slice(2).join(' ');
    if (!name || !label) {
      console.log(chalk.yellow('Usage: /model group add <name> <label>'));
      return 'handled';
    }
    if (currentGroups.some((g) => g.name === name)) {
      console.log(chalk.yellow(`  Group "${name}" already exists`));
      return 'handled';
    }
    const updated = [...currentGroups, { name, label, patterns: [] }];
    await saveGroups(updated);
    console.log(
      chalk.green('✓') +
        ` Added group "${name}" — use /model group pattern ${name} <pattern> to add patterns`
    );
    return 'handled';
  }

  if (sub === 'rm') {
    const name = parts[1];
    if (!name) {
      console.log(chalk.yellow('Usage: /model group rm <name>'));
      return 'handled';
    }
    const updated = currentGroups.filter((g) => g.name !== name);
    if (updated.length === currentGroups.length) {
      console.log(chalk.yellow(`  Group "${name}" not found`));
      return 'handled';
    }
    await saveGroups(updated);
    console.log(chalk.green('✓') + ` Removed group "${name}"`);
    return 'handled';
  }

  if (sub === 'pattern') {
    const name = parts[1];
    const pattern = parts.slice(2).join(' ');
    if (!name || !pattern) {
      console.log(chalk.yellow('Usage: /model group pattern <name> <pattern>'));
      return 'handled';
    }
    const updated = currentGroups.map((g) =>
      g.name === name ? { ...g, patterns: [...g.patterns, pattern] } : g
    );
    if (!updated.some((g) => g.name === name)) {
      console.log(chalk.yellow(`  Group "${name}" not found`));
      return 'handled';
    }
    await saveGroups(updated);
    console.log(chalk.green('✓') + ` Added pattern "${pattern}" to group "${name}"`);
    return 'handled';
  }

  console.log(chalk.yellow(`  Unknown group sub-command: ${sub}`));
  return 'handled';
};

const modelHandler = async (args: string, ctx: SlashContext): Promise<SlashResult> => {
  const trimmedArgs = args.trim();

  // /model group ... — manage groups
  if (trimmedArgs.startsWith('group')) {
    return groupHandler(trimmedArgs.slice(5).trim(), ctx);
  }

  // /model fav [name] — toggle or list favourites
  if (trimmedArgs.startsWith('fav')) {
    const favTarget = trimmedArgs.slice(3).trim();
    const currentFavs: string[] = (ctx.config.model as { favourites?: string[] }).favourites ?? [];

    if (!favTarget) {
      if (currentFavs.length === 0) {
        console.log(chalk.dim('  No favourites yet — use /model fav <model-id> to pin a model'));
      } else {
        console.log(chalk.yellow('★') + ' Favourites:');
        for (const f of currentFavs) {
          const isCurrent = f === ctx.config.model.default;
          console.log(`  ${isCurrent ? chalk.green('●') : ' '} ${f}`);
        }
        console.log(chalk.dim('\n  /model fav <name> to toggle'));
      }
      return 'handled';
    }

    const updated = await toggleFavourite(favTarget, currentFavs);
    const added = updated.includes(favTarget);
    const icon = added ? chalk.yellow('★') : chalk.dim('☆');
    const verb = added ? 'Added to' : 'Removed from';
    console.log(`${icon} ${verb} favourites: ${favTarget}`);
    return 'handled';
  }

  if (trimmedArgs) {
    // Direct switch: /model <name>
    try {
      let selectedModel = trimmedArgs;
      const { LmxClient, lookupContextLimit } = await import('../../lmx/client.js');
      const { ensureModelLoaded, findMatchingModelId } =
        await import('../../lmx/model-lifecycle.js');

      const lmx = new LmxClient({
        host: ctx.config.connection.host,
        fallbackHosts: ctx.config.connection.fallbackHosts,
        port: ctx.config.connection.port,
        adminKey: ctx.config.connection.adminKey,
      });

      const [loadedRes, available] = await Promise.all([
        lmx.models().catch(() => ({ models: [] })),
        lmx.available().catch(() => []),
      ]);
      const loadedIds = loadedRes.models.map((m) => m.model_id);
      const loadedMatch = findMatchingModelId(selectedModel, loadedIds);
      if (loadedMatch) {
        selectedModel = loadedMatch;
      } else {
        const onDiskMatch = findMatchingModelId(
          selectedModel,
          available.map((m) => m.repo_id)
        );
        if (onDiskMatch) {
          const loadedId = await ensureModelLoaded(lmx, onDiskMatch, {
            timeoutMs: STABLE_MODEL_LOAD_TIMEOUT_MS,
          });
          selectedModel = loadedId;
          console.log(chalk.green('\u2713') + ` Loaded ${loadedId}`);
        }
      }

      const { saveConfig } = await import('../../core/config.js');
      await saveConfig({
        model: {
          default: selectedModel,
          contextLimit: lookupContextLimit(selectedModel),
        },
      });
      ctx.session.model = selectedModel;
      console.log(chalk.green('\u2713') + ` Switched to ${selectedModel}`);
      return 'model-switched';
    } catch (err) {
      console.error(chalk.red('\u2717') + ` Failed to switch model: ${String(err)}`);
      return 'handled';
    }
  }

  // Interactive model picker: category-based with Favourites at top
  try {
    const { LmxClient, lookupContextLimit } = await import('../../lmx/client.js');
    const { select, Separator } = await import('@inquirer/prompts');
    const { classifyModel, DEFAULT_GROUPS } = await import('../../lmx/model-catalog.js');
    const activeGroups = (ctx.config.model as ModelConfigExtended).groups ?? DEFAULT_GROUPS;

    const lmx = new LmxClient({
      host: ctx.config.connection.host,
      fallbackHosts: ctx.config.connection.fallbackHosts,
      port: ctx.config.connection.port,
      adminKey: ctx.config.connection.adminKey,
    });

    const [loadedRes, availRes, cloudModels] = await Promise.all([
      lmx.models().catch(() => null),
      lmx.available().catch(() => null),
      (async () => {
        const hasKey = ctx.config.provider?.anthropic?.apiKey || process.env['ANTHROPIC_API_KEY'];
        if (!hasKey) return [];
        try {
          const { getProvider } = await import('../../providers/manager.js');
          const cfg = {
            ...ctx.config,
            provider: { ...ctx.config.provider, active: 'anthropic' as const },
          };
          const p = await getProvider(cfg);
          return await p.listModels();
        } catch {
          return [];
        }
      })(),
    ]);

    const loadedModels = loadedRes?.models ?? [];
    const toKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const loadedKeys = new Set(loadedModels.map((m) => toKey(m.model_id)));
    const onDisk = (availRes ?? []).filter((a) => !loadedKeys.has(toKey(a.repo_id)));
    const favourites: string[] = (ctx.config.model as { favourites?: string[] }).favourites ?? [];
    const favSet = new Set(favourites);

    if (loadedModels.length === 0 && onDisk.length === 0 && cloudModels.length === 0) {
      console.log(chalk.dim('  ' + NO_MODELS_LOADED));
      return 'handled';
    }

    type Choice = { name: string; value: string } | typeof Separator.prototype;
    const choices: Choice[] = [];
    const sep = (label: string) => new Separator(chalk.dim(`── ${label} `));

    // Helper: build a display line for a local model
    const localLine = (
      id: string,
      ctxK: number,
      status: 'loaded' | 'on-disk',
      extras: string[]
    ): string => {
      const isCurrent = id === ctx.config.model.default;
      const isFav = favSet.has(id);
      const dot = isCurrent ? chalk.green('●') : ' ';
      const star = isFav ? chalk.yellow('★') : ' ';
      const statusTag = status === 'loaded' ? chalk.green('loaded') : chalk.dim('on disk');
      const meta = chalk.dim([`${ctxK}K`, ...extras, statusTag].filter(Boolean).join(' · '));
      return `${dot}${star} ${id}  ${meta}`;
    };

    // ── Favourites ──
    if (favourites.length > 0) {
      choices.push(sep('Favourites ★'));
      for (const favId of favourites) {
        const loaded = loadedModels.find(
          (m) => m.model_id === favId || toKey(m.model_id) === toKey(favId)
        );
        const disk = onDisk.find((a) => a.repo_id === favId || toKey(a.repo_id) === toKey(favId));
        const cloud = cloudModels.find((m) => m.id === favId);

        if (loaded) {
          const ctxK = Math.round(
            (loaded.context_length ?? lookupContextLimit(loaded.model_id)) / 1000
          );
          const memStr = loaded.memory_bytes ? `${(loaded.memory_bytes / 1e9).toFixed(0)}GB` : '';
          choices.push({
            name: localLine(loaded.model_id, ctxK, 'loaded', [memStr].filter(Boolean)),
            value: loaded.model_id,
          });
        } else if (disk) {
          const ctxK = Math.round(lookupContextLimit(disk.repo_id) / 1000);
          const sizeStr = disk.size_bytes > 0 ? `${(disk.size_bytes / 1e9).toFixed(1)}GB` : '';
          choices.push({
            name: localLine(disk.repo_id, ctxK, 'on-disk', [sizeStr].filter(Boolean)),
            value: disk.repo_id,
          });
        } else if (cloud) {
          const ctxStr = cloud.contextLength ? `${Math.round(cloud.contextLength / 1000)}K` : '';
          const meta = chalk.dim(
            [cloud.name ?? '', ctxStr, chalk.blue('cloud')].filter(Boolean).join(' · ')
          );
          const isCurrent = cloud.id === ctx.config.model.default;
          choices.push({
            name: `${isCurrent ? chalk.green('●') : ' '}${chalk.yellow('★')} ${chalk.blue('☁')} ${cloud.id}  ${meta}`,
            value: cloud.id,
          });
        } else {
          // Favourite no longer available — show greyed out
          choices.push({
            name: `  ${chalk.yellow('★')} ${chalk.dim(favId)}  ${chalk.dim('unavailable')}`,
            value: favId,
          });
        }
      }
    }

    // Build per-group buckets for non-favourite LMX models
    const groupBuckets = new Map<string, Choice[]>();

    for (const m of loadedModels) {
      if (favSet.has(m.model_id)) continue;
      const group = classifyModel(m.model_id, activeGroups);
      const key = group?.name ?? activeGroups[activeGroups.length - 1]?.name ?? 'other';
      const ctxK = Math.round((m.context_length ?? lookupContextLimit(m.model_id)) / 1000);
      const memStr = m.memory_bytes ? `${(m.memory_bytes / 1e9).toFixed(0)}GB` : '';
      const reqStr = m.request_count ? `${m.request_count} reqs` : '';
      const bucket = groupBuckets.get(key) ?? [];
      bucket.push({
        name: localLine(m.model_id, ctxK, 'loaded', [memStr, reqStr].filter(Boolean)),
        value: m.model_id,
      });
      groupBuckets.set(key, bucket);
    }

    for (const a of onDisk) {
      if (favSet.has(a.repo_id)) continue;
      const group = classifyModel(a.repo_id, activeGroups);
      const key = group?.name ?? activeGroups[activeGroups.length - 1]?.name ?? 'other';
      const ctxK = Math.round(lookupContextLimit(a.repo_id) / 1000);
      const sizeStr = a.size_bytes > 0 ? `${(a.size_bytes / 1e9).toFixed(1)}GB` : '';
      const bucket = groupBuckets.get(key) ?? [];
      bucket.push({
        name: localLine(a.repo_id, ctxK, 'on-disk', [sizeStr].filter(Boolean)),
        value: a.repo_id,
      });
      groupBuckets.set(key, bucket);
    }

    // Emit group sections in user-defined order
    for (const group of activeGroups) {
      const bucket = groupBuckets.get(group.name);
      if (!bucket || bucket.length === 0) continue;
      const color = group.color ?? '#94a3b8';
      choices.push(sep(chalk.hex(color)(group.label)));
      choices.push(...bucket);
    }

    // Anthropic cloud models (not in favourites)
    const nonFavCloud = cloudModels.filter((m) => !favSet.has(m.id));
    if (nonFavCloud.length > 0) {
      choices.push(sep(chalk.blue('☁  Anthropic')));
      for (const m of nonFavCloud) {
        const isCurrent = m.id === ctx.config.model.default;
        const ctxStr = m.contextLength ? `${Math.round(m.contextLength / 1000)}K` : '';
        const meta = chalk.dim([m.name ?? '', ctxStr].filter(Boolean).join(' · '));
        choices.push({
          name: `${isCurrent ? chalk.green('●') : ' '}  ${chalk.blue('\u2601')} ${m.id}  ${meta}`,
          value: m.id,
        });
      }
    }

    if (choices.filter((c) => !('separator' in c)).length === 0) {
      console.log(chalk.dim('  ' + NO_MODELS_LOADED));
      return 'handled';
    }

    let selectedModel: string;
    try {
      const hint = chalk.dim('  /model fav <name> to pin  ·  /model <name> to switch directly');
      console.log(hint);
      const picked = await runMenuPrompt(
        (context) => select({ message: chalk.dim('Select model'), choices }, context),
        'select'
      );
      if (!picked) return 'handled';
      selectedModel = picked;
    } catch {
      return 'handled';
    }

    if (selectedModel === ctx.config.model.default) {
      console.log(chalk.dim(`  Already using ${selectedModel}`));
      return 'handled';
    }

    // Load if on disk
    if (onDisk.some((a) => a.repo_id === selectedModel)) {
      const { default: ora } = await import('ora');
      const { ensureModelLoaded } = await import('../../lmx/model-lifecycle.js');
      const spinner = ora({ text: `Loading ${selectedModel}...`, color: 'magenta' }).start();
      try {
        selectedModel = await ensureModelLoaded(lmx, selectedModel, {
          timeoutMs: STABLE_MODEL_LOAD_TIMEOUT_MS,
        });
        spinner.succeed(`Loaded ${selectedModel}`);
      } catch (err) {
        spinner.fail(`Failed to load: ${String(err)}`);
        return 'handled';
      }
    }

    // Switch provider if cloud model selected
    if (cloudModels.some((m) => m.id === selectedModel)) {
      const { saveConfig } = await import('../../core/config.js');
      await saveConfig({
        provider: { ...ctx.config.provider, active: 'anthropic' },
        model: { default: selectedModel, contextLimit: 200000 },
      });
      ctx.session.model = selectedModel;
      console.log(
        chalk.green('\u2713') + ` Switched to ${selectedModel} ${chalk.dim('(Anthropic)')}`
      );
      return 'model-switched';
    }

    const { saveConfig } = await import('../../core/config.js');
    const ctxLimit = lookupContextLimit(selectedModel);
    await saveConfig({ model: { default: selectedModel, contextLimit: ctxLimit } });
    ctx.session.model = selectedModel;
    console.log(chalk.green('\u2713') + ` Switched to ${selectedModel}`);
    return 'model-switched';
  } catch {
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
      console.log(
        chalk.yellow(`  Unknown agent profile: ${args}`) + chalk.dim(' (try /agent to see options)')
      );
      return 'handled';
    }
    ctx.chatState.agentProfile = profile.name;
    const betaTag = profile.beta ? chalk.yellow(' [beta]') : '';
    console.log(
      chalk.green('\u2713') +
        ` Agent: ${chalk.bold(profile.name)}${betaTag} \u2014 ${chalk.dim(profile.description)}`
    );
    console.log(chalk.dim(`  Tools: ${profile.tools.length} enabled`));
    if (profile.suggestedModel) {
      console.log(
        chalk.dim(
          `  Suggested model: ${profile.suggestedModel} — switch with /model ${profile.suggestedModel}`
        )
      );
    }
    return 'handled';
  }

  // Interactive picker
  const { select } = await import('@inquirer/prompts');
  const profiles = listAgentProfiles();
  const currentProfile = ctx.chatState.agentProfile;

  const choices = profiles.map((p) => {
    const isCurrent = p.name === currentProfile;
    const dot = isCurrent ? chalk.green('\u25cf ') : '  ';
    const betaTag = p.beta ? chalk.yellow(' [beta]') : '';
    return {
      name: `${dot}${chalk.bold(p.name.padEnd(14))}${betaTag} ${chalk.dim(p.description)}  ${chalk.dim(`(${p.tools.length} tools)`)}`,
      value: p.name,
    };
  });

  let selected: string;
  try {
    const picked = await runMenuPrompt(
      (context) =>
        select(
          {
            message: chalk.dim('Select agent profile'),
            choices,
          },
          context
        ),
      'select'
    );
    if (!picked) return 'handled';
    selected = picked;
  } catch {
    return 'handled'; // Ctrl+C
  }

  const profile = getAgentProfile(selected);
  if (profile) {
    ctx.chatState.agentProfile = profile.name;
    const betaTag = profile.beta ? chalk.yellow(' [beta]') : '';
    console.log(
      chalk.green('\u2713') +
        ` Agent: ${chalk.bold(profile.name)}${betaTag} \u2014 ${chalk.dim(profile.description)}`
    );
    console.log(chalk.dim(`  Tools: ${profile.tools.length} enabled`));
    if (profile.suggestedModel) {
      console.log(
        chalk.dim(
          `  Suggested model: ${profile.suggestedModel} — switch with /model ${profile.suggestedModel}`
        )
      );
    }
  }
  return 'handled';
};

export const modelCommands: SlashCommandDef[] = [
  {
    command: 'model',
    description: 'Switch model — category picker with favourites and use-case grouping',
    handler: modelHandler,
    category: 'session',
    usage: '/model [name|fav [name]|group [sub-command]]',
    examples: [
      '/model llama3',
      '/model fav dolphin-mixtral',
      '/model group',
      '/model group add work "🏢 Work"',
      '/model',
    ],
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
