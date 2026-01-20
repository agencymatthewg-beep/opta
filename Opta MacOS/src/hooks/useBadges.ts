import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Badge, BadgeResponse, UserStats } from '@/types/badges';

interface UseBadgesReturn {
  badges: Badge[];
  newUnlocks: string[];
  stats: UserStats | null;
  loading: boolean;
  refreshBadges: () => Promise<void>;
  markBadgeSeen: (badgeId: string) => Promise<void>;
}

export function useBadges(): UseBadgesReturn {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [newUnlocks, setNewUnlocks] = useState<string[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshBadges = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<BadgeResponse>('check_badges');
      setBadges(result.badges);
      setNewUnlocks(result.newUnlocks);
      setStats(result.stats);
    } catch (e) {
      console.error('Failed to load badges:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const markBadgeSeen = useCallback(async (badgeId: string) => {
    try {
      await invoke('mark_badge_seen', { badgeId });
      setBadges(prev =>
        prev.map(b => b.id === badgeId ? { ...b, isNew: false } : b)
      );
      setNewUnlocks(prev => prev.filter(id => id !== badgeId));
    } catch (e) {
      console.error('Failed to mark badge seen:', e);
    }
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  return { badges, newUnlocks, stats, loading, refreshBadges, markBadgeSeen };
}
