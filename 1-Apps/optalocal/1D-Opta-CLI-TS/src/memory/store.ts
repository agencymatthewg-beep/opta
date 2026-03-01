import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { nanoid } from 'nanoid';
import { getSessionsDir } from '../platform/paths.js';
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
  tags: string[];
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
  tags: z.array(z.string()).default([]),
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
  tags: string[];
  model: string;
  created: string;
  messageCount: number;
  toolCallCount: number;
}

// --- Paths ---

function sessionsDir(): string {
  return getSessionsDir();
}

function sessionPath(id: string): string {
  return join(sessionsDir(), `${id}.json`);
}

// --- Session Index (fast resume) ---

const INDEX_FILE = 'index.json';

interface SessionIndex {
  entries: Record<
    string,
    {
      title: string;
      model: string;
      tags: string[];
      created: string;
      messageCount: number;
      toolCallCount?: number;
    }
  >;
  updatedAt: string;
}

async function loadIndex(): Promise<SessionIndex> {
  try {
    const data = await readFile(join(sessionsDir(), INDEX_FILE), 'utf-8');
    const parsed: unknown = JSON.parse(data);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'entries' in parsed &&
      typeof (parsed as Record<string, unknown>).entries === 'object'
    ) {
      return parsed as SessionIndex;
    }
    return { entries: {}, updatedAt: new Date().toISOString() };
  } catch {
    return { entries: {}, updatedAt: new Date().toISOString() };
  }
}

async function saveIndex(index: SessionIndex): Promise<void> {
  index.updatedAt = new Date().toISOString();
  await mkdir(sessionsDir(), { recursive: true });
  await writeFile(join(sessionsDir(), INDEX_FILE), JSON.stringify(index, null, 2));
}

export async function updateSessionIndex(id: string, session: Session): Promise<void> {
  const index = await loadIndex();
  index.entries[id] = {
    title: session.title,
    model: session.model,
    tags: session.tags,
    created: session.created,
    messageCount: session.messages.filter((m) => m.role !== 'system').length,
    toolCallCount: session.toolCallCount ?? 0,
  };
  await saveIndex(index);
}

export async function removeFromIndex(id: string): Promise<void> {
  const index = await loadIndex();
  Reflect.deleteProperty(index.entries, id);
  await saveIndex(index);
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
    tags: [],
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
  await updateSessionIndex(session.id, session);
}

export async function listSessions(): Promise<SessionSummary[]> {
  const dir = sessionsDir();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }

  const sessionFiles = files.filter((file) => file.endsWith('.json') && file !== INDEX_FILE);
  const index = await loadIndex();
  if (sessionFiles.length === 0) {
    if (Object.keys(index.entries).length > 0) {
      index.entries = {};
      await saveIndex(index);
    }
    return [];
  }

  const fileIds = new Set(sessionFiles.map((file) => file.slice(0, -5)));
  const summaries: SessionSummary[] = [];
  let indexMutated = false;

  // Remove stale index entries that no longer have a backing session file.
  for (const id of Object.keys(index.entries)) {
    if (!fileIds.has(id)) {
      Reflect.deleteProperty(index.entries, id);
      indexMutated = true;
    }
  }

  const missingIds: string[] = [];
  for (const id of fileIds) {
    const entry = index.entries[id];
    if (entry) {
      summaries.push({
        id,
        title: entry.title || '(untitled)',
        tags: entry.tags ?? [],
        model: entry.model,
        created: entry.created,
        messageCount: entry.messageCount ?? 0,
        toolCallCount: entry.toolCallCount ?? 0,
      });
      continue;
    }
    missingIds.push(id);
  }

  // Backfill index entries from session files that are missing in index.
  if (missingIds.length > 0) {
    await Promise.all(
      missingIds.map(async (id) => {
        try {
          const data = await readFile(sessionPath(id), 'utf-8');
          const session = parseSession(data);
          if (!session) return; // Skip corrupt/invalid session files

          const messageCount = session.messages.filter((m) => m.role !== 'system').length;
          index.entries[id] = {
            title: session.title,
            model: session.model,
            tags: session.tags ?? [],
            created: session.created,
            messageCount,
            toolCallCount: session.toolCallCount ?? 0,
          };

          summaries.push({
            id: session.id,
            title: session.title || '(untitled)',
            tags: session.tags ?? [],
            model: session.model,
            created: session.created,
            messageCount,
            toolCallCount: session.toolCallCount ?? 0,
          });
          indexMutated = true;
        } catch {
          // Skip unreadable session files
        }
      })
    );
  }

  if (indexMutated) {
    await saveIndex(index);
  }

  return summaries.sort((a, b) => b.created.localeCompare(a.created));
}

