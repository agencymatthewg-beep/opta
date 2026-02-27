'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

type GlassLevel = 'subtle' | 'default' | 'strong'

interface GlassCardProps extends HTMLMotionProps<'div'> {
  level?: GlassLevel
  hover?: boolean
  shimmer?: boolean
}

const glassClasses: Record<GlassLevel, string> = {
  subtle: 'glass-subtle',
  default: 'glass',
  strong: 'glass-strong',
}

export function GlassCard({
  level = 'default',
  hover = true,
  shimmer = false,
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      whileHover={hover ? {
        y: -3,
        borderColor: 'rgba(139,92,246,0.3)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 0 20px rgba(139,92,246,0.06)',
      } : undefined}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className={cn(
        'rounded-2xl p-6',
        glassClasses[level],
        shimmer && 'shimmer-hover',
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}
