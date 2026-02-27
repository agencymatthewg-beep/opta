import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentRun, AgentRunEvent } from '@/types/agents';
import AgentRunsPage from '@/app/agents/runs/page';

const listAgentRuns = vi.fn();
const getAgentRun = vi.fn();
const cancelAgentRun = vi.fn();
const streamAgentRunEvents = vi.fn();
const mockClient = {
  listAgentRuns,
  getAgentRun,
  cancelAgentRun,
  streamAgentRunEvents,
};
const mockConnection = { client: mockClient };

vi.mock('@/components/shared/ConnectionProvider', () => ({
  useConnectionContextSafe: () => mockConnection,
}));

function createRun(overrides: Partial<AgentRun>): AgentRun {
  return {
    id: 'run-default',
    status: 'queued',
    created_at: 1700000000,
    updated_at: 1700000001,
    ...overrides,
  };
}

function createEvents(): AsyncGenerator<AgentRunEvent> {
  async function* generator() {
    yield { type: 'step.started', data: { step: 'compile' } };
    yield { type: 'step.completed', data: { step: 'compile' } };
  }
  return generator();
}

describe('AgentRunsPage', () => {
  beforeEach(() => {
    listAgentRuns.mockResolvedValue({
      data: [
        createRun({ id: 'run-1', status: 'running' }),
        createRun({ id: 'run-2', status: 'queued' }),
      ],
      total: 2,
    });
    getAgentRun.mockResolvedValue(createRun({ id: 'run-1', status: 'running' }));
    cancelAgentRun.mockResolvedValue(
      createRun({ id: 'run-1', status: 'cancelled' }),
    );
    streamAgentRunEvents.mockImplementation(() => createEvents());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads run list and selected run detail', async () => {
    render(<AgentRunsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('agent-run-item')).toHaveLength(2);
    });

    await waitFor(() => {
      expect(screen.getByTestId('selected-run-status').textContent).toBe('running');
    });
  });

  it('cancels selected run and streams events', async () => {
    render(<AgentRunsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('agent-run-item')).toHaveLength(2);
    });

    fireEvent.click(screen.getByTestId('cancel-run-button'));

    await waitFor(() => {
      expect(cancelAgentRun).toHaveBeenCalledWith('run-1');
    });

    fireEvent.click(screen.getByTestId('load-events-button'));

    await waitFor(() => {
      expect(streamAgentRunEvents).toHaveBeenCalledWith('run-1');
    });

    await waitFor(() => {
      expect(screen.getByTestId('run-events-panel').textContent).toContain(
        'step.started',
      );
    });
  });
});
