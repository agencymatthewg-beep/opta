import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion, LazyMotion, domAnimation } from 'framer-motion';
import Layout from './components/Layout';
import Background from './components/Background';
import ErrorBoundary from './components/ErrorBoundary';
import { pageVariants } from './lib/animations';
import { LearnModeProvider } from './components/LearnModeContext';
import { LearnModeToggle } from './components/LearnModeToggle';
import { InvestigationModeProvider } from './components/InvestigationMode';
import { ExpertiseProvider } from './components/ExpertiseContext';
import { ExpertiseTracking } from './components/ExpertiseTracking';
import { CommunicationStyleProvider } from './components/CommunicationStyleContext';
import { GameSessionProvider, useGameSessionContext } from './components/GameSessionContext';
import GameSessionTracker from './components/GameSessionTracker';
import SessionSummaryModal from './components/SessionSummaryModal';
import { useNavigationHistory } from './hooks/useNavigationHistory';
import { useSwipeNavigation } from './hooks/useSwipeNavigation';
import SwipeIndicator from './components/SwipeIndicator';
import { CommandPalette } from './components/CommandPalette';
import GlobalShortcuts from './components/GlobalShortcuts';
import { ChessWidget } from './components/chess';
import { PerformanceProvider } from './contexts/PerformanceContext';
import { ChromeProvider } from './contexts/ChromeContext';

// LocalStorage key for chess widget visibility
const CHESS_WIDGET_VISIBLE_KEY = 'opta_chess_widget_visible';

// Direct imports - lazy loading was broken (Suspense never resolving)
// TODO: Investigate React.lazy + Vite HMR compatibility issue
import Dashboard from './pages/Dashboard';
import Games from './pages/Games';
import Chess from './pages/Chess';
import Optimize from './pages/Optimize';
import PinpointOptimize from './pages/PinpointOptimize';
import Score from './pages/Score';
import Settings from './pages/Settings';

// Lazy load onboarding components (only needed on first launch)
const PlatformOnboarding = lazy(() => import('./components/PlatformOnboarding'));
const Onboarding = lazy(() => import('./components/Onboarding'));

// Type for onboarding preferences (imported dynamically)
interface OnboardingPreferences {
  priority: 'fps' | 'quality' | 'balanced';
  expertise: 'simple' | 'standard' | 'power';
  gameType: 'competitive' | 'story' | 'both';
}

const PLATFORM_ONBOARDING_KEY = 'opta_platform_onboarding_complete';
const PREFERENCES_ONBOARDING_KEY = 'opta_preferences_onboarding_complete';
const USER_PREFERENCES_KEY = 'opta_user_preferences';

/**
 * GameSessionUI - Renders session tracker and summary modal.
 * Must be inside GameSessionProvider.
 */
function GameSessionUI() {
  const { session, telemetry, summary, endSession, clearSummary, isActive } = useGameSessionContext();

  return (
    <>
      {/* Session Tracker - visible when game is running */}
      <AnimatePresence>
        {isActive && session && (
          <GameSessionTracker
            session={session}
            telemetry={telemetry}
            onEndSession={endSession}
          />
        )}
      </AnimatePresence>

      {/* Session Summary Modal - shown after session ends */}
      {summary && (
        <SessionSummaryModal
          open={!!summary}
          onClose={clearSummary}
          summary={summary}
        />
      )}
    </>
  );
}

