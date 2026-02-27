import { describe, expect, it } from 'vitest';
import {
  computeLifecycleStagePercent,
  normalizeModelKey,
  rankModelIds,
  normalizeModelHistoryEntries,
  mergeModelHistoryEntries,
  formatModelInventoryWarning,
} from '../../src/commands/models/index.js';
import { LmxApiError } from '../../src/lmx/client.js';

describe('normalizeModelKey', () => {
  it('normalizes case and strips punctuation', () => {
    expect(normalizeModelKey('MiniMax-M2.5 4bit')).toBe('minimaxm254bit');
  });

  it('returns empty string for separators-only input', () => {
    expect(normalizeModelKey('---___   ///')).toBe('');
  });
});

describe('rankModelIds', () => {
  it('prefers exact alias match over other candidates', () => {
    const ids = [
      'mlx-community/MiniMax-M2.5-4bit',
      'mlx-community/MiniMax-M2.5-8bit',
    ];
    const ranked = rankModelIds(ids, 'minimax-m2.5-4bit');
    expect(ranked[0]?.id).toBe('mlx-community/MiniMax-M2.5-4bit');
    expect(ranked[0]?.score).toBe(0);
  });

  it('uses normalization to match user input with spaces/punctuation', () => {
    const ids = ['mlx-community/MiniMax-M2.5-4bit'];
    const ranked = rankModelIds(ids, 'mini max m2.5 4bit');
    expect(ranked[0]?.id).toBe('mlx-community/MiniMax-M2.5-4bit');
    expect(ranked[0]?.score).toBe(0);
  });

  it('ranks prefix matches ahead of substring matches', () => {
    const ids = ['foo-bar-model', 'super-foo-bar'];
    const ranked = rankModelIds(ids, 'foo');
    expect(ranked[0]?.id).toBe('foo-bar-model');
    expect(ranked[0]?.score).toBe(1);
    expect(ranked[1]?.id).toBe('super-foo-bar');
    expect(ranked[1]?.score).toBe(2);
  });

  it('returns empty list for blank query', () => {
    const ids = ['a', 'b'];
    expect(rankModelIds(ids, '   ')).toEqual([]);
  });

  it('matches tokens across separators for queries like "kimi 2.5"', () => {
    const ids = [
      'moonshot/kimi-k2.5',
      'moonshot/kimi-2.0',
      'moonshot/k2.5-flash',
    ];
    const ranked = rankModelIds(ids, 'kimi 2.5');
    expect(ranked[0]?.id).toBe('moonshot/kimi-k2.5');
    expect(ranked[0]?.score).toBe(3);
  });

  it('treats shorthand "glm5" as a prefix of glm-5.4.8b identifiers', () => {
    const ids = ['glm-5.4.8b', 'glm-6.0', 'glm-5.4.8d'];
    const ranked = rankModelIds(ids, 'glm5');
    expect(ranked[0]?.id).toBe('glm-5.4.8b');
    expect(ranked[0]?.score).toBe(1);
  });

  it('matches GLM shorthand with separated version tokens', () => {
    const ids = [
      'inferencelabs/GLM-5-MLX-4.8bit',
      'inferencelabs/GLM-4-MLX-8bit',
    ];
    const ranked = rankModelIds(ids, 'glm 5.4.8b');
    expect(ranked[0]?.id).toBe('inferencelabs/GLM-5-MLX-4.8bit');
    expect(ranked[0]?.score).toBe(3);
  });

  it('matches configured aliases as exact hits', () => {
    const ids = ['inferencelabs/GLM-5-MLX-4.8bit'];
    const ranked = rankModelIds(ids, 'glm5', { glm5: 'inferencelabs/GLM-5-MLX-4.8bit' });
    expect(ranked[0]?.id).toBe('inferencelabs/GLM-5-MLX-4.8bit');
    expect(ranked[0]?.score).toBe(0);
  });
});

describe('model history helpers', () => {
  it('normalizes and deduplicates persisted history entries', () => {
    const entries = normalizeModelHistoryEntries([
      { id: 'a/model-1', firstSeenAt: 100, lastSeenAt: 200, lastAction: 'detected' },
      { id: 'a/model-1', firstSeenAt: 90, lastSeenAt: 300, lastAction: 'loaded' },
      { id: ' ', firstSeenAt: 1, lastSeenAt: 1, lastAction: 'detected' },
      { id: 'b/model-2', firstSeenAt: 'x', lastSeenAt: 10, lastAction: 'bogus' },
    ]);

    expect(entries).toHaveLength(2);
    const a = entries.find((entry) => entry.id === 'a/model-1');
    const b = entries.find((entry) => entry.id === 'b/model-2');
    expect(a?.lastAction).toBe('loaded');
    expect(b?.lastAction).toBe('detected');
  });

  it('merges new history updates and preserves earliest firstSeenAt', () => {
    const now = 1_000;
    const merged = mergeModelHistoryEntries(
      [
        { id: 'a/model', firstSeenAt: 100, lastSeenAt: 200, lastAction: 'detected' },
      ],
      ['a/model', 'b/model'],
      'loaded',
      now,
    );

    const a = merged.find((entry) => entry.id === 'a/model');
    const b = merged.find((entry) => entry.id === 'b/model');
    expect(a?.firstSeenAt).toBe(100);
    expect(a?.lastSeenAt).toBe(now);
    expect(a?.lastAction).toBe('loaded');
    expect(b?.firstSeenAt).toBe(now);
    expect(b?.lastAction).toBe('loaded');
  });
});

describe('model inventory warning formatting', () => {
  it('adds admin-key guidance for unauthorized admin endpoint failures', () => {
    const warning = formatModelInventoryWarning(
      'downloaded models',
      new LmxApiError(403, 'unauthorized', 'Forbidden'),
    );
    expect(warning).toContain('403 unauthorized');
    expect(warning).toContain('connection.adminKey');
  });

  it('uses connection-specific language for transport failures', () => {
    const warning = formatModelInventoryWarning(
      'loaded models',
      new LmxApiError(0, 'connection_error', 'ECONNREFUSED'),
    );
    expect(warning).toContain('LMX unreachable');
    expect(warning).toContain('ECONNREFUSED');
  });
});

describe('computeLifecycleStagePercent', () => {
  it('advances long-running load stages beyond fixed 75/88 starting points', () => {
    const pct75 = computeLifecycleStagePercent(75, {
      elapsedMs: 30_000,
      timeoutMs: 300_000,
      attempt: 2,
      status: 'waiting',
    });
    const pct88 = computeLifecycleStagePercent(88, {
      elapsedMs: 12_000,
      timeoutMs: 300_000,
      attempt: 2,
      status: 'waiting',
    });

    expect(pct75).toBeGreaterThan(75);
    expect(pct88).toBeGreaterThan(88);
  });

  it('is monotonic and stays below completion while still waiting', () => {
    const previous = computeLifecycleStagePercent(75, {
      elapsedMs: 3_000,
      timeoutMs: 300_000,
      attempt: 1,
      status: 'waiting',
    });
    const next = computeLifecycleStagePercent(75, {
      elapsedMs: 3_100,
      timeoutMs: 300_000,
      attempt: 1,
      status: 'waiting',
    }, previous);

    expect(next).toBeGreaterThanOrEqual(previous);
    expect(next).toBeLessThan(100);
  });
});
