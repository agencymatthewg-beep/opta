import { Info, AlertTriangle, AlertOctagon, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type CalloutVariant = "info" | "warning" | "danger" | "tip";

interface CalloutProps {
  variant?: CalloutVariant;
  title?: string;
  children: React.ReactNode;
}

const variants: Record<CalloutVariant, { icon: React.ElementType; glow: string; bg: string; title: string }> = {
  info: { icon: Info, glow: "shadow-[inset_3px_0_0_rgba(59,130,246,0.7)]", bg: "bg-[linear-gradient(90deg,rgba(59,130,246,0.12),transparent_40%)]", title: "Info" },
  warning: { icon: AlertTriangle, glow: "shadow-[inset_3px_0_0_rgba(245,158,11,0.7)]", bg: "bg-[linear-gradient(90deg,rgba(245,158,11,0.12),transparent_40%)]", title: "Warning" },
  danger: { icon: AlertOctagon, glow: "shadow-[inset_3px_0_0_rgba(239,68,68,0.72)]", bg: "bg-[linear-gradient(90deg,rgba(239,68,68,0.12),transparent_40%)]", title: "Danger" },
  tip: { icon: Lightbulb, glow: "shadow-[inset_3px_0_0_rgba(34,197,94,0.7)]", bg: "bg-[linear-gradient(90deg,rgba(34,197,94,0.12),transparent_40%)]", title: "Tip" },
};

export function Callout({ variant = "info", title, children }: CalloutProps) {
  const v = variants[variant];
  const Icon = v.icon;

  return (
    <div className={cn("doc-embed-block rounded-xl p-4 mb-5", v.glow, v.bg)}>
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
