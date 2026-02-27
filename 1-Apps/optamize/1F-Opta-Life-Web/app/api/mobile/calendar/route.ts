import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
    getCalendarEvents,
    getCalendarEventsForDays,
    getMonthlyCalendarEvents,
    createEvent,
    deleteEvent,
    deleteEventById,
} from "@/lib/actions";

// ============================================================================
// Mobile Calendar API
// ============================================================================

/**
 * GET /api/mobile/calendar
 * Get calendar events with optional range filter
 * Query params: range=today|week|month|days&days=N
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const range = searchParams.get("range") || "today";
        const days = parseInt(searchParams.get("days") || "7", 10);

        let result;

        switch (range) {
            case "today":
                result = await getCalendarEvents();
                break;
            case "week":
                result = await getCalendarEventsForDays(7);
                break;
            case "month":
                result = await getMonthlyCalendarEvents();
                break;
            case "days":
                result = await getCalendarEventsForDays(Math.min(days, 30));
                break;
            default:
                result = await getCalendarEvents();
                break;
        }

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        // Transform events for mobile consumption
        const events = result.events.map((event) => ({
            id: event.id,
            summary: event.summary || "Untitled Event",
            description: event.description || null,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            isAllDay: !event.start?.dateTime && !!event.start?.date,
            location: event.location || null,
            htmlLink: event.htmlLink || null,
        }));

        return NextResponse.json({
            success: true,
            events,
            count: events.length,
        });
    } catch (error) {
        console.error("Calendar API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch calendar events" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/mobile/calendar
 * Create a new calendar event
 * Body: { summary, startTime, endTime? }
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const body = await request.json();
        const { summary, startTime, endTime } = body;

        if (!summary || typeof summary !== "string") {
            return NextResponse.json(
                { error: "Event summary is required" },
                { status: 400 }
            );
        }

        if (!startTime) {
            return NextResponse.json(
                { error: "Start time is required" },
                { status: 400 }
            );
        }

        const result = await createEvent(summary, startTime, endTime);

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `Created event: "${summary}"`,
        });
    } catch (error) {
        console.error("Calendar API error:", error);
        return NextResponse.json(
            { error: "Failed to create event" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/mobile/calendar
 * Delete a calendar event
 * Query params: id=eventId OR query=searchText
 */
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get("id");
        const query = searchParams.get("query");

        if (eventId) {
            const result = await deleteEventById(eventId);

            if ("error" in result) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: `Deleted event: "${result.deletedEvent}"`,
            });
        }

        if (query) {
            const result = await deleteEvent(query);

            if ("error" in result) {
                return NextResponse.json({ error: result.error }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                message: `Deleted event: "${result.deletedEvent}"`,
            });
        }

        return NextResponse.json(
            { error: "Either event ID or search query is required" },
            { status: 400 }
        );
    } catch (error) {
        console.error("Calendar API error:", error);
        return NextResponse.json(
            { error: "Failed to delete event" },
            { status: 500 }
        );
    }
}
