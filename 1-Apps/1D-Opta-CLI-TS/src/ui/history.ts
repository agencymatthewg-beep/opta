export class InputHistory {
  private entries: string[] = [];
  private index = -1;
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  push(entry: string): void {
    const trimmed = entry.trim();
    if (!trimmed) return;
    // Deduplicate consecutive entries
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === trimmed) return;
    this.entries.push(trimmed);
    if (this.entries.length > this.maxSize) this.entries.shift();
    this.index = -1;
  }

  startNavigation(): void {
    this.index = this.entries.length;
  }

  previous(): string {
    if (this.entries.length === 0) return '';
    if (this.index > 0) this.index--;
    return this.entries[this.index] ?? '';
  }

  next(): string {
    if (this.entries.length === 0) return '';
    if (this.index < this.entries.length - 1) {
      this.index++;
      return this.entries[this.index]!;
    }
    this.index = this.entries.length;
    return '';
  }

  size(): number {
    return this.entries.length;
  }
}
