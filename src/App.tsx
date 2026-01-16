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
import { pageVariants } from './lib/animations';

const ONBOARDING_COMPLETE_KEY = 'opta_onboarding_complete';

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if onboarding should be shown on first launch
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_COMPLETE_KEY);
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setShowOnboarding(false);
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    setShowOnboarding(false);
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

      {/* First-launch onboarding */}
      <AnimatePresence>
        {showOnboarding && (
          <PlatformOnboarding
            onComplete={handleOnboardingComplete}
            onSkip={handleOnboardingSkip}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
