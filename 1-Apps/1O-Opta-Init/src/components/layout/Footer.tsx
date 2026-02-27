'use client'

import { motion } from 'framer-motion'

export function Footer() {
  return (
    <footer className="relative mt-24">
      <div className="neon-divider" />

      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-12 sm:flex-row">
        <p className="text-sm text-text-muted">
          &copy; 2026 Opta Operations
        </p>

        <div className="flex items-center gap-6">
          <motion.a
            href="https://lmx.optalocal.com"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ color: '#a1a1aa', y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20 }}
            className="text-sm text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded px-1"
          >
            lmx.optalocal.com
          </motion.a>
          <motion.a
            href="https://optamize.biz"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ color: '#a1a1aa', y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 350, damping: 20 }}
            className="text-sm text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded px-1"
          >
            optamize.biz
          </motion.a>
        </div>
      </div>
    </footer>
  )
}
