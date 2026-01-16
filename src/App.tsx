import { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import Background from './components/Background';
import { PageSkeleton } from './components/ui/skeleton';
import { pageVariants } from './lib/animations';
import { LearnModeProvider } from './components/LearnModeContext';
import { LearnModeToggle } from './components/LearnModeToggle';

// Lazy load pages for better initial load performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Games = lazy(() => import('./pages/Games'));
const Optimize = lazy(() => import('./pages/Optimize'));
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
              <Optimize />
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
    <LearnModeProvider>
      <div className="dark">
        {/* Immersive animated background */}
        <Background />

        {/* Main app layout */}
        <Layout activePage={activePage} onNavigate={setActivePage}>
          <AnimatePresence mode="wait">
            {renderPage()}
          </AnimatePresence>
        </Layout>

        {/* Learn Mode toggle - always visible */}
        <LearnModeToggle />

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
    </LearnModeProvider>
  );
}

export default App;
