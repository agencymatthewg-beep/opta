"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  content: React.ReactNode;
}

interface TabGroupProps {
  tabs: Tab[];
}

export function TabGroup({ tabs }: TabGroupProps) {
  const [active, setActive] = useState(0);

  return (
    <div className="rounded-lg doc-embed-block overflow-hidden mb-5">
      <div className="flex bg-transparent">
        {tabs.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActive(i)}
            className={cn(
              "px-4 py-2.5 text-sm transition-colors",
              i === active
                ? "text-primary font-medium shadow-[inset_0_-2px_0_0_rgba(168,85,247,0.9)]"
                : "text-text-muted hover:text-text-secondary hover:bg-white/5"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-4 bg-transparent">{tabs[active].content}</div>
    </div>
  );
}
