import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConflicts } from '../hooks/useConflicts';
import PlatformIndicator from './PlatformIndicator';
import {
  LayoutDashboard,
  Gamepad2,
  Zap,
  Award,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'games',
    label: 'Games',
    icon: Gamepad2,
  },
  {
    id: 'optimize',
    label: 'Optimize',
    icon: Zap,
  },
  {
    id: 'score',
    label: 'Score',
    icon: Award,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
  },
];

function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const { summary } = useConflicts();
  const hasConflicts = summary && summary.total_count > 0;
  const highSeverityConflicts = summary && summary.high_count > 0;

  return (
    <aside className="w-64 min-w-64 h-screen flex flex-col glass-strong border-r-0">
      {/* Logo - Bold Opta branding */}
      <motion.div
        className="px-6 py-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <motion.div
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-md"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <span className="text-xl font-bold text-white">O</span>
          </motion.div>
          {/* Logo text */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-glow bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Opta
              </span>
            </h1>
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-medium">
              Optimizer
            </p>
          </div>
        </div>
      </motion.div>

      {/* Divider */}
      <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 p-4 flex flex-col gap-1">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05, duration: 0.3 }}
            >
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3 h-12 px-4 rounded-xl',
                  'text-muted-foreground font-medium relative group',
                  'transition-all duration-300',
                  isActive && [
                    'bg-primary/15 text-primary',
                    'shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.3)]',
                  ],
                  !isActive && 'hover:bg-muted/30 hover:text-foreground'
                )}
                onClick={() => onNavigate(item.id)}
              >
                {/* Active indicator line */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-primary glow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}

                {/* Icon */}
                <span
                  className={cn(
                    'transition-all duration-300',
                    isActive && 'text-primary drop-shadow-[0_0_8px_hsl(var(--glow-primary)/0.6)]',
                    !isActive && 'group-hover:text-primary/70'
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </span>

                {/* Label */}
                <span className={cn(
                  'transition-all duration-300',
                  isActive && 'text-primary'
                )}>
                  {item.label}
                </span>

                {/* Conflict indicator on Settings */}
                {item.id === 'settings' && hasConflicts && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={cn(
                      'absolute right-4 w-2.5 h-2.5 rounded-full',
                      highSeverityConflicts
                        ? 'bg-danger animate-pulse glow-sm-danger'
                        : 'bg-warning glow-sm-warning'
                    )}
                    title={`${summary?.total_count} conflict${summary?.total_count !== 1 ? 's' : ''} detected`}
                  />
                )}
              </Button>
            </motion.div>
          );
        })}
      </nav>

      {/* Footer */}
      <motion.div
        className="p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {/* Divider */}
        <div className="mb-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Quick tip */}
        <div className="glass-subtle rounded-lg p-3 mb-4">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Press <kbd className="px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[10px] font-medium">O</kbd> to expand details throughout the app
          </p>
        </div>

        {/* Platform indicator */}
        <div className="mb-4">
          <PlatformIndicator />
        </div>

        {/* Version */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-muted-foreground/50 font-medium">v0.1.0</span>
          <span className="text-[10px] text-muted-foreground/40">Phase 5.1</span>
        </div>
      </motion.div>
    </aside>
  );
}

export default Sidebar;
