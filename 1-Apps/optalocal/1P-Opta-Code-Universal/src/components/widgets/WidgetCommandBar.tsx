import { Hash } from "lucide-react";
import { useMemo } from "react";
import { WidgetShell } from "./WidgetShell";

const STORAGE_KEY = "opta:command-frequency";
const DEFAULT_COMMANDS = ["/commit", "/build", "/test", "/fix", "/explain"];

function loadFrequency(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function recordCommandUsage(command: string) {
  const freq = loadFrequency();
  freq[command] = (freq[command] ?? 0) + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(freq));
}

export function WidgetCommandBar() {
  const commands = useMemo(() => {
    const freq = loadFrequency();
    const sorted = Object.entries(freq).sort(([, a], [, b]) => b - a).slice(0, 5).map(([cmd]) => cmd);
    return sorted.length > 0 ? sorted : DEFAULT_COMMANDS;
  }, []);

  const inject = (cmd: string) => {
    window.dispatchEvent(new CustomEvent("opta:inject-command", { detail: cmd }));
  };

  return (
    <WidgetShell icon={<Hash size={14} />} title="Quick Commands" accentVar="--opta-primary">
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {commands.map((cmd) => (
          <button
            key={cmd}
            className="wp-catalog-btn"
            onClick={() => inject(cmd)}
            type="button"
            style={{ fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}
          >
            {cmd}
          </button>
        ))}
      </div>
    </WidgetShell>
  );
}
