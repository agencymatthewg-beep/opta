import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes } from 'react';

import { CapabilityPanel } from '@/components/operations/CapabilityPanel';
import { CommandPalette } from '@/components/shared/CommandPalette';

vi.mock('@opta/ui', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  cn: (...values: Array<string | null | undefined | false>) =>
    values.filter(Boolean).join(' '),
}));

describe('copy-first actions', () => {
  const fetchMock = vi.fn();
  const writeTextMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('supports endpoint/payload/retry copy actions and explicit run now action', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'resp-123', ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(
      <CapabilityPanel
        endpointPath="/v1/responses"
        baseUrl="http://127.0.0.1:1234"
        adminKey="admin-key"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy Endpoint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Payload' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Retry Command' }));

    expect(writeTextMock).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole('button', { name: 'Run now' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('Response ID')).toBeTruthy();
    });
  });

  it('exposes copyable command templates in command palette', () => {
    render(<CommandPalette isOpen onClose={() => undefined} />);

    const copyButtons = screen.getAllByRole('button', { name: 'Copy' });
    expect(copyButtons.length).toBeGreaterThan(0);

    const firstCopyButton = copyButtons[0];
    if (!firstCopyButton) throw new Error('Expected at least one copy button');
    fireEvent.click(firstCopyButton);
    expect(writeTextMock).toHaveBeenCalled();

    expect(screen.getAllByRole('button', { name: 'Run now' }).length).toBeGreaterThan(0);
  });
});