export async function deleteSession(id: string): Promise<void> {
  await rm(sessionPath(id), { force: true });
  await removeFromIndex(id);
}

export async function exportSession(id: string): Promise<string> {
  const session = await loadSession(id);
  return JSON.stringify(session, null, 2);
}

// --- Search ---

/**
 * Fuzzy search sessions by query string.
 * Matches against session ID prefix, title, model, tags, and message content.
 * Returns results sorted by relevance score (highest first).
 */
export async function searchSessions(query: string): Promise<SessionSummary[]> {
  const all = await listSessions();
  const q = query.toLowerCase();

  // Build a map of session ID -> full session (for content matching)
  const sessionContentMap = new Map<string, Session>();
  await Promise.all(
    all.map(async (summary) => {
        try {
          const data = await readFile(sessionPath(summary.id), 'utf-8');
          const session = parseSession(data);
          if (session) sessionContentMap.set(session.id, session);
        } catch {
          // Skip unreadable files
        }
      })
  );

  const scored = all.map((summary) => {
    let score = 0;

    // Exact ID prefix match (highest priority)
    if (summary.id.toLowerCase().startsWith(q)) {
      score += 100;
    } else if (summary.id.toLowerCase().includes(q)) {
      score += 50;
    }

    // Title match
    const title = summary.title.toLowerCase();
    if (title === q) {
      score += 90;
    } else if (title.startsWith(q)) {
      score += 70;
    } else if (title.includes(q)) {
      score += 40;
    }

    // Tag match
    const tagMatch = summary.tags?.some((t) => t.toLowerCase().includes(q));
    if (tagMatch) score += 60;

    // Model match
    if (summary.model.toLowerCase().includes(q)) {
      score += 20;
    }

    // Word-level fuzzy: check if all query words appear somewhere
    const queryWords = q.split(/\s+/);
    const tagStr = (summary.tags ?? []).join(' ');
    const haystack = `${summary.id} ${summary.title} ${summary.model} ${tagStr}`.toLowerCase();
    const allWordsMatch = queryWords.every((w) => haystack.includes(w));
    if (allWordsMatch && queryWords.length > 1) {
      score += 30;
    }

    // Search message content (first 6 messages only for performance)
    const fullSession = sessionContentMap.get(summary.id);
    if (fullSession) {
      const contentMessages = fullSession.messages.slice(0, 6);
      for (const msg of contentMessages) {
        const content = typeof msg.content === 'string' ? msg.content : '';
        if (content.toLowerCase().includes(q)) {
          score += 40; // content match
          break; // one match is enough
        }
      }
    }

    return { session: summary, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.session);
}

// --- Tag & Rename ---

export async function tagSession(id: string, tags: string[]): Promise<void> {
  const session = await loadSession(id);
  session.tags = [...new Set([...session.tags, ...tags])];
  await saveSession(session);
}

export async function untagSession(id: string, tags: string[]): Promise<void> {
  const session = await loadSession(id);
  session.tags = session.tags.filter((t) => !tags.includes(t));
  await saveSession(session);
}

export async function renameSession(id: string, title: string): Promise<void> {
  const session = await loadSession(id);
  session.title = title;
  await saveSession(session);
}

// --- Helpers ---

export function generateTitle(firstMessage: string): string {
  return firstMessage.trim().slice(0, 60).replace(/\n/g, ' ');
}
