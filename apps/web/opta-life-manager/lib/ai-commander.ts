"use server";

import {
    createEvent,
    deleteEvent,
    deleteEventById,
    clearTodayEvents,
    getTodayEventsPreview,
    createGmailDraft,
    getCalendarEvents,
    getCalendarEventsForDays,
    getMonthlyCalendarEvents,
    getUnreadEmails,
} from "@/lib/actions";
import {
    getTodayTasks,
    getUpcomingTasks,
    createTodoistTask,
    completeTodoistTask,
    TodoistTask,
} from "@/lib/todoist";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// Types
// ============================================================================

export type CommandActionType =
    | "CALENDAR"
    | "TASK"
    | "EMAIL"
    | "NAVIGATE"
    | "CLEAR_COMPLETED"
    | "SEARCH"
    | "CONFIRM_CLEAR_CALENDAR"
    | "SUMMARY";

type CommandResult = {
    success: boolean;
    message: string;
    actionType?: CommandActionType;
    payload?: Record<string, unknown>;
    newState?: Record<string, unknown>;
};

interface AiResponse {
    intent: string;
    reply: string;
    data?: Record<string, unknown>;
}

// ============================================================================
// Configuration & Validation
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY environment variable is not set");
}

// Initialize Gemini only if API key exists
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const model = genAI?.getGenerativeModel({ model: "gemini-2.5-flash" });

// ============================================================================
// Security Utilities
// ============================================================================

// Sanitize user input to prevent prompt injection
function sanitizeUserInput(input: string): string {
    // Remove potential JSON/code injection attempts
    // Replace characters that could break out of the quoted string context
    return input
        .replace(/"/g, '\\"') // Escape quotes
        .replace(/\\/g, "\\\\") // Escape backslashes
        .replace(/\n/g, " ") // Replace newlines with spaces
        .replace(/\r/g, "") // Remove carriage returns
        .slice(0, 1000); // Limit input length
}

// Parse AI response with validation
function parseAiResponse(text: string): AiResponse | null {
    try {
        // Clean markdown code blocks
        const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);

        // Validate required fields
        if (typeof parsed.intent !== "string" || typeof parsed.reply !== "string") {
            console.error("Invalid AI response structure: missing intent or reply");
            return null;
        }

        return parsed as AiResponse;
    } catch (error) {
        console.error("Failed to parse AI response as JSON:", error);
        return null;
    }
}

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return "Unknown error";
}

// ============================================================================
// Main Command Processor
// ============================================================================

