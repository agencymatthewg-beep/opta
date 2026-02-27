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
    console.error("[ai-components] Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8 bg-opta-bg">
      <div className="max-w-md text-center">
        <h2 className="mb-4 text-2xl font-semibold text-white">
          Something went wrong
        </h2>
        <p className="mb-6 text-white/60">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-white backdrop-blur-sm border border-white/10 transition-colors hover:bg-white/20"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
