import * as React from "react";
import { Search, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  className?: string;
}

export function Header({ title, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex items-center justify-between h-16 px-6 bg-glass-bg/50 backdrop-blur-sm border-b border-glass-border",
        className
      )}
    >
      {/* Page title - with padding for mobile menu button */}
      <h1 className="text-xl font-semibold text-white pl-12 md:pl-0">
        {title}
      </h1>

      {/* Search input */}
      <div className="hidden sm:flex flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Search models, benchmarks..."
            className="w-full h-10 pl-10 pr-4 bg-opta-surface border border-opta-border rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/20 transition-colors"
          />
        </div>
      </div>

      {/* Theme toggle placeholder */}
      <button
        className="p-2 rounded-lg bg-opta-surface border border-opta-border hover:bg-glass-hover transition-colors"
        aria-label="Toggle theme"
      >
        <Sun className="h-5 w-5 text-white/70 hidden dark:block" />
        <Moon className="h-5 w-5 text-white/70 dark:hidden" />
      </button>
    </header>
  );
}