export async function processAiCommand(
    input: string,
    state: Record<string, unknown> = {}
): Promise<CommandResult> {
    // Check for API key
    if (!model) {
        return {
            success: false,
            message: "AI service is not configured. Please set the GEMINI_API_KEY environment variable.",
        };
    }

    // Handle confirmation states
    if (state.pendingAction === "CLEAR_CALENDAR_CONFIRM") {
        const confirmInput = input.toLowerCase().trim();
        if (confirmInput === "yes" || confirmInput === "y" || confirmInput === "confirm") {
            const res = await clearTodayEvents(true);
            if ("success" in res && res.success) {
                const count = res.deletedCount || 0;
                return {
                    success: true,
                    message: count > 0
                        ? `Done! Cleared ${count} event(s) from today's calendar.`
                        : "No events to clear.",
                    actionType: "CALENDAR",
                };
            }
            return { success: false, message: "error" in res ? res.error : "Failed to clear calendar." };
        } else {
            return { success: true, message: "Calendar clearing cancelled." };
        }
    }

    // Fetch context for AI
    const context = await fetchContext();

    // Sanitize user input to prevent prompt injection
    const sanitizedInput = sanitizeUserInput(input);

    // Construct prompt
    const prompt = buildPrompt(context, sanitizedInput, state);

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const parsed = parseAiResponse(text);

        if (!parsed) {
            // Fallback to task if AI response is invalid
            return {
                success: true,
                message: "I couldn't understand that fully, so I added it as a task.",
                actionType: "TASK",
                payload: { title: input },
            };
        }

        // Execute based on intent
        return await executeIntent(parsed, input);
    } catch (error) {
        console.error("Gemini API error:", extractErrorMessage(error));
        return {
            success: true,
            message: `Added to tasks (AI temporarily unavailable).`,
            actionType: "TASK",
            payload: { title: input },
        };
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

type CalendarEventContext = {
    id: string;
    summary: string;
    start: string;
    isAllDay: boolean;
};

type TodoistTaskContext = {
    id: string;
    content: string;
    due: string | null;
    priority: number;
};

async function fetchContext() {
    let calendarEvents: CalendarEventContext[] = [];
    let upcomingEvents: CalendarEventContext[] = [];
    let monthlyEvents: CalendarEventContext[] = [];
    let unreadEmailsCount = 0;
    let todayTasks: TodoistTaskContext[] = [];
    let upcomingTasks: TodoistTaskContext[] = [];

    // Helper to format calendar event for context
    const formatEvent = (e: { id?: string | null; summary?: string | null; start?: { dateTime?: string | null; date?: string | null } | null }): CalendarEventContext => ({
        id: e.id || "",
        summary: e.summary || "Untitled",
        start: e.start?.dateTime || e.start?.date || "",
        isAllDay: !e.start?.dateTime && !!e.start?.date,
    });

    // Helper to format Todoist task for context
    const formatTask = (t: TodoistTask): TodoistTaskContext => ({
        id: t.id,
        content: t.content,
        due: t.due?.string || null,
        priority: t.priority,
    });

    // Fetch all data in parallel
    const [todayCalData, upcomingCalData, monthlyCalData, emailData, todayTasksData, upcomingTasksData] = await Promise.all([
        getCalendarEvents().catch(() => null),
        getCalendarEventsForDays(7).catch(() => null),
        getMonthlyCalendarEvents().catch(() => null),
        getUnreadEmails().catch(() => null),
        getTodayTasks().catch(() => null),
        getUpcomingTasks().catch(() => null),
    ]);

    if (todayCalData && "success" in todayCalData && todayCalData.events) {
        calendarEvents = todayCalData.events.map(formatEvent);
    }

    if (upcomingCalData && "success" in upcomingCalData && upcomingCalData.events) {
        upcomingEvents = upcomingCalData.events.map(formatEvent);
    }

    if (monthlyCalData && "success" in monthlyCalData && monthlyCalData.events) {
        monthlyEvents = monthlyCalData.events.map(formatEvent);
    }

    if (emailData && "success" in emailData && emailData.emails) {
        unreadEmailsCount = emailData.emails.length;
    }

    if (todayTasksData && "success" in todayTasksData && todayTasksData.data) {
        todayTasks = todayTasksData.data.map(formatTask);
    }

    if (upcomingTasksData && "success" in upcomingTasksData && upcomingTasksData.data) {
        upcomingTasks = upcomingTasksData.data.map(formatTask);
    }

    return {
        currentTime: new Date().toISOString(),
        calendarEvents,
        upcomingEvents,
        monthlyEvents,
        unreadEmailsCount,
        todayTasks,
        upcomingTasks,
    };
}

function buildPrompt(
    context: {
        currentTime: string;
        calendarEvents: CalendarEventContext[];
        unreadEmailsCount: number;
        upcomingEvents?: CalendarEventContext[];
        monthlyEvents?: CalendarEventContext[];
        todayTasks?: TodoistTaskContext[];
        upcomingTasks?: TodoistTaskContext[];
    },
    sanitizedInput: string,
    state: Record<string, unknown>
): string {
    // Format events for clearer display
    const formatEventList = (events: CalendarEventContext[]) =>
        events.map(e => `• "${e.summary}" (ID: ${e.id}, ${e.isAllDay ? 'All day' : e.start})`).join('\n') || "None";

    // Format tasks for clearer display
    const formatTaskList = (tasks: TodoistTaskContext[]) =>
        tasks.map(t => `• "${t.content}" (ID: ${t.id}, Due: ${t.due || 'No date'}, Priority: ${t.priority})`).join('\n') || "None";

    return `You are Opta, an intelligent AI assistant for a life management dashboard. You have FULL CONTEXT of the user's calendar and tasks.

CURRENT TIME: ${context.currentTime}

YOUR CALENDAR KNOWLEDGE:
Today's events:
${formatEventList(context.calendarEvents)}

Upcoming events (next 7 days):
${formatEventList(context.upcomingEvents || [])}

This month:
${formatEventList(context.monthlyEvents || [])}

YOUR TODOIST TASKS:
Today's tasks:
${formatTaskList(context.todayTasks || [])}

Upcoming tasks (next 7 days):
${formatTaskList(context.upcomingTasks || [])}

Unread emails: ${context.unreadEmailsCount}
Conversation state: ${JSON.stringify(state)}

USER REQUEST: "${sanitizedInput}"

AVAILABLE ACTIONS:

CALENDAR:
1. CREATE_EVENT: Schedule new calendar event. Data: { title: string, startTime: ISO8601, endTime?: ISO8601 }
2. DELETE_EVENT: Delete calendar event by title. Data: { query: string } - Use EXACT event title!
3. DELETE_EVENT_BY_ID: Delete calendar event by ID. Data: { eventId: string }
4. CLEAR_CALENDAR: Delete ALL today's calendar events (DANGEROUS)
5. DAILY_SUMMARY: Summarize today's calendar. Data: {}
6. UPCOMING_SUMMARY: Summarize next N days calendar. Data: { days: number }
7. MONTHLY_SUMMARY: Summarize month's calendar. Data: {}

TODOIST TASKS:
8. CREATE_TASK: Add a new Todoist task. Data: { content: string, due_string?: string (e.g. "today", "tomorrow", "next monday"), priority?: 1-4 }
9. COMPLETE_TASK: Mark a Todoist task as complete. Data: { taskId: string } - Use task ID from the list above!

OTHER:
10. DRAFT_EMAIL: Create email draft. Data: { to, subject, body }
11. NAVIGATE: Go to widget. Data: { target: 'widget-inbox'|'widget-schedule'|'widget-briefing'|'widget-tasks' }
12. SEARCH: Search Google. Data: { query }
13. QUERY: Answer questions using your knowledge of user's schedule and tasks
14. CLARIFY: Ask user for more info

RESPONSE FORMAT (JSON only):
{"intent":"ACTION_NAME","reply":"Natural response","data":{}}

CRITICAL RULES:
1. Distinguish between CALENDAR EVENTS and TODOIST TASKS - they are different systems!
2. For tasks (todos, things to do): Use CREATE_TASK or COMPLETE_TASK
3. For calendar events (meetings, appointments with specific times): Use CREATE_EVENT or DELETE_EVENT
4. For DELETE_EVENT: Use the EXACT event title from the calendar list
5. For COMPLETE_TASK: Use the EXACT task ID from the tasks list
6. For CREATE_TASK: Use natural due_string like "today", "tomorrow", "next friday" - Todoist understands these
7. Priority: 4 = urgent/red, 3 = high/orange, 2 = medium/blue, 1 = normal/no color
8. Be conversational but precise. Always confirm what you're doing.
9. If user says "add a task" or "remind me to", use CREATE_TASK
10. If user says "schedule a meeting" or "add to calendar", use CREATE_EVENT`;
}

async function executeIntent(parsed: AiResponse, originalInput: string): Promise<CommandResult> {
    const { intent, reply, data = {} } = parsed;

    switch (intent) {
        case "CLARIFY":
            return {
                success: true,
                message: reply,
                newState: { intent: "WAITING_CLARIFICATION", originalInput },
            };

        case "QUERY":
            return { success: true, message: reply };

        case "CREATE_EVENT": {
            const { title, startTime, endTime } = data as {
                title?: string;
                startTime?: string;
                endTime?: string;
            };
            if (title && startTime) {
                const res = await createEvent(title, startTime, endTime);
                if ("success" in res && res.success) {
                    return {
                        success: true,
                        message: reply,
                        actionType: "CALENDAR",
                        // Store what was just created so AI can reference it later
                        newState: {
                            lastCreatedEvent: { title, startTime, endTime },
                            lastAction: "CREATE_EVENT",
                        },
                    };
                }
                return { success: false, message: "error" in res ? res.error : "Failed to create event." };
            }
            return { success: false, message: "I need both a title and start time to create an event." };
        }

        case "DELETE_EVENT": {
            const { query } = data as { query?: string };
            if (query) {
                const res = await deleteEvent(query);
                if ("success" in res && res.success) {
                    const deletedName = res.deletedEvent || "event";
                    return {
                        success: true,
                        message: reply || `Deleted "${deletedName}" from your calendar.`,
                        actionType: "CALENDAR",
                        newState: { lastDeletedEvent: deletedName },
                    };
                }
                return { success: false, message: "error" in res ? res.error : "Failed to delete event." };
            }
            return { success: false, message: "I need to know which event to delete." };
        }

        case "DELETE_EVENT_BY_ID": {
            const { eventId } = data as { eventId?: string };
            if (eventId) {
                const res = await deleteEventById(eventId);
                if ("success" in res && res.success) {
                    const deletedName = res.deletedEvent || "event";
                    return {
                        success: true,
                        message: reply || `Deleted "${deletedName}" from your calendar.`,
                        actionType: "CALENDAR",
                        newState: { lastDeletedEvent: deletedName },
                    };
                }
                return { success: false, message: "error" in res ? res.error : "Failed to delete event." };
            }
            return { success: false, message: "I need the event ID to delete it." };
        }

        case "CLEAR_CALENDAR": {
            // Get preview of events to show user what will be deleted
            const preview = await getTodayEventsPreview();
            if ("error" in preview) {
                return { success: false, message: preview.error };
            }

            if (preview.count === 0) {
                return { success: true, message: "No events on your calendar today to clear." };
            }

            const eventList = preview.events.map((e) => e.summary).join(", ");
            return {
                success: true,
                message: `This will delete ${preview.count} event(s): ${eventList}. Reply "yes" to confirm or anything else to cancel.`,
                actionType: "CONFIRM_CLEAR_CALENDAR",
                newState: { pendingAction: "CLEAR_CALENDAR_CONFIRM" },
            };
        }

        case "DRAFT_EMAIL": {
            const { to, subject, body } = data as {
                to?: string;
                subject?: string;
                body?: string;
            };
            if (to) {
                const res = await createGmailDraft(to, subject || "No Subject", body || "");
                if ("success" in res && res.success) {
                    return { success: true, message: reply, actionType: "EMAIL" };
                }
                return { success: false, message: "error" in res ? res.error : "Failed to create draft." };
            }
            return { success: false, message: "I need a recipient email address." };
        }

        case "NAVIGATE":
            return {
                success: true,
                message: reply,
                actionType: "NAVIGATE",
                payload: { target: data.target },
            };

        case "CLEAR_TASKS":
            return { success: true, message: reply, actionType: "CLEAR_COMPLETED" };

        case "SEARCH":
            return {
                success: true,
                message: reply,
                actionType: "SEARCH",
                payload: { query: data.query },
            };

        case "CREATE_TASK": {
            const { content, due_string, priority } = data as {
                content?: string;
                due_string?: string;
                priority?: 1 | 2 | 3 | 4;
            };
            if (content) {
                const res = await createTodoistTask(content, {
                    due_string: due_string,
                    priority: priority,
                });
                if ("success" in res && res.data) {
                    return {
                        success: true,
                        message: reply || `Added task: "${content}"${due_string ? ` due ${due_string}` : ''}`,
                        actionType: "TASK",
                        newState: {
                            lastCreatedTask: { content, due_string, priority, id: res.data.id },
                            lastAction: "CREATE_TASK",
                        },
                    };
                }
                return { success: false, message: "error" in res ? res.error : "Failed to create task." };
            }
            return { success: false, message: "I need to know what task to create." };
        }

        case "COMPLETE_TASK": {
            const { taskId } = data as { taskId?: string };
            if (taskId) {
                const res = await completeTodoistTask(taskId);
                if ("success" in res) {
                    return {
                        success: true,
                        message: reply || "Task completed!",
                        actionType: "TASK",
                        newState: {
                            lastCompletedTaskId: taskId,
                            lastAction: "COMPLETE_TASK",
                        },
                    };
                }
                return { success: false, message: "error" in res ? res.error : "Failed to complete task." };
            }
            return { success: false, message: "I need to know which task to complete. Please specify the task." };
        }

        case "DAILY_SUMMARY":
        case "UPCOMING_SUMMARY":
        case "MONTHLY_SUMMARY":
            // The AI has already generated the summary in the reply
            return {
                success: true,
                message: reply,
                actionType: "SUMMARY",
            };

        case "TASK":
        default:
            return {
                success: true,
                message: reply,
                actionType: "TASK",
                payload: { title: (data.title as string) || originalInput },
            };
    }
}
