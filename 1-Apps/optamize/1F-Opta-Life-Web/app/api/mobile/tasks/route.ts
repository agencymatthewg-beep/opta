import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    getTodoistDashboardData,
    createTodoistTask,
    completeTodoistTask,
    getTodayTasks,
    getUpcomingTasks,
    getOverdueTasks,
} from "@/lib/todoist";

// ============================================================================
// Mobile Tasks API
// ============================================================================

/**
 * GET /api/mobile/tasks
 * Get tasks with optional view filter
 * Query params: view=today|upcoming|overdue|dashboard
 */
export async function GET(request: NextRequest) {
    try {
        // Check for both cookie-based (web) and Bearer token (iOS) auth
        const supabase = await createClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const view = searchParams.get("view") || "dashboard";

        let result;

        switch (view) {
            case "today":
                result = await getTodayTasks();
                break;
            case "upcoming":
                result = await getUpcomingTasks();
                break;
            case "overdue":
                result = await getOverdueTasks();
                break;
            case "dashboard":
            default:
                result = await getTodoistDashboardData();
                break;
        }

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: result.data,
        });
    } catch (error) {
        console.error("Tasks API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch tasks" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/mobile/tasks
 * Create a new task or perform actions
 * Body: { action: "create" | "complete", ...params }
 */
export async function POST(request: NextRequest) {
    try {
        // Check for both cookie-based (web) and Bearer token (iOS) auth
        const supabase = await createClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case "create": {
                const { content, due_string, due_date, priority, labels } = params;

                if (!content || typeof content !== "string") {
                    return NextResponse.json(
                        { error: "Task content is required" },
                        { status: 400 }
                    );
                }

                const result = await createTodoistTask(content, {
                    due_string,
                    due_date,
                    priority,
                    labels,
                });

                if ("error" in result) {
                    return NextResponse.json({ error: result.error }, { status: 500 });
                }

                return NextResponse.json({
                    success: true,
                    task: result.data,
                    message: `Created task: "${content}"`,
                });
            }

            case "complete": {
                const { taskId } = params;

                if (!taskId || typeof taskId !== "string") {
                    return NextResponse.json(
                        { error: "Task ID is required" },
                        { status: 400 }
                    );
                }

                const result = await completeTodoistTask(taskId);

                if ("error" in result) {
                    return NextResponse.json({ error: result.error }, { status: 500 });
                }

                return NextResponse.json({
                    success: true,
                    message: "Task completed",
                });
            }

            default:
                return NextResponse.json(
                    { error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error("Tasks API error:", error);
        return NextResponse.json(
            { error: "Failed to process task request" },
            { status: 500 }
        );
    }
}
