"use client";

import { ReactNode } from "react";
import { CentralCardProvider } from "@/lib/hooks/useCentralCard";

interface MobileProvidersProps {
  children: ReactNode;
}

export function MobileProviders({ children }: MobileProvidersProps) {
  return (
    <CentralCardProvider>
      {children}
    </CentralCardProvider>
  );
}
