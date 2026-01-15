import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConflicts } from '../hooks/useConflicts';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zm10-3a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
      </svg>
    )
  },
  {
    id: 'optimize',
    label: 'Optimize',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
];

function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { summary } = useConflicts();
  const hasConflicts = summary && summary.total_count > 0;
  const highSeverityConflicts = summary && summary.high_count > 0;

  return (
    <aside className="w-64 min-w-64 h-screen bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-border">
        <span className="text-2xl font-bold text-primary text-glow-primary tracking-tight">
          Opta
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 flex flex-col gap-1">
        {navItems.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            className={cn(
              'w-full justify-start gap-3 h-11 px-4 text-muted-foreground font-medium relative',
              'hover:bg-muted/50 hover:text-foreground',
              activePage === item.id && [
                'bg-primary/10 text-primary border-l-2 border-primary rounded-l-none',
                'hover:bg-primary/15 hover:text-primary',
              ]
            )}
            onClick={() => onNavigate(item.id)}
          >
            <span className={cn(
              'transition-all',
              activePage === item.id && 'text-primary drop-shadow-[0_0_4px_hsl(var(--primary))]'
            )}>
              {item.icon}
            </span>
            <span>{item.label}</span>
            {/* Conflict indicator on Settings */}
            {item.id === 'settings' && hasConflicts && (
              <span
                className={cn(
                  'absolute right-3 w-2 h-2 rounded-full',
                  highSeverityConflicts ? 'bg-danger animate-pulse' : 'bg-warning'
                )}
                title={`${summary?.total_count} conflict${summary?.total_count !== 1 ? 's' : ''} detected`}
              />
            )}
          </Button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border">
        <span className="text-xs text-muted-foreground/60">v0.1.0</span>
      </div>
    </aside>
  );
}

export default Sidebar;
