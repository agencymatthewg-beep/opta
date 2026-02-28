'use client';

import { ErrorFallback } from '@/components/shared/ErrorFallback';

export default function BenchmarkError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} context="Benchmark" />;
}
