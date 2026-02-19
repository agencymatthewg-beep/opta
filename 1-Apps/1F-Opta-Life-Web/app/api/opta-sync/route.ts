import { NextRequest, NextResponse } from "next/server";
import {
  getTodoistDashboardData,
  createTodoistTask,
  completeTodoistTask,
  updateTodoistTask,
  deleteTodoistTask,
  TodoistTask,
  TodoistProject,
} from "@/lib/todoist";

// ============================================================================
// Opta AI Sync API
// ============================================================================
// Bidirectional sync between Opta (AI copilot) and Life Manager.
// 
// GET  /api/opta-sync         → Read current task context
// POST /api/opta-sync         → Mutate tasks (add/complete/update/delete)
//
// Security: Set OPTA_SYNC_KEY in .env.local for production
// ============================================================================

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

interface SimplifiedTask {
  id: string;
  content: string;
  description?: string;
  priority: "urgent" | "high" | "medium" | "low";
  due?: string;
  dueDate?: string;
  project?: string;
  labels: string[];
  isRecurring: boolean;
}

interface TaskStats {
  today: number;
  overdue: number;
  upcoming: number;
  total: number;
}

interface OptaSyncResponse {
  success: true;
  timestamp: string;
  timezone: string;
  today: {
    tasks: SimplifiedTask[];
    count: number;
  };
  overdue: {
    tasks: SimplifiedTask[];
    count: number;
  };
  upcoming: {
    tasks: SimplifiedTask[];
    count: number;
  };
  stats: TaskStats;
  summary: string;
  advice: string;
}

interface OptaErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: string;
}

type PostAction = 
  | { action: "add_task"; content: string; due_string?: string; priority?: 1 | 2 | 3 | 4; labels?: string[]; description?: string }
  | { action: "complete_task"; task_id: string }
  | { action: "update_task"; task_id: string; updates: { content?: string; due_string?: string; priority?: 1 | 2 | 3 | 4 } }
  | { action: "delete_task"; task_id: string }
  | { action: "health" };

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------

const PRIORITY_MAP: Record<number, SimplifiedTask["priority"]> = {
  4: "urgent",
  3: "high",
  2: "medium",
  1: "low",
};

const CACHE_MAX_AGE = 60; // 1 minute cache for GET requests

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function validateAuth(request: NextRequest): boolean {
  const expectedKey = process.env.OPTA_SYNC_KEY;
  if (!expectedKey) return true; // No key configured = open access (dev mode)
  
  const authHeader = request.headers.get("x-opta-key");
  const queryKey = request.nextUrl.searchParams.get("key");
  
  return authHeader === expectedKey || queryKey === expectedKey;
}

function simplifyTask(task: TodoistTask, projectMap: Map<string, string>): SimplifiedTask {
  return {
    id: task.id,
    content: task.content,
    description: task.description || undefined,
    priority: PRIORITY_MAP[task.priority] || "low",
    due: task.due?.string,
    dueDate: task.due?.date,
    project: projectMap.get(task.project_id),
    labels: task.labels,
    isRecurring: task.due?.is_recurring ?? false,
  };
}

function generateSummary(stats: TaskStats): string {
  const parts: string[] = [];
  
  if (stats.overdue > 0) parts.push(`⚠️ ${stats.overdue} overdue`);
  if (stats.today > 0) parts.push(`📅 ${stats.today} today`);
  if (stats.upcoming > 0) parts.push(`📆 ${stats.upcoming} upcoming`);
  
  return parts.length > 0 ? parts.join(" · ") : "✅ All clear";
}

function generateAdvice(stats: TaskStats, overdueTasks: SimplifiedTask[]): string {
  // Prioritization advice based on current state
  if (stats.overdue > 5) {
    return "🔴 High overdue count. Consider a task triage session — archive, delegate, or reschedule stale items.";
  }
  if (stats.overdue > 0) {
    const urgentOverdue = overdueTasks.filter(t => t.priority === "urgent");
    if (urgentOverdue.length > 0) {
      return `🟠 Urgent overdue: "${urgentOverdue[0].content}" — tackle this first.`;
    }
    return "🟡 Some overdue tasks. Quick wins: complete or reschedule to clear mental load.";
  }
  if (stats.today > 5) {
    return "📋 Heavy day ahead. Consider time-blocking the top 3 priorities.";
  }
  if (stats.total === 0) {
    return "🎯 Task list empty. Good time for strategic planning or deep work.";
  }
  return "✨ Workload looks manageable. Stay focused on high-impact items.";
}

function createErrorResponse(error: string, code: string, status: number): NextResponse<OptaErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error,
      code,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

function createCorsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-opta-key",
  };
}

// ----------------------------------------------------------------------------
// OPTIONS (CORS Preflight)
// ----------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: createCorsHeaders(),
  });
}

