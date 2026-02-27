import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { evaluatePolicyRequest, policyAuditPath } from '../../src/policy/engine.js';
import type { PolicyConfig, PolicyRequest } from '../../src/policy/types.js';

function baseConfig(overrides: Partial<PolicyConfig> = {}): PolicyConfig {
  return {
    enabled: true,
    mode: 'full',
    gateAllAutonomy: true,
    failureMode: 'closed',
    audit: { enabled: true },
    ...overrides,
  };
}

function request(overrides: Partial<PolicyRequest> = {}): PolicyRequest {
  return {
    action: 'run_command',
    autonomous: false,
    actor: 'agent',
    metadata: {},
    ...overrides,
  };
}

describe('policy engine', () => {
  let testCwd = '';

  beforeEach(async () => {
    testCwd = await mkdtemp(join(tmpdir(), 'opta-policy-engine-'));
  });

  afterEach(async () => {
    await rm(testCwd, { recursive: true, force: true });
  });

  it('gates all autonomous actions in full mode when gateAllAutonomy is enabled', async () => {
    const decision = await evaluatePolicyRequest(
      baseConfig({ gateAllAutonomy: true }),
      request({ autonomous: true }),
      { cwd: testCwd },
    );

    expect(decision.decision).toBe('gate');
    expect(decision.reason).toMatch(/gate-all/i);
  });

  it('allows non-autonomous actions in full mode', async () => {
    const decision = await evaluatePolicyRequest(
      baseConfig({ gateAllAutonomy: true }),
      request({ autonomous: false }),
      { cwd: testCwd },
    );

    expect(decision.decision).toBe('allow');
  });

  it('writes decision audits to JSONL', async () => {
    const decision = await evaluatePolicyRequest(
      baseConfig({ audit: { enabled: true } }),
      request({ action: 'edit_file', autonomous: true }),
      { cwd: testCwd, now: () => new Date('2026-02-22T12:00:00.000Z') },
    );

    const auditPath = policyAuditPath(testCwd);
    const raw = await readFile(auditPath, 'utf-8');
    const lines = raw.trim().split('\n');
    const parsed = JSON.parse(lines[0]!) as {
      decision: string;
      action: string;
      ts: string;
    };

    expect(lines).toHaveLength(1);
    expect(parsed.action).toBe('edit_file');
    expect(parsed.decision).toBe(decision.decision);
    expect(parsed.ts).toBe('2026-02-22T12:00:00.000Z');
  });

  it('fails closed when audit logging fails in fail-closed mode', async () => {
    await mkdir(join(testCwd, '.opta'), { recursive: true });
    await writeFile(join(testCwd, '.opta', 'policy'), 'block directory', 'utf-8');

    const decision = await evaluatePolicyRequest(
      baseConfig({ failureMode: 'closed', audit: { enabled: true } }),
      request({ autonomous: false }),
      { cwd: testCwd },
    );

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toMatch(/fail-closed/i);
  });
});
