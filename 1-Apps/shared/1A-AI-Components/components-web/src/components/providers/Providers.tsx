"use client";

import { ReactNode } from "react";
import { CentralCardProvider } from "@/lib/hooks/useCentralCard";
import { CompareProvider } from "@/lib/context/CompareContext";

/**
 * Client-side providers wrapper
 * Wraps children with context providers that require client-side rendering
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <CentralCardProvider>
      <CompareProvider>
        {children}
      </CompareProvider>
    </CentralCardProvider>
  );
}
