/**
 * Arena vote persistence using idb-keyval (IndexedDB).
 *
 * Stores user preference votes from Multi-Model Arena Mode.
 * Each vote records which model(s) the user preferred for a given prompt,
 * building a personal preference dataset over time.
 *
 * Uses the same idb-keyval store as chat-store.ts but with a distinct
 * key prefix to avoid collisions.
 */

import { get, set, del, keys } from 'idb-keyval';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArenaVote {
  id: string;
  prompt: string;
  models: string[];
  winner: string | 'tie';
  ratings: Record<string, 'better' | 'worse' | 'tie'>;
  created_at: string;
}

export interface ModelWinStats {
  modelId: string;
  wins: number;
  losses: number;
  ties: number;
  total: number;
  winRate: number;
}

// ---------------------------------------------------------------------------
// Key prefix
// ---------------------------------------------------------------------------

const KEY_PREFIX = 'opta-arena:';

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Save an arena vote to IndexedDB. */
export async function saveVote(vote: ArenaVote): Promise<void> {
  await set(`${KEY_PREFIX}${vote.id}`, vote);
}

/** Retrieve a single vote by ID. Returns undefined if not found. */
export async function getVote(id: string): Promise<ArenaVote | undefined> {
  return get<ArenaVote>(`${KEY_PREFIX}${id}`);
}

/** Delete a vote by ID. */
export async function deleteVote(id: string): Promise<void> {
  await del(`${KEY_PREFIX}${id}`);
}

/**
 * List all arena votes sorted by created_at descending (most recent first).
 */
export async function getVotes(): Promise<ArenaVote[]> {
  const allKeys = await keys();
  const arenaKeys = allKeys.filter(
    (k) => typeof k === 'string' && k.startsWith(KEY_PREFIX),
  );

  const votes: ArenaVote[] = [];
  for (const key of arenaKeys) {
    const vote = await get<ArenaVote>(key as string);
    if (vote) {
      votes.push(vote);
    }
  }

  return votes.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

/**
 * Compute win/loss/tie rates per model from all stored votes.
 * Returns an array sorted by win rate descending.
 */
export async function getVoteStats(): Promise<ModelWinStats[]> {
  const votes = await getVotes();
  const statsMap = new Map<
    string,
    { wins: number; losses: number; ties: number; total: number }
  >();

  for (const vote of votes) {
    for (const modelId of vote.models) {
      if (!statsMap.has(modelId)) {
        statsMap.set(modelId, { wins: 0, losses: 0, ties: 0, total: 0 });
      }
      const entry = statsMap.get(modelId)!;
      entry.total += 1;

      const rating = vote.ratings[modelId];
      if (rating === 'better') {
        entry.wins += 1;
      } else if (rating === 'worse') {
        entry.losses += 1;
      } else {
        entry.ties += 1;
      }
    }
  }

  const stats: ModelWinStats[] = [];
  for (const [modelId, entry] of statsMap) {
    stats.push({
      modelId,
      ...entry,
      winRate: entry.total > 0 ? entry.wins / entry.total : 0,
    });
  }

  return stats.sort((a, b) => b.winRate - a.winRate);
}
