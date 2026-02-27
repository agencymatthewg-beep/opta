import { parentPort } from 'node:worker_threads';

interface ToolJob {
  id: string;
  tool: string;
  argsJson: string;
}

let cachedExecuteTool: ((name: string, argsJson: string) => Promise<string>) | null = null;
let runtimeReady = false;

async function ensureRuntimeReady(): Promise<void> {
  if (runtimeReady) return;
  runtimeReady = true;
  if (import.meta.url.endsWith('.ts')) {
    const { register } = await import('tsx/esm/api');
    register();
  }
}

async function loadExecuteTool(): Promise<(name: string, argsJson: string) => Promise<string>> {
  if (cachedExecuteTool) return cachedExecuteTool;
  await ensureRuntimeReady();
  const mod = await import('../core/tools/executors.js');
  const executeTool = (mod as { executeTool?: (name: string, argsJson: string) => Promise<string> }).executeTool;
  if (typeof executeTool !== 'function') {
    throw new Error('Worker tool runtime missing executeTool export');
  }
  cachedExecuteTool = executeTool;
  return executeTool;
}

if (parentPort) {
  parentPort.on('message', async (job: ToolJob) => {
    try {
      const executeTool = await loadExecuteTool();
      const result = await executeTool(job.tool, job.argsJson);
      parentPort!.postMessage({ id: job.id, ok: true, result });
    } catch (err) {
      parentPort!.postMessage({
        id: job.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
