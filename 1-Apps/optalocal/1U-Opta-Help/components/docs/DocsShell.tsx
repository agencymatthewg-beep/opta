"use client";

import { Nav } from "@/components/layout/Nav";
import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";
import { PlatformPreferenceProvider } from "@/components/docs/PlatformContext";
import { PlatformToggle } from "@/components/docs/PlatformToggle";
import { DiagnosticsBundlePanel } from "@/components/docs/DiagnosticsBundlePanel";
import { PlatformContextWarning } from "@/components/docs/PlatformContextWarning";
import { LearnAboutPanel } from "@/components/docs/LearnAboutPanel";

export function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <PlatformPreferenceProvider>
      <Nav />
      <div className="docs-embedded relative max-w-[92rem] mx-auto px-4 sm:px-6 pt-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.12),transparent_66%)]" />
        <div className="relative pt-3 pb-1 grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="xl:col-span-2">
            <PlatformToggle />
          </div>
          <DiagnosticsBundlePanel />
        </div>
        <div className="relative flex gap-8 min-h-[calc(100vh-5rem)]">
          <Sidebar />
          <main className="flex-1 min-w-0 py-8">
            <PlatformContextWarning />
            <LearnAboutPanel />
            {children}
          </main>
        </div>
      </div>
      <Footer />
    </PlatformPreferenceProvider>
  );
}
