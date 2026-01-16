import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Layout from './components/Layout';
import Background from './components/Background';
import Dashboard from './pages/Dashboard';
import Games from './pages/Games';
import Optimize from './pages/Optimize';
import Score from './pages/Score';
import Settings from './pages/Settings';
import PlatformOnboarding from './components/PlatformOnboarding';
import Onboarding, { OnboardingPreferences } from './components/Onboarding';
import { pageVariants } from './lib/animations';

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
            <Dashboard onNavigate={setActivePage} />
          </motion.div>
        );
      case 'games':
        return (
          <motion.div {...pageProps}>
            <Games />
          </motion.div>
        );
      case 'optimize':
        return (
          <motion.div {...pageProps}>
            <Optimize />
          </motion.div>
        );
      case 'score':
        return (
          <motion.div {...pageProps}>
            <Score />
          </motion.div>
        );
      case 'settings':
        return (
          <motion.div {...pageProps}>
            <Settings />
          </motion.div>
        );
      default:
        return (
          <motion.div {...pageProps}>
            <Dashboard onNavigate={setActivePage} />
          </motion.div>
        );
    }
  };

  return (
    <div className="dark">
      {/* Immersive animated background */}
      <Background />

      {/* Main app layout */}
      <Layout activePage={activePage} onNavigate={setActivePage}>
        <AnimatePresence mode="wait">
          {renderPage()}
        </AnimatePresence>
      </Layout>

      {/* Platform onboarding (first) */}
      <AnimatePresence>
        {showPlatformOnboarding && (
          <PlatformOnboarding
            onComplete={handlePlatformOnboardingComplete}
            onSkip={handlePlatformOnboardingSkip}
          />
        )}
      </AnimatePresence>

      {/* Preferences onboarding (second) */}
      <AnimatePresence>
        {showPreferencesOnboarding && (
          <Onboarding onComplete={handlePreferencesComplete} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
