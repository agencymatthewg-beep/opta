import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUnreadEmails, createGmailDraft } from "@/lib/actions";

// ============================================================================
// Mobile Email API
// ============================================================================

/**
 * GET /api/mobile/email
 * Get unread emails from primary inbox
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

    const result = await getUnreadEmails();

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Transform emails for mobile consumption
    const emails = result.emails.map((thread) => {
      const firstMessage = thread.messages?.[0];
      const headers = firstMessage?.payload?.headers || [];

      const getHeader = (name: string) =>
        headers.find((h) => h.name === name)?.value || null;

      const from = getHeader("From") || "Unknown";
      const senderName = from.split("<")[0].trim().replace(/"/g, "");
      const senderEmail = from.match(/<(.+)>/)?.[1] || from;

      return {
        id: thread.id,
        threadId: thread.id,
        snippet: thread.snippet || "",
        subject: getHeader("Subject") || "(No Subject)",
        from: {
          name: senderName,
          email: senderEmail,
        },
        date: getHeader("Date"),
      };
    });

    return NextResponse.json({
      success: true,
      emails,
      count: emails.length,
    });
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/mobile/email
 * Create an email draft
 * Body: { action: "draft", to, subject, body }
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
    const { action, to, subject, body: emailBody } = body;

    if (action === "draft") {
      if (!to || typeof to !== "string") {
        return NextResponse.json(
          { error: "Recipient email is required" },
          { status: 400 },
        );
      }

      const result = await createGmailDraft(
        to,
        subject || "No Subject",
        emailBody || "",
      );

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Draft created for ${to}`,
      });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json(
      { error: "Failed to process email request" },
      { status: 500 },
    );
  }
}
