import type { ReactNode, CSSProperties } from "react";

interface WidgetShellProps {
  /** A Lucide icon element, e.g. <Activity size={14} /> */
  icon: ReactNode;
  title: string;
  /** Optional uppercase badge text, e.g. "RUNNING" */
  badge?: string;
  /**
   * CSS variable name for the widget's accent color.
   * e.g. "--opta-neon-cyan" for LMX, "--opta-primary" for daemon.
   * Defaults to --opta-primary.
   */
  accentVar?: string;
  children: ReactNode;
}

export function WidgetShell({ icon, title, badge, accentVar = "--opta-primary", children }: WidgetShellProps) {
  return (
    <div
      className="widget-bento-card widget-shell"
      style={{ "--widget-accent": `var(${accentVar})` } as CSSProperties}
    >
      <div className="bento-card-header">
        <div className="bento-card-title">
          <span className="bento-card-icon widget-shell-icon">{icon}</span>
          {title}
        </div>
        {badge && <span className="bento-badge" role="status">{badge}</span>}
      </div>
      <div className="widget-shell-body">{children}</div>
    </div>
  );
}
