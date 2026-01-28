"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCalendarEvents, getUnreadEmails } from "@/lib/actions";
import { UnifiedEmail, InboxSummary } from "@/types/accounts";

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const model = genAI?.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function getSystemBriefing(tasksCount: number, completedCount: number) {
    // Aggregate data from all sources (Server-side)
    const calendarData = await getCalendarEvents();
    const emailData = await getUnreadEmails();

    const events = "error" in calendarData ? [] : calendarData.events;
    const emails = "error" in emailData ? [] : emailData.emails;

    // Determine time of day
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    // Construct the narrative
    let narrative = `${timeGreeting}, Matthew. `;

    // 1. Task Status
    const pending = tasksCount - completedCount;
    if (pending === 0 && tasksCount > 0) {
        narrative += "Your task list is clear. Excellent efficiency. ";
    } else if (pending > 0) {
        narrative += `You have ${pending} pending task${pending > 1 ? 's' : ''} requiring attention. `;
    } else {
        narrative += "Systems are idle waiting for input. ";
    }

    // 2. Calendar Status
    if (events.length > 0) {
        const nextEvent = events[0];
        const startTime = nextEvent.start?.dateTime || nextEvent.start?.date;
        if (startTime) {
            const eventTime = new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
            narrative += `Your next scheduled event is "${nextEvent.summary}" at ${eventTime}. `;
        } else {
            narrative += `Your next scheduled event is "${nextEvent.summary}". `;
        }
    } else {
        narrative += "Your schedule is currently clear. ";
    }

    // 3. Email Status
    if (emails.length > 0) {
        narrative += `There are ${emails.length} unread priority messages in your inbox. `;
    } else {
        narrative += "Communications are up to date. ";
    }

    narrative += "Opta is online and assisting.";

    return { briefing: narrative };
}

// ============================================================================
// Multi-Inbox AI Summary
// ============================================================================

export type SummaryResult =
    | { success: true; summary: InboxSummary }
    | { error: string };

export async function generateInboxSummary(emails: UnifiedEmail[]): Promise<SummaryResult> {
    if (!model) {
        return { error: "AI not configured" };
    }

    if (emails.length === 0) {
        return {
            success: true,
            summary: {
                urgent: [],
                actionItems: [],
                themes: [],
                overview: "All inboxes are clear. No unread emails.",
                generatedAt: new Date(),
            },
        };
    }

    // Group emails by account
    const emailsByAccount = new Map<string, UnifiedEmail[]>();
    for (const email of emails) {
        const existing = emailsByAccount.get(email.accountEmail) || [];
        existing.push(email);
        emailsByAccount.set(email.accountEmail, existing);
    }

    // Build email context for AI
    const accountSummaries = Array.from(emailsByAccount.entries())
        .map(([account, accountEmails]) => {
            const emailList = accountEmails
                .slice(0, 5) // Limit to 5 per account
                .map((e, i) => `  ${i + 1}. From: ${e.senderName}\n     Subject: ${e.subject}\n     Preview: ${e.snippet.slice(0, 100)}...`)
                .join("\n");
            return `Account: ${account} (${accountEmails.length} unread)\n${emailList}`;
        })
        .join("\n\n");

    const prompt = `You are analyzing unread emails from ${emailsByAccount.size} different inboxes for a single user.

${accountSummaries}

Provide a holistic analysis in JSON format with these fields:
{
  "urgent": ["string array of 1-3 most urgent items requiring immediate attention"],
  "actionItems": ["string array of 2-4 clear action items with suggested priorities"],
  "themes": ["string array of 2-3 common themes or patterns across the inboxes"],
  "overview": "A concise 2-3 sentence summary of the inbox state, highlighting anything important"
}

Guidelines:
- Identify urgency based on sender importance, subject keywords (urgent, deadline, action required)
- Note any cross-account patterns (e.g., work bleeding into personal, recurring senders)
- Keep action items specific and actionable
- The overview should help the user quickly understand their inbox state

Respond ONLY with valid JSON, no markdown or explanation.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Parse the JSON response
        const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);

        // Validate structure
        if (!parsed.urgent || !parsed.actionItems || !parsed.themes || !parsed.overview) {
            throw new Error("Invalid response structure");
        }

        return {
            success: true,
            summary: {
                urgent: Array.isArray(parsed.urgent) ? parsed.urgent : [],
                actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
                themes: Array.isArray(parsed.themes) ? parsed.themes : [],
                overview: String(parsed.overview),
                generatedAt: new Date(),
            },
        };
    } catch (error) {
        console.error("AI summary generation failed:", error);
        return { error: "Failed to generate summary" };
    }
}

// Quick summary for single account (when only primary is available)
export async function generateQuickSummary(emails: UnifiedEmail[]): Promise<string> {
    if (emails.length === 0) {
        return "Inbox zero achieved.";
    }

    if (emails.length <= 3) {
        return `${emails.length} unread email${emails.length === 1 ? "" : "s"} to review.`;
    }

    if (!model) {
        return `${emails.length} unread emails across your inboxes.`;
    }

    const senders = [...new Set(emails.map(e => e.senderName))].slice(0, 5);
    const prompt = `In one short sentence (max 15 words), summarize ${emails.length} unread emails from senders including: ${senders.join(", ")}. Focus on what needs attention.`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch {
        return `${emails.length} unread emails need your attention.`;
    }
}
