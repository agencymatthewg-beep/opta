import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';

import { App } from '../../src/tui/App.js';
import { createTuiEmitter } from '../../src/tui/adapter.js';
import type { StartupConnectionNotice } from '../../src/tui/types.js';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

describe('App offline startup notice', () => {
  it('renders offline banner, CTA hints, and disables composer input', async () => {
    const notice: StartupConnectionNotice = {
      severity: 'error',
      bullets: ['LMX unreachable: 127.0.0.1:11434'],
      attemptedEndpoints: ['127.0.0.1:11434', 'localhost:11434'],
    };
    const emitter = createTuiEmitter();
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <App
        model="offline-model"
        sessionId="session-offline"
        emitter={emitter}
        onSubmit={onSubmit}
        startupConnectionNotice={notice}
      />,
      { stdout: { columns: 120, rows: 40 } as NodeJS.WriteStream },
    );

    await flush();
    expect(lastFrame()).toContain('OFFLINE');
    expect(lastFrame()).toContain('LMX unreachable');
    expect(lastFrame()).toContain('/server status');

    stdin.write('help');
    stdin.write('\r');
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
