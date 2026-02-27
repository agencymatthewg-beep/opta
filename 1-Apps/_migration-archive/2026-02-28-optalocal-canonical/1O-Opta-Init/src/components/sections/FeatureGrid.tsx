'use client'

import { motion } from 'framer-motion'
import {
  Shield,
  LayoutGrid,
  Layers,
  Activity,
  Cpu,
  Plug,
} from 'lucide-react'
import { GlassCard } from '@/components/ui/GlassCard'
import { SectionReveal, itemVariants } from '@/components/ui/SectionReveal'
import { FEATURES } from '@/lib/constants'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  layout: LayoutGrid,
  layers: Layers,
  activity: Activity,
  cpu: Cpu,
  plug: Plug,
}

export function FeatureGrid() {
  return (
    <SectionReveal id="features" className="py-24 px-6">
      <div className="mx-auto max-w-4xl">
        <motion.div variants={itemVariants} className="mb-12 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
            Built for everyone
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            Private AI on your Mac, no technical setup required
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = iconMap[feature.icon]
            return (
              <motion.div key={feature.title} variants={itemVariants}>
                <GlassCard
                  level="subtle"
                  hover
                  shimmer
                  className="flex h-full flex-col items-start border-t border-white/5"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    {Icon && <Icon className="h-5 w-5 text-primary" />}
                  </div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                    {feature.description}
                  </p>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>
      </div>
    </SectionReveal>
  )
}
