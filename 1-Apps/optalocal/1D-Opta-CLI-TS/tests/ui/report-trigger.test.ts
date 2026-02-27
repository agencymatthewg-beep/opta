import { describe, it, expect } from 'vitest';
import {
  shouldAutoReport,
  resolveReportConfig,
  buildSessionReportSections,
  buildPlanReportSections,
  type ReportConfig,
} from '../../src/ui/report-trigger.js';
import type { TurnStats } from '../../src/tui/adapter.js';
import type { Session } from '../../src/memory/store.js';
import type { OptaConfig } from '../../src/core/config.js';

function makeTurnStats(overrides: Partial<TurnStats> = {}): TurnStats {
  return {
    tokens: 500,
    promptTokens: 200,
    completionTokens: 300,
    toolCalls: 5,
    elapsed: 30,
    speed: 10,
    firstTokenLatencyMs: 250,
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session-001',
    created: '2026-02-27T10:00:00Z',
    updated: '2026-02-27T10:05:00Z',
    model: 'llama-3-8b',
    cwd: '/tmp/test-project',
    title: 'Test Session',
    tags: [],
    messages: [
      { role: 'user', content: 'Implement the auth feature' },
      {
        role: 'assistant',
        content: 'I decided to use JWT tokens. The approach involves creating a middleware.',
        tool_calls: [
          {
            id: 'tc_1',
            type: 'function' as const,
            function: { name: 'read_file', arguments: '{"path":"src/auth.ts"}' },
          },
          {
            id: 'tc_2',
            type: 'function' as const,
            function: { name: 'edit_file', arguments: '{"path":"src/middleware.ts"}' },
          },
        ],
      },
      { role: 'tool', content: 'file contents here', tool_call_id: 'tc_1' },
      { role: 'tool', content: 'edit applied', tool_call_id: 'tc_2' },
      { role: 'assistant', content: 'The auth feature has been implemented successfully.' },
    ],
    toolCallCount: 2,
    compacted: false,
    ...overrides,
  };
}

function makeDefaultReportConfig(): ReportConfig {
  return {
    enabled: true,
    autoOpen: true,
    outputDir: '.opta/reports',
    threshold: {
      toolCalls: 15,
      elapsedSeconds: 120,
    },
  };
}

// ── shouldAutoReport ──

describe('shouldAutoReport', () => {
  it('returns null when reports are disabled', () => {
    const config = { ...makeDefaultReportConfig(), enabled: false };
    const stats = makeTurnStats({ toolCalls: 100, elapsed: 999 });
    expect(shouldAutoReport(stats, undefined, config)).toBeNull();
  });

  it('returns "plan" for plan mode regardless of thresholds', () => {
    const config = makeDefaultReportConfig();
    const stats = makeTurnStats({ toolCalls: 1, elapsed: 5 });
    expect(shouldAutoReport(stats, 'plan', config)).toBe('plan');
  });

  it('returns "autonomous" when tool calls exceed threshold', () => {
    const config = makeDefaultReportConfig();
    const stats = makeTurnStats({ toolCalls: 15, elapsed: 10 });
    expect(shouldAutoReport(stats, undefined, config)).toBe('autonomous');
  });

  it('returns "autonomous" when elapsed exceeds threshold', () => {
    const config = makeDefaultReportConfig();
    const stats = makeTurnStats({ toolCalls: 3, elapsed: 120 });
    expect(shouldAutoReport(stats, undefined, config)).toBe('autonomous');
  });

  it('returns null when below both thresholds', () => {
    const config = makeDefaultReportConfig();
    const stats = makeTurnStats({ toolCalls: 5, elapsed: 30 });
    expect(shouldAutoReport(stats, undefined, config)).toBeNull();
  });

  it('returns null for low tool count in non-plan mode', () => {
    const config = makeDefaultReportConfig();
    const stats = makeTurnStats({ toolCalls: 2, elapsed: 10 });
    expect(shouldAutoReport(stats, 'review', config)).toBeNull();
  });

  it('respects custom thresholds', () => {
    const config: ReportConfig = {
      ...makeDefaultReportConfig(),
      threshold: { toolCalls: 5, elapsedSeconds: 30 },
    };
    const stats = makeTurnStats({ toolCalls: 5, elapsed: 10 });
    expect(shouldAutoReport(stats, undefined, config)).toBe('autonomous');
  });
});

// ── resolveReportConfig ──

describe('resolveReportConfig', () => {
  it('returns defaults when no reports section exists', () => {
    const config = {} as OptaConfig;
    const rc = resolveReportConfig(config);
    expect(rc.enabled).toBe(true);
    expect(rc.autoOpen).toBe(true);
    expect(rc.outputDir).toBe('.opta/reports');
    expect(rc.threshold.toolCalls).toBe(15);
    expect(rc.threshold.elapsedSeconds).toBe(120);
  });

  it('merges partial config', () => {
    const config = { reports: { enabled: false, threshold: { toolCalls: 50 } } } as unknown as OptaConfig;
    const rc = resolveReportConfig(config);
    expect(rc.enabled).toBe(false);
    expect(rc.threshold.toolCalls).toBe(50);
    expect(rc.threshold.elapsedSeconds).toBe(120); // default
  });
});

