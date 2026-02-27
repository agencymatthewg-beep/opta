"use client";

import { useEffect } from "react";

interface ShortcutMap {
  onCommandPalette: () => void;
  onBotSwitch: (index: number) => void;
  onEscape: () => void;
  onExport: () => void;
  onSearch: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutMap) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // ⌘K — Command palette
      if (meta && e.key === "k") {
        e.preventDefault();
        handlers.onCommandPalette();
        return;
      }

      // ⌘1-9 — Bot switching
      if (meta && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        handlers.onBotSwitch(parseInt(e.key, 10) - 1);
        return;
      }

      // ⌘E — Export
      if (meta && e.key === "e") {
        e.preventDefault();
        handlers.onExport();
        return;
      }

      // ⌘F — Focus search
      if (meta && e.key === "f") {
        e.preventDefault();
        handlers.onSearch();
        return;
      }

      // Escape — Close panels
      if (e.key === "Escape") {
        handlers.onEscape();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
