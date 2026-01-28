"use server";

// ============================================================================
// Todoist API Integration
// ============================================================================

const TODOIST_API_URL = "https://api.todoist.com/rest/v2";
const TODOIST_SYNC_URL = "https://api.todoist.com/sync/v9";

// ============================================================================
// Types
// ============================================================================

export interface TodoistTask {
    id: string;
    content: string;
    description: string;
    project_id: string;
    section_id: string | null;
    parent_id: string | null;
    order: number;
    priority: 1 | 2 | 3 | 4; // 4 = urgent, 1 = natural
    due: {
        date: string;
        string: string;
        datetime?: string;
        timezone?: string;
        is_recurring: boolean;
    } | null;
    labels: string[];
    is_completed: boolean;
    created_at: string;
    creator_id: string;
    assignee_id: string | null;
    assigner_id: string | null;
    comment_count: number;
    url: string;
}

export interface TodoistProject {
    id: string;
    name: string;
    color: string;
    parent_id: string | null;
    order: number;
    comment_count: number;
    is_shared: boolean;
    is_favorite: boolean;
    is_inbox_project: boolean;
    is_team_inbox: boolean;
    view_style: string;
    url: string;
}

type TodoistResult<T> = { success: true; data: T } | { error: string };

// ============================================================================
// Helpers
// ============================================================================

function getApiToken(): string | null {
    return process.env.TODOIST_API_TOKEN || null;
}

async function todoistFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<TodoistResult<T>> {
    const token = getApiToken();
    if (!token) {
        return { error: "Todoist API token not configured" };
    }

    try {
        const response = await fetch(`${TODOIST_API_URL}${endpoint}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Todoist API error (${response.status}):`, errorText);
            return { error: `Todoist API error: ${response.status}` };
        }

        // Handle 204 No Content (for delete operations)
        if (response.status === 204) {
            return { success: true, data: {} as T };
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error("Todoist fetch error:", error);
        return { error: error instanceof Error ? error.message : "Unknown error" };
    }
}

// ============================================================================
// Task Operations
// ============================================================================

/**
 * Get all active tasks, optionally filtered
 */
export async function getTodoistTasks(filter?: string): Promise<TodoistResult<TodoistTask[]>> {
    const params = filter ? `?filter=${encodeURIComponent(filter)}` : "";
    return todoistFetch<TodoistTask[]>(`/tasks${params}`);
}

/**
 * Get tasks due today
 */
export async function getTodayTasks(): Promise<TodoistResult<TodoistTask[]>> {
    return getTodoistTasks("today");
}

/**
 * Get tasks due this week
 */
export async function getUpcomingTasks(): Promise<TodoistResult<TodoistTask[]>> {
    return getTodoistTasks("7 days");
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(): Promise<TodoistResult<TodoistTask[]>> {
    return getTodoistTasks("overdue");
}

/**
 * Get a single task by ID
 */
export async function getTask(taskId: string): Promise<TodoistResult<TodoistTask>> {
    return todoistFetch<TodoistTask>(`/tasks/${taskId}`);
}

/**
 * Create a new task
 */
export async function createTodoistTask(
    content: string,
    options?: {
        description?: string;
        project_id?: string;
        due_string?: string;
        due_date?: string;
        priority?: 1 | 2 | 3 | 4;
        labels?: string[];
    }
): Promise<TodoistResult<TodoistTask>> {
    if (!content || content.trim().length === 0) {
        return { error: "Task content is required" };
    }

    return todoistFetch<TodoistTask>("/tasks", {
        method: "POST",
        body: JSON.stringify({
            content: content.trim(),
            ...options,
        }),
    });
}

/**
 * Update an existing task
 */
export async function updateTodoistTask(
    taskId: string,
    updates: {
        content?: string;
        description?: string;
        due_string?: string;
        due_date?: string;
        priority?: 1 | 2 | 3 | 4;
        labels?: string[];
    }
): Promise<TodoistResult<TodoistTask>> {
    return todoistFetch<TodoistTask>(`/tasks/${taskId}`, {
        method: "POST",
        body: JSON.stringify(updates),
    });
}

/**
 * Complete a task
 */
export async function completeTodoistTask(taskId: string): Promise<TodoistResult<object>> {
    return todoistFetch<object>(`/tasks/${taskId}/close`, {
        method: "POST",
    });
}

/**
 * Reopen a completed task
 */
export async function reopenTodoistTask(taskId: string): Promise<TodoistResult<object>> {
    return todoistFetch<object>(`/tasks/${taskId}/reopen`, {
        method: "POST",
    });
}

/**
 * Delete a task permanently
 */
export async function deleteTodoistTask(taskId: string): Promise<TodoistResult<object>> {
    return todoistFetch<object>(`/tasks/${taskId}`, {
        method: "DELETE",
    });
}

// ============================================================================
// Project Operations
// ============================================================================

/**
 * Get all projects
 */
export async function getTodoistProjects(): Promise<TodoistResult<TodoistProject[]>> {
    return todoistFetch<TodoistProject[]>("/projects");
}

/**
 * Get a single project
 */
export async function getTodoistProject(projectId: string): Promise<TodoistResult<TodoistProject>> {
    return todoistFetch<TodoistProject>(`/projects/${projectId}`);
}

// ============================================================================
// Aggregated Data for Dashboard
// ============================================================================

export interface TodoistDashboardData {
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
}

/**
 * Get all dashboard data in a single call
 */
export async function getTodoistDashboardData(): Promise<TodoistResult<TodoistDashboardData>> {
    const [todayResult, overdueResult, upcomingResult, allTasksResult, projectsResult] = await Promise.all([
        getTodayTasks(),
        getOverdueTasks(),
        getUpcomingTasks(),
        getTodoistTasks(),
        getTodoistProjects(),
    ]);

    // Check for auth errors
    if ("error" in todayResult && todayResult.error.includes("not configured")) {
        return { error: todayResult.error };
    }

    const todayTasks = "success" in todayResult ? todayResult.data : [];
    const overdueTasks = "success" in overdueResult ? overdueResult.data : [];
    const upcomingTasks = "success" in upcomingResult ? upcomingResult.data : [];
    const allTasks = "success" in allTasksResult ? allTasksResult.data : [];
    const projects = "success" in projectsResult ? projectsResult.data : [];

    return {
        success: true,
        data: {
            todayTasks,
            overdueTasks,
            upcomingTasks,
            projects,
            stats: {
                todayCount: todayTasks.length,
                overdueCount: overdueTasks.length,
                upcomingCount: upcomingTasks.length,
                totalActive: allTasks.length,
            },
        },
    };
}
