export interface DecisionLogEntryInput {
  hypothesis: string;
  evidence: string;
  decision: string;
  outcome: string;
  followUpCheckDate: string;
}

export interface DecisionLogEntry extends DecisionLogEntryInput {
  id: string;
  createdAt: string;
}

function requireNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`Decision log requires field: ${field}`);
  }
}

function requireIsoDate(value: string): void {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error('Decision log requires valid followUpCheckDate');
  }
}

export class DecisionLog {
  private entries: DecisionLogEntry[] = [];
  private nextSeq = 1;

  add(input: DecisionLogEntryInput, createdAt = new Date().toISOString()): DecisionLogEntry {
    requireNonEmpty(input.hypothesis, 'hypothesis');
    requireNonEmpty(input.evidence, 'evidence');
    requireNonEmpty(input.decision, 'decision');
    requireNonEmpty(input.outcome, 'outcome');
    requireNonEmpty(input.followUpCheckDate, 'followUpCheckDate');
    requireIsoDate(input.followUpCheckDate);

    const entry: DecisionLogEntry = {
      ...input,
      id: `decision-${String(this.nextSeq++).padStart(6, '0')}`,
      createdAt,
    };
    this.entries.push(entry);
    return entry;
  }

  list(): DecisionLogEntry[] {
    return [...this.entries];
  }
}

