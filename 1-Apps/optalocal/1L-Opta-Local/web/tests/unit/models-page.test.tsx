import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HTMLAttributes, ReactNode } from 'react';

// Mock ConnectionProvider so the page doesn't need a real connection
vi.mock('@/components/shared/ConnectionProvider', () => ({
  useConnectionContextSafe: () => null,
}));

// Mock framer-motion to avoid animation complexity in unit tests
vi.mock('framer-motion', () => {
  type MotionDivProps = HTMLAttributes<HTMLDivElement> & Record<string, unknown>;
  const MotionDiv = ({ children, layoutId, transition, initial, animate, exit, ...rest }: MotionDivProps) => {
    // Extracted to prevent framer-motion-specific props reaching the DOM
    void [layoutId, transition, initial, animate, exit];
    return <div {...rest}>{children}</div>;
  };
  return {
    motion: { div: MotionDiv },
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  };
});

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
