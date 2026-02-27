export interface QueuedTurn {
  turnId: string;
  ingressSeq: number;
  sessionId: string;
  clientId: string;
  writerId: string;
  content: string;
  mode: 'chat' | 'do';
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Deterministic FIFO queue ordered by daemon ingress sequence.
 */
export class TurnQueue {
  private readonly turns: QueuedTurn[] = [];

  enqueue(turn: QueuedTurn): void {
    this.turns.push(turn);
    this.turns.sort((a, b) => a.ingressSeq - b.ingressSeq);
  }

  dequeue(): QueuedTurn | undefined {
    return this.turns.shift();
  }

  peek(): QueuedTurn | undefined {
    return this.turns[0];
  }

  get size(): number {
    return this.turns.length;
  }

  toArray(): QueuedTurn[] {
    return [...this.turns];
  }

  cancelByWriter(writerId: string): number {
    const before = this.turns.length;
    for (let i = this.turns.length - 1; i >= 0; i--) {
      if (this.turns[i]?.writerId === writerId) {
        this.turns.splice(i, 1);
      }
    }
    return before - this.turns.length;
  }

  cancelByTurnId(turnId: string): boolean {
    const idx = this.turns.findIndex(t => t.turnId === turnId);
    if (idx === -1) return false;
    this.turns.splice(idx, 1);
    return true;
  }
}