function App() {
  const [showPlatformOnboarding, setShowPlatformOnboarding] = useState(false);
  const [showPreferencesOnboarding, setShowPreferencesOnboarding] = useState(false);

  // Chess widget visibility state
  const [chessWidgetVisible, setChessWidgetVisible] = useState(() => {
    try {
      return localStorage.getItem(CHESS_WIDGET_VISIBLE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Toggle chess widget
  const toggleChessWidget = useCallback(() => {
    setChessWidgetVisible((prev) => {
      const newValue = !prev;
      localStorage.setItem(CHESS_WIDGET_VISIBLE_KEY, String(newValue));
      return newValue;
    });
  }, []);

  // Close chess widget
  const closeChessWidget = useCallback(() => {
    setChessWidgetVisible(false);
    localStorage.setItem(CHESS_WIDGET_VISIBLE_KEY, 'false');
  }, []);

  // Navigation history for back/forward support
  const {
    currentPage: activePage,
    canGoBack,
    canGoForward,
    navigate,
    goBack,
    goForward,
  } = useNavigationHistory('dashboard');

  // Magic Mouse swipe navigation
  const { swipeProgress, swipeDirection } = useSwipeNavigation({
    onSwipeLeft: goForward,
    onSwipeRight: goBack,
    canSwipeLeft: canGoForward,
    canSwipeRight: canGoBack,
    threshold: 100,
    enabled: !showPlatformOnboarding && !showPreferencesOnboarding,
  });

  // Wrapper for navigation that uses history
  const setActivePage = useCallback((pageId: string) => {
    navigate(pageId);
  }, [navigate]);

  // Check if onboarding should be shown on first launch
  useEffect(() => {
    const hasPlatformOnboarding = localStorage.getItem(PLATFORM_ONBOARDING_KEY);
    const hasPreferencesOnboarding = localStorage.getItem(PREFERENCES_ONBOARDING_KEY);

    if (!hasPlatformOnboarding) {
      setShowPlatformOnboarding(true);
    } else if (!hasPreferencesOnboarding) {
      setShowPreferencesOnboarding(true);
    }
  }, []);

  const handlePlatformOnboardingComplete = () => {
    localStorage.setItem(PLATFORM_ONBOARDING_KEY, 'true');
    setShowPlatformOnboarding(false);
    // Show preferences onboarding next
    const hasPreferencesOnboarding = localStorage.getItem(PREFERENCES_ONBOARDING_KEY);
    if (!hasPreferencesOnboarding) {
      setShowPreferencesOnboarding(true);
    }
  };

  const handlePlatformOnboardingSkip = () => {
    localStorage.setItem(PLATFORM_ONBOARDING_KEY, 'true');
    setShowPlatformOnboarding(false);
    // Show preferences onboarding next
    const hasPreferencesOnboarding = localStorage.getItem(PREFERENCES_ONBOARDING_KEY);
    if (!hasPreferencesOnboarding) {
      setShowPreferencesOnboarding(true);
    }
  };

  const handlePreferencesComplete = (preferences: OnboardingPreferences) => {
    localStorage.setItem(PREFERENCES_ONBOARDING_KEY, 'true');
    localStorage.setItem(USER_PREFERENCES_KEY, JSON.stringify(preferences));
    setShowPreferencesOnboarding(false);
  };

  const renderPage = () => {
    // Animation props for page transitions (key passed directly to avoid React warning)
    const animationProps = {
      variants: pageVariants,
      initial: "initial",
      animate: "animate",
      exit: "exit",
    };

    switch (activePage) {
      case 'dashboard':
        return (
          <motion.div key={activePage} {...animationProps}>
            <Dashboard onNavigate={setActivePage} />
          </motion.div>
        );
      case 'games':
        return (
          <motion.div key={activePage} {...animationProps}>
            <Games />
          </motion.div>
        );
      case 'chess':
        return (
          <motion.div key={activePage} {...animationProps}>
            <Chess />
          </motion.div>
        );
      case 'optimize':
        return (
          <motion.div key={activePage} {...animationProps}>
            <Optimize onNavigate={setActivePage} />
          </motion.div>
        );
      case 'pinpoint':
        return (
          <motion.div key={activePage} {...animationProps}>
            <PinpointOptimize />
          </motion.div>
        );
      case 'score':
        return (
          <motion.div key={activePage} {...animationProps}>
            <Score />
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div key={activePage} {...animationProps}>
            <Settings />
          </motion.div>
        );
      default:
        return (
          <motion.div key={activePage} {...animationProps}>
            <Dashboard onNavigate={setActivePage} />
          </motion.div>
        );
    }
  };

  return (
    <LazyMotion features={domAnimation} strict>
    <PerformanceProvider>
    <ChromeProvider>
    <ExpertiseProvider>
      <LearnModeProvider>
        <CommunicationStyleProvider>
          <InvestigationModeProvider>
            <GameSessionProvider>
              <div className="dark">
              {/* Expertise signal tracking (session, shortcuts) */}
              <ExpertiseTracking />

              {/* Immersive animated background */}
              <Background />

              {/* Main app layout wrapped in error boundary */}
              <ErrorBoundary>
                <Layout activePage={activePage} onNavigate={setActivePage}>
                  <AnimatePresence mode="wait" initial={false}>
                    {renderPage()}
                  </AnimatePresence>
                </Layout>
              </ErrorBoundary>

              {/* Command Palette - global keyboard access (Cmd+K) */}
              <CommandPalette
                navigate={setActivePage}
                actions={{
                  runOptimization: () => {
                    // Navigate to optimize page and trigger optimization
                    setActivePage('optimize');
                  },
                  toggleStealth: () => {
                    // Toggle stealth mode (placeholder - can be connected to context)
                    console.log('[Opta] Stealth mode toggled');
                  },
                }}
              />

              {/* Global keyboard shortcuts (Cmd+Shift+O for quick optimize, Cmd+Shift+C for chess) */}
              <GlobalShortcuts onToggleChessWidget={toggleChessWidget} />

              {/* Chess Widget - floating draggable quick access (Phase 51) */}
              <ChessWidget
                isVisible={chessWidgetVisible}
                onClose={closeChessWidget}
                onNavigateToChess={() => setActivePage('chess')}
              />

              {/* Learn Mode toggle - always visible */}
              <LearnModeToggle />

              {/* Game Session UI - tracker and summary modal */}
              <GameSessionUI />

              {/* Persistent Ring moved to Layout.tsx for isHomeView access */}

              {/* Swipe navigation indicator */}
              <SwipeIndicator
                progress={swipeProgress}
                direction={swipeDirection}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
              />

              {/* Platform onboarding (first) */}
              <AnimatePresence>
                {showPlatformOnboarding && (
                  <Suspense fallback={null}>
                    <PlatformOnboarding
                      onComplete={handlePlatformOnboardingComplete}
                      onSkip={handlePlatformOnboardingSkip}
                    />
                  </Suspense>
                )}
              </AnimatePresence>

              {/* Preferences onboarding (second) */}
              <AnimatePresence>
                {showPreferencesOnboarding && (
                  <Suspense fallback={null}>
                    <Onboarding onComplete={handlePreferencesComplete} />
                  </Suspense>
                )}
              </AnimatePresence>
              </div>
            </GameSessionProvider>
          </InvestigationModeProvider>
        </CommunicationStyleProvider>
      </LearnModeProvider>
    </ExpertiseProvider>
    </ChromeProvider>
    </PerformanceProvider>
    </LazyMotion>
  );
}

export default App;
