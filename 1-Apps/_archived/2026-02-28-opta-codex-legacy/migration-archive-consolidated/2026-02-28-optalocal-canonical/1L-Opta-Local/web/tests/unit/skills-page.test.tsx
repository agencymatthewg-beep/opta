import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SkillsPage from '@/app/skills/page';

const listSkills = vi.fn();
const executeSkill = vi.fn();
const mockClient = {
  listSkills,
  executeSkill,
};
const mockConnection = { client: mockClient };

vi.mock('@/components/shared/ConnectionProvider', () => ({
  useConnectionContextSafe: () => mockConnection,
}));

describe('SkillsPage', () => {
  beforeEach(() => {
    listSkills.mockResolvedValue({
      data: [
        { name: 'echo', description: 'Echo skill' },
        { name: 'summarize', description: 'Summary skill' },
      ],
    });
    executeSkill.mockResolvedValue({
      skill: 'echo',
      ok: true,
      output: { text: 'hello' },
      duration_ms: 12,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads and renders available skills', async () => {
    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-item')).toHaveLength(2);
    });
  });

  it('executes selected skill with JSON arguments', async () => {
    render(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId('skill-item')).toHaveLength(2);
    });

    fireEvent.change(screen.getByTestId('skill-payload-input'), {
      target: { value: '{ "message": "run this" }' },
    });
    fireEvent.click(screen.getByTestId('run-skill-button'));

    await waitFor(() => {
      expect(executeSkill).toHaveBeenCalledWith('echo', {
        arguments: { message: 'run this' },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('skill-result-panel').textContent).toContain(
        '"ok": true',
      );
    });
  });
});
