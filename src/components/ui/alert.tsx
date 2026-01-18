/**
 * Alert - The Obsidian Notification
 *
 * Alert banners with obsidian glass material and status-based energy states.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  [
    "relative w-full rounded-xl px-4 py-3 text-sm",
    // Obsidian glass base
    "glass",
    "border",
    // Inner specular highlight
    "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
    "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
    "before:rounded-t-xl",
    // Icon positioning
    "[&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
  ],
  {
    variants: {
      variant: {
        default: [
          "border-white/[0.08] text-foreground",
          "[&>svg]:text-foreground",
        ],
        destructive: [
          "border-danger/30 text-danger",
          "shadow-[inset_0_0_20px_rgba(239,68,68,0.08),0_0_20px_-5px_rgba(239,68,68,0.2)]",
          "[&>svg]:text-danger [&>svg]:drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]",
        ],
        warning: [
          "border-warning/30 text-warning",
          "shadow-[inset_0_0_20px_rgba(234,179,8,0.08),0_0_20px_-5px_rgba(234,179,8,0.2)]",
          "[&>svg]:text-warning [&>svg]:drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]",
        ],
        info: [
          "border-primary/30 text-primary",
          "shadow-[inset_0_0_20px_rgba(168,85,247,0.08),0_0_20px_-5px_rgba(168,85,247,0.2)]",
          "[&>svg]:text-primary [&>svg]:drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]",
        ],
        success: [
          "border-success/30 text-success",
          "shadow-[inset_0_0_20px_rgba(34,197,94,0.08),0_0_20px_-5px_rgba(34,197,94,0.2)]",
          "[&>svg]:text-success [&>svg]:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn(
      "mb-1 font-semibold leading-none tracking-tight",
      // Moonlight gradient for titles
      "bg-gradient-to-br from-white via-white to-primary/50 bg-clip-text text-transparent",
      className
    )}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground/80 [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
