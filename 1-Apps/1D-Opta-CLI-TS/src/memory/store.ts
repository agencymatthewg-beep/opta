import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { nanoid } from 'nanoid';
import { z } from 'zod';

// --- Types ---

import type { AgentMessage, ContentPart } from '../core/agent.js';

// Re-export AgentMessage from agent.ts (canonical source)
export type { AgentMessage, ContentPart };

export interface Session {
  id: string;
  created: string;
  updated: string;
  model: string;
  cwd: string;
  title: string;
  messages: AgentMessage[];
  toolCallCount: number;
  compacted: boolean;
}

// --- Zod Schema for Session Validation ---

const ContentPartSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('image_url'), image_url: z.object({ url: z.string() }) }),
]);

const AgentMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([z.string(), z.array(ContentPartSchema), z.null()]),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({ name: z.string(), arguments: z.string() }),
      })
    )
    .optional(),
  tool_call_id: z.string().optional(),
});

const SessionSchema = z.object({
  id: z.string(),
  created: z.string(),
  updated: z.string(),
  model: z.string(),
  cwd: z.string(),
  title: z.string(),
  messages: z.array(AgentMessageSchema),
  toolCallCount: z.number(),
  compacted: z.boolean(),
});

function parseSession(data: string): Session | null {
  try {
    const parsed: unknown = JSON.parse(data);
    const result = SessionSchema.safeParse(parsed);
    if (!result.success) return null;
    return result.data as Session;
  } catch {
    return null;
  }
}

export interface SessionSummary {
  id: string;
  title: string;
  model: string;
  created: string;
  messageCount: number;
  toolCallCount: number;
}

// --- Paths ---

function sessionsDir(): string {
  return join(homedir(), '.config', 'opta', 'sessions');
}

function sessionPath(id: string): string {
  return join(sessionsDir(), `${id}.json`);
}

// --- CRUD ---

export async function createSession(model: string): Promise<Session> {
  const now = new Date().toISOString();
  const session: Session = {
    id: nanoid(12),
    created: now,
    updated: now,
    model,
    cwd: process.cwd(),
    title: '',
    messages: [],
    toolCallCount: 0,
    compacted: false,
  };
  await saveSession(session);
  return session;
}

export async function loadSession(id: string): Promise<Session> {
  const data = await readFile(sessionPath(id), 'utf-8');
  const session = parseSession(data);
  if (!session) {
    throw new Error(`Corrupt or invalid session file: ${id}`);
  }
  return session;
}

export async function saveSession(session: Session): Promise<void> {
  session.updated = new Date().toISOString();
  const dir = sessionsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(sessionPath(session.id), JSON.stringify(session, null, 2), 'utf-8');
}

export async function listSessions(): Promise<SessionSummary[]> {
  const dir = sessionsDir();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const summaries: SessionSummary[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = await readFile(join(dir, file), 'utf-8');
      const session = parseSession(data);
      if (!session) continue; // Skip corrupt/invalid session files
      summaries.push({
        id: session.id,
        title: session.title || '(untitled)',
        model: session.model,
        created: session.created,
        messageCount: session.messages.filter((m) => m.role !== 'system').length,
        toolCallCount: session.toolCallCount ?? 0,
      });
    } catch {
      // Skip unreadable session files
    }
  }

  return summaries.sort((a, b) => b.created.localeCompare(a.created));
}

export async function deleteSession(id: string): Promise<void> {
  await rm(sessionPath(id), { force: true });
}

export async function exportSession(id: string): Promise<string> {
  const session = await loadSession(id);
  return JSON.stringify(session, null, 2);
}

// --- Helpers ---

export function generateTitle(firstMessage: string): string {
  return firstMessage.trim().slice(0, 60).replace(/\n/g, ' ');
}
