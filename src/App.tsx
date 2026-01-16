import { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion, LazyMotion, domAnimation } from 'framer-motion';
import Layout from './components/Layout';
import Background from './components/Background';
import ErrorBoundary from './components/ErrorBoundary';
import { PageSkeleton } from './components/ui/skeleton';
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

// Lazy load pages for better initial load performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Games = lazy(() => import('./pages/Games'));
const Optimize = lazy(() => import('./pages/Optimize'));
const PinpointOptimize = lazy(() => import('./pages/PinpointOptimize'));
const Score = lazy(() => import('./pages/Score'));
const Settings = lazy(() => import('./pages/Settings'));

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
  const [activePage, setActivePage] = useState('dashboard');
  const [showPlatformOnboarding, setShowPlatformOnboarding] = useState(false);
  const [showPreferencesOnboarding, setShowPreferencesOnboarding] = useState(false);

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
    const pageProps = {
      key: activePage,
      variants: pageVariants,
      initial: "initial",
      animate: "animate",
      exit: "exit",
    };

    switch (activePage) {
      case 'dashboard':
        return (
          <motion.div {...pageProps}>
            <Suspense fallback={<PageSkeleton />}>
              <Dashboard onNavigate={setActivePage} />
            </Suspense>
          </motion.div>
        );
      case 'games':
        return (
          <motion.div {...pageProps}>
            <Suspense fallback={<PageSkeleton />}>
              <Games />
            </Suspense>
          </motion.div>
        );
      case 'optimize':
        return (
          <motion.div {...pageProps}>
            <Suspense fallback={<PageSkeleton />}>
              <Optimize onNavigate={setActivePage} />
            </Suspense>
          </motion.div>
        );
      case 'pinpoint':
        return (
          <motion.div {...pageProps}>
            <Suspense fallback={<PageSkeleton />}>
              <PinpointOptimize />
            </Suspense>
          </motion.div>
        );
      case 'score':
        return (
          <motion.div {...pageProps}>
            <Suspense fallback={<PageSkeleton />}>
              <Score />
            </Suspense>
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div {...pageProps}>
            <Suspense fallback={<PageSkeleton />}>
              <Settings />
            </Suspense>
          </motion.div>
        );
      default:
        return (
          <motion.div {...pageProps}>
            <Suspense fallback={<PageSkeleton />}>
              <Dashboard onNavigate={setActivePage} />
            </Suspense>
          </motion.div>
        );
    }
  };

  return (
    <LazyMotion features={domAnimation} strict>
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
                  <AnimatePresence mode="wait">
                    {renderPage()}
                  </AnimatePresence>
                </Layout>
              </ErrorBoundary>

              {/* Learn Mode toggle - always visible */}
              <LearnModeToggle />

              {/* Game Session UI - tracker and summary modal */}
              <GameSessionUI />

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
    </LazyMotion>
  );
}

export default App;
