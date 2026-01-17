import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * Button - The Energy Interface
 *
 * Buttons in the Obsidian Standard carry the energy of the Living Artifact.
 * Primary actions glow with internal plasma, while secondary actions
 * use obsidian glass surfaces that awaken on interaction.
 *
 * Variants:
 * - energy: Primary CTAs with volumetric purple glow (0%→50% on hover)
 * - obsidian: Secondary actions with glass surface
 * - ghost: Minimal presence, awakens on hover
 * - destructive: Warning actions with restrained danger glow
 * - link: Text-only with energy underline
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2",
    "whitespace-nowrap rounded-xl text-sm font-semibold",
    "transition-all duration-300 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Energy Button - Primary CTA with volumetric glow
        energy: [
          "bg-gradient-to-br from-primary via-primary to-primary/80",
          "text-white font-bold tracking-wide",
          "shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]",
          "border border-primary/50",
          // Inner glow
          "before:absolute before:inset-0 before:rounded-xl",
          "before:bg-gradient-to-b before:from-white/20 before:to-transparent",
          "before:opacity-60",
          // Hover: 0% → 50% energy transition
          "hover:shadow-[0_0_40px_-5px_rgba(168,85,247,0.7),inset_0_0_20px_rgba(168,85,247,0.2)]",
          "hover:border-primary",
          "hover:scale-[1.02]",
          "active:scale-[0.98]",
        ].join(" "),

        // Obsidian Button - Secondary with glass surface
        obsidian: [
          "bg-[#05030a]/80 backdrop-blur-xl",
          "text-foreground",
          "border border-white/[0.08]",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
          // Hover: awakens with energy
          "hover:border-primary/40 hover:bg-[#0a0514]/90",
          "hover:shadow-[inset_0_0_20px_rgba(168,85,247,0.08),0_0_15px_-3px_rgba(168,85,247,0.25)]",
          "hover:scale-[1.01]",
          "active:scale-[0.99]",
        ].join(" "),

        // Default - Alias for energy (primary actions)
        default: [
          "bg-gradient-to-br from-primary via-primary to-primary/80",
          "text-white font-bold tracking-wide",
          "shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]",
          "border border-primary/50",
          "before:absolute before:inset-0 before:rounded-xl",
          "before:bg-gradient-to-b before:from-white/20 before:to-transparent",
          "before:opacity-60",
          "hover:shadow-[0_0_40px_-5px_rgba(168,85,247,0.7),inset_0_0_20px_rgba(168,85,247,0.2)]",
          "hover:border-primary",
          "hover:scale-[1.02]",
          "active:scale-[0.98]",
        ].join(" "),

        // Destructive - Warning with restrained danger glow
        destructive: [
          "bg-gradient-to-br from-danger via-danger to-danger/80",
          "text-white font-bold",
          "shadow-[0_0_15px_-5px_rgba(239,68,68,0.4)]",
          "border border-danger/50",
          "hover:shadow-[0_0_30px_-5px_rgba(239,68,68,0.6)]",
          "hover:scale-[1.02]",
          "active:scale-[0.98]",
        ].join(" "),

        // Outline - Obsidian border, energy fill on hover
        outline: [
          "bg-transparent",
          "text-foreground",
          "border border-white/20",
          "hover:bg-primary/10 hover:border-primary/40",
          "hover:text-primary",
          "hover:shadow-[0_0_15px_-5px_rgba(168,85,247,0.3)]",
        ].join(" "),

        // Secondary - Subdued obsidian
        secondary: [
          "bg-[#0a0514]/60 backdrop-blur-lg",
          "text-muted-foreground",
          "border border-white/[0.05]",
          "hover:bg-[#0a0514]/80 hover:text-foreground",
          "hover:border-white/10",
        ].join(" "),

        // Ghost - Minimal, awakens on hover
        ghost: [
          "bg-transparent",
          "text-muted-foreground",
          "hover:bg-white/[0.05] hover:text-foreground",
          "hover:shadow-[inset_0_0_10px_rgba(168,85,247,0.05)]",
        ].join(" "),

        // Link - Text with energy underline
        link: [
          "bg-transparent text-primary",
          "underline-offset-4 decoration-primary/50",
          "hover:underline hover:decoration-primary",
          "hover:text-primary/80",
        ].join(" "),

        // Success - Positive action with emerald glow
        success: [
          "bg-gradient-to-br from-success via-success to-success/80",
          "text-white font-bold",
          "shadow-[0_0_15px_-5px_rgba(34,197,94,0.4)]",
          "border border-success/50",
          "hover:shadow-[0_0_30px_-5px_rgba(34,197,94,0.6)]",
          "hover:scale-[1.02]",
          "active:scale-[0.98]",
        ].join(" "),
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-lg",
        icon: "h-10 w-10 rounded-xl",
        "icon-sm": "h-8 w-8 rounded-lg",
        "icon-lg": "h-12 w-12 rounded-xl",
      },
      glow: {
        none: "",
        subtle: "shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)]",
        strong: "shadow-[0_0_30px_-5px_rgba(168,85,247,0.5)]",
        pulse: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      glow: "none",
    },
  }
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  children?: React.ReactNode;
  /** Whether to use motion animations */
  animated?: boolean;
  /** Processing/loading state with pulsing glow */
  processing?: boolean;
}

