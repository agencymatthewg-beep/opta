import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock ConnectionProvider so the page doesn't need a real connection
vi.mock('@/components/shared/ConnectionProvider', () => ({
  useConnectionContextSafe: () => null,
}));

// Mock framer-motion to avoid animation complexity in unit tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) =>
      <div {...p}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    <>{children}</>,
}));

import ModelsPage from '@/app/models/page';

describe('ModelsPage', () => {
  it('renders the page header', () => {
    render(<ModelsPage />);
    expect(screen.getByRole('heading', { name: /models/i })).toBeInTheDocument();
  });

  it('shows offline state when no client', () => {
    render(<ModelsPage />);
    expect(screen.getByText(/not connected/i)).toBeInTheDocument();
  });
});
