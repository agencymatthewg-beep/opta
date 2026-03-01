import Link from 'next/link';
import type { AppSlug, Category, Guide, GuideSection } from '@/content/guides';
import { appColors, appLabels } from '@/content/guides';

const categoryLabels: Record<Category, string> = {
  'getting-started': 'Getting Started',
  feature: 'Feature',
  troubleshooting: 'Troubleshooting',
  reference: 'Reference',
};

function AppBadge({ app }: { app: AppSlug }) {
  const color = appColors[app];

  return (
    <span
      className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-mono"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {appLabels[app]}
    </span>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-mono text-text-muted">
      {categoryLabels[category]}
    </span>
  );
}

function Section({ section, index }: { section: GuideSection; index: number }) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-white mt-12 mb-4">{section.heading}</h2>
      <p className="text-base text-text-secondary leading-relaxed">{section.body}</p>

      {section.note && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mt-4">
          <p className="text-sm text-amber-100/90">{section.note}</p>
        </div>
      )}

      {section.code && (
        <pre className="font-mono text-sm bg-surface rounded-xl p-4 mt-4 overflow-x-auto text-neon-green">
          <code>{section.code}</code>
        </pre>
      )}
    </section>
  );
}

export function GuideViewer({ guide }: { guide: Guide }) {
  return (
    <div className="min-h-screen bg-void flex flex-col">
      <header className="sticky top-0 z-10 glass-subtle border-b border-white/5 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-text-muted hover:text-white transition-colors">
          ← Back to Learn
        </Link>
        <span className="text-text-muted">/</span>
        <span className="text-white font-semibold truncate">{guide.title}</span>
        <div className="ml-auto flex items-center gap-2">
          <AppBadge app={guide.app} />
          <CategoryBadge category={guide.category} />
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-moonlight mb-4">{guide.title}</h1>
          <p className="text-xl text-text-secondary">{guide.summary}</p>
          <p className="text-xs font-mono text-text-muted mt-4">Updated {guide.updatedAt}</p>
        </div>

        {guide.sections.map((section, index) => (
          <Section key={`${guide.slug}-${index}`} section={section} index={index} />
        ))}

        <div className="mt-16 pt-8 border-t border-white/5">
          <Link href="/" className="text-primary text-sm hover:text-primary-glow transition-colors">
            ← Back to all guides
          </Link>
        </div>
      </div>
    </div>
  );
}
