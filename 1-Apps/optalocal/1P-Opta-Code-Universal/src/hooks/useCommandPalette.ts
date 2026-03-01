import { useCallback, useEffect, useMemo, useState } from "react";
import type { PaletteCommand } from "../types";

interface UseCommandPaletteOptions {
  commands: PaletteCommand[];
  onApply: (command: PaletteCommand, query: string) => Promise<void>;
}

export function useCommandPalette(options: UseCommandPaletteOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.commands;
    return options.commands.filter((cmd) => {
      const haystack = [
        cmd.title,
        cmd.description ?? "",
        ...(cmd.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [options.commands, query]);

  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const applySelected = useCallback(async () => {
    const selected = filteredCommands[selectedIndex];
    if (!selected) return;
    await options.onApply(selected, query);
  }, [filteredCommands, options, query, selectedIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMetaK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isMetaK) {
        event.preventDefault();
        setIsOpen((current) => !current);
        return;
      }
      if (!isOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, Math.max(0, filteredCommands.length - 1)),
        );
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, filteredCommands.length, isOpen]);

  return {
    isOpen,
    query,
    selectedIndex,
    filteredCommands,
    setQuery,
    setSelectedIndex,
    open,
    close,
    applySelected,
  };
}
