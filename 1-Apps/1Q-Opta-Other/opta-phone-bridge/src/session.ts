type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

interface Session {
  history: Message[];
  lastActive: number;
}

const sessions = new Map<string, Session>();
const MAX_HISTORY = 20;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 mins

// Clean up expired sessions every 5 mins
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActive > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

export function getHistory(sessionId: string): Message[] {
  return sessions.get(sessionId)?.history ?? [];
}

export function addMessage(sessionId: string, role: Role, content: string): void {
  let session = sessions.get(sessionId);
  if (!session) {
    session = { history: [], lastActive: Date.now() };
    sessions.set(sessionId, session);
  }
  session.history.push({ role, content });
  session.lastActive = Date.now();
  // Keep last N messages
  if (session.history.length > MAX_HISTORY) {
    session.history = session.history.slice(-MAX_HISTORY);
  }
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function sessionCount(): number {
  return sessions.size;
}
