'use client';

import { ErrorFallback } from '@/components/shared/ErrorFallback';

export default function StackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} context="Stack" />;
}
