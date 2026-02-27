import { NextResponse } from "next/server";
import { getConversationCount } from "@/lib/conversation";

const startTime = Date.now();

export async function GET() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return NextResponse.json({
    status: "ok",
    version: "1.0.0",
    uptime: `${uptime}s`,
    conversations: getConversationCount(),
    timestamp: new Date().toISOString(),
    env: {
      hasPageToken: !!process.env.META_PAGE_ACCESS_TOKEN,
      hasAppSecret: !!process.env.META_APP_SECRET,
      hasVerifyToken: !!process.env.META_VERIFY_TOKEN,
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      verifyTokenLength: process.env.META_VERIFY_TOKEN?.length ?? 0,
    },
  });
}
