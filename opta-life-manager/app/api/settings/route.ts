import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";

const ENV_FILE = join(process.cwd(), ".env.local");

const MANAGED_KEYS = [
  "TODOIST_API_TOKEN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GEMINI_API_KEY",
  "AUTH_SECRET",
  "NEXTAUTH_SECRET",
];

async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const content = await readFile(ENV_FILE, "utf-8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

async function writeEnvFile(env: Record<string, string>): Promise<void> {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (value.includes(" ") || value.includes('"') || value.includes("'") || value.includes("#")) {
      lines.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  await writeFile(ENV_FILE, lines.join("\n") + "\n", "utf-8");
}

// GET: Return which keys are configured (not their values)
export async function GET() {
  const env = await readEnvFile();
  const status: Record<string, boolean> = {};
  for (const key of MANAGED_KEYS) {
    status[key] = !!env[key] && env[key].length > 0;
  }
  return NextResponse.json({ success: true, keys: status });
}

// POST: Save keys to .env.local
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updates: Record<string, string> = body.settings || {};

    // Validate: only allow managed keys
    for (const key of Object.keys(updates)) {
      if (!MANAGED_KEYS.includes(key)) {
        return NextResponse.json(
          { success: false, error: `Unknown key: ${key}` },
          { status: 400 }
        );
      }
    }

    // Read existing env, merge updates
    const env = await readEnvFile();
    for (const [key, value] of Object.entries(updates)) {
      if (value && value.trim().length > 0) {
        env[key] = value.trim();
      }
      // Don't delete keys if value is empty - just skip
    }

    await writeEnvFile(env);

    return NextResponse.json({
      success: true,
      message: "Settings saved. Restart the app to apply changes.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}
