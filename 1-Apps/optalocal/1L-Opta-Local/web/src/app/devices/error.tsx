'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@opta/ui';

export default function DevicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-neon-red mb-3" />
        <h2 className="text-lg font-semibold text-text-primary mb-1">
          Something went wrong
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          {error.message || 'Failed to load devices'}
        </p>
        <Button variant="glass" size="sm" onClick={reset}>
          Try again
        </Button>
      </div>
    </main>
  );
}
