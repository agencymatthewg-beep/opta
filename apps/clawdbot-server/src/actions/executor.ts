/**
 * Action Executor
 * Coordinates actions based on LLM decisions.
 */

import type { Connection } from '../websocket/connection';
import type { OptaClient } from './opta-client';

export interface ActionContext {
  connection: Connection;
  optaClient: OptaClient;
}

export type ActionType =
  | 'create_task'
  | 'complete_task'
  | 'create_event'
  | 'get_schedule'
  | 'get_tasks';

export interface ActionRequest {
  type: ActionType;
  params: Record<string, unknown>;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Execute an action
 */
export async function executeAction(
  context: ActionContext,
  action: ActionRequest
): Promise<ActionResult> {
  const { connection, optaClient } = context;

  // Notify client that we're using a tool
  connection.sendBotState('toolUse', `Executing: ${action.type}`);

  try {
    switch (action.type) {
      case 'create_task':
        return await executeCreateTask(optaClient, action.params);

      case 'complete_task':
        return await executeCompleteTask(optaClient, action.params);

      case 'create_event':
        return await executeCreateEvent(optaClient, action.params);

      case 'get_schedule':
        return await executeGetSchedule(optaClient, action.params);

      case 'get_tasks':
        return await executeGetTasks(optaClient);

      default:
        return {
          success: false,
          error: `Unknown action type: ${action.type}`,
        };
    }
  } catch (error) {
    console.error('[ActionExecutor] Error executing action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Return to idle after action completes
    connection.sendBotState('idle');
  }
}

async function executeCreateTask(
  client: OptaClient,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const task = await client.createTask({
    title: String(params.title ?? ''),
    description: params.description ? String(params.description) : undefined,
    priority: typeof params.priority === 'number' ? params.priority : 1,
    dueDate: params.dueDate ? String(params.dueDate) : undefined,
    completed: false,
    project: params.project ? String(params.project) : undefined,
    labels: Array.isArray(params.labels) ? params.labels.map(String) : undefined,
  });

  if (task) {
    return { success: true, data: task };
  }
  return { success: false, error: 'Failed to create task' };
}

async function executeCompleteTask(
  client: OptaClient,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const taskId = String(params.taskId ?? '');
  if (!taskId) {
    return { success: false, error: 'Task ID is required' };
  }

  const success = await client.completeTask(taskId);
  return { success, error: success ? undefined : 'Failed to complete task' };
}

async function executeCreateEvent(
  client: OptaClient,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const event = await client.createEvent({
    title: String(params.title ?? ''),
    start: String(params.start ?? ''),
    end: String(params.end ?? ''),
    description: params.description ? String(params.description) : undefined,
    location: params.location ? String(params.location) : undefined,
    calendar: String(params.calendar ?? 'primary'),
  });

  if (event) {
    return { success: true, data: event };
  }
  return { success: false, error: 'Failed to create event' };
}

async function executeGetSchedule(
  client: OptaClient,
  params: Record<string, unknown>
): Promise<ActionResult> {
  const days = typeof params.days === 'number' ? params.days : 7;
  const events = await client.getUpcomingEvents(days);
  return { success: true, data: events };
}

async function executeGetTasks(client: OptaClient): Promise<ActionResult> {
  const tasks = await client.getPendingTasks();
  return { success: true, data: tasks };
}

/**
 * Parse action request from LLM output (if using function calling)
 */
export function parseActionFromLLM(text: string): ActionRequest | null {
  // Simple pattern matching for action detection
  // This would be replaced with proper function calling in production
  const patterns: Array<{ pattern: RegExp; type: ActionType; extractor: (match: RegExpMatchArray) => Record<string, unknown> }> = [
    {
      pattern: /create (?:a )?task:?\s*[""']?(.+?)[""']?$/i,
      type: 'create_task',
      extractor: (m) => ({ title: m[1] }),
    },
    {
      pattern: /complete task:?\s*(.+)/i,
      type: 'complete_task',
      extractor: (m) => ({ taskId: m[1] }),
    },
    {
      pattern: /show (?:my )?(?:upcoming )?schedule/i,
      type: 'get_schedule',
      extractor: () => ({ days: 7 }),
    },
    {
      pattern: /show (?:my )?(?:pending )?tasks/i,
      type: 'get_tasks',
      extractor: () => ({}),
    },
  ];

  for (const { pattern, type, extractor } of patterns) {
    const match = text.match(pattern);
    if (match) {
      return { type, params: extractor(match) };
    }
  }

  return null;
}
