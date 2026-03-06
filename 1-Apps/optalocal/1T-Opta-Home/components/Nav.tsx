"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const desktopNavBreakpoint = "(min-width: 768px)";
const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const primaryLinks = [
  { href: "https://init.optalocal.com", label: "Init" },
  { href: "https://lmx.optalocal.com", label: "LMX" },
  { href: "https://help.optalocal.com/docs/cli", label: "CLI" },
  { href: "https://help.optalocal.com/docs/code-desktop", label: "Code" },
];

const secondaryLinks = [
  { href: "https://accounts.optalocal.com", label: "Accounts" },
  { href: "https://status.optalocal.com", label: "Status" },
  { href: "https://help.optalocal.com", label: "Help" },
  { href: "https://learn.optalocal.com", label: "Learn" },
];

export function Nav() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const wasMenuOpenRef = useRef(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(desktopNavBreakpoint);

    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMobileMenuOpen(false);
      }
    };

    mediaQuery.addEventListener("change", handleViewportChange);
    return () => {
      mediaQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };
    const handleFocusTrap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusableElements =
        menuRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [];

      if (focusableElements.length === 0) {
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    window.addEventListener("keydown", handleEscape);
    window.addEventListener("keydown", handleFocusTrap);
    const firstFocusable = menuRef.current?.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("keydown", handleFocusTrap);
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (wasMenuOpenRef.current && !isMobileMenuOpen) {
      toggleButtonRef.current?.focus();
    }
    wasMenuOpenRef.current = isMobileMenuOpen;
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="fixed top-0 inset-x-0 z-50 glass-subtle border-b border-white/5" aria-label="Primary navigation">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity motion-reduce:transition-none hover:opacity-90"
          aria-label="Opta Local home"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/opta-local-mark.svg"
            alt="Opta Local"
            className="w-6 h-6"
            width={24}
            height={24}
            loading="eager"
            decoding="async"
          />
          <span className="text-sm font-bold tracking-[0.1em] text-moonlight">
            OPTA LOCAL
          </span>
        </Link>

        {/* Core app links */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          {primaryLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-text-secondary hover:text-text-primary transition-colors motion-reduce:transition-none"
            >
              {link.label}
            </a>
          ))}
          <span className="w-px h-4 bg-white/10" aria-hidden="true" />
          {secondaryLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`transition-colors motion-reduce:transition-none text-xs ${link.label === "Learn" ? "text-text-muted hover:text-primary font-medium" : "text-text-muted hover:text-text-secondary"}`}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            ref={toggleButtonRef}
            type="button"
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-white/10 text-text-primary hover:border-primary/40 hover:text-primary transition-colors motion-reduce:transition-none"
            aria-controls="mobile-nav-menu"
            aria-expanded={isMobileMenuOpen}
            aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            <span className="sr-only">Menu</span>
            <span className="relative block h-3 w-5" aria-hidden="true">
              <span
                className={`absolute left-0 top-0 h-0.5 w-5 bg-current transition-transform motion-reduce:transition-none ${isMobileMenuOpen ? "translate-y-[5px] rotate-45" : ""}`}
              />
              <span
                className={`absolute left-0 top-[5px] h-0.5 w-5 bg-current transition-opacity motion-reduce:transition-none ${isMobileMenuOpen ? "opacity-0" : "opacity-100"}`}
              />
              <span
                className={`absolute left-0 top-[10px] h-0.5 w-5 bg-current transition-transform motion-reduce:transition-none ${isMobileMenuOpen ? "-translate-y-[5px] -rotate-45" : ""}`}
              />
            </span>
          </button>

          <a
            href="https://init.optalocal.com"
            className="hidden md:inline-flex px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors motion-reduce:transition-none font-medium"
          >
            Start with Init
          </a>
        </div>
      </div>

      <div
        ref={menuRef}
        id="mobile-nav-menu"
        aria-hidden={!isMobileMenuOpen}
        className={`md:hidden overflow-hidden border-t border-white/5 bg-void/95 backdrop-blur-xl transition-[max-height,opacity,visibility] duration-300 motion-reduce:transition-none ${isMobileMenuOpen ? "max-h-[32rem] opacity-100 visible" : "max-h-0 opacity-0 pointer-events-none invisible"}`}
      >
        <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {primaryLinks.map((link) => (
              <a
                key={`mobile-${link.href}`}
                href={link.href}
                className="text-text-secondary hover:text-text-primary transition-colors motion-reduce:transition-none"
                onClick={closeMobileMenu}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="h-px bg-white/10" aria-hidden="true" />

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {secondaryLinks.map((link) => (
              <a
                key={`mobile-secondary-${link.href}`}
                href={link.href}
                className={`transition-colors motion-reduce:transition-none ${link.label === "Learn" ? "text-text-muted hover:text-primary font-medium" : "text-text-muted hover:text-text-secondary"}`}
                onClick={closeMobileMenu}
              >
                {link.label}
              </a>
            ))}
          </div>

          <a
            href="https://init.optalocal.com"
            className="inline-flex w-full items-center justify-center px-4 py-2 text-sm bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors motion-reduce:transition-none font-medium"
            onClick={closeMobileMenu}
          >
            Start with Init
          </a>
        </div>
      </div>
    </nav>
  );
}
