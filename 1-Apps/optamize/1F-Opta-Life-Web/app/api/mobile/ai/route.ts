import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processAiCommand } from "@/lib/ai-commander";
import { getSystemBriefing } from "@/lib/ai-summary";
import { getTodoistDashboardData } from "@/lib/todoist";
import { getCalendarEventsForDays, getUnreadEmails } from "@/lib/actions";

// ============================================================================
// Mobile AI API
// ============================================================================

/**
 * POST /api/mobile/ai
 * Process AI commands (Opta Chat) or get briefings
 * Body: { action: "command" | "briefing", command?: string, state?: object }
 */
export async function POST(request: NextRequest) {
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

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { action, command, state = {} } = body;

    switch (action) {
      case "command": {
        if (!command || typeof command !== "string") {
          return NextResponse.json(
            { error: "Command text is required" },
            { status: 400 },
          );
        }

        const result = await processAiCommand(command, state);

        return NextResponse.json({
          success: result.success,
          message: result.message,
          actionType: result.actionType || null,
          payload: result.payload || null,
          newState: result.newState || null,
        });
      }

      case "briefing": {
        // Gather context for briefing
        const [tasksResult, calendarResult, emailResult] = await Promise.all([
          getTodoistDashboardData().catch(() => null),
          getCalendarEventsForDays(3).catch(() => null),
          getUnreadEmails().catch(() => null),
        ]);

        const taskStats =
          tasksResult && "success" in tasksResult
            ? tasksResult.data.stats
            : { todayCount: 0, totalActive: 0 };

        const upcomingEvents =
          calendarResult && "success" in calendarResult
            ? calendarResult.events.slice(0, 3).map((e) => ({
                summary: e.summary || "Untitled",
                start: e.start?.dateTime || e.start?.date,
              }))
            : [];

        const unreadCount =
          emailResult && "success" in emailResult
            ? emailResult.emails.length
            : 0;

        // Generate AI briefing
        const { briefing } = await getSystemBriefing(
          taskStats.totalActive,
          taskStats.totalActive - taskStats.todayCount,
        );

        // Determine time of day greeting
        const hour = new Date().getHours();
        const timeOfDay =
          hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

        return NextResponse.json({
          success: true,
          briefing: {
            greeting: timeOfDay,
            summary: briefing,
            stats: {
              tasksToday: taskStats.todayCount,
              tasksTotal: taskStats.totalActive,
              upcomingEvents: upcomingEvents.length,
              unreadEmails: unreadCount,
            },
            nextEvents: upcomingEvents,
          },
        });
      }

      case "quick_status": {
        // Quick status for Siri - minimal data fetch
        const [tasksResult, calendarResult] = await Promise.all([
          getTodoistDashboardData().catch(() => null),
          getCalendarEventsForDays(1).catch(() => null),
        ]);

        const taskCount =
          tasksResult && "success" in tasksResult
            ? tasksResult.data.stats.todayCount
            : 0;

        const nextEvent =
          calendarResult &&
          "success" in calendarResult &&
          calendarResult.events.length > 0
            ? calendarResult.events[0].summary
            : null;

        const nextEventTime =
          calendarResult &&
          "success" in calendarResult &&
          calendarResult.events.length > 0
            ? calendarResult.events[0].start?.dateTime
            : null;

        // Generate spoken response for Siri
        let spokenResponse = `You have ${taskCount} task${taskCount !== 1 ? "s" : ""} today.`;

        if (nextEvent) {
          const time = nextEventTime
            ? new Date(nextEventTime).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
            : "sometime today";
          spokenResponse += ` Your next event is "${nextEvent}" at ${time}.`;
        } else {
          spokenResponse += ` No upcoming events on your calendar.`;
        }

        return NextResponse.json({
          success: true,
          status: {
            tasksToday: taskCount,
            nextEvent,
            nextEventTime,
          },
          spokenResponse,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("AI API error:", error);
    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/mobile/ai
 * Quick endpoint for simple queries
 * Query params: type=briefing|status
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

    if (error || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "status";

    // Redirect to POST handler for actual processing
    const fakeRequest = {
      json: async () => ({
        action: type === "briefing" ? "briefing" : "quick_status",
      }),
      url: request.url,
    } as NextRequest;

    return POST(fakeRequest);
  } catch (error) {
    console.error("AI API error:", error);
    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 },
    );
  }
}
