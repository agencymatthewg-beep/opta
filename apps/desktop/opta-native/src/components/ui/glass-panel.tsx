import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAnimationVisibilityWithRef } from "@/hooks/useAnimationVisibility";

/**
 * ObsidianPanel - The Living Artifact Surface
 *
 * Dark obsidian glass that awakens with energy on interaction.
 * Implements the 0% → 50% state transition system.
 *
 * States:
 * - Dormant (0%): Dark glass, subtle inner glow, high gloss reflections
 * - Active (50%): Purple energy emanates from within, casts ambient glow
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

const obsidianPanelVariants = cva(
  [
    // Base obsidian glass material
    "relative",
    "rounded-xl",
    "bg-[#05030a]/80",
    "backdrop-blur-xl",
    "border border-white/[0.05]",
    // Inner specular highlight (top edge reflection)
    "before:absolute before:inset-x-0 before:top-0 before:h-px",
    "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
    "before:rounded-t-xl",
    // Transition for energy awakening
    "transition-all duration-500 ease-out",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "",
        subtle: [
          "bg-[#05030a]/50",
          "backdrop-blur-lg",
          "border-white/[0.03]",
          "rounded-lg",
          "before:via-white/5",
        ].join(" "),
        strong: [
          "bg-[#05030a]/95",
          "backdrop-blur-2xl",
          "border-white/10",
          "before:via-white/15",
        ].join(" "),
        elevated: [
          "bg-[#08051a]/90",
          "backdrop-blur-2xl",
          "border-primary/10",
          "shadow-[0_8px_32px_-8px_rgba(168,85,247,0.15)]",
        ].join(" "),
      },
      interactive: {
        true: "cursor-pointer",
        false: "",
      },
      glow: {
        none: "",
        subtle: "shadow-[0_0_15px_-3px_rgba(168,85,247,0.15)]",
        default: "shadow-[0_0_20px_-5px_rgba(168,85,247,0.25)]",
        strong: "shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)]",
        pulse: "",
      },
    },
    defaultVariants: {
      variant: "default",
      interactive: false,
      glow: "none",
    },
  }
);

export interface ObsidianPanelProps
  extends Omit<HTMLMotionProps<"div">, "children">,
    VariantProps<typeof obsidianPanelVariants> {
  children?: React.ReactNode;
  /** Whether the panel should animate on mount (ignition effect) */
  animate?: boolean;
  /** Custom animation delay for staggered entrances */
  animationDelay?: number;
  /** Energy state - controls the 0%→50% glow intensity */
  energyState?: "dormant" | "active" | "pulse";
}

