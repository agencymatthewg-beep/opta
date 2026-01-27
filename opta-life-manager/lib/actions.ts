"use server";

import { auth } from "@/auth";
import { google, calendar_v3, gmail_v1 } from "googleapis";
import { UnifiedEmail, AccountColor } from "@/types/accounts";

// ============================================================================
// Constants
// ============================================================================

const MAX_CALENDAR_RESULTS = 50;
const MAX_EMAIL_RESULTS = 5;
const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000; // 1 hour
const MAX_BULK_DELETE = 10; // Safety limit for bulk deletions

// ============================================================================
// Types
// ============================================================================

type ActionSuccess<T = object> = { success: true } & T;
type ActionError = { error: string };
type ActionResult<T = object> = ActionSuccess<T> | ActionError;

export type CalendarResult = ActionSuccess<{ events: calendar_v3.Schema$Event[] }> | ActionError;
export type EventResult = ActionSuccess<{ deletedCount?: number; deletedEvent?: string }> | ActionError;
export type EmailResult = ActionSuccess<{ emails: gmail_v1.Schema$Thread[] }> | ActionError;

// ============================================================================
// Utilities
// ============================================================================

async function getAuthenticatedSession(): Promise<{ accessToken: string } | { error: string }> {
    const session = await auth();
    if (!session?.accessToken) {
        return { error: "Not authenticated" };
    }
    if (session.error === "RefreshAccessTokenError") {
        return { error: "Session expired. Please sign out and sign back in to reconnect your Google account." };
    }
    return { accessToken: session.accessToken };
}

function getAuthenticatedCalendarClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: "v3", auth: oauth2Client });
}

function getAuthenticatedGmailClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.gmail({ version: "v1", auth: oauth2Client });
}

function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "object" && error !== null) {
        const anyError = error as Record<string, unknown>;
        if (typeof anyError.message === "string") return anyError.message;
        if (Array.isArray(anyError.errors) && anyError.errors[0]?.message) {
            return String(anyError.errors[0].message);
        }
    }
    return "Unknown error";
}

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email.trim());
}

// Sanitize header values to prevent header injection
function sanitizeHeaderValue(value: string): string {
    return value.replace(/[\r\n]/g, " ").trim();
}

// Parse human-readable time strings into a Date
function parseTimeString(timeStr: string, baseDate: Date = new Date()): Date | null {
    const date = new Date(baseDate);
    const input = timeStr.trim();

    // Try ISO format first
    const isoDate = new Date(input);
    if (!isNaN(isoDate.getTime()) && input.includes("-")) return isoDate;

    // Extract time from strings like "6:30 PM", "6:30PM", "6:30 PM Today", "5pm", "17:00"
    const timeRegex = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;
    const match = input.match(timeRegex);

    if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3]?.toLowerCase();

        // Validate hours and minutes
        if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            return null;
        }

        // Handle AM/PM conversion
        if (period === "pm" && hours !== 12) hours += 12;
        if (period === "am" && hours === 12) hours = 0;

        date.setHours(hours, minutes, 0, 0);
        return date;
    }

    return null;
}

// ============================================================================
// Calendar Actions
// ============================================================================

export async function getCalendarEvents(): Promise<CalendarResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    const calendar = getAuthenticatedCalendarClient(authResult.accessToken);

    try {
        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: new Date().toISOString(),
            maxResults: MAX_EMAIL_RESULTS,
            singleEvents: true,
            orderBy: "startTime",
        });

        return { success: true, events: response.data.items || [] };
    } catch (error) {
        console.error("Failed to fetch calendar events:", extractErrorMessage(error));
        return { error: "Failed to fetch events" };
    }
}

export async function getCalendarEventsForDays(days: number): Promise<CalendarResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    const calendar = getAuthenticatedCalendarClient(authResult.accessToken);

    try {
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + days);
        endDate.setHours(23, 59, 59, 999);

        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            maxResults: MAX_CALENDAR_RESULTS,
            singleEvents: true,
            orderBy: "startTime",
        });

        return { success: true, events: response.data.items || [] };
    } catch (error) {
        console.error("Failed to fetch calendar events:", extractErrorMessage(error));
        return { error: "Failed to fetch events" };
    }
}

