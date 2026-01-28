/**
 * Input - The Obsidian Text Field
 *
 * Form inputs with obsidian glass styling and energy focus states.
 * Transitions from dormant (0%) to active (50%) on focus.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-xl px-4 py-2 text-sm transition-all duration-300',
          // Obsidian glass material
          'glass-subtle',
          'border border-white/[0.06]',
          // Inner specular highlight effect
          'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]',
          // File input styling
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          // Placeholder
          'placeholder:text-muted-foreground/40',
          // Focus: 0% → 50% energy transition
          'focus-visible:outline-none',
          'focus-visible:border-primary/40',
          'focus-visible:shadow-[inset_0_0_15px_rgba(168,85,247,0.08),0_0_20px_-5px_rgba(168,85,247,0.25)]',
          'focus-visible:bg-card/80',
          // Disabled state
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
