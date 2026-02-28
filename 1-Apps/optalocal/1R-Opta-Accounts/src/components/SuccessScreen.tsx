'use client';

import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { OptaRing } from './OptaRing';

/**
 * Shown after CLI browser auth completes.
 * The user can close this tab — the CLI has received its tokens.
 */
export function SuccessScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24 }}
        className="text-center max-w-sm"
      >
        <div className="flex justify-center mb-6">
          <OptaRing size={64} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
        >
          <CheckCircle
            size={48}
            className="mx-auto mb-4 text-opta-neon-green"
          />
          <h1 className="text-xl font-semibold text-opta-text-primary mb-2">
            Signed in successfully
          </h1>
          <p className="text-opta-text-secondary text-sm">
            Your Opta CLI session is active. You can close this tab.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
