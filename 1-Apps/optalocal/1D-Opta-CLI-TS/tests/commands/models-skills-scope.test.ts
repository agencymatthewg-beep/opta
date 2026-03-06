import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSkillsCommand } from '../../src/commands/models/extensions.js';
import { deriveOpenClawAgentId } from '../../src/utils/openclaw-scope.js';

describe('models skills openclaw scope forwarding', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards deterministic OpenClaw agent identity when bridge scope is provided', async () => {
    const invoke = vi.fn().mockResolvedValue({
      ok: true,
      result: { status: 'ok' },
    });
    const client = {
      skillOpenClawInvoke: invoke,
    } as unknown as Parameters<typeof runSkillsCommand>[1];

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runSkillsCommand(
      'openclaw planner --args {"goal":"ship"}',
      client,
      { json: true, openclawScope: 'telegram:dm:peer-42' }
    );

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'planner',
        arguments: { goal: 'ship' },
        openclawAgentId: deriveOpenClawAgentId('telegram:dm:peer-42'),
      }),
      expect.any(Object)
    );

    logSpy.mockRestore();
  });
});
