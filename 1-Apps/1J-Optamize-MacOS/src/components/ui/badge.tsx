/**
 * Badge - The Obsidian Status Indicator
 *
 * Small status badges with obsidian glass material and energy variants.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background backdrop-blur-sm",
  {
    variants: {
      variant: {
        default: [
          "border-primary/30 bg-primary/15 text-primary",
          "shadow-[0_0_10px_-3px_rgba(168,85,247,0.3)]",
        ],
        secondary: [
          "border-white/[0.08] bg-white/[0.03] text-muted-foreground",
        ],
        destructive: [
          "border-danger/30 bg-danger/15 text-danger",
          "shadow-[0_0_10px_-3px_rgba(239,68,68,0.3)]",
        ],
        outline: [
          "border-white/[0.08] bg-transparent text-foreground",
        ],
        success: [
          "border-success/30 bg-success/15 text-success",
          "shadow-[0_0_10px_-3px_rgba(34,197,94,0.3)]",
        ],
        warning: [
          "border-warning/30 bg-warning/15 text-warning",
          "shadow-[0_0_10px_-3px_rgba(234,179,8,0.3)]",
        ],
        online: [
          "border-success/30 bg-success/15 text-success",
          "shadow-[0_0_10px_-3px_rgba(34,197,94,0.3)]",
        ],
        // Energy variant - full 50% state glow
        energy: [
          "border-primary/40 bg-primary/20 text-primary",
          "shadow-[inset_0_0_10px_rgba(168,85,247,0.1),0_0_15px_-3px_rgba(168,85,247,0.4)]",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
