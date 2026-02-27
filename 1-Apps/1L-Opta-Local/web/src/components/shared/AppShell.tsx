'use client';

/**
 * AppShell — Root layout shell with global navigation header.
 *
 * Wraps all page content in ConnectionProvider and renders a sticky
 * glass header with branding, navigation links, and ConnectionBadge.
 * This is a client component because it uses hooks and context.
 */

import { type ReactNode, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  Layers,
  History,
  Settings,
  Swords,
  Database,
  Workflow,
  Monitor,
  Menu,
  X,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@opta/ui';

import {
  ConnectionProvider,
  useConnectionContextSafe,
} from '@/components/shared/ConnectionProvider';
import { ConnectionBadge } from '@/components/shared/ConnectionBadge';
import { AuthProvider, useAuth } from '@/components/shared/AuthProvider';
import { SignInOverlay } from '@/components/shared/SignInOverlay';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { StatusStrip } from '@/components/shared/StatusStrip';
import { POST_SIGN_IN_NEXT_KEY, sanitizeNextPath } from '@/lib/auth-utils';

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Chat', href: '/chat', icon: MessageSquare },
  { label: 'Models', href: '/models', icon: Layers },
  { label: 'Arena', href: '/arena', icon: Swords },
  { label: 'RAG', href: '/rag', icon: Database },
  { label: 'Agents', href: '/agents', icon: Workflow },
  { label: 'Devices', href: '/devices', icon: Monitor },
  { label: 'Sessions', href: '/sessions', icon: History },
  { label: 'Settings', href: '/settings', icon: Settings },
] as const;

const PRIMARY_HREFS = ['/', '/chat', '/models'];
const primaryNav = navItems.filter((i) => PRIMARY_HREFS.includes(i.href));
const secondaryNav = navItems.filter((i) => !PRIMARY_HREFS.includes(i.href));

function isActiveRoute(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

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
  const { user, isLoading } = useAuth();

  if (isLoading || !user) return null;

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
        'border border-transparent hover:bg-primary/30 transition-colors',
      )}
      aria-label="User settings"
    >
      {initial}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Auth blur wrapper (applies blur when overlay is visible)
// ---------------------------------------------------------------------------

function AuthBlurWrapper({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const shouldBlur = !isLoading && !user;

  return (
    <div
      className={cn(
        'transition-[filter,transform] duration-500 ease-out',
        shouldBlur && 'blur-[24px] scale-[1.01]',
      )}
    >
      {children}
    </div>
  );
}

function PostSignInNextRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading || !user) return;

    const storedNext = sanitizeNextPath(
      typeof window === 'undefined'
        ? null
        : window.sessionStorage.getItem(POST_SIGN_IN_NEXT_KEY),
    );

    if (!storedNext) return;

    const currentPath =
      typeof window === 'undefined'
        ? pathname
        : `${window.location.pathname}${window.location.search}`;

    if (storedNext === currentPath) {
      window.sessionStorage.removeItem(POST_SIGN_IN_NEXT_KEY);
      return;
    }

    window.sessionStorage.removeItem(POST_SIGN_IN_NEXT_KEY);
    router.replace(storedNext);
  }, [user, isLoading, pathname, router]);

  return null;
}

