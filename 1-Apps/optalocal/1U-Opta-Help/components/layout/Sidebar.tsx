"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navigation } from "@/lib/content";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[280px] shrink-0 hidden lg:block">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-4 pb-8">
        <nav className="space-y-6">
          {navigation.map((section) => (
            <div key={section.slug}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2 px-3">
                {section.title}
              </h3>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || pathname === item.href.replace(/\/$/, '');
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                            : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                        )}
                      >
                        {isActive && <ChevronRight size={12} className="shrink-0" />}
                        <span>{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
