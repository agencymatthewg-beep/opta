/**
 * CommandPalette - The Obsidian Command Interface
 *
 * Keyboard-first navigation with Cmd+K. Built on cmdk for fuzzy search
 * and automatic focus management.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 * @see DESIGN_SYSTEM.md - Part 6: Animation Standards
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { smoothOut } from '@/lib/animations';
import {
  createCommands,
  groupLabels,
  type Command as CommandType,
  type CommandGroup,
  type CommandActions,
} from './commands';

// Easing curves from design system
const circOut = [0, 0.55, 0.45, 1] as const;

export interface CommandPaletteProps {
  /**
   * Navigation function to route to different pages.
   * Receives page ID like 'dashboard', 'games', etc.
   */
  navigate: (pageId: string) => void;
  /**
   * Action handlers for non-navigation commands.
   */
  actions: CommandActions;
}

/**
 * CommandPalette - Opta's keyboard-first command interface.
 *
 * Opens with Cmd+K (or Ctrl+K on Windows/Linux).
 * Provides fuzzy search across navigation, actions, and utilities.
 */
export function CommandPalette({ navigate, actions }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Create commands with navigation and action handlers
  const commands = useMemo(
    () => createCommands(navigate, actions),
    [navigate, actions]
  );

  // Group commands by their group property
  const groupedCommands = useMemo(() => {
    const groups: Record<CommandGroup, CommandType[]> = {
      navigation: [],
      actions: [],
      utilities: [],
    };

    commands.forEach((cmd) => {
      groups[cmd.group].push(cmd);
    });

    return groups;
  }, [commands]);

  // Handle keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      // Small delay to allow animation to complete
      const timer = setTimeout(() => setSearch(''), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle command selection
  const handleSelect = useCallback(
    (cmd: CommandType) => {
      setOpen(false);
      // Small delay to ensure smooth close animation
      setTimeout(() => {
        cmd.action();
      }, 100);
    },
    []
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop with blur effect */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: smoothOut }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Command dialog */}
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className={cn(
                'w-full max-w-lg mx-4',
                // Obsidian strong glass
                'bg-[#05030a]/95 backdrop-blur-2xl',
                'border border-white/10 rounded-xl',
                'shadow-2xl overflow-hidden'
              )}
              style={{
                boxShadow:
                  'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px -15px rgba(168, 85, 247, 0.3)',
              }}
              initial={{
                opacity: 0,
                scale: 0.96,
                y: -10,
                filter: 'brightness(0.7) blur(4px)',
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
                filter: 'brightness(1) blur(0px)',
              }}
              exit={{
                opacity: 0,
                scale: 0.98,
                y: -5,
                filter: 'brightness(0.9)',
              }}
              transition={{ duration: 0.25, ease: circOut }}
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
            >
              <Command
                loop
                shouldFilter={true}
                className="w-full"
                onKeyDown={(e) => {
                  // Close on Escape (cmdk handles this but we want smooth close)
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
              >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                  <Search
                    className="w-4 h-4 text-muted-foreground/60"
                    strokeWidth={1.75}
                  />
                  <Command.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Type a command or search..."
                    aria-label="Search commands"
                    className={cn(
                      'flex-1 bg-transparent text-foreground text-sm',
                      'placeholder:text-muted-foreground/50',
                      'outline-none border-none',
                      'font-normal'
                    )}
                  />
                  <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-white/5 text-muted-foreground/60 border border-white/5">
                    esc
                  </kbd>
                </div>

                {/* Command list */}
                <Command.List className="max-h-[300px] overflow-y-auto p-2">
                  <Command.Empty className="py-8 text-center text-muted-foreground/60 text-sm">
                    No commands found.
                  </Command.Empty>

                  {/* Render groups with staggered animation */}
                  {(Object.keys(groupedCommands) as CommandGroup[]).map(
                    (group, groupIndex) => {
                      const cmds = groupedCommands[group];
                      if (cmds.length === 0) return null;

                      return (
                        <Command.Group
                          key={group}
                          heading={groupLabels[group]}
                          className="mb-2 last:mb-0"
                        >
                          <motion.div
                            initial="hidden"
                            animate="visible"
                            variants={{
                              hidden: {},
                              visible: {
                                transition: {
                                  staggerChildren: 0.03,
                                  delayChildren: groupIndex * 0.05,
                                },
                              },
                            }}
                          >
                            {cmds.map((cmd) => (
                              <motion.div
                                key={cmd.id}
                                variants={{
                                  hidden: {
                                    opacity: 0,
                                    y: 6,
                                    filter: 'brightness(0.7)',
                                  },
                                  visible: {
                                    opacity: 1,
                                    y: 0,
                                    filter: 'brightness(1)',
                                    transition: {
                                      duration: 0.2,
                                      ease: smoothOut,
                                    },
                                  },
                                }}
                              >
                                <Command.Item
                                  value={`${cmd.id} ${cmd.label} ${cmd.keywords?.join(' ') ?? ''}`}
                                  onSelect={() => handleSelect(cmd)}
                                  className={cn(
                                    'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer',
                                    'text-muted-foreground text-sm',
                                    'transition-colors duration-150',
                                    // Hover/selected state - obsidian glow
                                    'data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground',
                                    'hover:bg-white/[0.03]'
                                  )}
                                >
                                  <cmd.icon
                                    className={cn(
                                      'w-4 h-4 flex-shrink-0',
                                      'transition-colors duration-150',
                                      'group-data-[selected=true]:text-primary'
                                    )}
                                    strokeWidth={1.75}
                                  />
                                  <span className="flex-1 truncate">
                                    {cmd.label}
                                  </span>
                                  {cmd.shortcut && (
                                    <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-white/5 text-muted-foreground/50 border border-white/[0.03]">
                                      {cmd.shortcut}
                                    </kbd>
                                  )}
                                </Command.Item>
                              </motion.div>
                            ))}
                          </motion.div>
                        </Command.Group>
                      );
                    }
                  )}
                </Command.List>

                {/* Footer hint */}
                <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-[10px] text-muted-foreground/40">
                  <span>
                    <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/5 mr-1">
                      {'\u2191'}
                    </kbd>
                    <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/5 mr-1">
                      {'\u2193'}
                    </kbd>
                    navigate
                  </span>
                  <span>
                    <kbd className="px-1 py-0.5 rounded bg-white/5 border border-white/5 mr-1">
                      {'\u21b5'}
                    </kbd>
                    select
                  </span>
                </div>
              </Command>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default CommandPalette;
