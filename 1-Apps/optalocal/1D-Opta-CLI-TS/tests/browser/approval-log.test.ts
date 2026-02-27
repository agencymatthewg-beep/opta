import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BROWSER_APPROVAL_LOG_RELATIVE_PATH,
  browserApprovalLogPath,
  extractBrowserSessionId,
  appendBrowserApprovalEvent,
  readBrowserApprovalEvents,
  readRecentBrowserApprovalEvents,
  type BrowserApprovalEvent,
  type BrowserApprovalEventInput,
} from '../../src/browser/approval-log.js';

let testDir = '';

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'opta-approval-log-test-'));
});

afterEach(async () => {
  if (testDir) {
    await rm(testDir, { recursive: true, force: true });
    testDir = '';
  }
});

describe('BROWSER_APPROVAL_LOG_RELATIVE_PATH', () => {
  it('ends with approval-log.jsonl', () => {
    expect(BROWSER_APPROVAL_LOG_RELATIVE_PATH).toContain('approval-log.jsonl');
    expect(BROWSER_APPROVAL_LOG_RELATIVE_PATH).toContain('.opta');
    expect(BROWSER_APPROVAL_LOG_RELATIVE_PATH).toContain('browser');
  });
});

describe('browserApprovalLogPath', () => {
  it('joins cwd with relative path', () => {
    const result = browserApprovalLogPath('/test/project');
    expect(result).toBe(join('/test/project', BROWSER_APPROVAL_LOG_RELATIVE_PATH));
  });

  it('defaults to process.cwd() when no cwd given', () => {
    const result = browserApprovalLogPath();
    expect(result).toBe(join(process.cwd(), BROWSER_APPROVAL_LOG_RELATIVE_PATH));
  });
});

describe('extractBrowserSessionId', () => {
  it('extracts session_id from args', () => {
    expect(extractBrowserSessionId({ session_id: 'abc-123' })).toBe('abc-123');
  });

  it('extracts sessionId from args', () => {
    expect(extractBrowserSessionId({ sessionId: 'def-456' })).toBe('def-456');
  });

  it('prefers session_id over sessionId', () => {
    expect(extractBrowserSessionId({ session_id: 'first', sessionId: 'second' })).toBe('first');
  });

  it('returns undefined when neither key exists', () => {
    expect(extractBrowserSessionId({ other: 'value' })).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(extractBrowserSessionId({ session_id: '' })).toBeUndefined();
  });

  it('returns undefined for whitespace-only string', () => {
    expect(extractBrowserSessionId({ session_id: '   ' })).toBeUndefined();
  });

  it('trims whitespace from session id', () => {
    expect(extractBrowserSessionId({ session_id: '  abc  ' })).toBe('abc');
  });

  it('returns undefined for non-string values', () => {
    expect(extractBrowserSessionId({ session_id: 42 })).toBeUndefined();
    expect(extractBrowserSessionId({ session_id: null })).toBeUndefined();
    expect(extractBrowserSessionId({ session_id: true })).toBeUndefined();
  });
});

