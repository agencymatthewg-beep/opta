'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@opta/ui';

interface ErrorFallbackProps {
  error: Error & { digest?: string };
  reset: () => void;
  context?: string;
}

export function ErrorFallback({ error, reset, context }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 text-center max-w-md">
        <AlertCircle className="mx-auto h-10 w-10 text-neon-red mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          Something went wrong
        </h2>
        {context && (
          <p className="text-sm text-text-secondary mb-2">{context}</p>
        )}
        <p className="text-sm text-text-muted mb-6 break-words">
          {error.message}
        </p>
        <Button variant="primary" size="md" onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
