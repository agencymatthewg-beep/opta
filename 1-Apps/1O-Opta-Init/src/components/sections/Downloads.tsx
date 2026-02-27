'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { GlassCard } from '@/components/ui/GlassCard'
import { SectionReveal, itemVariants } from '@/components/ui/SectionReveal'
import { DOWNLOADS } from '@/lib/constants'

function AppleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M12.152 8.556c-.018-1.87 1.527-2.768 1.597-2.812-.87-1.272-2.225-1.446-2.707-1.466-1.152-.117-2.25.679-2.835.679-.585 0-1.49-.661-2.449-.644-1.26.019-2.422.733-3.07 1.862-1.31 2.272-.335 5.64.941 7.486.624.903 1.368 1.917 2.345 1.88.941-.038 1.296-.609 2.432-.609 1.136 0 1.455.609 2.449.59.012 0-.012 0 0 0 1.013-.018 1.653-.92 2.274-1.826.717-1.047 1.011-2.06 1.029-2.113-.022-.01-1.974-.758-1.993-3.006l-.013.001zM10.286 2.89c.519-.629.869-1.502.774-2.374-.748.03-1.655.499-2.192 1.128-.481.556-.903 1.444-.789 2.297.835.065 1.688-.425 2.207-1.05z" />
    </svg>
  )
}

function WindowsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="opacity-40" aria-hidden="true">
      <path d="M0 2.05v5.644h7.352V0H2.49A2.5 2.5 0 0 0 0 2.05zm8.648 5.644V0h4.862A2.5 2.5 0 0 1 16 2.05v5.644H8.648zM0 8.694v5.257A2.5 2.5 0 0 0 2.49 16h4.862V8.694H0zm8.648 0V16h4.862A2.5 2.5 0 0 0 16 13.95V8.694H8.648z" />
    </svg>
  )
}

const apps = [
  { key: 'cli' as const, data: DOWNLOADS.cli, icon: '>' },
  { key: 'lmx' as const, data: DOWNLOADS.lmx, icon: '~' },
]

export function Downloads() {
  return (
    <SectionReveal id="downloads" className="py-24 px-6">
      <div className="mx-auto max-w-4xl">
        <motion.div variants={itemVariants} className="mb-12 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
            Download
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            Everything you need to run AI locally
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {apps.map(({ key, data, icon }) => (
            <motion.div key={key} variants={itemVariants}>
              <GlassCard
                level="subtle"
                hover
                shimmer
                className="flex h-full flex-col border-t border-white/10"
              >
                {/* App identity */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-mono text-lg font-bold">
                    {icon}
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary">
                    {data.name}
                  </h3>
                </div>

                <p className="mb-6 text-sm leading-relaxed text-text-secondary">
                  {data.description}
                </p>

                <div className="mt-auto space-y-3">
                  <Button
                    variant="primary"
                    size="md"
                    href={data.macos}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <AppleIcon />
                    Download for macOS
                  </Button>

                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-text-muted">
                    <WindowsIcon />
                    <span className="opacity-50">Windows — Coming Soon</span>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionReveal>
  )
}
