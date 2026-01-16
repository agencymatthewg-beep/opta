/**
 * InvestigationPanel - Full transparency view for power users.
 * Shows exact registry keys, config files, commands, dependencies, and rollback info.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InvestigationReport, ChangeType } from '@/types/investigation';
import {
  Eye,
  FileCode,
  Terminal,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  Undo2,
  Copy,
  Settings2,
  Database,
} from 'lucide-react';

interface InvestigationPanelProps {
  report: InvestigationReport;
  onClose: () => void;
}

/**
 * Investigation Panel component showing full transparency for optimizations.
 */
export function InvestigationPanel({ report, onClose }: InvestigationPanelProps) {
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  const toggleChange = (id: string) => {
    const next = new Set(expandedChanges);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedChanges(next);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const changeTypeIcons: Record<ChangeType, typeof FileCode> = {
    registry: Database,
    config: FileCode,
    command: Terminal,
    service: Settings2,
    file: FileCode,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-0 top-0 bottom-0 w-[480px] glass-strong border-l border-border/30 z-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-border/30 sticky top-0 glass-strong z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Eye className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-semibold">Investigation Mode</h2>
          </div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-lg">
              <XCircle className="w-4 h-4" strokeWidth={1.75} />
            </Button>
          </motion.div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {report.optimizationName}
        </p>
      </div>

      <div className="p-4 space-y-6">
        {/* Changes Section */}
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" strokeWidth={1.75} />
            Changes ({report.changes.length})
          </h3>
          <div className="space-y-2">
            {report.changes.map((change) => {
              const Icon = changeTypeIcons[change.type];
              const isExpanded = expandedChanges.has(change.id);

              return (
                <motion.div
                  key={change.id}
                  className="glass-subtle rounded-lg overflow-hidden border border-border/20"
                  layout
                >
                  <button
                    className="w-full p-3 flex items-center gap-2 text-left hover:bg-primary/5 transition-colors"
                    onClick={() => toggleChange(change.id)}
                  >
                    <motion.div
                      animate={{ rotate: isExpanded ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                    </motion.div>
                    <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
                    <span className="flex-1 text-sm font-medium truncate">{change.description}</span>
                    <Badge variant={change.reversible ? "default" : "secondary"} className="text-[10px]">
                      {change.reversible ? "Reversible" : "One-way"}
                    </Badge>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 space-y-3">
                          {/* Location */}
                          <div>
                            <div className="text-xs text-muted-foreground/60 mb-1.5">Location</div>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-card p-2 rounded-lg flex-1 overflow-x-auto border border-border/20 text-foreground/80">
                                {change.location}
                              </code>
                              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 rounded-lg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(change.location, `${change.id}_loc`);
                                  }}
                                >
                                  {copied === `${change.id}_loc` ? (
                                    <CheckCircle className="w-3.5 h-3.5 text-success" strokeWidth={1.75} />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                                  )}
                                </Button>
                              </motion.div>
                            </div>
                          </div>

                          {/* Before/After */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-xs text-muted-foreground/60 mb-1.5">Before</div>
                              <code className="text-xs bg-danger/10 text-danger p-2 rounded-lg block border border-danger/20">
                                {change.before || 'N/A'}
                              </code>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground/60 mb-1.5">After</div>
                              <code className="text-xs bg-success/10 text-success p-2 rounded-lg block border border-success/20">
                                {change.after}
                              </code>
                            </div>
                          </div>

                          {/* Technical Detail */}
                          <div>
                            <div className="text-xs text-muted-foreground/60 mb-1.5">Technical Detail</div>
                            <p className="text-xs text-muted-foreground bg-card/50 p-2.5 rounded-lg border border-border/20 leading-relaxed">
                              {change.technical}
                            </p>
                          </div>

                          {/* Rollback */}
                          {change.rollbackCommand && (
                            <div>
                              <div className="text-xs text-muted-foreground/60 mb-1.5">Rollback Command</div>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-warning/10 text-warning p-2 rounded-lg flex-1 border border-warning/20">
                                  {change.rollbackCommand}
                                </code>
                                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 rounded-lg"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(change.rollbackCommand!, `${change.id}_rb`);
                                    }}
                                  >
                                    {copied === `${change.id}_rb` ? (
                                      <CheckCircle className="w-3.5 h-3.5 text-success" strokeWidth={1.75} />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
                                    )}
                                  </Button>
                                </motion.div>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Dependencies Section */}
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" strokeWidth={1.75} />
            Dependencies ({report.dependencies.length})
          </h3>
          <div className="space-y-2">
            {report.dependencies.map((dep, i) => (
              <motion.div
                key={i}
                className="glass-subtle rounded-lg p-3 flex items-center gap-3 border border-border/20"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full flex-shrink-0",
                  dep.status === 'ok' && "bg-success shadow-[0_0_8px_2px_hsl(var(--success)/0.4)]",
                  dep.status === 'warning' && "bg-warning shadow-[0_0_8px_2px_hsl(var(--warning)/0.4)]",
                  dep.status === 'blocked' && "bg-danger shadow-[0_0_8px_2px_hsl(var(--danger)/0.4)]"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{dep.name}</div>
                  <div className="text-xs text-muted-foreground/70 truncate">{dep.description}</div>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">
                  {dep.type}
                </Badge>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Impact Analysis */}
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" strokeWidth={1.75} />
            Impact Analysis ({report.impacts.length})
          </h3>
          <div className="space-y-2">
            {report.impacts.map((impact, i) => (
              <motion.div
                key={i}
                className={cn(
                  "glass-subtle rounded-lg p-3 border-l-2",
                  impact.severity === 'low' && "border-l-success",
                  impact.severity === 'medium' && "border-l-warning",
                  impact.severity === 'high' && "border-l-danger"
                )}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {impact.category}
                  </Badge>
                  <span className={cn(
                    "text-xs font-medium capitalize",
                    impact.severity === 'low' && "text-success",
                    impact.severity === 'medium' && "text-warning",
                    impact.severity === 'high' && "text-danger"
                  )}>
                    {impact.severity} impact
                  </span>
                </div>
                <p className="text-sm text-foreground/90">{impact.description}</p>
                {impact.mitigation && (
                  <p className="text-xs text-muted-foreground/70 mt-1.5 flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 text-success flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <span>Mitigation: {impact.mitigation}</span>
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* Rollback Section */}
        <section>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Undo2 className="w-4 h-4 text-primary" strokeWidth={1.75} />
            Rollback
          </h3>
          <motion.div
            className="glass-subtle rounded-lg p-4 border border-border/20"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-3">
              {report.rollback.available ? (
                <div className="p-1 rounded-full bg-success/10">
                  <CheckCircle className="w-4 h-4 text-success" strokeWidth={1.75} />
                </div>
              ) : (
                <div className="p-1 rounded-full bg-warning/10">
                  <AlertTriangle className="w-4 h-4 text-warning" strokeWidth={1.75} />
                </div>
              )}
              <span className="text-sm font-medium">
                {report.rollback.available
                  ? "Full rollback available"
                  : "Partial rollback only"}
              </span>
            </div>
            {report.rollback.warnings.length > 0 && (
              <div className="space-y-1.5">
                {report.rollback.warnings.map((w, i) => (
                  <div key={i} className="text-xs text-warning flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={2} />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
            {report.rollback.steps.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/20">
                <div className="text-xs text-muted-foreground/60 mb-2">Rollback Steps</div>
                <div className="space-y-1.5">
                  {report.rollback.steps.map((step, i) => (
                    <div key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                      <span className="text-muted-foreground/50">{i + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </section>
      </div>
    </motion.div>
  );
}

export default InvestigationPanel;