describe('appendBrowserApprovalEvent', () => {
  it('creates log file and appends event', async () => {
    const input: BrowserApprovalEventInput = {
      cwd: testDir,
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'browser_navigate',
      decision: 'approved',
      sessionId: 'sess-1',
      risk: 'low',
      actionKey: 'navigate',
      targetHost: 'example.com',
      targetOrigin: 'https://example.com',
      policyReason: 'allowed host',
    };
    await appendBrowserApprovalEvent(input);

    const logPath = browserApprovalLogPath(testDir);
    const raw = await readFile(logPath, 'utf-8');
    const event = JSON.parse(raw.trim()) as BrowserApprovalEvent;

    expect(event.timestamp).toBe('2026-02-23T10:00:00.000Z');
    expect(event.tool).toBe('browser_navigate');
    expect(event.decision).toBe('approved');
    expect(event.sessionId).toBe('sess-1');
    expect(event.risk).toBe('low');
    expect(event.actionKey).toBe('navigate');
    expect(event.targetHost).toBe('example.com');
    expect(event.target_origin).toBe('https://example.com');
    expect(event.policyReason).toBe('allowed host');
  });

  it('appends multiple events as separate lines', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'browser_navigate',
      decision: 'approved',
    });
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T10:01:00.000Z',
      tool: 'browser_click',
      decision: 'denied',
    });

    const logPath = browserApprovalLogPath(testDir);
    const raw = await readFile(logPath, 'utf-8');
    const lines = raw.trim().split('\n');
    expect(lines).toHaveLength(2);
  });

  it('uses current timestamp if not provided', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      tool: 'browser_navigate',
      decision: 'approved',
    });

    const logPath = browserApprovalLogPath(testDir);
    const raw = await readFile(logPath, 'utf-8');
    const event = JSON.parse(raw.trim()) as BrowserApprovalEvent;
    expect(event.timestamp).toBeTruthy();
    // Should be an ISO timestamp
    expect(() => new Date(event.timestamp)).not.toThrow();
  });

  it('trims sessionId before writing', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'browser_navigate',
      decision: 'approved',
      sessionId: '  sess-trimmed  ',
    });

    const logPath = browserApprovalLogPath(testDir);
    const raw = await readFile(logPath, 'utf-8');
    const event = JSON.parse(raw.trim()) as BrowserApprovalEvent;
    expect(event.sessionId).toBe('sess-trimmed');
  });

  it('omits sessionId if empty after trim', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'browser_navigate',
      decision: 'approved',
      sessionId: '   ',
    });

    const logPath = browserApprovalLogPath(testDir);
    const raw = await readFile(logPath, 'utf-8');
    const event = JSON.parse(raw.trim()) as BrowserApprovalEvent;
    expect(event.sessionId).toBeUndefined();
  });

  it('includes riskEvidence when provided', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'browser_navigate',
      decision: 'denied',
      riskEvidence: {
        classifier: 'static',
        matchedSignals: ['blocked-host'],
      },
    });

    const logPath = browserApprovalLogPath(testDir);
    const raw = await readFile(logPath, 'utf-8');
    const event = JSON.parse(raw.trim()) as BrowserApprovalEvent;
    expect(event.riskEvidence?.classifier).toBe('static');
    expect(event.riskEvidence?.matchedSignals).toEqual(['blocked-host']);
  });
});

describe('readBrowserApprovalEvents', () => {
  it('returns empty array when file does not exist', async () => {
    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toEqual([]);
  });

  it('reads and parses JSONL events', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'browser_navigate',
      decision: 'approved',
    });
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T10:01:00.000Z',
      tool: 'browser_click',
      decision: 'denied',
      risk: 'high',
    });

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(2);
    expect(events[0]!.tool).toBe('browser_navigate');
    expect(events[0]!.decision).toBe('approved');
    expect(events[1]!.tool).toBe('browser_click');
    expect(events[1]!.decision).toBe('denied');
    expect(events[1]!.risk).toBe('high');
  });

  it('skips malformed JSON lines', async () => {
    const logPath = browserApprovalLogPath(testDir);
    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    const content = [
      JSON.stringify({ timestamp: '2026-02-23T10:00:00.000Z', tool: 'nav', decision: 'approved' }),
      'not-valid-json',
      JSON.stringify({ timestamp: '2026-02-23T10:01:00.000Z', tool: 'click', decision: 'denied' }),
    ].join('\n') + '\n';
    await writeFile(logPath, content, 'utf-8');

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(2);
  });

  it('skips events missing required fields', async () => {
    const logPath = browserApprovalLogPath(testDir);
    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    const content = [
      JSON.stringify({ timestamp: '2026-02-23T10:00:00.000Z', tool: 'nav', decision: 'approved' }),
      JSON.stringify({ tool: 'click', decision: 'denied' }), // missing timestamp
      JSON.stringify({ timestamp: '2026-02-23T10:00:00.000Z', decision: 'approved' }), // missing tool
      JSON.stringify({ timestamp: '2026-02-23T10:00:00.000Z', tool: 'nav', decision: 'maybe' }), // invalid decision
      JSON.stringify({ timestamp: '2026-02-23T10:02:00.000Z', tool: 'type', decision: 'denied' }),
    ].join('\n') + '\n';
    await writeFile(logPath, content, 'utf-8');

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(2);
    expect(events[0]!.tool).toBe('nav');
    expect(events[1]!.tool).toBe('type');
  });

  it('skips empty lines', async () => {
    const logPath = browserApprovalLogPath(testDir);
    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    const content = '\n\n' + JSON.stringify({
      timestamp: '2026-02-23T10:00:00.000Z', tool: 'nav', decision: 'approved',
    }) + '\n\n';
    await writeFile(logPath, content, 'utf-8');

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(1);
  });

  it('parses optional fields correctly', async () => {
    const logPath = browserApprovalLogPath(testDir);
    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    const event = {
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'browser_navigate',
      decision: 'approved',
      sessionId: 'sess-1',
      risk: 'medium',
      actionKey: 'navigate',
      targetHost: 'example.com',
      target_origin: 'https://example.com',
      policyReason: 'allowed',
      riskEvidence: {
        classifier: 'adaptive-escalation',
        matchedSignals: ['high-regression'],
        adaptationReason: 'run-corpus escalation',
      },
    };
    await writeFile(logPath, JSON.stringify(event) + '\n', 'utf-8');

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(1);
    const parsed = events[0]!;
    expect(parsed.sessionId).toBe('sess-1');
    expect(parsed.risk).toBe('medium');
    expect(parsed.actionKey).toBe('navigate');
    expect(parsed.targetHost).toBe('example.com');
    expect(parsed.target_origin).toBe('https://example.com');
    expect(parsed.policyReason).toBe('allowed');
    expect(parsed.riskEvidence?.classifier).toBe('adaptive-escalation');
    expect(parsed.riskEvidence?.matchedSignals).toEqual(['high-regression']);
    expect(parsed.riskEvidence?.adaptationReason).toBe('run-corpus escalation');
  });

  it('rejects riskEvidence with invalid classifier', async () => {
    const logPath = browserApprovalLogPath(testDir);
    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    const event = {
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'nav',
      decision: 'approved',
      riskEvidence: {
        classifier: 'unknown-classifier',
        matchedSignals: [],
      },
    };
    await writeFile(logPath, JSON.stringify(event) + '\n', 'utf-8');

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(1);
    expect(events[0]!.riskEvidence).toBeUndefined();
  });

  it('filters non-string signals from matchedSignals', async () => {
    const logPath = browserApprovalLogPath(testDir);
    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    const event = {
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'nav',
      decision: 'approved',
      riskEvidence: {
        classifier: 'static',
        matchedSignals: ['valid', 42, null, 'also-valid'],
      },
    };
    await writeFile(logPath, JSON.stringify(event) + '\n', 'utf-8');

    const events = await readBrowserApprovalEvents(testDir);
    expect(events[0]!.riskEvidence?.matchedSignals).toEqual(['valid', 'also-valid']);
  });

  it('rejects non-object values (arrays, primitives, null)', async () => {
    const logPath = browserApprovalLogPath(testDir);
    await mkdir(join(testDir, '.opta', 'browser'), { recursive: true });
    const lines = [
      'null',
      '42',
      '"string"',
      '[1,2,3]',
      JSON.stringify({ timestamp: '2026-02-23T10:00:00.000Z', tool: 'ok', decision: 'approved' }),
    ].join('\n') + '\n';
    await writeFile(logPath, lines, 'utf-8');

    const events = await readBrowserApprovalEvents(testDir);
    expect(events).toHaveLength(1);
    expect(events[0]!.tool).toBe('ok');
  });

  it('rethrows non-ENOENT errors', async () => {
    // Read a directory instead of a file — produces EISDIR error on most platforms
    await mkdir(browserApprovalLogPath(testDir), { recursive: true });
    await expect(readBrowserApprovalEvents(testDir)).rejects.toThrow();
  });
});

