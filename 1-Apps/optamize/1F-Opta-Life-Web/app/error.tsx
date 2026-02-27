"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[opta-life] Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="mb-4 text-2xl font-semibold text-text-primary">
          Something went wrong
        </h2>
        <p className="mb-6 text-text-primary/60">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
