import Anthropic from "@anthropic-ai/sdk";

const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY not set");
  throw new Error("ANTHROPIC_API_KEY is required");
}

const anthropic = new Anthropic({ apiKey: API_KEY });

const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 1024;

interface Message {
  role: "user" | "assistant";
  content: string;
}

export async function generateResponse(
  messages: Message[],
  systemPrompt: string
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: messages,
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    return content.text;
  } catch (error: any) {
    console.error("Anthropic API error:", error.message);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}
