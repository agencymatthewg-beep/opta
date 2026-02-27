'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Globe, ArrowLeft, User } from 'lucide-react';
import { cn } from '@opta/ui';
import { OptaSurface } from '@/components/shared/OptaPrimitives';

const navItems = [
  {
    label: 'General',
    href: '/settings',
    icon: Settings,
  },
  {
    label: 'Tunnel',
    href: '/settings/tunnel',
    icon: Globe,
  },
  {
    label: 'Account',
    href: '/settings/account',
    icon: User,
  },
] as const;

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-opta-border flex-shrink-0">
        <OptaSurface
          hierarchy="overlay"
          padding="none"
          className="rounded-none border-0 px-6 py-3 flex items-center gap-4"
        >
          <Link
            href="/"
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </Link>
          <div className="w-px h-5 bg-opta-border" />
          <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
        </OptaSurface>
      </header>

      {/* Content area: sidebar + main */}
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Sidebar navigation */}
        <nav className="border-b md:border-b-0 md:border-r border-opta-border md:w-56 flex-shrink-0">
          <OptaSurface
            hierarchy="base"
            padding="none"
            className="rounded-none border-0 h-full p-3 md:p-4"
          >
            <ul className="flex md:flex-col gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/settings'
                    ? pathname === '/settings'
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'text-text-secondary hover:text-text-primary hover:bg-opta-surface',
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </OptaSurface>
        </nav>

        {/* Page content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
