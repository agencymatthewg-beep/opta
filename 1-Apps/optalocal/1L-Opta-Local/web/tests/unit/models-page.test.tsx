import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HTMLAttributes, ReactNode } from 'react';

// Mock ConnectionProvider so the page doesn't need a real connection
vi.mock('@/components/shared/ConnectionProvider', () => ({
  useConnectionContextSafe: () => null,
}));

// Mock framer-motion to avoid animation complexity in unit tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: HTMLAttributes<HTMLDivElement>) =>
      <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) =>
    <>{children}</>,
}));

import ModelsPage from '@/app/models/page';

afterEach(() => {
  cleanup();
});

describe('ModelsPage', () => {
  it('renders the page header', () => {
    render(<ModelsPage />);
    expect(screen.getByRole('heading', { name: /models/i })).toBeTruthy();
  });

  it('shows offline state when no client', () => {
    render(<ModelsPage />);
    expect(screen.getByText(/not connected/i)).toBeTruthy();
  });
});
