'use client';

/**
 * Agent Workspace — /agents page.
 *
 * Visual pipeline editor for multi-step agent workflows.
 * Users select a template or build custom workflows, then execute
 * them against loaded models. Execution streams in real-time.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  StopCircle,
  ArrowLeft,
  Zap,
  Workflow,
} from 'lucide-react';
import { cn, Button } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaStatusPill, OptaSurface } from '@/components/shared/OptaPrimitives';
import { useModels } from '@/hooks/useModels';
import { useAgentWorkflow } from '@/hooks/useAgentWorkflow';
import type {
  AgentWorkflow,
  PipelineStep,
  WorkflowTemplate,
} from '@/types/agent';
import { WORKFLOW_TEMPLATES } from '@/types/agent';
import {
  saveWorkflow,
  listWorkflows,
  deleteWorkflow,
  instantiateTemplate,
} from '@/lib/agent-store';
import { StepCard } from '@/components/agents/StepCard';
import { ExecutionLog } from '@/components/agents/ExecutionLog';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;
  const { models } = useModels(client);
  const { execution, isRunning, execute, cancel, reset } =
    useAgentWorkflow(client);

  // ---- State ----
  const [workflows, setWorkflows] = useState<AgentWorkflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<AgentWorkflow | null>(
    null,
  );
  const [inputText, setInputText] = useState('');
  const [view, setView] = useState<'library' | 'editor'>('library');

  // Default model (first loaded)
  const defaultModel = useMemo(
    () => models[0]?.id ?? '',
    [models],
  );

  // Load saved workflows
  useEffect(() => {
    void listWorkflows().then(setWorkflows);
  }, []);

  // ---- Actions ----

  const handleSelectTemplate = useCallback(
    (template: WorkflowTemplate) => {
      const workflow = instantiateTemplate(template, defaultModel);
      setActiveWorkflow(workflow);
      setView('editor');
    },
    [defaultModel],
  );

  const handleSelectWorkflow = useCallback((wf: AgentWorkflow) => {
    setActiveWorkflow(wf);
    setView('editor');
  }, []);

  const handleSaveWorkflow = useCallback(async () => {
    if (!activeWorkflow) return;
    const updated = {
      ...activeWorkflow,
      updated_at: new Date().toISOString(),
    };
    await saveWorkflow(updated);
    setActiveWorkflow(updated);
    setWorkflows(await listWorkflows());
  }, [activeWorkflow]);

  const handleDeleteWorkflow = useCallback(
    async (id: string) => {
      await deleteWorkflow(id);
      setWorkflows(await listWorkflows());
      if (activeWorkflow?.id === id) {
        setActiveWorkflow(null);
        setView('library');
      }
    },
    [activeWorkflow],
  );

  const handleExecute = useCallback(async () => {
    if (!activeWorkflow || !inputText.trim()) return;
    reset();
    await execute(activeWorkflow, inputText.trim());
  }, [activeWorkflow, inputText, execute, reset]);

  const handleAddStep = useCallback(() => {
    if (!activeWorkflow) return;
    const newStep: PipelineStep = {
      id: crypto.randomUUID(),
      type: 'prompt',
      label: `Step ${activeWorkflow.steps.length + 1}`,
      position: activeWorkflow.steps.length,
      config: {
        model: defaultModel,
        systemPrompt: '',
        userPromptTemplate: '{{input}}',
        temperature: 0.7,
      },
    };
    setActiveWorkflow({
      ...activeWorkflow,
      steps: [...activeWorkflow.steps, newStep],
    });
  }, [activeWorkflow, defaultModel]);

  const handleRemoveStep = useCallback(
    (stepId: string) => {
      if (!activeWorkflow) return;
      setActiveWorkflow({
        ...activeWorkflow,
        steps: activeWorkflow.steps
          .filter((s) => s.id !== stepId)
          .map((s, i) => ({ ...s, position: i })),
      });
    },
    [activeWorkflow],
  );

  // ---- Render ----

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <AnimatePresence mode="wait">
        {view === 'library' ? (
          <motion.div
            key="library"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
          >
            {/* Header */}
            <header className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center">
                  <Workflow className="w-5 h-5 text-primary" />
                </div>
                <h1 className="text-2xl font-bold text-text-primary">
                  Agent Workspace
                </h1>
              </div>
              <p className="text-sm text-text-secondary">
                Chain AI models into multi-step workflows. No API costs — everything runs locally.
              </p>
            </header>

            {/* Templates */}
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
                Templates
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {WORKFLOW_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className="w-full text-left group"
                  >
                    <OptaSurface
                      hierarchy="raised"
                      className="rounded-xl p-5 transition-all group-hover:border-primary/30"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
                          {template.name}
                        </h3>
                      </div>
                      <p className="text-xs text-text-secondary mb-3">
                        {template.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <OptaStatusPill
                          label={template.category}
                          status="info"
                          className="text-[10px] uppercase tracking-wider"
                        />
                        <span className="text-[10px] text-text-muted">
                          {template.steps.length} steps
                        </span>
                      </div>
                    </OptaSurface>
                  </button>
                ))}
              </div>
            </section>

            {/* Saved Workflows */}
            {workflows.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-4">
                  Saved Workflows
                </h2>
                <div className="space-y-3">
                  {workflows.map((wf) => (
                    <OptaSurface
                      key={wf.id}
                      hierarchy="raised"
                      padding="md"
                      className="rounded-xl flex items-center gap-4"
                    >
                      <button
                        onClick={() => handleSelectWorkflow(wf)}
                        className="flex-1 text-left"
                      >
                        <h3 className="text-sm font-medium text-text-primary">
                          {wf.name}
                        </h3>
                        <p className="text-xs text-text-muted">
                          {wf.steps.length} steps · Updated{' '}
                          {new Date(wf.updated_at).toLocaleDateString()}
                        </p>
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(wf.id)}
                        className="p-2 text-text-muted hover:text-neon-red transition-colors"
                        aria-label="Delete workflow"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </OptaSurface>
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
          >
            {/* Editor Header */}
            <header className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setView('library');
                    reset();
                  }}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-primary/10 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-text-primary">
                    {activeWorkflow?.name ?? 'New Workflow'}
                  </h1>
                  <div className="mt-1">
                    <OptaStatusPill
                      label={`${activeWorkflow?.steps.length ?? 0} steps`}
                      status="neutral"
                      className="text-[10px]"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveWorkflow}
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddStep}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Step
                </Button>
              </div>
            </header>

            {/* Two-column layout: pipeline + execution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Pipeline */}
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">
                  Pipeline
                </h2>
                {activeWorkflow?.steps.map((step, i) => {
                  const stepExec = execution?.steps.find(
                    (s) => s.stepId === step.id,
                  );
                  return (
                    <div key={step.id} className="relative group">
                      <StepCard
                        step={step}
                        execution={stepExec}
                        isActive={stepExec?.status === 'running'}
                      />
                      {/* Remove button */}
                      {!isRunning && (
                        <button
                          onClick={() => handleRemoveStep(step.id)}
                          className={cn(
                            'absolute -right-2 -top-2 w-6 h-6 rounded-full',
                            'bg-opta-surface border border-opta-border',
                            'flex items-center justify-center',
                            'opacity-0 group-hover:opacity-100 transition-opacity',
                            'text-text-muted hover:text-neon-red',
                          )}
                          aria-label={`Remove step ${i + 1}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      {/* Connector line */}
                      {i < (activeWorkflow?.steps.length ?? 0) - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="w-px h-4 bg-opta-border" />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Input area */}
                <OptaSurface
                  hierarchy="base"
                  padding="md"
                  className="mt-6 rounded-xl space-y-3"
                >
                  <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest">
                    Input
                  </h2>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter the initial input for this workflow..."
                    disabled={isRunning}
                    rows={4}
                    className={cn(
                      'w-full rounded-xl px-4 py-3',
                      'bg-opta-surface text-sm text-text-primary',
                      'placeholder:text-text-muted outline-none resize-none border border-opta-border',
                      'disabled:opacity-50',
                    )}
                  />
                  <div className="flex gap-2">
                    {isRunning ? (
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={cancel}
                      >
                        <StopCircle className="mr-1.5 h-3.5 w-3.5 text-neon-red" />
                        Stop
                      </Button>
                    ) : (
                      <Button
                        variant="glass"
                        size="sm"
                        onClick={handleExecute}
                        disabled={
                          !inputText.trim() ||
                          !activeWorkflow?.steps.length ||
                          !client
                        }
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Execute
                      </Button>
                    )}
                    {execution && !isRunning && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={reset}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Reset
                      </Button>
                    )}
                  </div>
                </OptaSurface>
              </div>

              {/* Right: Execution log */}
              <div>
                {execution ? (
                  <div>
                    <h2 className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-3">
                      Execution
                    </h2>
                    <ExecutionLog execution={execution} />
                  </div>
                ) : (
                  <OptaSurface
                    hierarchy="raised"
                    padding="lg"
                    className="rounded-xl p-8 text-center"
                  >
                    <Workflow className="w-10 h-10 text-text-muted mx-auto mb-3" />
                    <div className="mb-2 inline-flex">
                      <OptaStatusPill label="Ready to execute" status="info" />
                    </div>
                    <p className="text-xs text-text-muted">
                      Enter input and click Execute to run the pipeline
                    </p>
                  </OptaSurface>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
