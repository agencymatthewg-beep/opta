'use client'

import { motion } from 'framer-motion'
import { Download, Rocket, MessageCircle } from 'lucide-react'
import { SectionReveal, itemVariants } from '@/components/ui/SectionReveal'

const steps = [
  {
    icon: Download,
    title: 'Download',
    description: 'Grab the macOS installer — one file, one click.',
  },
  {
    icon: Rocket,
    title: 'Launch',
    description: 'Open Opta and it connects to your AI engine automatically.',
  },
  {
    icon: MessageCircle,
    title: 'Chat',
    description: 'Start talking to your local AI — private, fast, and always available.',
  },
]

export function HowItWorks() {
  return (
    <SectionReveal className="py-24 px-6">
      <div className="mx-auto max-w-4xl">
        <motion.div variants={itemVariants} className="mb-14 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
            Three steps, that&apos;s it
          </h2>
        </motion.div>

        <div className="relative flex flex-col items-center gap-12 md:flex-row md:justify-between md:gap-0">
          {/* Connecting line (desktop only) */}
          <div
            className="pointer-events-none absolute top-10 left-[16.6%] right-[16.6%] hidden h-px md:block"
            aria-hidden="true"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
              opacity: 0.25,
            }}
          />

          {steps.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              variants={itemVariants}
              className="relative flex flex-col items-center text-center md:flex-1"
            >
              {/* Step number + icon */}
              <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-surface">
                <Icon className="h-8 w-8 text-primary" />
                <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                  {i + 1}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
              <p className="mt-2 max-w-[200px] text-sm leading-relaxed text-text-secondary">
                {description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionReveal>
  )
}
