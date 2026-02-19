"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CronJob } from "@/types";
import { GlassPanel } from "./GlassPanel";

interface CronPanelProps {
  jobs: CronJob[];
  onAdd: (job: Partial<CronJob>) => void;
  onUpdate: (id: string, updates: Partial<CronJob>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export function CronPanel({ jobs, onAdd, onUpdate, onRemove, onClose }: CronPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [newPayload, setNewPayload] = useState("");

  const handleAdd = () => {
    if (!newSchedule) return;
    onAdd({ name: newName || undefined, schedule: newSchedule, payload: newPayload, enabled: true });
    setNewName("");
    setNewSchedule("");
    setNewPayload("");
    setShowAdd(false);
  };

  return (
    <GlassPanel heavy className="w-96 h-full flex flex-col border-l border-border rounded-none">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-base font-semibold">Cron Jobs</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-xs px-3 py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          >
            + Add
          </button>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">×</button>
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border"
          >
            <div className="p-4 space-y-2">
              <input
                placeholder="Name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-white/[0.04] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40"
              />
              <input
                placeholder="Schedule (e.g. */30 * * * *)"
                value={newSchedule}
                onChange={(e) => setNewSchedule(e.target.value)}
                className="w-full bg-white/[0.04] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40"
              />
              <textarea
                placeholder="Payload"
                value={newPayload}
                onChange={(e) => setNewPayload(e.target.value)}
                rows={2}
                className="w-full bg-white/[0.04] border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40 resize-none"
              />
              <button
                onClick={handleAdd}
                className="w-full py-2 rounded-lg bg-primary/20 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
              >
                Create
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {jobs.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8">No cron jobs</div>
        ) : (
          jobs.map((job) => (
            <motion.div
              key={job.id}
              className="glass rounded-xl p-3"
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate">
                  {job.name || job.schedule}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onUpdate(job.id, { enabled: !job.enabled })}
                    className={`text-xs px-2 py-0.5 rounded ${
                      job.enabled ? "bg-success/20 text-success" : "bg-white/[0.05] text-text-muted"
                    }`}
                  >
                    {job.enabled ? "On" : "Off"}
                  </button>
                  <button
                    onClick={() => onRemove(job.id)}
                    className="text-xs text-error/60 hover:text-error"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="text-xs text-text-muted font-mono">{job.schedule}</div>
              {job.nextRun && (
                <div className="text-[10px] text-text-muted mt-1">
                  Next: {new Date(job.nextRun).toLocaleString()}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </GlassPanel>
  );
}