// ── buildSessionReportSections ──

describe('buildSessionReportSections', () => {
  it('always includes stats-grid and session key-value sections', () => {
    const session = makeSession();
    const stats = makeTurnStats();
    const sections = buildSessionReportSections(session, stats, 'autonomous', {
      created: [],
      modified: [],
      deleted: [],
    });

    const types = sections.map((s) => s.type);
    expect(types).toContain('stats-grid');
    expect(types).toContain('key-value');
    expect(types).toContain('section-header');
  });

  it('includes tool timeline when session has tool calls', () => {
    const session = makeSession();
    const stats = makeTurnStats({ toolCalls: 2 });
    const sections = buildSessionReportSections(session, stats, 'autonomous', {
      created: [],
      modified: [],
      deleted: [],
    });

    const types = sections.map((s) => s.type);
    expect(types).toContain('timeline');
  });

  it('includes file-changes section when files were changed', () => {
    const session = makeSession();
    const stats = makeTurnStats();
    const sections = buildSessionReportSections(session, stats, 'autonomous', {
      created: ['src/new.ts'],
      modified: ['src/old.ts'],
      deleted: [],
    });

    const types = sections.map((s) => s.type);
    expect(types).toContain('file-changes');
  });

  it('omits file-changes section when no files changed', () => {
    const session = makeSession({ messages: [] });
    const stats = makeTurnStats();
    const sections = buildSessionReportSections(session, stats, 'manual', {
      created: [],
      modified: [],
      deleted: [],
    });

    const fileChangeSections = sections.filter((s) => s.type === 'file-changes');
    expect(fileChangeSections).toHaveLength(0);
  });

  it('extracts decisions from assistant messages', () => {
    const session = makeSession();
    const stats = makeTurnStats();
    const sections = buildSessionReportSections(session, stats, 'autonomous', {
      created: [],
      modified: [],
      deleted: [],
    });

    const listSections = sections.filter((s) => s.type === 'list');
    // "decided" appears in the test session's assistant message
    expect(listSections.length).toBeGreaterThanOrEqual(1);
  });

  it('includes intent sentence in key-value pairs', () => {
    const session = makeSession();
    const stats = makeTurnStats();
    const sections = buildSessionReportSections(session, stats, 'autonomous', {
      created: [],
      modified: [],
      deleted: [],
    });

    const kvSection = sections.find((s) => s.type === 'key-value');
    expect(kvSection).toBeDefined();
    if (kvSection?.type === 'key-value') {
      const intentPair = kvSection.pairs.find((p) => p.key === 'Intent');
      expect(intentPair).toBeDefined();
      expect(intentPair!.value).toContain('implementation task');
    }
  });

  it('shows report trigger reason in session info', () => {
    const session = makeSession();
    const stats = makeTurnStats();
    const sections = buildSessionReportSections(session, stats, 'benchmark', {
      created: [],
      modified: [],
      deleted: [],
    });

    const kvSection = sections.find((s) => s.type === 'key-value');
    if (kvSection?.type === 'key-value') {
      const triggerPair = kvSection.pairs.find((p) => p.key === 'Report Trigger');
      expect(triggerPair?.value).toBe('benchmark');
    }
  });
});

// ── buildPlanReportSections ──

describe('buildPlanReportSections', () => {
  it('includes metrics, context, and plan text', () => {
    const session = makeSession({
      messages: [
        { role: 'user', content: 'Plan the refactoring' },
        { role: 'assistant', content: 'Step 1: Extract hooks\nStep 2: Test\nStep 3: Review' },
      ],
    });
    const stats = makeTurnStats();
    const sections = buildPlanReportSections(session, stats);

    const types = sections.map((s) => s.type);
    expect(types).toContain('stats-grid');
    expect(types).toContain('key-value');
    expect(types).toContain('text-block');
    expect(types).toContain('divider');
    expect(types).toContain('section-header');
  });

  it('includes plan content from last assistant message', () => {
    const planText = 'Phase 1: Design\nPhase 2: Implement\nPhase 3: Ship';
    const session = makeSession({
      messages: [
        { role: 'user', content: 'Plan' },
        { role: 'assistant', content: planText },
      ],
    });
    const stats = makeTurnStats();
    const sections = buildPlanReportSections(session, stats);

    const textBlock = sections.find((s) => s.type === 'text-block');
    expect(textBlock).toBeDefined();
    if (textBlock?.type === 'text-block') {
      expect(textBlock.content).toContain('Phase 1: Design');
    }
  });

  it('handles empty plan gracefully', () => {
    const session = makeSession({ messages: [] });
    const stats = makeTurnStats();
    const sections = buildPlanReportSections(session, stats);

    const textBlock = sections.find((s) => s.type === 'text-block');
    if (textBlock?.type === 'text-block') {
      expect(textBlock.content).toBe('No plan content generated.');
    }
  });
});
