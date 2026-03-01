"use client";

import { Info, AlertTriangle, AlertOctagon, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type CalloutVariant = "info" | "warning" | "danger" | "tip";

interface CalloutProps {
  variant?: CalloutVariant;
  title?: string;
  children: React.ReactNode;
}

const variants: Record<CalloutVariant, { icon: React.ElementType; border: string; bg: string; title: string }> = {
  info: { icon: Info, border: "border-neon-blue/30", bg: "bg-neon-blue/5", title: "Info" },
  warning: { icon: AlertTriangle, border: "border-neon-amber/30", bg: "bg-neon-amber/5", title: "Warning" },
  danger: { icon: AlertOctagon, border: "border-neon-red/30", bg: "bg-neon-red/5", title: "Danger" },
  tip: { icon: Lightbulb, border: "border-neon-green/30", bg: "bg-neon-green/5", title: "Tip" },
};

export function Callout({ variant = "info", title, children }: CalloutProps) {
  const v = variants[variant];
  const Icon = v.icon;

  return (
    <div className={cn("rounded-lg border p-4 mb-4", v.border, v.bg)}>
      <div className="flex items-start gap-3">
        <Icon size={18} className="shrink-0 mt-0.5 text-text-secondary" />
        <div className="text-sm">
          {(title || v.title) && (
            <div className="font-semibold text-text-primary mb-1">{title || v.title}</div>
          )}
          <div className="text-text-secondary leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
