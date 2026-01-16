import { ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { OptaTextZone } from './OptaTextZone';
import { OptaTextZoneProvider, useOptaTextZone } from './OptaTextZoneContext';
import { OptaRingProvider, useOptaRing } from '@/contexts/OptaRingContext';
import { FogProvider, useFog } from '@/contexts/FogContext';
import { Background } from './Background';
import { FloatingRingOverlay } from './FloatingRingOverlay';
import { ScrollArea } from '@/components/ui/scroll-area';
import { pageContentVariants } from '@/lib/pageTransitions';
import { cn } from '@/lib/utils';

/**
 * Layout - The Living Artifact Container
 *
 * Orchestrates the OptaRing and AtmosphericFog during page navigation.
 * The ring is the PROTAGONIST - it moves to center, ignites, and
 * dissolves as content appears.
 *
 * Providers:
 * - OptaRingProvider: Global ring state for transitions
 * - FogProvider: Global fog intensity for atmosphere
 * - OptaTextZoneProvider: Global messaging system
 *
 * @see DESIGN_SYSTEM.md - Part 5: The Living Artifact State System
 * @see pageTransitions.ts - Ring + fog orchestration
 */

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}


/**
 * Inner layout component that accesses contexts.
 */
function LayoutInner({ activePage, onNavigate, children }: LayoutProps) {
  const { state: textZoneState } = useOptaTextZone();
  const ringContext = useOptaRing();
  const fogContext = useFog();
  const prevPageRef = useRef(activePage);
  const isFirstRender = useRef(true);

  // Page transition orchestration
  useEffect(() => {
    // Skip transition on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Only trigger transition if page actually changed
    if (prevPageRef.current !== activePage) {
      prevPageRef.current = activePage;

      // Orchestrate ring + fog transition
      const runTransition = async () => {
        // 1. Activate fog atmosphere
        fogContext.activate();

        // 2. Trigger ring page transition (center → ignite → dissolve)
        await ringContext.triggerPageTransition();

        // 3. Return fog to idle
        fogContext.idle();
      };

      runTransition();
    }
  }, [activePage, ringContext, fogContext]);

  return (
    <div className="relative flex min-h-screen">
      {/* The Living Void - Background with integrated fog */}
      <Background />

      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className={cn(
          'sr-only focus:not-sr-only',
          'focus:absolute focus:top-4 focus:left-4 focus:z-50',
          'focus:px-4 focus:py-2 focus:rounded-xl',
          'focus:bg-primary focus:text-white',
          'focus:outline-none focus:ring-2 focus:ring-primary/50',
          'focus:shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]'
        )}
      >
        Skip to main content
      </a>

      {/* Sidebar navigation - Fixed obsidian spine */}
      <nav aria-label="Main navigation">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
      </nav>

      {/* Main content area */}
      <ScrollArea className="flex-1 h-screen">
        <div className="flex flex-col h-full">
          {/* Text Zone at top */}
          <div className="p-4 pb-0">
            <OptaTextZone
              message={textZoneState.message}
              type={textZoneState.type}
              indicator={textZoneState.indicator}
              hint={textZoneState.hint}
            />
          </div>

          {/* Page content with ignition animation */}
          <AnimatePresence mode="wait">
            <motion.main
              key={activePage}
              id="main-content"
              className="flex-1 p-8 max-w-7xl"
              role="main"
              tabIndex={-1}
              variants={pageContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Floating Ring Overlay - Appears during page transitions */}
      <FloatingRingOverlay />
    </div>
  );
}

/**
 * Main application layout with obsidian aesthetic.
 *
 * Includes:
 * - OptaRing as protagonist (sidebar + floating overlay)
 * - Atmospheric fog integration
 * - Page transition orchestration
 * - Accessibility features: skip link, landmarks, focus management
 */
function Layout({ activePage, onNavigate, children }: LayoutProps) {
  return (
    <FogProvider>
      <OptaRingProvider>
        <OptaTextZoneProvider>
          <LayoutInner activePage={activePage} onNavigate={onNavigate}>
            {children}
          </LayoutInner>
        </OptaTextZoneProvider>
      </OptaRingProvider>
    </FogProvider>
  );
}

export default Layout;