/**
 * Standard Button - For non-animated use cases
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      glow,
      asChild = false,
      animated = false,
      processing = false,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    // Processing state overrides glow
    const effectiveGlow = processing ? "pulse" : glow;

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, glow: effectiveGlow, className }),
          processing && "animate-pulse-glow pointer-events-none"
        )}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
Button.displayName = "Button";

/**
 * Motion Button Props - Extended for Framer Motion
 */
export interface MotionButtonProps
  extends Omit<HTMLMotionProps<"button">, "children">,
    VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
  /** Processing/loading state with pulsing glow */
  processing?: boolean;
}

// =============================================================================
// RIPPLE HOOK - Internal ripple effect for buttons
// =============================================================================

interface RippleInstance {
  id: number;
  x: number;
  y: number;
  size: number;
}

function useButtonRipple(disabled: boolean) {
  const prefersReducedMotion = useReducedMotion();
  const [ripples, setRipples] = React.useState<RippleInstance[]>([]);
  const nextId = React.useRef(0);

  const createRipple = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || prefersReducedMotion) return;

      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Calculate size to cover entire button
      const maxX = Math.max(x, rect.width - x);
      const maxY = Math.max(y, rect.height - y);
      const size = Math.sqrt(maxX * maxX + maxY * maxY) * 2;

      const newRipple: RippleInstance = {
        id: nextId.current++,
        x,
        y,
        size,
      };

      setRipples((prev) => [...prev, newRipple]);

      // Remove after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 400);
    },
    [disabled, prefersReducedMotion]
  );

  return { ripples, createRipple };
}

/**
 * MotionButton - Animated button with full Framer Motion support
 *
 * Use this for primary CTAs and interactions where animation quality matters.
 * Provides magnetic hover effects, energy transitions, and ripple click feedback.
 */
const MotionButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  (
    {
      className,
      variant,
      size,
      glow,
      processing = false,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const effectiveGlow = processing ? "pulse" : glow;
    const { ripples, createRipple } = useButtonRipple(processing || props.disabled || false);

    // Base variants for animation - spring physics
    const motionVariants = {
      initial: {
        scale: 1,
      },
      hover: {
        scale: variant === "ghost" || variant === "link" ? 1 : 1.02,
        transition: {
          type: "spring" as const,
          stiffness: 200,
          damping: 25,
        },
      },
      tap: {
        scale: 0.98,
        transition: {
          type: "spring" as const,
          stiffness: 400,
          damping: 30,
        },
      },
    };

    // Processing animation
    const processingAnimation = processing
      ? {
          boxShadow: [
            "0 0 15px -3px rgba(168, 85, 247, 0.3)",
            "0 0 35px -5px rgba(168, 85, 247, 0.6)",
            "0 0 15px -3px rgba(168, 85, 247, 0.3)",
          ],
        }
      : {};

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        createRipple(e);
        onClick?.(e);
      },
      [createRipple, onClick]
    );

    return (
      <motion.button
        ref={ref}
        className={cn(
          buttonVariants({ variant, size, glow: effectiveGlow, className }),
          processing && "pointer-events-none",
          "overflow-hidden" // Required for ripple containment
        )}
        variants={motionVariants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        animate={processing ? processingAnimation : undefined}
        transition={
          processing
            ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
            : undefined
        }
        onClick={handleClick}
        {...props}
      >
        {/* Ripple layer */}
        <AnimatePresence>
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              initial={{
                opacity: 1,
                scale: 0,
                x: ripple.x - ripple.size / 2,
                y: ripple.y - ripple.size / 2,
              }}
              animate={{
                opacity: 0,
                scale: 1,
              }}
              exit={{ opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 25,
              }}
              className="pointer-events-none absolute rounded-full"
              style={{
                width: ripple.size,
                height: ripple.size,
                backgroundColor: "rgba(255, 255, 255, 0.2)",
              }}
            />
          ))}
        </AnimatePresence>

        {/* Button content */}
        <span className="relative z-10">{children}</span>
      </motion.button>
    );
  }
);
MotionButton.displayName = "MotionButton";

/**
 * EnergyButton - Specialized primary CTA with maximum visual impact
 *
 * RULE: Use for the single most important action on a page.
 * Features magnetic glow that follows cursor proximity.
 */
const EnergyButton = React.forwardRef<HTMLButtonElement, MotionButtonProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <MotionButton
        ref={ref}
        variant="energy"
        size={size}
        className={cn("overflow-hidden", className)}
        {...props}
      >
        {/* Energy ripple effect on hover */}
        <motion.span
          className="absolute inset-0 rounded-xl bg-white/10"
          initial={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 2, opacity: 0.1 }}
          transition={{ duration: 0.5, ease: smoothOut }}
        />
        <span className="relative z-10">{children}</span>
      </MotionButton>
    );
  }
);
EnergyButton.displayName = "EnergyButton";

/**
 * IconButton - Optimized for icon-only buttons
 *
 * Use with Lucide icons. Includes subtle glow on hover.
 */
const IconButton = React.forwardRef<
  HTMLButtonElement,
  Omit<MotionButtonProps, "size"> & { size?: "sm" | "default" | "lg" }
>(({ className, variant = "ghost", size = "default", children, ...props }, ref) => {
  const sizeMap = {
    sm: "icon-sm" as const,
    default: "icon" as const,
    lg: "icon-lg" as const,
  };

  return (
    <MotionButton
      ref={ref}
      variant={variant}
      size={sizeMap[size]}
      className={cn("p-0", className)}
      {...props}
    >
      {children}
    </MotionButton>
  );
});
IconButton.displayName = "IconButton";

export { Button, MotionButton, EnergyButton, IconButton, buttonVariants };
