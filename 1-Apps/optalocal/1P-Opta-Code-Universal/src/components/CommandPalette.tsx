import { useEffect, useRef } from "react";
import type { PaletteCommand } from "../types";

interface CommandPaletteProps {
  open: boolean;
  query: string;
  commands: PaletteCommand[];
  selectedIndex: number;
  onQueryChange: (value: string) => void;
  onSelect: (index: number) => void;
  onApply: () => void;
  onClose: () => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [props.open]);

  if (!props.open) return null;

  return (
    <div
      className="palette-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="palette-shell">
        <header>
          <h2>Opta Command Palette</h2>
          <button type="button" onClick={props.onClose}>
            Close
          </button>
        </header>
        <input
          ref={inputRef}
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void props.onApply();
            }
          }}
          placeholder="Type to search commands..."
        />

        <ul className="palette-list">
          {props.commands.map((command, index) => (
            <li key={command.id}>
              <button
                type="button"
                className={index === props.selectedIndex ? "active" : ""}
                onMouseEnter={() => props.onSelect(index)}
                onClick={() => void props.onApply()}
              >
                <strong>{command.title}</strong>
                {command.description ? (
                  <span>{command.description}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
