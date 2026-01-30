/**
 * Sequence Number Manager
 * Manages monotonically increasing sequence numbers for message ordering.
 */

export class SequenceManager {
  private sequence = 0;

  /**
   * Get the next sequence number
   */
  next(): number {
    return ++this.sequence;
  }

  /**
   * Get current sequence number without incrementing
   */
  current(): number {
    return this.sequence;
  }

  /**
   * Reset sequence to zero (e.g., on reconnection)
   */
  reset(): void {
    this.sequence = 0;
  }
}

/**
 * Per-client sequence tracker for server-side validation
 */
export class ClientSequenceTracker {
  private lastReceived = 0;
  private outOfOrder: number[] = [];

  /**
   * Validate and track an incoming sequence number
   * Returns true if sequence is valid (in order or acceptable gap)
   */
  track(sequence: number): { valid: boolean; missed: number[] } {
    if (sequence <= this.lastReceived) {
      // Duplicate or old message
      return { valid: false, missed: [] };
    }

    const missed: number[] = [];
    if (sequence > this.lastReceived + 1) {
      // Gap detected - track missed sequences
      for (let i = this.lastReceived + 1; i < sequence; i++) {
        missed.push(i);
        this.outOfOrder.push(i);
      }
    }

    this.lastReceived = sequence;
    return { valid: true, missed };
  }

  /**
   * Get the last received sequence number
   */
  getLastReceived(): number {
    return this.lastReceived;
  }

  /**
   * Check if any sequences were missed
   */
  hasMissedSequences(): boolean {
    return this.outOfOrder.length > 0;
  }

  /**
   * Get missed sequences
   */
  getMissedSequences(): number[] {
    return [...this.outOfOrder];
  }

  /**
   * Clear missed sequences (e.g., after recovery)
   */
  clearMissed(): void {
    this.outOfOrder = [];
  }
}
