import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes } from 'react';

import parityArtifact from '@/lib/capabilities/parity.generated.json';
import OperationsPage from '@/app/operations/page';

vi.mock('@opta/ui', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  cn: (...values: Array<string | null | undefined | false>) =>
    values.filter(Boolean).join(' '),
}));

vi.mock('@/components/shared/ConnectionProvider', () => ({
  useConnectionContextSafe: () => ({
    baseUrl: 'http://127.0.0.1:1234',
    adminKey: 'admin-key',
  }),
}));

describe('OperationsPage', () => {
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

  it('renders all in_lmx_not_dashboard capabilities', () => {
    render(<OperationsPage />);

    expect(screen.getByRole('heading', { name: 'Operations' })).toBeTruthy();
    expect(screen.getAllByTestId('operation-item')).toHaveLength(
      parityArtifact.byCategory.in_lmx_not_dashboard.length,
    );
  });

  it('supports copy endpoint/payload and run action', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, source: 'test' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<OperationsPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy Endpoint' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Payload' }));

    expect(writeTextMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId('run-button'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('response-panel').textContent).toContain('"ok": true');
    });
  });
});

