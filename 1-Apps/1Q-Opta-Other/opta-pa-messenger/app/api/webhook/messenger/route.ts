import { NextRequest, NextResponse } from "next/server";
import { generateResponse } from "@/lib/anthropic";
import { sendMessage, sendTypingIndicator, verifyWebhookSignature } from "@/lib/messenger";
import { getHistory, addMessage } from "@/lib/conversation";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/**
 * GET handler: Webhook verification
 * Meta sends: hub.mode=subscribe, hub.challenge, hub.verify_token
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  log(`Webhook verification attempt: mode=${mode}, token=${token ? "present" : "missing"}`);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    log("✅ Webhook verified successfully");
    return new NextResponse(challenge, { status: 200 });
  } else {
    log("❌ Webhook verification failed");
    return new NextResponse("Forbidden", { status: 403 });
  }
}

/**
 * POST handler: Receive incoming messages from Meta Messenger API
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      log("❌ Invalid webhook signature");
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Parse webhook payload
    const body = JSON.parse(rawBody);

    // Meta sends webhook in this format
    if (body.object !== "page") {
      log("⚠️ Webhook not for page object");
      return NextResponse.json({ status: "ignored" });
    }

    // Process each entry
    for (const entry of body.entry || []) {
      for (const messagingEvent of entry.messaging || []) {
        // Handle incoming message
        if (messagingEvent.message && !messagingEvent.message.is_echo) {
          // Process message asynchronously to avoid Meta timeout
          processMessage(messagingEvent).catch((error) => {
            log(`❌ Error processing message: ${error.message}`);
          });
        }
      }
    }

    // Return 200 immediately (Meta requires fast response)
    return NextResponse.json({ status: "received" });
  } catch (error: any) {
    log(`❌ Webhook error: ${error.message}`);
    // Still return 200 to avoid Meta retrying
    return NextResponse.json({ status: "error", message: error.message });
  }
}

/**
 * Process incoming message asynchronously
 */
async function processMessage(messagingEvent: any) {
  const senderId = messagingEvent.sender?.id;
  const messageText = messagingEvent.message?.text;

  if (!senderId || !messageText) {
    log("⚠️ Missing sender ID or message text");
    return;
  }

  log(`📩 Message from ${senderId}: ${messageText.slice(0, 80)}`);

  try {
    // Show typing indicator
    await sendTypingIndicator(senderId, true);

    // Get conversation history
    const history = getHistory(senderId);

    // Add user message to history
    addMessage(senderId, "user", messageText);

    // Generate response with Claude
    const response = await generateResponse(
      [...history, { role: "user" as const, content: messageText }],
      SYSTEM_PROMPT
    );

    log(`🤖 Response to ${senderId}: ${response.slice(0, 80)}`);

    // Add assistant response to history
    addMessage(senderId, "assistant", response);

    // Turn off typing indicator
    await sendTypingIndicator(senderId, false);

    // Send response
    await sendMessage(senderId, response);

    log(`✅ Message processed successfully for ${senderId}`);
  } catch (error: any) {
    log(`❌ Error processing message for ${senderId}: ${error.message}`);

    // Turn off typing indicator
    await sendTypingIndicator(senderId, false).catch(() => {});

    // Send error message to user
    await sendMessage(
      senderId,
      "Sorry, I encountered an error processing your message. Please try again."
    ).catch(() => {});
  }
}
