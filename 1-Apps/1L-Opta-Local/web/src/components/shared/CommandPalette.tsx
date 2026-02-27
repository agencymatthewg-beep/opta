'use client';

/**
 * CommandPalette — Cmd+K / Ctrl+K fuzzy command palette
 *
 * Renders a modal overlay with search input and fuzzy-filtered navigation results.
 * Uses fuse.js for fuzzy matching. Keyboard navigation with ArrowUp/ArrowDown.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Fuse from 'fuse.js';
import type { LucideIcon } from 'lucide-react';
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
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaletteItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  category: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const paletteItems: PaletteItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard, category: 'Navigate' },
  { id: 'chat', label: 'Chat', href: '/chat', icon: MessageSquare, category: 'Navigate' },
  { id: 'models', label: 'Models', href: '/models', icon: Layers, category: 'Navigate' },
  { id: 'arena', label: 'Arena', href: '/arena', icon: Swords, category: 'Navigate' },
  { id: 'rag', label: 'RAG', href: '/rag', icon: Database, category: 'Navigate' },
  { id: 'agents', label: 'Agents', href: '/agents', icon: Workflow, category: 'Navigate' },
  { id: 'devices', label: 'Devices', href: '/devices', icon: Monitor, category: 'Navigate' },
  { id: 'sessions', label: 'Sessions', href: '/sessions', icon: History, category: 'Navigate' },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings, category: 'Navigate' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fuse.js instance
  const fuse = useMemo(
    () =>
      new Fuse(paletteItems, {
        keys: ['label', 'category'],
        threshold: 0.3,
        includeScore: true,
      }),
    []
  );

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return paletteItems;
    const results = fuse.search(query);
    return results.map((r) => r.item);
  }, [query, fuse]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter' && filteredItems.length > 0) {
        e.preventDefault();
        const selected = filteredItems[selectedIndex];
        if (selected) {
          router.push(selected.href);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose, router]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleItemClick = useCallback(
    (item: PaletteItem) => {
      router.push(item.href);
      onClose();
    },
    [router, onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-opta-bg/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="glass-strong relative w-full max-w-lg overflow-hidden rounded-2xl"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Search input */}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages..."
              autoFocus
              className="w-full border-b border-white/5 bg-transparent px-4 py-3.5 text-sm placeholder:text-text-muted focus:outline-none"
            />

            {/* Results */}
            <div className="max-h-[300px] overflow-y-auto py-1.5">
              {filteredItems.length > 0 ? (
                <>
                  <div className="px-4 pb-1 pt-3 text-[10px] font-medium uppercase tracking-widest text-text-muted">
                    Navigate
                  </div>
                  {filteredItems.map((item, index) => {
                    const Icon = item.icon;
                    const isSelected = index === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-4 py-2 text-sm transition-colors ${
                          isSelected ? 'opta-palette-item-selected' : 'hover:bg-primary/10 hover:text-primary'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-text-muted">No results</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-4 border-t border-white/5 px-4 py-2 text-[11px] text-text-muted">
              <span>
                <span className="opta-kbd">↑</span>
                <span className="opta-kbd ml-1">↓</span>
                <span className="ml-1.5">Navigate</span>
              </span>
              <span>
                <span className="opta-kbd">↵</span>
                <span className="ml-1.5">Open</span>
              </span>
              <span>
                <span className="opta-kbd">Esc</span>
                <span className="ml-1.5">Close</span>
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
