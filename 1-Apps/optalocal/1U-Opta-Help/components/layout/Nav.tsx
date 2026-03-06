"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, X, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { OptaRing } from "@/components/shared/OptaRing";
import { SearchDialog } from "@/components/docs/SearchDialog";
import { navigation } from "@/lib/content";

const NAV_LINKS = [
  { label: "Getting Started", href: "/docs/getting-started/" },
  { label: "CLI", href: "/docs/cli/" },
  { label: "Daemon", href: "/docs/daemon/" },
  { label: "LMX", href: "/docs/lmx/" },
];

function MobileSidebar({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-6">
      {navigation.map((section) => (
        <div key={section.slug}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 px-3">
            {section.title}
          </h3>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = pathname === item.href || pathname === item.href.replace(/\/$/, "");
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors duration-150",
                      isActive
                        ? "text-primary font-medium shadow-[inset_2px_0_0_rgba(168,85,247,0.85)] bg-transparent"
                        : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
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
  );
}

export function Nav() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleSearch = useCallback(() => setSearchOpen(prev => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSearch();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSearch]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 glass-subtle doc-embed-block">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 -ml-2 text-text-secondary hover:text-text-primary transition-colors duration-150"
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
            {NAV_LINKS.map(({ label, href }) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "transition-colors duration-150",
                    isActive
                      ? "text-primary font-medium"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-secondary doc-embed-block rounded-lg transition-all duration-150 hover:bg-white/[0.02]"
              aria-label="Search documentation"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline text-xs text-text-muted bg-white/5 px-1.5 py-0.5 rounded border border-white/[0.06] font-sans search-kbd-hint">
                ⌘K
              </kbd>
            </button>
            <a
              href="https://optalocal.com"
              className="hidden sm:inline-flex px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors duration-150"
            >
              Home
            </a>
            <a
              href="https://init.optalocal.com"
              className="inline-flex px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg font-medium nav-cta"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile navigation overlay with spring entrance */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="fixed inset-0 bg-void/75 backdrop-blur-sm" />
            <motion.div
              className="fixed top-16 left-0 bottom-0 w-[280px] overflow-y-auto p-4 mobile-nav-panel"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
            >
              <MobileSidebar onNavigate={() => setMobileMenuOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