export async function getMonthlyCalendarEvents(): Promise<CalendarResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    const calendar = getAuthenticatedCalendarClient(authResult.accessToken);

    try {
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: endOfMonth.toISOString(),
            maxResults: MAX_CALENDAR_RESULTS,
            singleEvents: true,
            orderBy: "startTime",
        });

        return { success: true, events: response.data.items || [] };
    } catch (error) {
        console.error("Failed to fetch monthly events:", extractErrorMessage(error));
        return { error: "Failed to fetch events" };
    }
}

export async function createEvent(
    summary: string,
    startTime: string,
    endTime?: string
): Promise<ActionResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    // Validate inputs
    if (!summary || summary.trim().length === 0) {
        return { error: "Event title is required" };
    }
    if (summary.length > 1024) {
        return { error: "Event title is too long (max 1024 characters)" };
    }

    const calendar = getAuthenticatedCalendarClient(authResult.accessToken);

    try {
        const start = parseTimeString(startTime);
        if (!start) {
            return { error: `Could not parse start time: "${startTime}"` };
        }

        let end: Date;
        if (endTime) {
            const parsedEnd = parseTimeString(endTime, start);
            if (!parsedEnd) {
                return { error: `Could not parse end time: "${endTime}"` };
            }
            end = parsedEnd;
            // If end is before start, assume it's the next day
            if (end <= start) {
                end.setDate(end.getDate() + 1);
            }
        } else {
            end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
        }

        await calendar.events.insert({
            calendarId: "primary",
            requestBody: {
                summary: sanitizeHeaderValue(summary),
                start: { dateTime: start.toISOString() },
                end: { dateTime: end.toISOString() },
            },
        });
        return { success: true };
    } catch (error) {
        console.error("Failed to create event:", extractErrorMessage(error));
        return { error: extractErrorMessage(error) };
    }
}

// Fuzzy match helper - checks if query words appear in the event summary
function fuzzyMatch(summary: string, query: string): boolean {
    const summaryLower = summary.toLowerCase();
    const queryLower = query.toLowerCase();

    // Direct substring match
    if (summaryLower.includes(queryLower)) return true;

    // Check if all significant words in query appear in summary
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const matchedWords = queryWords.filter(word => summaryLower.includes(word));

    // Match if at least 50% of query words are found, or at least 1 word for short queries
    return queryWords.length <= 2
        ? matchedWords.length >= 1
        : matchedWords.length >= queryWords.length * 0.5;
}

export async function deleteEvent(
    query: string,
    deleteAll: boolean = false
): Promise<EventResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    // Validate query
    if (!query || query.trim().length === 0) {
        return { error: "Search query is required" };
    }

    const calendar = getAuthenticatedCalendarClient(authResult.accessToken);

    try {
        // Fetch events for the next 30 days (covers "tomorrow" and beyond)
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + 30);

        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            maxResults: MAX_CALENDAR_RESULTS,
            singleEvents: true,
            orderBy: "startTime",
        });

        const allEvents = response.data.items || [];

        // Use local fuzzy matching instead of Google's unreliable `q` parameter
        const matchingEvents = allEvents.filter(event => {
            const summary = event.summary || "";
            return fuzzyMatch(summary, query);
        });

        if (matchingEvents.length === 0) {
            // Provide helpful suggestions
            const eventNames = allEvents.slice(0, 5).map(e => e.summary).filter(Boolean);
            const suggestion = eventNames.length > 0
                ? ` Available events: ${eventNames.join(", ")}`
                : "";
            return { error: `No events found matching "${query}".${suggestion}` };
        }

        if (deleteAll) {
            // Safety check: limit bulk deletions
            if (matchingEvents.length > MAX_BULK_DELETE) {
                return {
                    error: `Too many events (${matchingEvents.length}) match your query. Please be more specific or delete individually. Max bulk delete: ${MAX_BULK_DELETE}`,
                };
            }

            let deletedCount = 0;
            for (const event of matchingEvents) {
                if (event.id) {
                    await calendar.events.delete({
                        calendarId: "primary",
                        eventId: event.id,
                    });
                    deletedCount++;
                }
            }
            return { success: true, deletedCount };
        } else {
            // Delete only the first matching event
            const event = matchingEvents[0];
            if (event.id) {
                await calendar.events.delete({
                    calendarId: "primary",
                    eventId: event.id,
                });
                return { success: true, deletedEvent: event.summary || "Untitled event" };
            }
            return { error: "Event has no ID" };
        }
    } catch (error) {
        console.error("Failed to delete event:", extractErrorMessage(error));
        return { error: extractErrorMessage(error) };
    }
}

