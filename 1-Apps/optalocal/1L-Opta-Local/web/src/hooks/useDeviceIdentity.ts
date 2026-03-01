'use client';
import { useState, useEffect } from 'react';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import type { DeviceIdentity } from '@/types/lmx';

export function useDeviceIdentity() {
  const connection = useConnectionContextSafe();
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null);

  useEffect(() => {
    if (!connection?.isConnected || !connection.baseUrl) return;

    const headers: Record<string, string> = {};
    if (connection.adminKey) headers['X-Admin-Key'] = connection.adminKey;

    fetch(`${connection.baseUrl}/admin/device`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setIdentity(data as DeviceIdentity); })
      .catch(() => {});
  }, [connection?.isConnected, connection?.baseUrl, connection?.adminKey]);

  return identity;
}
