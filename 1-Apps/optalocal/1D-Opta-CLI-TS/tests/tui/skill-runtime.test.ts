import { describe, expect, it } from 'vitest';
import { SkillRuntime } from '../../src/tui/skill-runtime.js';

describe('SkillRuntime', () => {
  it('loads requested skills and exposes active stack', () => {
    const runtime = new SkillRuntime();
    const result = runtime.reconcile(['playwright', 'reviewer'], { now: 1_000 });

    expect(result.loaded).toEqual(['playwright', 'reviewer']);
    expect(result.activeSkills).toEqual(['playwright', 'reviewer']);
  });

  it('refreshes existing skills without duplicating entries', () => {
    const runtime = new SkillRuntime();
    runtime.reconcile(['playwright'], { now: 1_000 });
    const result = runtime.reconcile(['playwright'], { now: 2_000 });

    expect(result.loaded).toEqual([]);
    expect(result.refreshed).toEqual(['playwright']);
    expect(result.activeSkills).toEqual(['playwright']);
  });

  it('unloads inactive skills when configured', () => {
    const runtime = new SkillRuntime();
    runtime.reconcile(['plan-skill', 'review-skill'], { now: 1_000 });

    const result = runtime.reconcile(['review-skill'], {
      now: 2_000,
      unloadInactive: true,
    });

    expect(result.unloaded).toContain('plan-skill');
    expect(result.activeSkills).toEqual(['review-skill']);
  });

  it('expires stale skills based on ttl', () => {
    const runtime = new SkillRuntime();
    runtime.reconcile(['research-skill'], { now: 1_000, ttlMs: 500 });

    const result = runtime.reconcile([], {
      now: 1_700,
      ttlMs: 500,
    });

    expect(result.expired).toEqual(['research-skill']);
    expect(result.activeSkills).toEqual([]);
  });

  it('evicts least-recently-active skills when reaching capacity', () => {
    const runtime = new SkillRuntime();
    runtime.reconcile(['skill-a'], { now: 1_000, maxActiveSkills: 2 });
    runtime.reconcile(['skill-b'], { now: 2_000, maxActiveSkills: 2 });

    const result = runtime.reconcile(['skill-c'], {
      now: 3_000,
      maxActiveSkills: 2,
    });

    expect(result.evicted).toEqual(['skill-a']);
    expect(result.activeSkills).toEqual(['skill-c', 'skill-b']);
  });
});