// Delete event by ID directly (more reliable)
export async function deleteEventById(eventId: string): Promise<EventResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    if (!eventId || eventId.trim().length === 0) {
        return { error: "Event ID is required" };
    }

    const calendar = getAuthenticatedCalendarClient(authResult.accessToken);

    try {
        // First get the event to confirm it exists and get its name
        const event = await calendar.events.get({
            calendarId: "primary",
            eventId: eventId,
        });

        await calendar.events.delete({
            calendarId: "primary",
            eventId: eventId,
        });

        return { success: true, deletedEvent: event.data.summary || "Untitled event" };
    } catch (error) {
        console.error("Failed to delete event by ID:", extractErrorMessage(error));
        return { error: extractErrorMessage(error) };
    }
}

export async function getTodayEventsPreview(): Promise<{
    events: { id: string; summary: string }[];
    count: number;
} | { error: string }> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    const calendar = getAuthenticatedCalendarClient(authResult.accessToken);

    try {
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
        });

        const events = response.data.items || [];
        return {
            events: events.map((e) => ({
                id: e.id || "",
                summary: e.summary || "Untitled",
            })),
            count: events.length,
        };
    } catch (error) {
        console.error("Failed to preview events:", extractErrorMessage(error));
        return { error: extractErrorMessage(error) };
    }
}

export async function clearTodayEvents(confirmed: boolean = false): Promise<EventResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    // Require explicit confirmation for destructive operation
    if (!confirmed) {
        return { error: "CONFIRMATION_REQUIRED" };
    }

    const calendar = getAuthenticatedCalendarClient(authResult.accessToken);

    try {
        const now = new Date();
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: endOfDay.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
        });

        const events = response.data.items || [];

        if (events.length === 0) {
            return { success: true, deletedCount: 0 };
        }

        let deletedCount = 0;
        for (const event of events) {
            if (event.id) {
                await calendar.events.delete({
                    calendarId: "primary",
                    eventId: event.id,
                });
                deletedCount++;
            }
        }
        return { success: true, deletedCount };
    } catch (error) {
        console.error("Failed to clear events:", extractErrorMessage(error));
        return { error: extractErrorMessage(error) };
    }
}

// ============================================================================
// Gmail Actions
// ============================================================================

export async function createGmailDraft(
    to: string,
    subject: string,
    body: string
): Promise<ActionResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    // Validate email address
    if (!to || !isValidEmail(to)) {
        return { error: `Invalid email address: "${to}"` };
    }

    // Validate subject (prevent header injection)
    if (subject && subject.length > 998) {
        return { error: "Subject line is too long (max 998 characters)" };
    }

    const gmail = getAuthenticatedGmailClient(authResult.accessToken);

    // Sanitize headers to prevent injection
    const sanitizedTo = sanitizeHeaderValue(to);
    const sanitizedSubject = sanitizeHeaderValue(subject || "No Subject");

    const message = [
        `To: ${sanitizedTo}`,
        `Subject: ${sanitizedSubject}`,
        `Content-Type: text/plain; charset=utf-8`,
        `MIME-Version: 1.0`,
        ``,
        body || "",
    ].join("\r\n"); // Use CRLF for email headers

    // Base64url encode the message
    const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    try {
        await gmail.users.drafts.create({
            userId: "me",
            requestBody: {
                message: {
                    raw: encodedMessage,
                },
            },
        });
        return { success: true };
    } catch (error) {
        console.error("Failed to create draft:", extractErrorMessage(error));
        return { error: extractErrorMessage(error) };
    }
}

export async function getUnreadEmails(): Promise<EmailResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    const gmail = getAuthenticatedGmailClient(authResult.accessToken);

    try {
        const response = await gmail.users.threads.list({
            userId: "me",
            q: "is:unread category:primary",
            maxResults: MAX_EMAIL_RESULTS,
        });

        const threads = response.data.threads || [];

        const detailedThreads = await Promise.all(
            threads.map(async (thread) => {
                if (!thread.id) {
                    return { id: "", snippet: "Error: missing thread ID" };
                }
                try {
                    const detail = await gmail.users.threads.get({
                        userId: "me",
                        id: thread.id,
                        format: "metadata",
                        metadataHeaders: ["Subject", "From"],
                    });
                    return detail.data;
                } catch {
                    return { id: thread.id, snippet: "Error fetching details" };
                }
            })
        );

        return { success: true, emails: detailedThreads as gmail_v1.Schema$Thread[] };
    } catch (error) {
        console.error("Failed to fetch emails:", extractErrorMessage(error));
        return { error: "Failed to fetch emails" };
    }
}

