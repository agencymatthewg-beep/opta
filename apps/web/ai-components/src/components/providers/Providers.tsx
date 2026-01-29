"use client";

import { ReactNode } from "react";
import { CentralCardProvider } from "@/lib/hooks/useCentralCard";

/**
 * Client-side providers wrapper
 * Wraps children with context providers that require client-side rendering
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <CentralCardProvider>
      {children}
    </CentralCardProvider>
  );
}
