import { describe, expect, it } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { BrowserManagerRail } from '../../src/tui/BrowserManagerRail.js';

describe('BrowserManagerRail', () => {
  it('keeps emergency controls visible in safe mode', () => {
    const { lastFrame } = render(
      <BrowserManagerRail
        safeMode={true}
        browserHealth={null}
        pendingApprovals={[
          {
            requestId: 'req-001',
            toolName: 'browser_click',
            requestedAt: '2026-02-24T12:00:00.000Z',
            risk: 'high',
            actionKey: 'delete',
            targetHost: 'example.com',
          },
        ]}
        recentApprovals={[]}
        busy={false}
        message=""
        messageStatus="info"
      />,
      { stdout: { columns: 140, rows: 20 } as NodeJS.WriteStream },
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Browser controls: Ctrl+P pause/resume');
    expect(frame).toContain('Ctrl+X kill');
    expect(frame).toContain('state=offline');
    expect(frame).toContain('pending=1 (high=1, med=0, low=0)');
  });

  it('shows blocked runtime state when high-risk approvals are queued', () => {
    const { lastFrame } = render(
      <BrowserManagerRail
        browserHealth={{
          running: true,
          paused: false,
          killed: false,
          maxSessions: 3,
          sessionCount: 1,
          recoveredSessionIds: [],
          profilePrune: {
            enabled: true,
            inFlight: false,
            lastStatus: 'success',
          },
          sessions: [],
        }}
        pendingApprovals={[
          {
            requestId: 'req-002',
            toolName: 'browser_click',
            requestedAt: '2026-02-24T12:00:00.000Z',
            risk: 'high',
            actionKey: 'delete',
            targetHost: 'example.com',
          },
        ]}
        recentApprovals={[]}
        busy={false}
        message=""
        messageStatus="info"
      />,
      { stdout: { columns: 140, rows: 20 } as NodeJS.WriteStream },
    );

    const frame = lastFrame() ?? '';
    expect(frame).toContain('Browser Manager Rail [blocked]');
    expect(frame).toContain('high-risk approval');
  });
});
