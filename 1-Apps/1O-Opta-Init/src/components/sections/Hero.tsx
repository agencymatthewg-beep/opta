'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { SectionReveal, itemVariants } from '@/components/ui/SectionReveal'
import { DASHBOARD_URL } from '@/lib/constants'

function AppleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12.152 5.106c-.076.058-1.416.814-1.416 2.493 0 1.942 1.706 2.63 1.756 2.647-.008.041-.272.938-1.008 1.852-.652.798-1.33 1.594-2.364 1.594-1.034 0-1.298-.6-2.49-.6-1.16 0-1.572.617-2.524.617-.952 0-1.614-.738-2.381-1.644C.836 10.895.2 9.198.2 7.59c0-2.584 1.68-3.954 3.334-3.954.878 0 1.61.577 2.162.577.52 0 1.33-.612 2.33-.612.377 0 1.73.034 2.623.904l-.008.008c.377.344-.504.964-1.505 1.6zM9.58 2.4c.476-.568.814-1.356.814-2.144 0-.11-.008-.22-.026-.31-.776.028-1.698.517-2.254 1.16-.44.502-.84 1.29-.84 2.09 0 .12.018.24.026.278.046.008.118.016.192.016.696 0 1.572-.466 2.088-1.09z" />
    </svg>
  )
}

const heroTextVariants = {
  hidden: { opacity: 0, y: 40, filter: 'blur(16px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 120, damping: 20 },
  },
}

const heroCTAVariants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 160, damping: 20, delay: 0.15 },
  },
}

export function Hero() {
  return (
    <SectionReveal
      id="hero"
      className="relative overflow-hidden py-36 md:py-52"
      stagger={0.08}
    >
      {/* Gradient mesh background — three drifting blobs */}
      <div className="hero-mesh" aria-hidden="true" />

      {/* Third blob (via inline, since ::before and ::after are taken) */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
        style={{
          width: '900px',
          height: '900px',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 55%)',
        }}
      />

      {/* Film grain */}
      <div className="film-grain pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        {/* Badge */}
        <motion.div
          variants={itemVariants}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium uppercase tracking-widest text-primary"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-neon-green animate-pulse" />
          Now available for macOS
        </motion.div>

        <motion.h1
          variants={heroTextVariants}
          className="bg-gradient-to-br from-white via-primary-light to-primary bg-clip-text text-5xl font-bold leading-[1.08] tracking-tight text-transparent sm:text-6xl md:text-7xl"
        >
          Your AI,{' '}
          <br className="hidden sm:block" />
          running&nbsp;locally
        </motion.h1>

        <motion.p
          variants={heroTextVariants}
          className="mt-7 max-w-2xl text-lg leading-relaxed text-text-secondary md:text-xl"
        >
          Private, fast, and completely yours. Opta runs AI models directly on
          your Mac — no cloud, no accounts, no data leaving your machine.
          Just download and go.
        </motion.p>

        <motion.div
          variants={heroCTAVariants}
          className="mt-11 flex flex-wrap items-center justify-center gap-4"
        >
          <Button href="#downloads" size="lg">
            <AppleIcon />
            Download for macOS
          </Button>
          <Button
            href={DASHBOARD_URL}
            variant="secondary"
            size="lg"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Dashboard
          </Button>
        </motion.div>

        {/* Subtle scroll hint */}
        <motion.div
          variants={itemVariants}
          className="mt-20 flex flex-col items-center gap-2 text-text-muted"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="h-6 w-4 rounded-full border border-border flex items-start justify-center pt-1"
          >
            <div className="h-1.5 w-0.5 rounded-full bg-text-muted" />
          </motion.div>
        </motion.div>
      </div>
    </SectionReveal>
  )
}
