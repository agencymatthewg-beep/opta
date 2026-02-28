import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes } from 'react';

vi.mock('@opta/ui', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  cn: (...values: Array<string | null | undefined | false>) =>
    values.filter(Boolean).join(' '),
}));

import ServicesSettingsPage from '@/app/settings/services/page';

describe('ServicesSettingsPage', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads service status on mount', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ integrations: { github: { configured: true } } }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    render(<ServicesSettingsPage />);

    expect(screen.getByRole('heading', { name: 'Services' })).toBeTruthy();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/services/status',
        expect.objectContaining({
          method: 'GET',
          cache: 'no-store',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/github/i)).toBeTruthy();
    });
  });
});
