/**
 * Switch - The Obsidian Toggle
 *
 * A toggle switch with obsidian glass styling and energy state transitions.
 * Off = dormant (0%), On = active (50%) with purple energy glow.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  /** Whether the switch is on */
  checked?: boolean;
  /** Called when the switch is toggled */
  onCheckedChange?: (checked: boolean) => void;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessible name for the switch */
  'aria-label'?: string;
}

/**
 * Switch - A toggle switch component with obsidian styling.
 *
 * @example
 * ```tsx
 * <Switch
 *   checked={enabled}
 *   onCheckedChange={setEnabled}
 * />
 * ```
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, onCheckedChange, disabled = false, className, ...props }, ref) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        handleClick();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full',
          'transition-all duration-300',
          'border border-white/[0.06]',
          // Focus state
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          // Disabled state
          'disabled:cursor-not-allowed disabled:opacity-50',
          // Off state (0% - dormant)
          !checked && [
            'bg-[#05030a]/80 backdrop-blur-lg',
            'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]',
          ],
          // On state (50% - active energy)
          checked && [
            'bg-primary/80',
            'border-primary/50',
            'shadow-[inset_0_0_15px_rgba(168,85,247,0.3),0_0_20px_-5px_rgba(168,85,247,0.5)]',
          ],
          className
        )}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full transition-all duration-300',
            // Thumb styling - obsidian glass
            'bg-white/90 shadow-lg',
            // Position
            checked ? 'translate-x-5' : 'translate-x-0.5',
            // Glow when active
            checked && 'shadow-[0_0_10px_rgba(255,255,255,0.5)]'
          )}
        />
      </button>
    );
  }
);

Switch.displayName = 'Switch';

export { Switch };
