"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FileText, X } from "lucide-react";
import { searchData } from "@/lib/search-data";

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<typeof searchData>([]);
  const [selected, setSelected] = useState(0);
  const router = useRouter();

  const search = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const lower = q.toLowerCase();
    const matches = searchData.filter(
      (item) =>
        item.title.toLowerCase().includes(lower) ||
        item.description.toLowerCase().includes(lower) ||
        item.keywords.some((k) => k.toLowerCase().includes(lower))
    );
    setResults(matches.slice(0, 8));
    setSelected(0);
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (open) {
          onClose();
        }
      }
      if (!open) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter" && results[selected]) {
        router.push(results[selected].href);
        onClose();
        setQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, results, selected, router]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="fixed inset-0 bg-void/80 backdrop-blur-sm" />
      <div className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="glass-strong rounded-xl overflow-hidden shadow-2xl">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <Search size={18} className="text-text-muted shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documentation..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
              autoFocus
            />
            <button onClick={onClose} className="text-text-muted hover:text-text-secondary">
              <X size={16} />
            </button>
          </div>
          {results.length > 0 && (
            <div className="max-h-80 overflow-y-auto p-2">
              {results.map((item, i) => (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(item.href);
                    onClose();
                    setQuery("");
                  }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    i === selected ? "bg-primary/10" : "hover:bg-white/5"
                  }`}
                >
                  <FileText size={16} className="text-text-muted shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm text-text-primary font-medium">{item.title}</div>
                    <div className="text-xs text-text-muted">{item.section} &middot; {item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          {query && results.length === 0 && (
            <div className="p-8 text-center text-sm text-text-muted">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
          {!query && (
            <div className="p-4 text-center text-xs text-text-muted">
              Type to search across all documentation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
