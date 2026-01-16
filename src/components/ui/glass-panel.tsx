import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * GlassPanel - Frosted glass surface component
 *
 * The core visual element of Opta's glassmorphism design system.
 * Provides consistent frosted glass effects with hover states and glow.
 */

const glassPanelVariants = cva(
  [
    "relative",
    "rounded-xl",
    "transition-all duration-300",
    "backdrop-blur-[var(--glass-blur)]",
    "border border-[hsl(var(--glass-border)/var(--glass-border-opacity))]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-[hsl(var(--glass-bg)/var(--glass-opacity))]",
        ].join(" "),
        subtle: [
          "bg-[hsl(var(--glass-bg)/0.35)]",
          "backdrop-blur-[12px]",
          "border-[hsl(var(--glass-border)/0.15)]",
          "rounded-lg",
        ].join(" "),
        strong: [
          "bg-[hsl(var(--glass-bg)/0.7)]",
          "backdrop-blur-[24px]",
          "border-[hsl(var(--glass-border)/0.35)]",
        ].join(" "),
        solid: [
          "bg-card",
          "backdrop-blur-none",
          "border-border",
        ].join(" "),
      },
      interactive: {
        true: "cursor-pointer",
        false: "",
      },
      glow: {
        none: "",
        default: "shadow-glow-sm",
        hover: "",
        always: "shadow-glow",
      },
    },
    defaultVariants: {
      variant: "default",
      interactive: false,
      glow: "none",
    },
  }
);

export interface GlassPanelProps
  extends Omit<HTMLMotionProps<"div">, "children">,
    VariantProps<typeof glassPanelVariants> {
  children?: React.ReactNode;
  /** Whether the panel should animate on mount */
  animate?: boolean;
  /** Custom animation delay */
  animationDelay?: number;
}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      className,
      variant,
      interactive,
      glow,
      animate = true,
      animationDelay = 0,
      children,
      ...props
    },
    ref
  ) => {
    const baseClassName = cn(
      glassPanelVariants({ variant, interactive, glow }),
      className
    );

    // Interactive hover animation
    const interactiveProps = interactive
      ? {
          whileHover: {
            y: -2,
            boxShadow: "0 0 0 1px hsl(var(--glow-primary) / 0.2), 0 8px 32px -8px hsl(var(--glow-primary) / 0.25)",
          },
          whileTap: { y: 0 },
          transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const },
        }
      : {};

    // Mount animation
    const animationProps = animate
      ? {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.4,
            delay: animationDelay,
            ease: [0, 0, 0.2, 1] as const,
          },
        }
      : {};

    return (
      <motion.div
        ref={ref}
        className={baseClassName}
        {...animationProps}
        {...interactiveProps}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";

// ============================================
// SUB-COMPONENTS
// ============================================

interface GlassPanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const GlassPanelHeader = React.forwardRef<HTMLDivElement, GlassPanelHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
);
GlassPanelHeader.displayName = "GlassPanelHeader";

interface GlassPanelTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const GlassPanelTitle = React.forwardRef<HTMLHeadingElement, GlassPanelTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-lg font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
);
GlassPanelTitle.displayName = "GlassPanelTitle";

interface GlassPanelDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

const GlassPanelDescription = React.forwardRef<
  HTMLParagraphElement,
  GlassPanelDescriptionProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
GlassPanelDescription.displayName = "GlassPanelDescription";

interface GlassPanelContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const GlassPanelContent = React.forwardRef<HTMLDivElement, GlassPanelContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
);
GlassPanelContent.displayName = "GlassPanelContent";

interface GlassPanelFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const GlassPanelFooter = React.forwardRef<HTMLDivElement, GlassPanelFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
);
GlassPanelFooter.displayName = "GlassPanelFooter";

export {
  GlassPanel,
  GlassPanelHeader,
  GlassPanelTitle,
  GlassPanelDescription,
  GlassPanelContent,
  GlassPanelFooter,
};