describe('readRecentBrowserApprovalEvents', () => {
  it('returns empty array when no events exist', async () => {
    const events = await readRecentBrowserApprovalEvents(testDir);
    expect(events).toEqual([]);
  });

  it('returns last N events in reverse order', async () => {
    for (let i = 0; i < 5; i++) {
      await appendBrowserApprovalEvent({
        cwd: testDir,
        timestamp: `2026-02-23T10:0${i}:00.000Z`,
        tool: `tool-${i}`,
        decision: 'approved',
      });
    }

    const events = await readRecentBrowserApprovalEvents(testDir, 3);
    expect(events).toHaveLength(3);
    // Should be reversed — most recent first
    expect(events[0]!.tool).toBe('tool-4');
    expect(events[1]!.tool).toBe('tool-3');
    expect(events[2]!.tool).toBe('tool-2');
  });

  it('defaults to 10 with invalid limit', async () => {
    for (let i = 0; i < 15; i++) {
      await appendBrowserApprovalEvent({
        cwd: testDir,
        timestamp: `2026-02-23T10:${String(i).padStart(2, '0')}:00.000Z`,
        tool: `tool-${i}`,
        decision: 'approved',
      });
    }

    const events = await readRecentBrowserApprovalEvents(testDir, -1);
    expect(events).toHaveLength(10);
  });

  it('returns all events reversed if fewer than limit', async () => {
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T10:00:00.000Z',
      tool: 'first',
      decision: 'approved',
    });
    await appendBrowserApprovalEvent({
      cwd: testDir,
      timestamp: '2026-02-23T10:01:00.000Z',
      tool: 'second',
      decision: 'denied',
    });

    const events = await readRecentBrowserApprovalEvents(testDir, 50);
    expect(events).toHaveLength(2);
    expect(events[0]!.tool).toBe('second');
    expect(events[1]!.tool).toBe('first');
  });
});
