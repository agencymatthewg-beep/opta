/**
 * CircularBuffer — Fixed-size sliding window for time-series data.
 *
 * Automatically evicts the oldest item when capacity is reached.
 * toArray() returns items in chronological order (oldest first).
 *
 * Usage:
 *   const buffer = new CircularBuffer<ThroughputPoint>(300);
 *   buffer.push({ timestamp: Date.now(), tokensPerSecond: 42.5 });
 *   const chartData = buffer.toArray(); // chronological order for Recharts
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single throughput measurement for time-series charts. */
export interface ThroughputPoint {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Tokens generated per second at this point in time */
  tokensPerSecond: number;
}

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

export class CircularBuffer<T> {
  private readonly buffer: Array<T | undefined>;
  private head = 0;
  private count = 0;

  constructor(private readonly capacity: number) {
    this.buffer = new Array<T | undefined>(capacity);
  }

  /** Add an item to the buffer. Overwrites the oldest item when full. */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /**
   * Return all items in chronological order (oldest first).
   * Unwraps the circular structure so the array is suitable for
   * direct use as chart data.
   */
  toArray(): T[] {
    if (this.count < this.capacity) {
      // Buffer not yet full — items are contiguous from index 0
      return this.buffer.slice(0, this.count) as T[];
    }
    // Buffer is full — head points to the oldest item
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head),
    ] as T[];
  }

  /** Current number of items in the buffer. */
  get length(): number {
    return this.count;
  }

  /** Whether the buffer has reached its maximum capacity. */
  get isFull(): boolean {
    return this.count === this.capacity;
  }

  /** Remove all items from the buffer. */
  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}
