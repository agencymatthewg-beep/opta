import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getTodoistDashboardData,
  getTodayTasks,
  getUpcomingTasks,
  getOverdueTasks,
  TodoistTask,
  TodoistProject,
} from "@/lib/todoist";

// ============================================================================
// Tasks API (web compatibility route)
// ============================================================================

interface DashboardTask {
  id: string;
  content: string;
  description?: string;
  priority: 1 | 2 | 3 | 4;
  dueDate: string | null;
  dueString: string | null;
  project: string | null;
  labels: string[];
}

const MOCK_DASHBOARD_RESPONSE = {
  success: true,
  source: "fallback",
  note: "Showing fallback data because task provider is unavailable.",
  data: {
    todayTasks: [
      {
        id: "mock-1",
        content: "Review today's top priorities",
        description: "Fallback task shown when integrations are unavailable",
        priority: 2 as const,
        dueDate: new Date().toISOString().slice(0, 10),
        dueString: "today",
        project: "General",
        labels: ["fallback"],
      },
    ],
    overdueTasks: [],
    upcomingTasks: [],
    projects: [{ id: "mock-project", name: "General" }],
    stats: {
      todayCount: 1,
      overdueCount: 0,
      upcomingCount: 0,
      totalActive: 1,
    },
  },
};

function mapTask(
  task: TodoistTask,
  projectMap: Map<string, string>,
): DashboardTask {
  return {
    id: task.id,
    content: task.content,
    description: task.description || undefined,
    priority: task.priority,
    dueDate: task.due?.date || null,
    dueString: task.due?.string || null,
    project: projectMap.get(task.project_id) || null,
    labels: task.labels,
  };
}

function buildDashboardResponse(data: {
  todayTasks: TodoistTask[];
  overdueTasks: TodoistTask[];
  upcomingTasks: TodoistTask[];
  projects: TodoistProject[];
  stats: {
    todayCount: number;
    overdueCount: number;
    upcomingCount: number;
    totalActive: number;
  };
}) {
  const projectMap = new Map<string, string>(
    data.projects.map((p) => [p.id, p.name]),
  );

  return {
    success: true,
    source: "todoist",
    data: {
      todayTasks: data.todayTasks.map((task) => mapTask(task, projectMap)),
      overdueTasks: data.overdueTasks.map((task) => mapTask(task, projectMap)),
      upcomingTasks: data.upcomingTasks.map((task) =>
        mapTask(task, projectMap),
      ),
      projects: data.projects.map((p) => ({ id: p.id, name: p.name })),
      stats: data.stats,
    },
  };
}

/**
 * GET /api/tasks?view=dashboard|today|upcoming|overdue
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 503 },
      );
    }
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // If Supabase auth backend is unreachable, return fallback for dashboard view.
    // Keep hard-auth failure behavior for explicit unauthenticated users.
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "dashboard";

    if (error && view === "dashboard") {
      return NextResponse.json(MOCK_DASHBOARD_RESPONSE, { status: 200 });
    }

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    switch (view) {
      case "today": {
        const result = await getTodayTasks();
        if ("error" in result) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          source: "todoist",
          data: result.data,
        });
      }

      case "upcoming": {
        const result = await getUpcomingTasks();
        if ("error" in result) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          source: "todoist",
          data: result.data,
        });
      }

      case "overdue": {
        const result = await getOverdueTasks();
        if ("error" in result) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({
          success: true,
          source: "todoist",
          data: result.data,
        });
      }

      case "dashboard":
      default: {
        const result = await getTodoistDashboardData();

        if ("error" in result) {
          return NextResponse.json(MOCK_DASHBOARD_RESPONSE, { status: 200 });
        }

        return NextResponse.json(buildDashboardResponse(result.data));
      }
    }
  } catch (error) {
    console.error("Tasks API error:", error);
    return NextResponse.json(MOCK_DASHBOARD_RESPONSE, { status: 200 });
  }
}