// ---------------------------------------------------------------------------
// AppShell
// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    closeMobileMenu();
    setMoreMenuOpen(false);
  }, [closeMobileMenu, pathname]);

  // Cmd+K / Ctrl+K opens command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeMobileMenu, mobileMenuOpen]);

  return (
    <AuthProvider>
      {/* Sign-in overlay (above everything, self-determines visibility) */}
      <SignInOverlay />

      <AuthBlurWrapper>
      <ConnectionProvider>
        <PostSignInNextRedirect />

        {/* Global ambient background glow */}
        <div className="fixed -inset-[50%] -z-10 pointer-events-none opacity-40 blur-[200px] rounded-full mix-blend-screen bg-gradient-to-tr from-opta-primary/20 via-opta-primary-glow/10 to-transparent animate-[opta-breathe_8s_ease-in-out_infinite]" />

        {/* Sticky global header */}
        <header className="fixed inset-x-0 top-0 z-50 glass-subtle border-b border-transparent">

          <div className="mx-auto flex h-11 max-w-screen-2xl items-center gap-3 px-3 sm:px-4">
            {/* Left: branding + mobile hamburger */}
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-opta-surface/50 hover:text-text-primary sm:hidden"
                onClick={toggleMobileMenu}
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav-drawer"
                aria-haspopup="dialog"
              >
                {mobileMenuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>

              <Link
                href="/"
                className="group flex min-w-0 items-center gap-2"
                onClick={closeMobileMenu}
                aria-label="Opta Local home"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                  className="shrink-0 transition-transform duration-500 group-hover:rotate-45"
                >
                  <defs>
                    {/* Radial gradient: light source at upper-left → deep dark at lower-right */}
                    <radialGradient id="hdr-ring-3d" cx="32%" cy="26%" r="72%" gradientUnits="objectBoundingBox">
                      <stop offset="0%"   stopColor="#f5f3ff" />
                      <stop offset="15%"  stopColor="#e9d5ff" />
                      <stop offset="35%"  stopColor="#a855f7" />
                      <stop offset="65%"  stopColor="#6d28d9" />
                      <stop offset="85%"  stopColor="#3b0764" />
                      <stop offset="100%" stopColor="#13052e" />
                    </radialGradient>
                    {/* Soft glow: blur behind + sharp on top */}
                    <filter id="hdr-ring-glow" x="-35%" y="-35%" width="170%" height="170%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    stroke="url(#hdr-ring-3d)"
                    strokeWidth="5.5"
                    fill="none"
                    filter="url(#hdr-ring-glow)"
                  />
                  {/* Specular highlight — upper-left bright zone (lit sphere illusion) */}
                  <circle cx="8.5"  cy="7.2"  r="1.8" fill="white"   fillOpacity="0.55" />
                  {/* Counter-specular — lower-right dim bounce */}
                  <circle cx="15.5" cy="17.0" r="0.8" fill="#c084fc" fillOpacity="0.35" />
                </svg>

                <span className="flex min-w-0 flex-col leading-none">
                  <span className="opta-gradient-text text-sm font-bold tracking-[0.1em]">
                    OPTA LOCAL
                  </span>
                  <span className="hidden text-[10px] uppercase tracking-[0.16em] text-text-muted md:block">
                    Command Surface
                  </span>
                </span>
              </Link>
            </div>

            {/* Center: navigation (desktop) */}
            <nav className="hidden flex-1 items-center gap-1 sm:flex" aria-label="Primary navigation">
              {primaryNav.map((item) => {
                const isActive = isActiveRoute(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
                      isActive
                        ? 'bg-primary/15 text-primary shadow-[0_0_12px_rgba(168,85,247,0.2),inset_0_-1px_0_rgba(168,85,247,0.5)]'
                        : 'text-text-secondary hover:bg-opta-surface/50 hover:text-text-primary',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* More overflow button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen((prev) => !prev)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
                    secondaryNav.some((i) => isActiveRoute(pathname, i.href))
                      ? 'bg-primary/15 text-primary shadow-[0_0_12px_rgba(168,85,247,0.2),inset_0_-1px_0_rgba(168,85,247,0.5)]'
                      : 'text-text-secondary hover:bg-opta-surface/50 hover:text-text-primary',
                  )}
                  aria-expanded={moreMenuOpen}
                  aria-label="More navigation options"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                  <span>More</span>
                </button>

                {moreMenuOpen && (
                  <div className="absolute top-full mt-1 left-0 glass-strong rounded-xl p-1.5 min-w-[160px] shadow-xl z-50">
                    {secondaryNav.map((item) => {
                      const isActive = isActiveRoute(pathname, item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors',
                            isActive
                              ? 'bg-primary/15 text-primary'
                              : 'text-text-secondary hover:bg-primary/10 hover:text-primary',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>

            {/* Right: Cmd+K hint + connection badge + user */}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="hidden sm:flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-muted hover:text-text-secondary hover:bg-opta-surface/50 transition-colors"
                aria-label="Open command palette"
              >
                <span className="opta-kbd">⌘</span>
                <span className="opta-kbd ml-0.5">K</span>
              </button>
              <HeaderConnectionBadge />
              <HeaderUserBadge />
            </div>
          </div>
        </header>

        {/* Mobile navigation drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 top-11 z-40 sm:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-opta-bg/55 backdrop-blur-[1px]"
              aria-label="Close navigation menu"
              onClick={closeMobileMenu}
            />

            <section
              id="mobile-nav-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              className="relative mx-3 mt-2 rounded-xl border border-transparent glass-strong p-2"
            >
              <div className="mb-1 flex items-center justify-between px-2 py-1">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Navigate
                </h2>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-opta-surface/50 hover:text-text-primary"
                  aria-label="Close navigation menu"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <nav className="space-y-0.5" aria-label="Primary navigation">
                {navItems.map((item) => {
                  const isActive = isActiveRoute(pathname, item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobileMenu}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                        isActive
                          ? 'bg-primary/15 text-primary shadow-[inset_0_-1px_0_rgba(168,85,247,0.5)]'
                          : 'text-text-secondary hover:bg-opta-surface/50 hover:text-text-primary',
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </section>
          </div>
        )}

        {/* Content area — offset by header height */}
        <div className="pt-11 pb-7">{children}</div>
      </ConnectionProvider>

      {/* Command palette — global Cmd+K */}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Status strip — persistent bottom bar */}
      <StatusStrip />
      </AuthBlurWrapper>
    </AuthProvider>
  );
}
