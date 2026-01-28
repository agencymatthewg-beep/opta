import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OptaTextZone } from './OptaTextZone';
import { OptaTextZoneProvider, useOptaTextZone } from './OptaTextZoneContext';
import { OptaRingProvider, useOptaRing } from '@/contexts/OptaRingContext';
import { FogProvider, useFog } from '@/contexts/FogContext';
import { RadialNavProvider, useRadialNav } from '@/contexts/RadialNavContext';
import { ParticleProvider } from '@/contexts/ParticleContext';
import { Background } from './Background';
import { RadialNav, UtilityIsland, useRadialNavKeyboard } from './navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { pageContentVariants } from '@/lib/pageTransitions';
import { cn } from '@/lib/utils';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useNavigationHistory } from '@/hooks/useNavigationHistory';
import { SwipeIndicator } from './SwipeIndicator';
import { GestureHints } from './Gestures';
import { ParticleField } from '@/components/effects/ParticleField';
import { PersistentRing } from '@/components/OptaRing3D';
import { ChromeCanvas } from '@/components/chrome';

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
 * - ParticleProvider: Global particle environment state (Phase 32)
 *
 * Phase 32 Features:
 * - ParticleField: Ambient floating dust motes
 * - Ring attraction during processing state
 * - Reduced motion fallback (static dots)
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
 * Uses RadialNav for center-focused navigation.
 */
function LayoutInner({ activePage, onNavigate, children }: LayoutProps) {
  const { state: textZoneState } = useOptaTextZone();
  const ringContext = useOptaRing();
  const fogContext = useFog();
  const prevPageRef = useRef(activePage);
  const isFirstRender = useRef(true);

  // Access RadialNav context for home view state
  const { isHomeView } = useRadialNav();

  // Enable global keyboard shortcuts for radial navigation
  useRadialNavKeyboard();

  // Navigation history for back/forward support
  const {
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    navigate: historyNavigate,
  } = useNavigationHistory(activePage, onNavigate);

  // Swipe navigation for trackpad gestures
  const {
    swipeProgress,
    swipeDirection,
    rubberBandOffset,
    isAtBoundary,
  } = useSwipeNavigation({
    onSwipeLeft: () => {
      if (canGoForward) {
        goForward();
      }
    },
    onSwipeRight: () => {
      if (canGoBack) {
        goBack();
      }
    },
    canSwipeLeft: canGoForward,
    canSwipeRight: canGoBack,
    enabled: !isHomeView, // Only enable swipe when viewing a page
  });

  // Track whether to show gesture hints (first-time user)
  const [showGestureHints, setShowGestureHints] = useState(false);

  // Show gesture hints after first navigation
  useEffect(() => {
    if (!isHomeView && !isFirstRender.current) {
      // Delay showing hints to not overwhelm user
      const timer = setTimeout(() => setShowGestureHints(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isHomeView]);

  // Sync navigation history when page changes from external source
  useEffect(() => {
    if (activePage !== prevPageRef.current) {
      historyNavigate(activePage);
    }
  }, [activePage, historyNavigate]);

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
    <div className="relative min-h-screen">
      {/* The Living Void - Background with integrated fog */}
      <Background />

      {/* Chrome Canvas - GPU-rendered glass panels and borders */}
      {/* Renders at z-index 0, between background (-10) and content (10+) */}
      <ChromeCanvas />

      {/* Ambient Particle Environment - Phase 32 */}
      {/* Subtle floating dust motes with ring attraction during processing */}
      <ParticleField
        particleCount={75}
        opacity={1}
        speedMultiplier={1}
        connectToRing={true}
        zIndex={-1}
      />

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

      {/* Radial Navigation - Centered in home view, top in page view */}
      {/* Pure CSS positioning - no Framer animate prop to avoid transform conflicts */}
      <nav
        aria-label="Main navigation"
        className={cn(
          'fixed inset-x-0 z-30 flex justify-center pointer-events-none',
          isHomeView ? 'top-1/2 -translate-y-1/2' : 'top-8'
        )}
      >
        <div className="pointer-events-auto">
          <RadialNav activePage={activePage} onNavigate={onNavigate} />
        </div>
      </nav>

      {/* Utility Island - Quick access modal (rendered via portal-like behavior) */}
      <UtilityIsland />

      {/* Main content area - only visible when not in home view */}
      <AnimatePresence>
        {!isHomeView && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <ScrollArea className="h-screen pt-80">
              <div className="flex flex-col h-full">
                {/* Text Zone at top of content */}
                <div className="p-4 pb-0 max-w-4xl mx-auto w-full">
                  <OptaTextZone
                    message={textZoneState.message}
                    type={textZoneState.type}
                    indicator={textZoneState.indicator}
                    hint={textZoneState.hint}
                  />
                </div>

                {/* Page content - children handle their own AnimatePresence keying */}
                <main
                  id="main-content"
                  className="flex-1 p-8 max-w-6xl mx-auto w-full"
                  role="main"
                  tabIndex={-1}
                >
                  {children}
                </main>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Ring Overlay removed - user requested no image transitions */}

      {/* Persistent 3D Ring - Contextual position based on view */}
      {/* Centered in home view, bottom-right when viewing pages */}
      <PersistentRing
        currentPage={activePage}
        position={isHomeView ? 'center' : 'bottom-right'}
        sizeMode={isHomeView ? 'hero' : 'ambient'}
        interactive
        onClick={() => {
          console.log('[Opta] Ring clicked');
        }}
      />

      {/* Swipe Navigation Indicator - Shows during trackpad swipe gestures */}
      <SwipeIndicator
        progress={swipeProgress}
        direction={swipeDirection}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
      />

      {/* Rubber band edge effect when swiping at boundary */}
      <AnimatePresence>
        {isAtBoundary && Math.abs(rubberBandOffset) > 1 && (
          <motion.div
            className={cn(
              'fixed top-0 bottom-0 w-2 z-40',
              'pointer-events-none',
              rubberBandOffset > 0 ? 'left-0' : 'right-0'
            )}
            style={{
              background: 'linear-gradient(to right, rgba(168, 85, 247, 0.3), transparent)',
              transform: `scaleX(${Math.abs(rubberBandOffset) / 10})`,
              transformOrigin: rubberBandOffset > 0 ? 'left' : 'right',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
          />
        )}
      </AnimatePresence>

      {/* Gesture Hints - Shows available gestures for first-time users */}
      {showGestureHints && !isHomeView && (
        <GestureHints
          hints={['pinch', 'swipe']}
          position="bottom-right"
          onDismiss={() => setShowGestureHints(false)}
        />
      )}
    </div>
  );
}

/**
 * Main application layout with obsidian aesthetic.
 *
 * Includes:
 * - RadialNav as center-focused navigation protagonist
 * - OptaRing for page transitions (floating overlay)
 * - Atmospheric fog integration
 * - Particle environment (Phase 32)
 * - Page transition orchestration
 * - Accessibility features: skip link, landmarks, focus management
 */
function Layout({ activePage, onNavigate, children }: LayoutProps) {
  return (
    <FogProvider>
      <OptaRingProvider>
        <ParticleProvider>
          <OptaTextZoneProvider>
            <RadialNavProvider activePage={activePage} onNavigate={onNavigate}>
              <LayoutInner activePage={activePage} onNavigate={onNavigate}>
                {children}
              </LayoutInner>
            </RadialNavProvider>
          </OptaTextZoneProvider>
        </ParticleProvider>
      </OptaRingProvider>
    </FogProvider>
  );
}

export default Layout;
