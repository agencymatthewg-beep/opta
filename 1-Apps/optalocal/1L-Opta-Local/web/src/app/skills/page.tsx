'use client';

/**
 * Skills Page — Browse and execute LMX skills (MCP tool integrations).
 *
 * Lists all registered skills, shows their MCP tools, and provides
 * a simple form to execute any skill.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Wrench, Play, ChevronRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaSurface, OptaStatusPill } from '@/components/shared/OptaPrimitives';
import type { Skill, SkillMcpTool, SkillExecuteResult } from '@/types/lmx';

// ---------------------------------------------------------------------------
// Execute form
// ---------------------------------------------------------------------------

interface ExecuteFormProps {
  skillName: string;
  onExecute: (args: Record<string, unknown>) => Promise<void>;
  isExecuting: boolean;
}

function ExecuteForm({ skillName, onExecute, isExecuting }: ExecuteFormProps) {
  const [argsJson, setArgsJson] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setJsonError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(argsJson) as Record<string, unknown>;
    } catch {
      setJsonError('Invalid JSON');
      return;
    }
    void onExecute(parsed);
  }, [argsJson, onExecute]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-medium text-text-muted block mb-1">
          Arguments (JSON)
        </label>
        <textarea
          value={argsJson}
          onChange={(e) => setArgsJson(e.target.value)}
          rows={4}
          disabled={isExecuting}
          className={cn(
            'w-full rounded-xl px-3 py-2 text-xs font-mono',
            'bg-opta-surface text-text-primary placeholder:text-text-muted',
            'border border-opta-border outline-none resize-none',
            'disabled:opacity-50',
            jsonError && 'border-neon-red/50',
          )}
          placeholder='{"key": "value"}'
        />
        {jsonError && <p className="text-xs text-neon-red mt-1">{jsonError}</p>}
      </div>
      <button
        type="submit"
        disabled={isExecuting || !argsJson.trim()}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
          'bg-primary/15 text-primary hover:bg-primary/25',
          'disabled:opacity-50 disabled:pointer-events-none',
        )}
      >
        <Play className="w-3 h-3" />
        {isExecuting ? 'Executing…' : `Execute "${skillName}"`}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Tool card
// ---------------------------------------------------------------------------

function McpToolCard({ tool }: { tool: SkillMcpTool }) {
  return (
    <div className="rounded-lg border border-opta-border p-3 space-y-1">
      <div className="flex items-center gap-2">
        <Wrench className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-text-primary font-mono">{tool.name}</span>
      </div>
      {tool.description && (
        <p className="text-xs text-text-secondary">{tool.description}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SkillsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const [skills, setSkills] = useState<Skill[]>([]);
  const [mcpTools, setMcpTools] = useState<SkillMcpTool[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<SkillExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);
    try {
      const [skillList, tools] = await Promise.allSettled([
        client.listSkills(),
        client.listSkillMcpTools(),
      ]);
      setSkills(skillList.status === 'fulfilled' ? skillList.value : []);
      setMcpTools(tools.status === 'fulfilled' ? tools.value : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load skills');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => { void fetchSkills(); }, [fetchSkills]);

  const handleSelectSkill = useCallback(async (name: string) => {
    if (!client) return;
    setExecResult(null);
    try {
      const detail = await client.getSkill(name);
      setSelectedSkill(detail);
    } catch {
      // Fall back to list entry if detail fails
      const found = skills.find(s => s.name === name);
      if (found) setSelectedSkill(found);
    }
  }, [client, skills]);

  const handleExecute = useCallback(async (args: Record<string, unknown>) => {
    if (!client || !selectedSkill) return;
    setIsExecuting(true);
    setError(null);
    setExecResult(null);
    try {
      const result = await client.executeSkill(selectedSkill.name, args);
      setExecResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  }, [client, selectedSkill]);

  return (
    <main className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn('p-1.5 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-primary/10')}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Wrench className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold text-text-primary">Skills</h1>
        <div className="ml-auto">
          <button
            onClick={() => void fetchSkills()}
            disabled={isLoading}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              'text-text-secondary hover:text-text-primary hover:bg-primary/10',
              isLoading && 'animate-spin',
            )}
            aria-label="Refresh skills"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Skill list */}
        <div className="w-64 border-r border-opta-border overflow-y-auto p-4 space-y-2 flex-shrink-0">
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-subtle rounded-lg px-3 py-2 text-xs text-neon-amber border border-neon-amber/20"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {!client && <p className="text-xs text-text-muted text-center py-8">Not connected.</p>}
          {isLoading && skills.length === 0 && <p className="text-xs text-text-muted text-center py-8">Loading…</p>}

          {skills.map((skill) => (
            <button
              key={skill.name}
              onClick={() => void handleSelectSkill(skill.name)}
              className={cn(
                'w-full text-left rounded-xl p-3 transition-all border',
                selectedSkill?.name === skill.name
                  ? 'border-primary/40 bg-primary/10'
                  : 'border-transparent glass-subtle hover:border-opta-border',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary truncate max-w-[160px]">{skill.name}</span>
                <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
              </div>
              {skill.enabled !== undefined && (
                <div className="mt-1.5">
                  <OptaStatusPill label={skill.enabled ? 'Enabled' : 'Disabled'} status={skill.enabled ? 'success' : 'neutral'} />
                </div>
              )}
            </button>
          ))}

          {!isLoading && skills.length === 0 && client && (
            <p className="text-xs text-text-muted text-center py-8">No skills registered.</p>
          )}
        </div>

        {/* Detail + execute */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {selectedSkill ? (
            <motion.div
              key={selectedSkill.name}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              {/* Skill header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text-primary">{selectedSkill.name}</h2>
                  {selectedSkill.description && (
                    <p className="text-sm text-text-secondary">{selectedSkill.description}</p>
                  )}
                </div>
                {selectedSkill.enabled !== undefined && (
                  <OptaStatusPill
                    label={selectedSkill.enabled ? 'Enabled' : 'Disabled'}
                    status={selectedSkill.enabled ? 'success' : 'neutral'}
                    className="ml-auto"
                  />
                )}
              </div>

              {/* Tools */}
              {selectedSkill.tools && selectedSkill.tools.length > 0 && (
                <OptaSurface hierarchy="raised" padding="md" className="rounded-xl">
                  <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                    MCP Tools ({selectedSkill.tools.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedSkill.tools.map((tool) => (
                      <McpToolCard key={tool.name} tool={tool} />
                    ))}
                  </div>
                </OptaSurface>
              )}

              {/* Execute */}
              <OptaSurface hierarchy="raised" padding="md" className="rounded-xl">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">Execute</h3>
                <ExecuteForm
                  skillName={selectedSkill.name}
                  onExecute={handleExecute}
                  isExecuting={isExecuting}
                />
              </OptaSurface>

              {/* Result */}
              <AnimatePresence>
                {execResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                  >
                    <OptaSurface hierarchy="raised" padding="md" className="rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-widest">Result</h3>
                        <OptaStatusPill label={execResult.error ? 'Error' : 'Success'} status={execResult.error ? 'danger' : 'success'} />
                      </div>
                      <pre className="text-xs text-text-secondary whitespace-pre-wrap break-words font-mono bg-opta-surface/50 rounded-lg p-3 max-h-64 overflow-y-auto">
                        {execResult.error ?? execResult.output}
                      </pre>
                    </OptaSurface>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Wrench className="w-10 h-10 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-muted">Select a skill from the list</p>
              </div>
            </div>
          )}

          {/* Global MCP tools fallback */}
          {!selectedSkill && mcpTools.length > 0 && (
            <section className="max-w-2xl">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                All MCP Tools ({mcpTools.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {mcpTools.map((tool) => (
                  <McpToolCard key={tool.name} tool={tool} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
