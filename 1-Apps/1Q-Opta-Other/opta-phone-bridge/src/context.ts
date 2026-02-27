import { readFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";

const BASE = join(homedir(), "Synced/Opta/1-Apps/opta-phone-bridge/.context");

async function tryRead(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

export async function buildSystemPrompt(): Promise<string> {
  const [soul, user, memory] = await Promise.all([
    tryRead(join(BASE, "SOUL.md")),
    tryRead(join(BASE, "USER.md")),
    tryRead(join(BASE, "MEMORY_BRIEF.md")),
  ]);

  const sections: string[] = [
    `You are Opta, Matthew's personal AI assistant. You are currently on a PHONE CALL with Matthew.

IMPORTANT VOICE CALL RULES:
- Keep responses SHORT — 1-3 sentences max unless asked for detail
- Speak naturally, conversationally — no bullet points, no markdown
- No lists, no headers, just natural speech
- Be direct and precise (that's your personality)
- If something needs a long explanation, offer to send it to Telegram instead`,
  ];

  if (soul) sections.push(`## Your Personality\n${soul}`);
  if (user) sections.push(`## About Matthew\n${user}`);
  if (memory) sections.push(`## Key Context\n${memory}`);

  return sections.join("\n\n---\n\n");
}
