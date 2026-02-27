import { describe, expect, it } from 'vitest';
import { ToolWorkerPool } from '../../src/daemon/worker-pool.js';

describe('ToolWorkerPool', () => {
  it('executes tools in a worker thread', async () => {
    const pool = new ToolWorkerPool();
    try {
      const result = await pool.runTool('find_files', JSON.stringify({
        pattern: 'package.json',
        path: '.',
      }));
      expect(result).toContain('package.json');
      const stats = pool.getStats();
      expect(stats.workers).toBeGreaterThan(0);
    } finally {
      await pool.close();
    }
  });

  it('aborts running tool execution when signal is cancelled', async () => {
    const pool = new ToolWorkerPool();
    const controller = new AbortController();

    try {
      const pending = pool.runTool('run_command', JSON.stringify({
        command: 'node -e "setTimeout(() => {}, 5000)"',
        timeout: 15000,
      }), controller.signal);

      setTimeout(() => controller.abort(), 50);

      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    } finally {
      await pool.close();
    }
  }, 15000);

  it('reuses worker slots up to the configured pool size', async () => {
    const pool = new ToolWorkerPool(2);
    try {
      const jobs = Array.from({ length: 6 }, () =>
        pool.runTool('run_command', JSON.stringify({
          command: 'node -e "setTimeout(() => {}, 120)"',
          timeout: 4000,
        }))
      );
      await Promise.all(jobs);
      const stats = pool.getStats();
      expect(stats.workers).toBeLessThanOrEqual(2);
      expect(stats.busy).toBe(0);
      expect(stats.queued).toBe(0);
    } finally {
      await pool.close();
    }
  }, 15000);
});
