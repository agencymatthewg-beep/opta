'use client'

import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TerminalWindowProps extends HTMLMotionProps<'div'> {
  title?: string
  children: ReactNode
}

export function TerminalWindow({
  title = 'Opta',
  children,
  className,
  ...props
}: TerminalWindowProps) {
  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(139,92,246,0.08)' }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className={cn(
        'terminal-window overflow-hidden rounded-xl border border-white/10',
        className,
      )}
      {...props}
    >
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#1c1c1e] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-2 text-xs font-medium text-text-muted">{title}</span>
      </div>

      {/* Terminal content */}
      <div className="bg-void p-4 font-mono text-sm leading-relaxed">
        {children}
      </div>
    </motion.div>
  )
}
