'use client';

/**
 * AppShell — Root layout shell with global navigation header.
 *
 * Wraps all page content in ConnectionProvider and renders a sticky
 * glass header with branding, navigation links, and ConnectionBadge.
 * This is a client component because it uses hooks and context.
 */

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  History,
  Settings,
} from 'lucide-react';
import { cn } from '@opta/ui';

import {
  ConnectionProvider,
  useConnectionContextSafe,
} from '@/components/shared/ConnectionProvider';
import { ConnectionBadge } from '@/components/shared/ConnectionBadge';

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Chat', href: '/chat', icon: MessageSquare },
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
// AppShell
// ---------------------------------------------------------------------------

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ConnectionProvider>
      {/* Sticky global header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-subtle border-b border-opta-border">
        <div className="flex items-center justify-between px-4 py-2 max-w-screen-2xl mx-auto">
          {/* Left: branding */}
          <Link
            href="/"
            className="flex items-center gap-2 text-text-primary hover:text-primary transition-colors"
          >
            <span className="text-base font-bold tracking-tight">
              Opta Local
            </span>
          </Link>

          {/* Center: navigation */}
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
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-opta-surface/50',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: connection badge */}
          <HeaderConnectionBadge />
        </div>
      </header>

      {/* Content area — offset by header height */}
      <div className="pt-11">{children}</div>
    </ConnectionProvider>
  );
}
