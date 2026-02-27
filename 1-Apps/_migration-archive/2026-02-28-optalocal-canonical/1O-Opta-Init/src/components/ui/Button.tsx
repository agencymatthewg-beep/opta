'use client'

import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends Omit<HTMLMotionProps<'a'>, 'children'> {
  children: ReactNode
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-dim shadow-lg shadow-primary/20',
  secondary:
    'glass-subtle text-text-primary hover:border-glass-border',
  ghost:
    'bg-transparent text-text-secondary',
}

const sizes = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-base rounded-lg',
  lg: 'px-8 py-4 text-lg rounded-xl',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <motion.a
      whileHover={disabled ? undefined : { scale: 1.02, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-semibold cursor-pointer select-none',
        variants[variant],
        sizes[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
      {...props}
    >
      {children}
    </motion.a>
  )
}
