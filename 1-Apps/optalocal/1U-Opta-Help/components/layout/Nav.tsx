"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Menu, X } from "lucide-react";
import { OptaRing } from "@/components/shared/OptaRing";
import { SearchDialog } from "@/components/docs/SearchDialog";

export function Nav() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 glass-subtle border-b border-white/5">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link href="/" className="flex items-center gap-3">
              <OptaRing size={24} />
              <span className="text-sm font-bold tracking-[0.1em] text-moonlight">
                OPTA HELP
              </span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/docs/getting-started/" className="text-text-secondary hover:text-text-primary transition-colors">
              Getting Started
            </Link>
            <Link href="/docs/cli/" className="text-text-secondary hover:text-text-primary transition-colors">
              CLI
            </Link>
            <Link href="/docs/daemon/" className="text-text-secondary hover:text-text-primary transition-colors">
              Daemon
            </Link>
            <Link href="/docs/lmx/" className="text-text-secondary hover:text-text-primary transition-colors">
              LMX
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary glass-subtle rounded-lg transition-colors"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline text-xs text-text-muted bg-elevated px-1.5 py-0.5 rounded border border-white/5">
                ⌘K
              </kbd>
            </button>
            <a
              href="https://optalocal.com"
              className="hidden sm:inline-flex px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Home
            </a>
            <a
              href="https://init.optalocal.com"
              className="inline-flex px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-all font-medium"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
