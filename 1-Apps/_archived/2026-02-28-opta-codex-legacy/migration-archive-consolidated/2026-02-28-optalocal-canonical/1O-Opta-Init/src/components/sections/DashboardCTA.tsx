'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { SectionReveal, itemVariants } from '@/components/ui/SectionReveal'
import { DASHBOARD_URL } from '@/lib/constants'

export function DashboardCTA() {
  return (
    <SectionReveal id="dashboard" className="px-6 py-24">
      <motion.div variants={itemVariants}>
        <div className="glass-strong relative mx-auto max-w-4xl overflow-hidden rounded-2xl px-8 py-16 text-center">
          {/* Ambient glow behind CTA */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <div className="h-72 w-72 rounded-full bg-primary/15 blur-[140px]" />
          </div>

          {/* Film grain on CTA panel */}
          <div className="film-grain pointer-events-none absolute inset-0 rounded-2xl" aria-hidden="true" />

          <div className="relative z-10">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              <span className="bg-gradient-to-r from-white to-primary-light bg-clip-text text-transparent">
                Ready to manage your models?
              </span>
            </h2>

            <p className="mx-auto mt-4 max-w-lg text-text-secondary">
              Access your dashboard to monitor performance, manage models, and
              chat — all in one interface.
            </p>

            <div className="mt-8">
              <Button
                variant="primary"
                size="lg"
                href={DASHBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Dashboard
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </SectionReveal>
  )
}
