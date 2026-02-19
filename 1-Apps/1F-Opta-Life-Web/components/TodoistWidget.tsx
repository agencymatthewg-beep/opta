"use client";

import { useEffect, useState, useTransition } from "react";
import {
    Circle,
    AlertCircle,
    Clock,
    Plus,
    ListTodo,
    RefreshCw,
    Inbox,
    Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    getTodoistDashboardData,
    createTodoistTask,
    completeTodoistTask,
    TodoistTask,
    TodoistDashboardData,
} from "@/lib/todoist";

type ViewMode = "today" | "upcoming" | "overdue";

const priorityColors: Record<number, string> = {
    4: "text-red-400 border-red-400/50", // Urgent
    3: "text-orange-400 border-orange-400/50",
    2: "text-blue-400 border-blue-400/50",
    1: "text-white/40 border-white/20", // Natural
};

const priorityBg: Record<number, string> = {
    4: "bg-red-500/10",
    3: "bg-orange-500/10",
    2: "bg-blue-500/10",
    1: "bg-white/5",
};

export function TodoistWidget() {
    const [data, setData] = useState<TodoistDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("today");
    const [isAdding, setIsAdding] = useState(false);
    const [newTaskContent, setNewTaskContent] = useState("");
    const [isPending, startTransition] = useTransition();

    const loadData = async () => {
        setLoading(true);
        setError(null);
        const result = await getTodoistDashboardData();
        if ("error" in result) {
            setError(result.error);
        } else {
            setData(result.data);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleComplete = async (taskId: string) => {
        startTransition(async () => {
            const result = await completeTodoistTask(taskId);
            if ("success" in result) {
                // Optimistically update UI
                setData((prev) => {
                    if (!prev) return prev;
                    const removeTask = (tasks: TodoistTask[]) =>
                        tasks.filter((t) => t.id !== taskId);
                    return {
                        ...prev,
                        todayTasks: removeTask(prev.todayTasks),
                        overdueTasks: removeTask(prev.overdueTasks),
                        upcomingTasks: removeTask(prev.upcomingTasks),
                        stats: {
                            ...prev.stats,
                            totalActive: prev.stats.totalActive - 1,
                        },
                    };
                });
            }
        });
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskContent.trim()) return;

        startTransition(async () => {
            const dueString = viewMode === "today" ? "today" : viewMode === "upcoming" ? "tomorrow" : undefined;
            const result = await createTodoistTask(newTaskContent, {
                due_string: dueString,
            });

            if ("success" in result) {
                setNewTaskContent("");
                setIsAdding(false);
                // Reload data to get the new task
                loadData();
            }
        });
    };

    const getDisplayTasks = (): TodoistTask[] => {
        if (!data) return [];
        switch (viewMode) {
            case "today":
                return data.todayTasks;
            case "upcoming":
                return data.upcomingTasks;
            case "overdue":
                return data.overdueTasks;
            default:
                return data.todayTasks;
        }
    };

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                <div className="h-8 bg-white/5 rounded w-1/3" />
                <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-12 bg-white/5 rounded" />
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        const isConfigError = error.toLowerCase().includes("not configured") || error.toLowerCase().includes("token");
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className={cn("w-8 h-8 mb-2", isConfigError ? "text-neon-amber" : "text-red-400")} />
                <p className="text-sm text-text-muted">
                    {isConfigError ? "Todoist API token not configured" : error}
                </p>
                <p className="text-xs text-text-muted mt-1">
                    {isConfigError ? "Add your token in Settings (⚙️) to connect Todoist" : ""}
                </p>
                {!isConfigError && (
                    <button
                        onClick={loadData}
                        className="mt-3 text-xs text-primary hover:text-primary-glow transition-colors"
                    >
                        Try Again
                    </button>
                )}
            </div>
        );
    }

    const tasks = getDisplayTasks();

    return (
        <div className="space-y-4">
            {/* Stats Bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setViewMode("today")}
                        className={cn(
                            "flex items-center gap-1.5 text-xs font-medium transition-colors",
                            viewMode === "today"
                                ? "text-primary"
                                : "text-text-muted hover:text-text-secondary"
                        )}
                    >
                        <Inbox className="w-3.5 h-3.5" />
                        Today
                        {data?.stats.todayCount ? (
                            <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-[10px]">
                                {data.stats.todayCount}
                            </span>
                        ) : null}
                    </button>

                    <button
                        onClick={() => setViewMode("upcoming")}
                        className={cn(
                            "flex items-center gap-1.5 text-xs font-medium transition-colors",
                            viewMode === "upcoming"
                                ? "text-neon-blue"
                                : "text-text-muted hover:text-text-secondary"
                        )}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Week
                        {data?.stats.upcomingCount ? (
                            <span className="px-1.5 py-0.5 bg-neon-blue/20 text-neon-blue rounded text-[10px]">
                                {data.stats.upcomingCount}
                            </span>
                        ) : null}
                    </button>

                    {data?.stats.overdueCount ? (
                        <button
                            onClick={() => setViewMode("overdue")}
                            className={cn(
                                "flex items-center gap-1.5 text-xs font-medium transition-colors",
                                viewMode === "overdue"
                                    ? "text-red-400"
                                    : "text-red-400/60 hover:text-red-400"
                            )}
                        >
                            <AlertCircle className="w-3.5 h-3.5" />
                            Overdue
                            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px]">
                                {data.stats.overdueCount}
                            </span>
                        </button>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        aria-label="Refresh tasks"
                        className="p-1.5 text-text-muted hover:text-text-secondary transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                    </button>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        aria-label={isAdding ? "Cancel adding task" : "Add new task"}
                        aria-expanded={isAdding}
                        className="p-1.5 text-primary hover:text-primary-glow transition-colors"
                        title="Add Task"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Add Task Form */}
            {isAdding && (
                <form onSubmit={handleAddTask} className="animate-in fade-in slide-in-from-top-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newTaskContent}
                            onChange={(e) => setNewTaskContent(e.target.value)}
                            placeholder="What needs to be done?"
                            className="flex-1 bg-white/5 border border-primary/30 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary placeholder:text-text-muted"
                            autoFocus
                            disabled={isPending}
                        />
                        <button
                            type="submit"
                            disabled={!newTaskContent.trim() || isPending}
                            className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-glow transition-colors disabled:opacity-50"
                        >
                            {isPending ? "..." : "Add"}
                        </button>
                    </div>
                </form>
            )}

            {/* Tasks List */}
            <div className="space-y-2">
                {tasks.length === 0 ? (
                    <div className="text-center py-6 text-text-muted">
                        <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                            {viewMode === "today"
                                ? "No tasks for today"
                                : viewMode === "overdue"
                                ? "No overdue tasks"
                                : "No upcoming tasks"}
                        </p>
                    </div>
                ) : (
                    tasks.slice(0, 8).map((task) => (
                        <TaskItem
                            key={task.id}
                            task={task}
                            onComplete={() => handleComplete(task.id)}
                            isPending={isPending}
                        />
                    ))
                )}

                {tasks.length > 8 && (
                    <p className="text-xs text-text-muted text-center pt-2">
                        +{tasks.length - 8} more tasks
                    </p>
                )}
            </div>

            {/* Footer Stats */}
            {data && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
                        Todoist • {data.stats.totalActive} Active
                    </span>
                    <a
                        href="https://todoist.com/app"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:text-primary-glow transition-colors"
                    >
                        Open Todoist →
                    </a>
                </div>
            )}
        </div>
    );
}

function TaskItem({
    task,
    onComplete,
    isPending,
}: {
    task: TodoistTask;
    onComplete: () => void;
    isPending: boolean;
}) {
    const priorityClass = priorityColors[task.priority] || priorityColors[1];
    const priorityBgClass = priorityBg[task.priority] || priorityBg[1];

    return (
        <div
            className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all group",
                priorityBgClass,
                "border-white/5 hover:border-white/10"
            )}
        >
            <button
                onClick={onComplete}
                disabled={isPending}
                aria-label={`Complete task: ${task.content}`}
                className={cn(
                    "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                    priorityClass,
                    "hover:bg-white/10 disabled:opacity-50"
                )}
            >
                <Circle className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary leading-tight">{task.content}</p>
                {task.due && (
                    <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-text-muted" />
                        <span className="text-xs text-text-muted">{task.due.string}</span>
                    </div>
                )}
                {task.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {task.labels.map((label) => (
                            <span
                                key={label}
                                className="px-1.5 py-0.5 text-[10px] bg-white/5 text-text-muted rounded"
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {task.priority > 1 && (
                <Flag
                    className={cn("w-3.5 h-3.5 shrink-0", priorityColors[task.priority])}
                />
            )}
        </div>
    );
}
