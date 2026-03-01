"use client";

import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  title: string;
  level: 2 | 3;
}

interface TableOfContentsProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  if (items.length === 0) return null;

  return (
    <div className="hidden xl:block w-[200px] shrink-0">
      <div className="sticky top-20">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">
          On this page
        </h4>
        <nav className="space-y-1">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "block text-xs text-text-muted hover:text-text-secondary transition-colors py-0.5",
                item.level === 3 && "pl-3"
              )}
            >
              {item.title}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}
