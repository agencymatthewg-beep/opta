export interface LessonEntryInput {
  problem: string;
  rootCause: string;
  preventionRule: string;
}

export interface LessonEntry extends LessonEntryInput {
  id: string;
  createdAt: string;
}

export class LessonsLog {
  private entries: LessonEntry[] = [];
  private nextSeq = 1;

  add(input: LessonEntryInput, createdAt = new Date().toISOString()): LessonEntry {
    if (!input.problem.trim()) throw new Error('Lesson requires problem');
    if (!input.rootCause.trim()) throw new Error('Lesson requires rootCause');
    if (!input.preventionRule.trim()) {
      throw new Error('Lesson requires preventionRule');
    }

    const entry: LessonEntry = {
      ...input,
      id: `lesson-${String(this.nextSeq++).padStart(6, '0')}`,
      createdAt,
    };
    this.entries.push(entry);
    return entry;
  }

  list(): LessonEntry[] {
    return [...this.entries];
  }
}

