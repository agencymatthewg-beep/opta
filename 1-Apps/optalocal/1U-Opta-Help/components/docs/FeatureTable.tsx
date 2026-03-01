"use client";

import { Check, X, Minus } from "lucide-react";

interface FeatureRow {
  feature: string;
  status: "done" | "partial" | "planned";
  description?: string;
}

interface FeatureTableProps {
  title?: string;
  features: FeatureRow[];
}

const statusIcons = {
  done: <Check size={14} className="text-neon-green" />,
  partial: <Minus size={14} className="text-neon-amber" />,
  planned: <X size={14} className="text-text-muted" />,
};

const statusLabels = {
  done: "Complete",
  partial: "Partial",
  planned: "Planned",
};

export function FeatureTable({ title, features }: FeatureTableProps) {
  return (
    <div className="rounded-lg border border-white/5 overflow-hidden mb-4">
      {title && (
        <div className="px-4 py-3 bg-surface border-b border-white/5">
          <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Feature</th>
            <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase">Status</th>
            {features.some(f => f.description) && (
              <th className="text-left px-4 py-2 text-text-muted font-medium text-xs uppercase hidden sm:table-cell">Notes</th>
            )}
          </tr>
        </thead>
        <tbody>
          {features.map((f, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-2.5 text-text-primary">{f.feature}</td>
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center gap-1.5">
                  {statusIcons[f.status]}
                  <span className="text-text-secondary text-xs">{statusLabels[f.status]}</span>
                </span>
              </td>
              {features.some(ff => ff.description) && (
                <td className="px-4 py-2.5 text-text-muted text-xs hidden sm:table-cell">{f.description}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
