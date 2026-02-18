'use client';

/**
 * useAgentWorkflow — Manages agent workflow execution.
 *
 * Executes pipeline steps sequentially, passing output from one step
 * as input to the next. Prompt steps stream through LMXClient,
 * transform steps manipulate text locally, and conditional steps
 * branch the execution path.
 */

import { useState, useCallback, useRef } from 'react';
import type { LMXClient } from '@/lib/lmx-client';
import type {
  AgentWorkflow,
  PipelineStep,
  StepExecution,
  WorkflowExecution,
} from '@/types/agent';
import { saveExecution } from '@/lib/agent-store';

interface UseAgentWorkflowReturn {
  /** Current execution state (null when idle) */
  execution: WorkflowExecution | null;
  /** Whether any step is currently running */
  isRunning: boolean;
  /** Start executing a workflow with initial input */
  execute: (workflow: AgentWorkflow, input: string) => Promise<void>;
  /** Cancel the current execution */
  cancel: () => void;
  /** Clear execution state */
  reset: () => void;
}

export function useAgentWorkflow(client: LMXClient | null): UseAgentWorkflowReturn {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const executeStep = useCallback(
    async (step: PipelineStep, input: string): Promise<string> => {
      switch (step.type) {
        case 'prompt': {
          if (!client) throw new Error('No LMX client available');

          const userPrompt = step.config.userPromptTemplate.replace(
            /\{\{input\}\}/g,
            input,
          );

          const messages = [
            ...(step.config.systemPrompt
              ? [
                  {
                    id: crypto.randomUUID(),
                    role: 'system' as const,
                    content: step.config.systemPrompt,
                    created_at: new Date().toISOString(),
                  },
                ]
              : []),
            {
              id: crypto.randomUUID(),
              role: 'user' as const,
              content: userPrompt,
              created_at: new Date().toISOString(),
            },
          ];

          let result = '';
          for await (const token of client.streamChat(
            step.config.model,
            messages,
            {
              temperature: step.config.temperature,
              max_tokens: step.config.maxTokens,
            },
          )) {
            if (cancelledRef.current) throw new Error('Cancelled');
            result += token;

            // Update step output in real-time
            setExecution((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                steps: prev.steps.map((s) =>
                  s.stepId === step.id ? { ...s, output: result } : s,
                ),
              };
            });
          }

          return result;
        }

        case 'transform': {
          switch (step.config.operation) {
            case 'extract_json': {
              const jsonMatch = input.match(/```json\s*([\s\S]*?)\s*```/);
              return jsonMatch?.[1]?.trim() ?? input;
            }
            case 'summarize':
              // Pass-through for now — would need a prompt step for real summarization
              return input;
            case 'format':
              return step.config.template
                ? step.config.template.replace(/\{\{input\}\}/g, input)
                : input;
            case 'regex': {
              if (!step.config.pattern) return input;
              const regex = new RegExp(step.config.pattern, 'g');
              const matches = input.match(regex);
              return matches ? matches.join('\n') : input;
            }
            case 'split':
              return input; // Placeholder
            default:
              return input;
          }
        }

        case 'conditional': {
          // Evaluate condition — return trueBranch or falseBranch step ID
          let conditionMet = false;
          switch (step.config.condition) {
            case 'contains':
              conditionMet = input
                .toLowerCase()
                .includes(step.config.value.toLowerCase());
              break;
            case 'length_gt':
              conditionMet = input.length > parseInt(step.config.value, 10);
              break;
            case 'regex_match':
              conditionMet = new RegExp(step.config.value).test(input);
              break;
            case 'sentiment':
              // Simple heuristic
              conditionMet =
                input.toLowerCase().includes('good') ||
                input.toLowerCase().includes('positive');
              break;
          }
          // Return the branch destination as a special marker
          return conditionMet
            ? `__BRANCH__${step.config.trueBranch}`
            : `__BRANCH__${step.config.falseBranch}`;
        }

        case 'output': {
          return input; // Output step just passes through
        }
      }
    },
    [client],
  );

  const execute = useCallback(
    async (workflow: AgentWorkflow, input: string) => {
      cancelledRef.current = false;
      abortRef.current = new AbortController();
      setIsRunning(true);

      const executionId = crypto.randomUUID();
      const now = new Date().toISOString();

      const initialExecution: WorkflowExecution = {
        id: executionId,
        workflowId: workflow.id,
        status: 'running',
        steps: workflow.steps.map((step) => ({
          stepId: step.id,
          status: 'pending',
          input: '',
          output: '',
          startedAt: now,
        })),
        startedAt: now,
        initialInput: input,
      };

      setExecution(initialExecution);

      let currentInput = input;
      let currentStepIndex = 0;

      try {
        while (currentStepIndex < workflow.steps.length) {
          if (cancelledRef.current) {
            setExecution((prev) =>
              prev ? { ...prev, status: 'cancelled' } : prev,
            );
            break;
          }

          const step = workflow.steps[currentStepIndex]!;
          const stepStart = Date.now();

          // Mark step as running
          setExecution((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              steps: prev.steps.map((s) =>
                s.stepId === step.id
                  ? { ...s, status: 'running', input: currentInput }
                  : s,
              ),
            };
          });

          try {
            const output = await executeStep(step, currentInput);
            const elapsed = Date.now() - stepStart;

            // Handle conditional branching
            if (output.startsWith('__BRANCH__')) {
              const targetStepId = output.replace('__BRANCH__', '');
              const targetIndex = workflow.steps.findIndex(
                (s) => s.id === targetStepId,
              );
              if (targetIndex >= 0) {
                currentStepIndex = targetIndex;
              } else {
                currentStepIndex++;
              }

              // Mark conditional step as completed
              setExecution((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  steps: prev.steps.map((s) =>
                    s.stepId === step.id
                      ? {
                          ...s,
                          status: 'completed',
                          output: `Branch → ${targetStepId}`,
                          completedAt: new Date().toISOString(),
                          durationMs: elapsed,
                        }
                      : s,
                  ),
                };
              });
              continue;
            }

            // Mark step as completed
            setExecution((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                steps: prev.steps.map((s) =>
                  s.stepId === step.id
                    ? {
                        ...s,
                        status: 'completed',
                        output,
                        completedAt: new Date().toISOString(),
                        durationMs: elapsed,
                        tokensUsed: Math.ceil(output.length / 4),
                      }
                    : s,
                ),
              };
            });

            currentInput = output;
            currentStepIndex++;
          } catch (stepError) {
            if (cancelledRef.current) break;

            // Mark step as failed
            setExecution((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                status: 'failed',
                steps: prev.steps.map((s) =>
                  s.stepId === step.id
                    ? {
                        ...s,
                        status: 'failed',
                        error:
                          stepError instanceof Error
                            ? stepError.message
                            : String(stepError),
                        completedAt: new Date().toISOString(),
                        durationMs: Date.now() - stepStart,
                      }
                    : s,
                ),
              };
            });
            break;
          }
        }

        // Mark execution as completed
        if (!cancelledRef.current) {
          setExecution((prev) => {
            if (!prev) return prev;
            const completed: WorkflowExecution = {
              ...prev,
              status: prev.steps.some((s) => s.status === 'failed')
                ? 'failed'
                : 'completed',
              completedAt: new Date().toISOString(),
              finalOutput: currentInput,
            };
            void saveExecution(completed);
            return completed;
          });
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
      }
    },
    [executeStep],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setExecution(null);
    setIsRunning(false);
  }, []);

  return { execution, isRunning, execute, cancel, reset };
}
