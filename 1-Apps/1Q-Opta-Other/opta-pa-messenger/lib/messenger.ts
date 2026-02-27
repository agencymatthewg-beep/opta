import crypto from "crypto";

const PAGE_ACCESS_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET;
const GRAPH_API_URL = "https://graph.facebook.com/v21.0/me/messages";
const MAX_MESSAGE_LENGTH = 2000;

if (!PAGE_ACCESS_TOKEN) {
  console.error("❌ META_PAGE_ACCESS_TOKEN not set");
}

if (!APP_SECRET) {
  console.warn("⚠️ META_APP_SECRET not set — webhook signature verification disabled");
}

/**
 * Send a text message via Messenger Send API
 */
export async function sendMessage(recipientId: string, text: string): Promise<void> {
  if (!PAGE_ACCESS_TOKEN) {
    throw new Error("META_PAGE_ACCESS_TOKEN not configured");
  }

  // If message is too long, chunk it
  if (text.length > MAX_MESSAGE_LENGTH) {
    const chunks = chunkMessage(text);
    for (const chunk of chunks) {
      await sendSingleMessage(recipientId, chunk);
      // Small delay between chunks to maintain order
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } else {
    await sendSingleMessage(recipientId, text);
  }
}

async function sendSingleMessage(recipientId: string, text: string): Promise<void> {
  const payload = {
    recipient: { id: recipientId },
    message: { text },
  };

  const response = await fetch(`${GRAPH_API_URL}?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Messenger Send API error:", error);
    throw new Error(`Failed to send message: ${response.statusText}`);
  }
}

/**
 * Send typing indicator (on/off)
 */
export async function sendTypingIndicator(
  recipientId: string,
  isTyping: boolean
): Promise<void> {
  if (!PAGE_ACCESS_TOKEN) {
    throw new Error("META_PAGE_ACCESS_TOKEN not configured");
  }

  const payload = {
    recipient: { id: recipientId },
    sender_action: isTyping ? "typing_on" : "typing_off",
  };

  const response = await fetch(`${GRAPH_API_URL}?access_token=${PAGE_ACCESS_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error("Failed to send typing indicator:", response.statusText);
  }
}

/**
 * Verify webhook signature (X-Hub-Signature-256)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!APP_SECRET) {
    // Skip verification if no secret configured (dev mode)
    console.warn("⚠️ Skipping signature verification: META_APP_SECRET not set");
    return true;
  }
  if (!signature) {
    console.warn("⚠️ No signature header present");
    return false;
  }

  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", APP_SECRET)
    .update(rawBody)
    .digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Split a long message into chunks that fit Messenger's limit
 */
function chunkMessage(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MESSAGE_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a sentence boundary
    let splitIndex = MAX_MESSAGE_LENGTH;
    const lastPeriod = remaining.lastIndexOf(".", MAX_MESSAGE_LENGTH);
    const lastNewline = remaining.lastIndexOf("\n", MAX_MESSAGE_LENGTH);

    if (lastPeriod > MAX_MESSAGE_LENGTH * 0.7) {
      splitIndex = lastPeriod + 1;
    } else if (lastNewline > MAX_MESSAGE_LENGTH * 0.7) {
      splitIndex = lastNewline + 1;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}
