"use client";

import { BotConfig } from "@/types";
import { GlassPanel } from "./GlassPanel";

interface ConfigPanelProps {
  config: BotConfig | null;
  onRestart: () => void;
  onClose: () => void;
}

export function ConfigPanel({ config, onRestart, onClose }: ConfigPanelProps) {
  return (
    <GlassPanel heavy className="w-96 h-full flex flex-col border-l border-border rounded-none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold">Bot Config</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!config ? (
          <div className="text-center text-text-muted text-sm py-8">Loading config...</div>
        ) : (
          <>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wide">Model</label>
              <div className="mt-1 glass rounded-lg px-3 py-2 text-sm font-mono">
                {config.model ?? "Default"}
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted uppercase tracking-wide">Thinking</label>
              <div className="mt-1 glass rounded-lg px-3 py-2 text-sm">
                {config.thinking ?? "off"}
              </div>
            </div>

            {config.skills && config.skills.length > 0 && (
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wide">Skills</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {config.skills.map((s) => (
                    <span key={s} className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {config.systemPrompt && (
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wide">System Prompt</label>
                <div className="mt-1 glass rounded-lg px-3 py-2 text-xs text-text-secondary max-h-48 overflow-y-auto whitespace-pre-wrap">
                  {config.systemPrompt}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <button
          onClick={onRestart}
          className="w-full py-2.5 rounded-xl bg-warning/15 text-warning text-sm font-medium hover:bg-warning/25 transition-colors"
        >
          ⟲ Restart Bot
        </button>
      </div>
    </GlassPanel>
  );
}
