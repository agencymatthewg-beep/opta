'use client'

import type { ReactNode } from 'react'
import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SectionRevealProps {
  children: ReactNode
  className?: string
  id?: string
  stagger?: number
}

const containerVariants = {
  hidden: {},
  visible: (stagger: number) => ({
    transition: { staggerChildren: stagger },
  }),
}

export const itemVariants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring' as const, stiffness: 180, damping: 22 },
  },
}

export function SectionReveal({
  children,
  className,
  id,
  stagger = 0.04,
}: SectionRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.section
      ref={ref}
      id={id}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={containerVariants}
      custom={stagger}
      className={cn('relative', className)}
    >
      {children}
    </motion.section>
  )
}