// ----------------------------------------------------------------------------
// GET: Read Task Context
// ----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Auth check
  if (!validateAuth(request)) {
    return createErrorResponse("Invalid or missing API key", "AUTH_FAILED", 401);
  }

  // Fetch data
  const result = await getTodoistDashboardData();

  if ("error" in result) {
    return createErrorResponse(result.error, "TODOIST_ERROR", 502);
  }

  const { todayTasks, overdueTasks, upcomingTasks, projects, stats } = result.data;
  const projectMap = new Map<string, string>(projects.map((p: TodoistProject) => [p.id, p.name]));

  const taskStats: TaskStats = {
    today: stats.todayCount,
    overdue: stats.overdueCount,
    upcoming: stats.upcomingCount,
    total: stats.totalActive,
  };

  const simplifiedOverdue = overdueTasks.map((t: TodoistTask) => simplifyTask(t, projectMap));

  const response: OptaSyncResponse = {
    success: true,
    timestamp: new Date().toISOString(),
    timezone: "Australia/Melbourne",
    today: {
      tasks: todayTasks.slice(0, 15).map((t: TodoistTask) => simplifyTask(t, projectMap)),
      count: stats.todayCount,
    },
    overdue: {
      tasks: simplifiedOverdue.slice(0, 10),
      count: stats.overdueCount,
    },
    upcoming: {
      tasks: upcomingTasks.slice(0, 15).map((t: TodoistTask) => simplifyTask(t, projectMap)),
      count: stats.upcomingCount,
    },
    stats: taskStats,
    summary: generateSummary(taskStats),
    advice: generateAdvice(taskStats, simplifiedOverdue),
  };

  return NextResponse.json(response, {
    headers: {
      ...createCorsHeaders(),
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}`,
      "X-Response-Time": `${Date.now() - startTime}ms`,
    },
  });
}

// ----------------------------------------------------------------------------
// POST: Mutate Tasks
// ----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Auth check
  if (!validateAuth(request)) {
    return createErrorResponse("Invalid or missing API key", "AUTH_FAILED", 401);
  }

  let body: PostAction;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse("Invalid JSON body", "PARSE_ERROR", 400);
  }

  if (!body.action) {
    return createErrorResponse("Missing 'action' field", "VALIDATION_ERROR", 400);
  }

  const timestamp = new Date().toISOString();

  switch (body.action) {
    // Health check
    case "health": {
      return NextResponse.json({
        success: true,
        status: "healthy",
        timestamp,
        service: "opta-life",
      });
    }

    // Add task
    case "add_task": {
      if (!body.content?.trim()) {
        return createErrorResponse("Task content is required", "VALIDATION_ERROR", 400);
      }

      const result = await createTodoistTask(body.content.trim(), {
        due_string: body.due_string,
        priority: body.priority ?? 2,
        labels: body.labels,
        description: body.description,
      });

      if ("error" in result) {
        return createErrorResponse(result.error, "TODOIST_ERROR", 502);
      }

      return NextResponse.json({
        success: true,
        action: "task_created",
        task: {
          id: result.data.id,
          content: result.data.content,
          due: result.data.due?.string,
        },
        timestamp,
      }, { status: 201, headers: createCorsHeaders() });
    }

    // Complete task
    case "complete_task": {
      if (!body.task_id) {
        return createErrorResponse("task_id is required", "VALIDATION_ERROR", 400);
      }

      const result = await completeTodoistTask(body.task_id);

      if ("error" in result) {
        return createErrorResponse(result.error, "TODOIST_ERROR", 502);
      }

      return NextResponse.json({
        success: true,
        action: "task_completed",
        task_id: body.task_id,
        timestamp,
      }, { headers: createCorsHeaders() });
    }

    // Update task
    case "update_task": {
      if (!body.task_id) {
        return createErrorResponse("task_id is required", "VALIDATION_ERROR", 400);
      }
      if (!body.updates || Object.keys(body.updates).length === 0) {
        return createErrorResponse("updates object is required", "VALIDATION_ERROR", 400);
      }

      const result = await updateTodoistTask(body.task_id, body.updates);

      if ("error" in result) {
        return createErrorResponse(result.error, "TODOIST_ERROR", 502);
      }

      return NextResponse.json({
        success: true,
        action: "task_updated",
        task: {
          id: result.data.id,
          content: result.data.content,
          due: result.data.due?.string,
        },
        timestamp,
      }, { headers: createCorsHeaders() });
    }

    // Delete task
    case "delete_task": {
      if (!body.task_id) {
        return createErrorResponse("task_id is required", "VALIDATION_ERROR", 400);
      }

      const result = await deleteTodoistTask(body.task_id);

      if ("error" in result) {
        return createErrorResponse(result.error, "TODOIST_ERROR", 502);
      }

      return NextResponse.json({
        success: true,
        action: "task_deleted",
        task_id: body.task_id,
        timestamp,
      }, { headers: createCorsHeaders() });
    }

    default: {
      return createErrorResponse(
        `Unknown action: ${(body as { action: string }).action}`,
        "UNKNOWN_ACTION",
        400
      );
    }
  }
}
