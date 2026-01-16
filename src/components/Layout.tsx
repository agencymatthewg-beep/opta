import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import { OptaTextZone } from './OptaTextZone';
import { OptaTextZoneProvider, useOptaTextZone } from './OptaTextZoneContext';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

/**
 * Inner layout component that accesses the OptaTextZone context.
 */
function LayoutInner({ activePage, onNavigate, children }: LayoutProps) {
  const { state } = useOptaTextZone();

  return (
    <div className="flex min-h-screen">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        Skip to main content
      </a>

      {/* Sidebar navigation */}
      <motion.nav
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
        aria-label="Main navigation"
      >
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
      </motion.nav>

      {/* Main content area */}
      <ScrollArea className="flex-1 h-screen">
        <div className="flex flex-col h-full">
          {/* Text Zone at top */}
          <div className="p-4 pb-0">
            <OptaTextZone
              message={state.message}
              type={state.type}
              indicator={state.indicator}
              hint={state.hint}
            />
          </div>
          {/* Page content */}
          <main id="main-content" className="flex-1 p-8 max-w-7xl" role="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Main application layout with sidebar navigation.
 * Includes accessibility features: skip link, landmarks, and focus management.
 * Provides OptaTextZone context for global messaging.
 */
function Layout({ activePage, onNavigate, children }: LayoutProps) {
  return (
    <OptaTextZoneProvider>
      <LayoutInner activePage={activePage} onNavigate={onNavigate}>
        {children}
      </LayoutInner>
    </OptaTextZoneProvider>
  );
}

export default Layout;
