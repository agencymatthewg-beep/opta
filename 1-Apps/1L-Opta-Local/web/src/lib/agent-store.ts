/**
 * Agent Workflow persistence using idb-keyval (IndexedDB).
 *
 * Stores workflow definitions and execution history.
 * Uses the same IndexedDB backend as chat-store.
 */

import { get, set, del, keys } from 'idb-keyval';
import type {
  AgentWorkflow,
  WorkflowExecution,
  PipelineStep,
  PromptStep,
  WorkflowTemplate,
} from '@/types/agent';

const WORKFLOW_PREFIX = 'opta-workflow:';
const EXECUTION_PREFIX = 'opta-execution:';

// ---------------------------------------------------------------------------
// Workflow CRUD
// ---------------------------------------------------------------------------

/** Save a workflow definition. */
export async function saveWorkflow(workflow: AgentWorkflow): Promise<void> {
  await set(`${WORKFLOW_PREFIX}${workflow.id}`, workflow);
}

/** Get a workflow by ID. */
export async function getWorkflow(id: string): Promise<AgentWorkflow | undefined> {
  return get<AgentWorkflow>(`${WORKFLOW_PREFIX}${id}`);
}

/** Delete a workflow by ID. */
export async function deleteWorkflow(id: string): Promise<void> {
  await del(`${WORKFLOW_PREFIX}${id}`);
}

/** List all workflows, sorted by updated_at descending. */
export async function listWorkflows(): Promise<AgentWorkflow[]> {
  const allKeys = await keys();
  const wfKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(WORKFLOW_PREFIX),
  );

  const workflows: AgentWorkflow[] = [];
  for (const key of wfKeys) {
    const wf = await get<AgentWorkflow>(key as string);
    if (wf) workflows.push(wf);
  }

  return workflows.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

// ---------------------------------------------------------------------------
// Execution History
// ---------------------------------------------------------------------------

/** Save an execution run. */
export async function saveExecution(execution: WorkflowExecution): Promise<void> {
  await set(`${EXECUTION_PREFIX}${execution.id}`, execution);
}

/** Get an execution by ID. */
export async function getExecution(id: string): Promise<WorkflowExecution | undefined> {
  return get<WorkflowExecution>(`${EXECUTION_PREFIX}${id}`);
}

/** List executions for a workflow, sorted by startedAt descending. */
export async function listExecutions(workflowId: string): Promise<WorkflowExecution[]> {
  const allKeys = await keys();
  const exKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(EXECUTION_PREFIX),
  );

  const executions: WorkflowExecution[] = [];
  for (const key of exKeys) {
    const ex = await get<WorkflowExecution>(key as string);
    if (ex && ex.workflowId === workflowId) executions.push(ex);
  }

  return executions.sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

// ---------------------------------------------------------------------------
// Template Instantiation
// ---------------------------------------------------------------------------

/** Create a new workflow from a template. */
export function instantiateTemplate(
  template: WorkflowTemplate,
  defaultModel: string,
): AgentWorkflow {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: template.name,
    description: template.description,
    steps: template.steps.map((step) => {
      const id = crypto.randomUUID();
      if (step.type === 'prompt' && 'model' in step.config) {
        const cfg = step.config as PromptStep['config'];
        return {
          ...step,
          id,
          config: { ...cfg, model: cfg.model || defaultModel },
        };
      }
      return { ...step, id };
    }) as PipelineStep[],
    created_at: now,
    updated_at: now,
  };
}
