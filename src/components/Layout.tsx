import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

/**
 * Main application layout with sidebar navigation.
 * Includes accessibility features: skip link, landmarks, and focus management.
 */
function Layout({ activePage, onNavigate, children }: LayoutProps) {
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
        <main id="main-content" className="p-8 max-w-7xl" role="main" tabIndex={-1}>
          {children}
        </main>
      </ScrollArea>
    </div>
  );
}

export default Layout;
