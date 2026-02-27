/**
 * useDevices — Real-time device list from Supabase.
 *
 * Fetches the user's registered devices and subscribes to
 * Supabase Realtime for live presence updates (heartbeats).
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/shared/AuthProvider';
import type { Device } from '@/types/cloud';

interface UseDevicesReturn {
  devices: Device[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Two-minute threshold for online status (matches heartbeat interval). */
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

interface DeviceRealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  old: { id: string };
  new: Omit<Device, 'is_online'>;
}

/** Compute is_online client-side from last_seen_at. */
function withOnlineStatus(device: Omit<Device, 'is_online'>): Device {
  const lastSeen = new Date(device.last_seen_at).getTime();
  const isOnline = Date.now() - lastSeen < ONLINE_THRESHOLD_MS;
  return { ...device, is_online: isOnline } as Device;
}

export function useDevices(): UseDevicesReturn {
  const auth = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    if (!auth?.supabase || !auth.user) {
      setDevices([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await auth.supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      setDevices((data ?? []).map(withOnlineStatus));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
    } finally {
      setIsLoading(false);
    }
  }, [auth?.supabase, auth?.user]);

  // Initial fetch
  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Subscribe to Realtime changes on devices table
  useEffect(() => {
    if (!auth?.supabase || !auth.user) return;
    const supabase = auth.supabase;

    const channel = supabase
      .channel('devices-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `user_id=eq.${auth.user.id}`,
        },
        (payload) => {
          const nextPayload = payload as unknown as DeviceRealtimePayload;

          if (nextPayload.eventType === 'DELETE') {
            setDevices((prev) =>
              prev.filter((d) => d.id !== nextPayload.old.id),
            );
          } else {
            const updated = withOnlineStatus(nextPayload.new);
            setDevices((prev) => {
              const idx = prev.findIndex((d) => d.id === updated.id);
              if (idx === -1) return [...prev, updated];
              const next = [...prev];
              next[idx] = updated;
              return next;
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auth?.supabase, auth?.user]);

  // Refresh online status every 30s (re-evaluate last_seen_at thresholds)
  useEffect(() => {
    const id = setInterval(() => {
      setDevices((prev) => prev.map(withOnlineStatus));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return { devices, isLoading, error, refetch: fetchDevices };
}
