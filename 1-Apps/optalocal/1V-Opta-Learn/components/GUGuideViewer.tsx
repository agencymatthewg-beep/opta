import Link from 'next/link';
import type { RegisteredGuide } from '@/content/guides';
import { appLabels } from '@/content/guides';

interface GUGuideViewerProps {
  guide: RegisteredGuide;
}

export function GUGuideViewer({ guide }: GUGuideViewerProps) {
  const appLabel = appLabels[guide.app] ?? guide.app;

  return (
    <main className="min-h-screen bg-void flex flex-col">
      <header className="fixed top-0 inset-x-0 z-50 h-14 flex items-center px-6 glass-subtle border-b border-white/5">
        <nav className="flex items-center gap-2 text-xs font-mono min-w-0">
          <Link href="/" className="text-text-muted hover:text-text-secondary transition-colors shrink-0">
            learn
          </Link>
          <span className="text-text-muted shrink-0">/</span>
          <span className="text-text-primary truncate">{guide.title}</span>
        </nav>

        <div className="ml-auto flex items-center gap-3 shrink-0 pl-4">
          <span className="px-2 py-0.5 rounded-full border border-primary/30 text-primary text-[11px] font-mono">
            {appLabel}
          </span>
          <span className="text-[11px] font-mono text-text-muted hidden sm:block">
            {guide.updatedAt}
          </span>
          <Link
            href="https://optalocal.com"
            className="text-xs font-mono text-text-muted hover:text-white transition-colors"
          >
            optalocal.com ↗
          </Link>
        </div>
      </header>

      <iframe
        src={`/${guide.guFile}`}
        title={guide.title}
        style={{
          marginTop: '56px',
          height: 'calc(100vh - 56px)',
          border: 'none',
          width: '100%',
          display: 'block',
        }}
      />
    </main>
  );
}
