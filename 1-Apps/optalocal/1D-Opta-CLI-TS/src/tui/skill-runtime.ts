export interface SkillRuntimeEntry {
  skill: string;
  loadedAt: number;
  lastActiveAt: number;
}

export interface SkillRuntimeReconcileOptions {
  now?: number;
  ttlMs?: number;
  maxActiveSkills?: number;
  unloadInactive?: boolean;
}

export interface SkillRuntimeReconcileResult {
  loaded: string[];
  refreshed: string[];
  unloaded: string[];
  evicted: string[];
  expired: string[];
  activeSkills: string[];
}

const DEFAULT_TTL_MS = 30 * 60 * 1_000;
const DEFAULT_MAX_ACTIVE_SKILLS = 24;

function normalizeSkillList(skills: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of skills) {
    const candidate = raw.trim();
    if (!candidate) continue;
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(candidate);
  }

  return normalized;
}

export class SkillRuntime {
  private readonly entries = new Map<string, SkillRuntimeEntry>();

  private skillKey(skill: string): string {
    return skill.trim().toLowerCase();
  }

  private removeSkill(skill: string): boolean {
    return this.entries.delete(this.skillKey(skill));
  }

  private pruneExpired(now: number, ttlMs: number): string[] {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return [];

    const expired: string[] = [];
    for (const [key, entry] of this.entries) {
      if (now - entry.lastActiveAt > ttlMs) {
        this.entries.delete(key);
        expired.push(entry.skill);
      }
    }
    return expired;
  }

  private evictLeastRecentlyActive(): string | null {
    let oldest: SkillRuntimeEntry | null = null;

    for (const entry of this.entries.values()) {
      if (!oldest || entry.lastActiveAt < oldest.lastActiveAt) {
        oldest = entry;
      }
    }

    if (!oldest) return null;
    this.removeSkill(oldest.skill);
    return oldest.skill;
  }

  activeSkills(options: Pick<SkillRuntimeReconcileOptions, 'now' | 'ttlMs'> = {}): string[] {
    const now = options.now ?? Date.now();
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.pruneExpired(now, ttlMs);

    return [...this.entries.values()]
      .sort((left, right) => right.lastActiveAt - left.lastActiveAt)
      .map((entry) => entry.skill);
  }

  reset(): void {
    this.entries.clear();
  }

  reconcile(
    requestedSkills: string[],
    options: SkillRuntimeReconcileOptions = {},
  ): SkillRuntimeReconcileResult {
    const now = options.now ?? Date.now();
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const maxActiveSkills = options.maxActiveSkills ?? DEFAULT_MAX_ACTIVE_SKILLS;
    const unloadInactive = options.unloadInactive ?? false;
    const normalizedRequested = normalizeSkillList(requestedSkills);
    const requestedKeys = new Set(normalizedRequested.map((skill) => this.skillKey(skill)));

    const expired = this.pruneExpired(now, ttlMs);
    const loaded: string[] = [];
    const refreshed: string[] = [];
    const unloaded: string[] = [];
    const evicted: string[] = [];

    if (unloadInactive) {
      for (const [key, entry] of this.entries) {
        if (!requestedKeys.has(key)) {
          this.entries.delete(key);
          unloaded.push(entry.skill);
        }
      }
    }

    for (const skill of normalizedRequested) {
      const key = this.skillKey(skill);
      const existing = this.entries.get(key);
      if (existing) {
        existing.lastActiveAt = now;
        refreshed.push(existing.skill);
        continue;
      }

      if (maxActiveSkills > 0 && this.entries.size >= maxActiveSkills) {
        const dropped = this.evictLeastRecentlyActive();
        if (dropped) {
          evicted.push(dropped);
          unloaded.push(dropped);
        }
      }

      this.entries.set(key, {
        skill,
        loadedAt: now,
        lastActiveAt: now,
      });
      loaded.push(skill);
    }

    return {
      loaded,
      refreshed,
      unloaded,
      evicted,
      expired,
      activeSkills: this.activeSkills({ now, ttlMs }),
    };
  }
}
