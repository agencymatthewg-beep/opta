/**
 * Checkbox - The Obsidian Selection Indicator
 *
 * A checkbox with obsidian glass styling and energy state transitions.
 * Unchecked = dormant (0%), Checked = active (50%) with energy glow.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, checked, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
    };

    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          className="sr-only peer"
          {...props}
        />
        <motion.div
          className={cn(
            'h-5 w-5 shrink-0 rounded-md cursor-pointer',
            'transition-all duration-300',
            'flex items-center justify-center',
            // Focus ring
            'ring-offset-background',
            'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary/50 peer-focus-visible:ring-offset-2',
            // Disabled state
            'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
            // Unchecked state (0% - dormant obsidian)
            !checked && [
              'bg-[#05030a]/80 backdrop-blur-lg',
              'border border-white/[0.08]',
              'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]',
            ],
            // Checked state (50% - active energy)
            checked && [
              'bg-primary',
              'border border-primary/60',
              'shadow-[inset_0_0_10px_rgba(255,255,255,0.1),0_0_15px_-3px_rgba(168,85,247,0.5)]',
            ],
            className
          )}
          onClick={() => onCheckedChange?.(!checked)}
          whileHover={{
            borderColor: checked ? 'rgba(168, 85, 247, 0.8)' : 'rgba(168, 85, 247, 0.3)',
            boxShadow: checked
              ? 'inset 0 0 10px rgba(255,255,255,0.1), 0 0 20px -3px rgba(168,85,247,0.6)'
              : 'inset 0 0 0 1px rgba(168, 85, 247, 0.15), 0 0 10px -3px rgba(168,85,247,0.2)',
          }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.2, ease: smoothOut }}
        >
          <AnimatePresence>
            {checked && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15, ease: smoothOut }}
              >
                <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
