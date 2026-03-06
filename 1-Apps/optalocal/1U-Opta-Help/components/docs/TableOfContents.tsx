"use client";

import { useEffect, useState } from "react";
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
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      {
        // Band: just below nav bar to the upper third of viewport
        rootMargin: "-80px 0px -66% 0px",
        threshold: 0,
      }
    );

    const els = items
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean) as Element[];

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className={cn("hidden xl:block w-[200px] shrink-0 transition-opacity duration-500", mounted ? "opacity-100" : "opacity-0")}>
      <div className="sticky top-20">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3 px-2">
          On this page
        </h4>
        <nav className="space-y-0.5">
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={cn(
                "block text-[13px] leading-snug transition-all duration-150 py-1 px-2 rounded-md",
                item.level === 3 && "pl-4",
                activeId === item.id
                  ? "text-primary font-medium shadow-[inset_2px_0_0_rgba(168,85,247,0.75)] bg-primary/[0.04]"
                  : "text-zinc-500 hover:text-text-secondary hover:bg-white/[0.02]"
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