const ObsidianPanel = React.forwardRef<HTMLDivElement, ObsidianPanelProps>(
  (
    {
      className,
      variant,
      interactive,
      glow,
      animate = true,
      animationDelay = 0,
      energyState = "dormant",
      children,
      ...props
    },
    ref
  ) => {
    // Use internal ref for visibility detection
    const internalRef = React.useRef<HTMLDivElement>(null);
    const { isVisible } = useAnimationVisibilityWithRef(internalRef, { rootMargin: '100px' });

    // Combine refs
    React.useImperativeHandle(ref, () => internalRef.current as HTMLDivElement);

    // When not visible, disable infinite pulse animation by falling back to active state
    const effectiveEnergyState = energyState === "pulse" && !isVisible ? "active" : energyState;

    const baseClassName = cn(
      obsidianPanelVariants({ variant, interactive, glow }),
      className
    );

    // Interactive hover variants - triggers 0% → 50% on hover
    const interactiveVariants = interactive
      ? {
          initial: {
            borderColor: "rgba(255, 255, 255, 0.05)",
            boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
          },
          whileHover: {
            y: -2,
            borderColor: "rgba(168, 85, 247, 0.4)",
            boxShadow: `
              inset 0 0 20px rgba(168, 85, 247, 0.08),
              0 0 0 1px rgba(168, 85, 247, 0.2),
              0 8px 32px -8px rgba(168, 85, 247, 0.25)
            `,
            transition: { duration: 0.5, ease: smoothOut },
          },
          whileTap: {
            y: 0,
            scale: 0.995,
            transition: { duration: 0.1 },
          },
        }
      : {};

    // Energy state animations
    const energyVariants = {
      dormant: {
        boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
      },
      active: {
        boxShadow: `
          inset 0 0 30px rgba(168, 85, 247, 0.12),
          0 0 25px rgba(168, 85, 247, 0.35)
        `,
        borderColor: "rgba(168, 85, 247, 0.5)",
      },
      pulse: {
        boxShadow: [
          "inset 0 0 15px rgba(168, 85, 247, 0.05), 0 0 10px rgba(168, 85, 247, 0.15)",
          "inset 0 0 30px rgba(168, 85, 247, 0.15), 0 0 30px rgba(168, 85, 247, 0.4)",
          "inset 0 0 15px rgba(168, 85, 247, 0.05), 0 0 10px rgba(168, 85, 247, 0.15)",
        ],
        transition: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      },
    };

    // Mount animation - ignition effect (emerges from darkness)
    const mountAnimation = animate
      ? {
          initial: {
            opacity: 0,
            y: 8,
            scale: 0.98,
            filter: "brightness(0.6) blur(2px)",
          },
          animate: {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "brightness(1) blur(0px)",
            ...energyVariants[effectiveEnergyState],
          },
          transition: {
            duration: 0.6,
            delay: animationDelay,
            ease: smoothOut,
          },
        }
      : {
          animate: energyVariants[effectiveEnergyState],
        };

    return (
      <motion.div
        ref={internalRef}
        className={baseClassName}
        {...mountAnimation}
        {...interactiveVariants}
        {...props}
      >
        {/* Inner glow layer for active state */}
        {effectiveEnergyState === "active" && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.08) 0%, transparent 70%)",
            }}
          />
        )}
        {children}
      </motion.div>
    );
  }
);

ObsidianPanel.displayName = "ObsidianPanel";

// ============================================
// SUB-COMPONENTS
// ============================================

interface ObsidianPanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const ObsidianPanelHeader = React.forwardRef<HTMLDivElement, ObsidianPanelHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
);
ObsidianPanelHeader.displayName = "ObsidianPanelHeader";

interface ObsidianPanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const ObsidianPanelTitle = React.forwardRef<HTMLHeadingElement, ObsidianPanelTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        "bg-gradient-to-br from-white via-white to-primary/50 bg-clip-text text-transparent",
        className
      )}
      {...props}
    />
  )
);
ObsidianPanelTitle.displayName = "ObsidianPanelTitle";

interface ObsidianPanelDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

const ObsidianPanelDescription = React.forwardRef<
  HTMLParagraphElement,
  ObsidianPanelDescriptionProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
ObsidianPanelDescription.displayName = "ObsidianPanelDescription";

interface ObsidianPanelContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const ObsidianPanelContent = React.forwardRef<HTMLDivElement, ObsidianPanelContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
ObsidianPanelContent.displayName = "ObsidianPanelContent";

interface ObsidianPanelFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const ObsidianPanelFooter = React.forwardRef<HTMLDivElement, ObsidianPanelFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
);
ObsidianPanelFooter.displayName = "ObsidianPanelFooter";

// ============================================
// LEGACY ALIASES (for backward compatibility)
// ============================================

/** @deprecated Use ObsidianPanel instead */
const GlassPanel = ObsidianPanel;
/** @deprecated Use ObsidianPanelHeader instead */
const GlassPanelHeader = ObsidianPanelHeader;
/** @deprecated Use ObsidianPanelTitle instead */
const GlassPanelTitle = ObsidianPanelTitle;
/** @deprecated Use ObsidianPanelDescription instead */
const GlassPanelDescription = ObsidianPanelDescription;
/** @deprecated Use ObsidianPanelContent instead */
const GlassPanelContent = ObsidianPanelContent;
/** @deprecated Use ObsidianPanelFooter instead */
const GlassPanelFooter = ObsidianPanelFooter;

export {
  ObsidianPanel,
  ObsidianPanelHeader,
  ObsidianPanelTitle,
  ObsidianPanelDescription,
  ObsidianPanelContent,
  ObsidianPanelFooter,
  // Legacy exports
  GlassPanel,
  GlassPanelHeader,
  GlassPanelTitle,
  GlassPanelDescription,
  GlassPanelContent,
  GlassPanelFooter,
};