// ============================================================================
// Multi-Account Email Actions
// ============================================================================

interface LinkedAccountToken {
    email: string;
    accessToken: string;
    color: AccountColor;
}

export type UnifiedEmailResult = ActionSuccess<{ emails: UnifiedEmail[] }> | ActionError;

// Fetch emails from a single account using provided token
async function fetchEmailsForAccount(
    accessToken: string,
    accountEmail: string,
    accountColor: AccountColor
): Promise<UnifiedEmail[]> {
    const gmail = getAuthenticatedGmailClient(accessToken);

    try {
        const response = await gmail.users.threads.list({
            userId: "me",
            q: "is:unread category:primary",
            maxResults: MAX_EMAIL_RESULTS,
        });

        const threads = response.data.threads || [];

        const emails = await Promise.all(
            threads.map(async (thread): Promise<UnifiedEmail | null> => {
                if (!thread.id) return null;

                try {
                    const detail = await gmail.users.threads.get({
                        userId: "me",
                        id: thread.id,
                        format: "metadata",
                        metadataHeaders: ["Subject", "From", "Date"],
                    });

                    const headers = detail.data.messages?.[0]?.payload?.headers || [];
                    const subject = headers.find(h => h.name === "Subject")?.value || "(No Subject)";
                    const from = headers.find(h => h.name === "From")?.value || "Unknown";
                    const dateStr = headers.find(h => h.name === "Date")?.value;
                    const senderName = from.split("<")[0].trim().replace(/"/g, "");

                    return {
                        id: detail.data.id || thread.id,
                        accountEmail,
                        accountColor,
                        subject,
                        from,
                        senderName,
                        snippet: detail.data.snippet || "",
                        date: dateStr ? new Date(dateStr) : new Date(),
                        threadId: thread.id,
                    };
                } catch {
                    return null;
                }
            })
        );

        return emails.filter((e): e is UnifiedEmail => e !== null);
    } catch (error) {
        console.error(`Failed to fetch emails for ${accountEmail}:`, extractErrorMessage(error));
        return [];
    }
}

// Fetch emails from primary account
export async function getPrimaryAccountEmails(): Promise<UnifiedEmailResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    const session = await auth();
    const primaryEmail = session?.user?.email || "Primary";

    const emails = await fetchEmailsForAccount(
        authResult.accessToken,
        primaryEmail,
        "blue" // Primary account is always blue
    );

    return { success: true, emails };
}

// Fetch emails from linked accounts (tokens passed from client)
export async function getLinkedAccountEmails(
    accounts: LinkedAccountToken[]
): Promise<UnifiedEmailResult> {
    // Ensure user is authenticated before processing linked accounts
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    const allEmails: UnifiedEmail[] = [];

    // Fetch from all linked accounts in parallel
    const results = await Promise.all(
        accounts.map(account =>
            fetchEmailsForAccount(account.accessToken, account.email, account.color)
        )
    );

    for (const emails of results) {
        allEmails.push(...emails);
    }

    return { success: true, emails: allEmails };
}

// Combined function to get all emails (primary + linked)
export async function getAllInboxEmails(
    linkedAccounts: LinkedAccountToken[]
): Promise<UnifiedEmailResult> {
    const authResult = await getAuthenticatedSession();
    if ("error" in authResult) return { error: authResult.error };

    const session = await auth();
    const primaryEmail = session?.user?.email || "Primary";

    // Fetch from primary and all linked accounts in parallel
    const [primaryEmails, ...linkedResults] = await Promise.all([
        fetchEmailsForAccount(authResult.accessToken, primaryEmail, "blue"),
        ...linkedAccounts.map(account =>
            fetchEmailsForAccount(account.accessToken, account.email, account.color)
        ),
    ]);

    // Combine all emails
    const allEmails = [...primaryEmails];
    for (const emails of linkedResults) {
        allEmails.push(...emails);
    }

    // Sort by date (newest first)
    allEmails.sort((a, b) => b.date.getTime() - a.date.getTime());

    return { success: true, emails: allEmails };
}
