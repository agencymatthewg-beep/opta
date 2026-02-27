interface Message {
  role: "user" | "assistant";
  content: string;
}

// In-memory conversation store
// TODO: Replace with Supabase or Redis for production
const conversations = new Map<string, Message[]>();

const MAX_MESSAGES = 20; // Keep last 20 messages (10 exchanges)

export function getHistory(senderId: string): Message[] {
  return conversations.get(senderId) ?? [];
}

export function addMessage(senderId: string, role: "user" | "assistant", content: string): void {
  const history = conversations.get(senderId) ?? [];
  history.push({ role, content });

  // Sliding window: keep only last MAX_MESSAGES
  if (history.length > MAX_MESSAGES) {
    history.splice(0, history.length - MAX_MESSAGES);
  }

  conversations.set(senderId, history);
}

export function clearHistory(senderId: string): void {
  conversations.delete(senderId);
}

export function getConversationCount(): number {
  return conversations.size;
}
