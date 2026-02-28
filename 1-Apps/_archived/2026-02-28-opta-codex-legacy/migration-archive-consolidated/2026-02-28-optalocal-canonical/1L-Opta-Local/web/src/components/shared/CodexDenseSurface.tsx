import type { ReactNode } from 'react';

interface CodexDenseSurfaceProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CodexDenseSurface({
  title,
  subtitle,
  actions,
  children,
  className,
}: CodexDenseSurfaceProps) {
  return (
    <section className={`codex-surface ${className ?? ''}`.trim()}>
      <header className="codex-surface-header">
        <div>
          <h2 className="codex-surface-title">{title}</h2>
          {subtitle ? <p className="codex-surface-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="codex-surface-actions">{actions}</div> : null}
      </header>
      <div className="codex-surface-body">{children}</div>
    </section>
  );
}

