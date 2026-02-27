import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-opta-surface border border-opta-border text-white",
        success:
          "bg-neon-green/20 border border-neon-green/40 text-neon-green",
        warning:
          "bg-neon-orange/20 border border-neon-orange/40 text-neon-orange",
        info:
          "bg-neon-cyan/20 border border-neon-cyan/40 text-neon-cyan",
        purple:
          "bg-neon-purple/20 border border-neon-purple/40 text-neon-purple",
      },
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(badgeVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
