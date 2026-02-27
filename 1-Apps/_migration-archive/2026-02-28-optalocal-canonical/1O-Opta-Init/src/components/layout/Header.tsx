'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { NAV_LINKS } from '@/lib/constants'

export function Header() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.1 }}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-16 flex items-center',
        scrolled
          ? 'glass-subtle border-b border-border/50'
          : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6">
        {/* Wordmark */}
        <motion.a
          href="#"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="text-xl font-bold tracking-tight text-primary select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded"
        >
          Opta
        </motion.a>

        {/* Nav links */}
        <ul className="flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <motion.a
                href={link.href}
                whileHover={{ color: '#fafafa', y: -1 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                className="text-sm font-medium text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:rounded px-1"
              >
                {link.label}
              </motion.a>
            </li>
          ))}
        </ul>
      </nav>
    </motion.header>
  )
}
