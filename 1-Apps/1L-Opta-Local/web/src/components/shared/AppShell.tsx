'use client';

/**
 * AppShell — Root layout shell with global navigation header.
 *
 * Wraps all page content in ConnectionProvider and renders a sticky
 * glass header with branding, navigation links, and ConnectionBadge.
 * This is a client component because it uses hooks and context.
 */

import { type ReactNode, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  History,
  Settings,
  Swords,
  Database,
  Workflow,
  Monitor,
  User,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@opta/ui';

import {
  ConnectionProvider,
  useConnectionContextSafe,
} from '@/components/shared/ConnectionProvider';
import { ConnectionBadge } from '@/components/shared/ConnectionBadge';
import { AuthProvider, useAuthSafe } from '@/components/shared/AuthProvider';

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Arena', href: '/arena', icon: Swords },
  { label: 'RAG', href: '/rag', icon: Database },
  { label: 'Agents', href: '/agents', icon: Workflow },
  { label: 'Devices', href: '/devices', icon: Monitor },
  { label: 'Sessions', href: '/sessions', icon: History },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const;

// ---------------------------------------------------------------------------
// Header badge (reads context safely)
// ---------------------------------------------------------------------------

function HeaderConnectionBadge() {
  const connection = useConnectionContextSafe();

  if (!connection) {
    return <ConnectionBadge type="probing" />;
  }

  return (
    <ConnectionBadge
      type={connection.connectionType}
      latencyMs={connection.latencyMs}
    />
  );
}

// ---------------------------------------------------------------------------
// Header user badge (reads auth context safely)
// ---------------------------------------------------------------------------

function HeaderUserBadge() {
  const auth = useAuthSafe();

  // No auth context yet (still loading) — render nothing
  if (!auth) return null;

  const { user, isLoading, isCloudMode } = auth;

  // Loading state — don't flash UI
  if (isLoading) return null;

  // Signed in — show avatar with first initial
  if (user) {
    const initial = (
      user.user_metadata?.full_name ??
      user.email ??
      '?'
    ).charAt(0).toUpperCase();

    return (
      <Link
        href="/settings"
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full',
          'bg-primary/20 text-primary text-xs font-semibold',
          'border border-primary/30 hover:bg-primary/30 transition-colors',
        )}
        aria-label="User settings"
      >
        {initial}
      </Link>
    );
  }

  // Cloud mode but not signed in — show sign-in link
  if (isCloudMode) {
    return (
      <Link
        href="/sign-in"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
          'glass-subtle text-xs font-medium',
          'border-opta-border text-text-secondary hover:text-text-primary transition-colors',
        )}
      >
        <User className="h-3 w-3" />
        <span>Sign In</span>
      </Link>
    );
  }

  // LAN mode, not signed in — show nothing (existing behavior)
  return null;
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <AuthProvider>
      <ConnectionProvider>
        {/* Sticky global header */}
        <header className="fixed top-0 left-0 right-0 z-50 glass-subtle border-b border-opta-border">
          <div className="flex items-center justify-between px-4 py-2 max-w-screen-2xl mx-auto">
            {/* Left: branding + mobile hamburger */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="sm:hidden flex items-center justify-center h-7 w-7 rounded-lg text-text-secondary hover:text-text-primary hover:bg-opta-surface/50 transition-colors"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>
              <Link
                href="/"
                className="flex items-center gap-2 group"
                onClick={closeMobileMenu}
                aria-label="Opta Local home"
              >
                {/* Mini Opta ring mark */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className="shrink-0 transition-transform group-hover:rotate-45 duration-500"
                >
                  <defs>
                    <linearGradient id="hdr-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%"   stopColor="#fafafa" stopOpacity="0.9" />
                      <stop offset="50%"  stopColor="#a855f7" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  <circle
                    cx="12" cy="12" r="8"
                    stroke="url(#hdr-ring-grad)"
                    strokeWidth="5.5"
                    fill="none"
                  />
                </svg>
                {/* Brand text */}
                <span className="flex items-baseline gap-1.5">
                  <span className="opta-gradient-text text-sm font-bold tracking-[0.1em]">
                    OPTA
                  </span>
                  <span className="text-[10px] font-light tracking-[0.18em] uppercase text-text-muted">
                    LOCAL
                  </span>
                </span>
              </Link>
            </div>

            {/* Center: navigation (desktop) */}
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary/15 text-primary shadow-[0_0_12px_rgba(168,85,247,0.2),inset_0_-1px_0_rgba(168,85,247,0.5)]'
                        : 'text-text-secondary hover:text-text-primary hover:bg-opta-surface/50',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: connection badge + user */}
            <div className="flex items-center gap-2">
              <HeaderConnectionBadge />
              <HeaderUserBadge />
            </div>
          </div>

          {/* Mobile navigation drawer */}
          {mobileMenuOpen && (
            <nav className="sm:hidden border-t border-opta-border glass-subtle px-4 py-2 space-y-0.5">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={closeMobileMenu}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary/15 text-primary shadow-[inset_0_-1px_0_rgba(168,85,247,0.5)]'
                        : 'text-text-secondary hover:text-text-primary hover:bg-opta-surface/50',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          )}
        </header>

        {/* Content area — offset by header height */}
        <div className="pt-11">{children}</div>
      </ConnectionProvider>
    </AuthProvider>
  );
}
