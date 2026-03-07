import { FolderOpen } from "lucide-react";
import { WidgetShell } from "./WidgetShell";

interface Props {
  cwd: string | null | undefined;
}

export function WidgetWorkingDir({ cwd }: Props) {
  const parts = cwd ? cwd.replace(/^\//, "").split("/") : [];

  const openSegment = async (upTo: number) => {
    if (!cwd) return;
    const path = "/" + parts.slice(0, upTo + 1).join("/");
    // Only attempt Tauri open if in native context
    try {
      const { invoke } = await import("@tauri-apps/api/core").catch(() => ({ invoke: null }));
      if (invoke) {
        await invoke("plugin:opener|open_path", { path }).catch(() => {});
      }
    } catch {
      // web context — no-op
    }
  };

  return (
    <WidgetShell icon={<FolderOpen size={14} />} title="Working Directory" accentVar="--opta-neon-amber">
      {!cwd ? (
        <span className="widget-stat-label">No project open</span>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 0", alignItems: "center" }}>
          {parts.map((part, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center" }}>
              {i > 0 && <span className="widget-stat-label" style={{ padding: "0 2px" }}>/</span>}
              <button
                className="widget-dir-segment"
                onClick={() => openSegment(i)}
                type="button"
              >
                {part}
              </button>
            </span>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}
