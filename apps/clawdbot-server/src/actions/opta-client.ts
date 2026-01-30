/**
 * Opta API Client
 * Communicates with Opta Life Manager backend for data and actions.
 */

export interface OptaClientConfig {
  baseUrl: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  calendar: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: number;
  dueDate?: string;
  completed: boolean;
  project?: string;
  labels?: string[];
}

export interface ContextData {
  upcomingEvents: CalendarEvent[];
  pendingTasks: Task[];
  todayDate: string;
  timezone: string;
}

export class OptaClient {
  private baseUrl: string;

  constructor(config: OptaClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  /**
   * Fetch user context (calendar events, tasks, etc.)
   */
  async getContext(): Promise<ContextData> {
    // For now, return mock data until API endpoints are built
    // This will be replaced with actual API calls
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    return {
      upcomingEvents: [],
      pendingTasks: [],
      todayDate: today,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }

  /**
   * Fetch upcoming calendar events
   */
  async getUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/calendar/events?days=${days}`);
      if (!response.ok) {
        console.warn('[OptaClient] Failed to fetch events:', response.status);
        return [];
      }
      return await response.json();
    } catch (error) {
      console.warn('[OptaClient] Error fetching events:', error);
      return [];
    }
  }

  /**
   * Fetch pending tasks
   */
  async getPendingTasks(): Promise<Task[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks?completed=false`);
      if (!response.ok) {
        console.warn('[OptaClient] Failed to fetch tasks:', response.status);
        return [];
      }
      return await response.json();
    } catch (error) {
      console.warn('[OptaClient] Error fetching tasks:', error);
      return [];
    }
  }

  /**
   * Create a new task
   */
  async createTask(task: Omit<Task, 'id'>): Promise<Task | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      if (!response.ok) {
        console.warn('[OptaClient] Failed to create task:', response.status);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn('[OptaClient] Error creating task:', error);
      return null;
    }
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tasks/${taskId}/complete`, {
        method: 'POST',
      });
      return response.ok;
    } catch (error) {
      console.warn('[OptaClient] Error completing task:', error);
      return false;
    }
  }

  /**
   * Create a calendar event
   */
  async createEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/calendar/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) {
        console.warn('[OptaClient] Failed to create event:', response.status);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.warn('[OptaClient] Error creating event:', error);
      return null;
    }
  }

  /**
   * Format context data for LLM consumption
   */
  formatContextForLLM(context: ContextData): string {
    const lines: string[] = [
      `Current Date: ${context.todayDate}`,
      `Timezone: ${context.timezone}`,
      '',
    ];

    if (context.upcomingEvents.length > 0) {
      lines.push('Upcoming Events:');
      for (const event of context.upcomingEvents.slice(0, 10)) {
        lines.push(`- ${event.title} (${event.start} - ${event.end})`);
      }
      lines.push('');
    } else {
      lines.push('No upcoming events.');
      lines.push('');
    }

    if (context.pendingTasks.length > 0) {
      lines.push('Pending Tasks:');
      for (const task of context.pendingTasks.slice(0, 10)) {
        const due = task.dueDate ? ` (due: ${task.dueDate})` : '';
        const priority = task.priority > 2 ? ' [HIGH]' : '';
        lines.push(`- ${task.title}${due}${priority}`);
      }
    } else {
      lines.push('No pending tasks.');
    }

    return lines.join('\n');
  }
}

/**
 * Create an Opta client from base URL
 */
export function createOptaClient(baseUrl: string): OptaClient {
  return new OptaClient({ baseUrl });
}
