import { loadConfig } from '../src/core/config.js';
import { dispatchSlashCommand } from '../src/commands/slash/index.js';

async function run() {
  const cfg = await loadConfig();
  const session = { id: `live-stability-sweep-${Date.now()}`, messages: [] as any[] } as any;
  const ctx = { session, config: cfg, chatState: {} as any } as any;
  const model = cfg.model.default;
  const cmds = [
    '/memory',
    `/load ${model}`,
    '/memory',
    `/unload ${model}`,
    '/memory',
    `/load ${model} --backend mlx-lm --kv-bits 4 --prefix-cache false`,
    '/memory',
    `/unload ${model}`,
    '/memory',
    `/autotune ${model} --runs 1 --max-tokens 32 --temperature 0 --profiles-json "[{\\"backend\\":\\"mlx-lm\\",\\"kv_bits\\":4,\\"prefix_cache\\":false}]"`,
    `/autotune-status ${model}`,
    `/load ${model}`,
    '/memory',
  ];

  for (const cmd of cmds) {
    console.log(`\n>>> ${cmd}`);
    try {
      await dispatchSlashCommand(cmd, ctx);
    } catch (err) {
      console.error(`Command failed: ${cmd}`);
      console.error(err);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
