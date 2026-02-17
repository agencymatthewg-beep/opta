export interface AnalyticsSessionSummary {
  id: string;
  model: string;
  created: string;
  messageCount: number;
  toolCallCount: number;
  title: string;
}

export class SessionAnalytics {
  private sessions: AnalyticsSessionSummary[];

  constructor(sessions: AnalyticsSessionSummary[]) {
    this.sessions = sessions;
  }

  get totalSessions(): number {
    return this.sessions.length;
  }

  get totalMessages(): number {
    return this.sessions.reduce((sum, s) => sum + s.messageCount, 0);
  }

  get totalToolCalls(): number {
    return this.sessions.reduce((sum, s) => sum + s.toolCallCount, 0);
  }

  get avgMessagesPerSession(): number {
    if (this.sessions.length === 0) return 0;
    return this.totalMessages / this.sessions.length;
  }

  get modelBreakdown(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const s of this.sessions) {
      counts[s.model] = (counts[s.model] ?? 0) + 1;
    }
    return counts;
  }

  sessionsToday(today?: string): number {
    const d = today ?? new Date().toISOString().split('T')[0]!;
    return this.sessions.filter(s => s.created.startsWith(d)).length;
  }

  get mostUsedModel(): string {
    const breakdown = this.modelBreakdown;
    let max = 0;
    let model = 'none';
    for (const [m, count] of Object.entries(breakdown)) {
      if (count > max) {
        max = count;
        model = m;
      }
    }
    return model;
  }
}
