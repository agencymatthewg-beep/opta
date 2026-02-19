'use client';

/**
 * Device pairing page — /pair
 *
 * Handles the device registration flow. A device (LMX Host or Workstation)
 * opens this page with query params, user signs in (if needed), then
 * confirms to claim the device to their account.
 *
 * Query params:
 *   ?device_name=Mono512&role=llm_host&hostname=Mono512.local&lan_ip=192.168.188.11&lan_port=1234
 *   &callback=http://localhost:9876/pair-callback
 */

import { Suspense, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Server, Monitor, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@opta/ui';

import { useAuthSafe } from '@/components/shared/AuthProvider';
import type { DeviceRole } from '@/types/cloud';

export default function PairPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
        </main>
      }
    >
      <PairPageInner />
    </Suspense>
  );
}

function PairPageInner() {
  const auth = useAuthSafe();
  const searchParams = useSearchParams();

  // Parse device info from query params
  const deviceInfo = useMemo(() => {
    return {
      name: searchParams.get('device_name') ?? 'Unknown Device',
      role: (searchParams.get('role') ?? 'workstation') as DeviceRole,
      hostname: searchParams.get('hostname') ?? null,
      lan_ip: searchParams.get('lan_ip') ?? null,
      lan_port: searchParams.get('lan_port')
        ? Number(searchParams.get('lan_port'))
        : 1234,
      callback: searchParams.get('callback') ?? null,
    };
  }, [searchParams]);

  const [status, setStatus] = useState<
    'pending' | 'claiming' | 'success' | 'error'
  >('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const RoleIcon = deviceInfo.role === 'llm_host' ? Server : Monitor;
  const roleLabel =
    deviceInfo.role === 'llm_host' ? 'LLM Host' : 'Workstation';

  const handleClaim = useCallback(async () => {
    if (!auth?.supabase || !auth.user) return;

    setStatus('claiming');
    setErrorMessage(null);

    try {
      // Check if device already exists (by name + user)
      const { data: existing } = await auth.supabase
        .from('devices')
        .select('id')
        .eq('name', deviceInfo.name)
        .maybeSingle();

      let deviceId: string;

      if (existing) {
        // Update existing device
        const { error: updateError } = await auth.supabase
          .from('devices')
          .update({
            role: deviceInfo.role,
            hostname: deviceInfo.hostname,
            lan_ip: deviceInfo.lan_ip,
            lan_port: deviceInfo.lan_port,
            last_seen_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        deviceId = existing.id;
      } else {
        // Insert new device
        const { data: inserted, error: insertError } = await auth.supabase
          .from('devices')
          .insert({
            user_id: auth.user.id,
            name: deviceInfo.name,
            role: deviceInfo.role,
            hostname: deviceInfo.hostname,
            lan_ip: deviceInfo.lan_ip,
            lan_port: deviceInfo.lan_port,
            last_seen_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        deviceId = inserted.id;
      }

      setStatus('success');

      // If a callback URL was provided, send the device ID back
      if (deviceInfo.callback) {
        try {
          await fetch(deviceInfo.callback, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              device_id: deviceId,
              user_id: auth.user.id,
              status: 'paired',
            }),
          });
        } catch {
          // Callback failure is non-fatal — device is registered either way
          console.warn('[pair] Failed to notify device callback');
        }
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to register device',
      );
    }
  }, [auth, deviceInfo]);

  // Redirect to sign-in if not authenticated
  if (!auth?.isLoading && !auth?.user) {
    return (
      <main className="min-h-screen p-6 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-subtle rounded-xl p-8 max-w-md w-full text-center border border-opta-border"
        >
          <RoleIcon className="mx-auto h-8 w-8 text-text-muted mb-4" />
          <h1 className="text-lg font-bold text-text-primary mb-2">
            Sign in to pair {deviceInfo.name}
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            Sign in to your Opta account to register this {roleLabel} to your
            device network.
          </p>
          <a
            href={`/sign-in?next=/pair?${searchParams.toString()}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Sign In to Continue
          </a>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-subtle rounded-xl p-8 max-w-md w-full text-center border border-opta-border"
      >
        {/* Device info */}
        <RoleIcon className="mx-auto h-8 w-8 text-primary mb-4" />
        <h1 className="text-lg font-bold text-text-primary mb-1">
          Pair {deviceInfo.name}
        </h1>
        <p className="text-xs text-text-muted mb-4">{roleLabel}</p>

        {/* Device details */}
        <div className="glass rounded-lg p-3 mb-6 text-left space-y-1">
          {deviceInfo.hostname && (
            <DetailLine label="Hostname" value={deviceInfo.hostname} />
          )}
          {deviceInfo.lan_ip && (
            <DetailLine
              label="LAN"
              value={`${deviceInfo.lan_ip}:${deviceInfo.lan_port}`}
            />
          )}
          <DetailLine label="Role" value={roleLabel} />
          <DetailLine
            label="Account"
            value={auth?.user?.email ?? 'Loading...'}
          />
        </div>

        {/* Status-dependent content */}
        {status === 'pending' && (
          <Button variant="glass" onClick={handleClaim} className="w-full">
            Claim Device
          </Button>
        )}

        {status === 'claiming' && (
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Registering...
          </div>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-center gap-2 text-neon-green">
              <Check className="h-5 w-5" />
              <span className="text-sm font-medium">Device registered</span>
            </div>
            <p className="text-xs text-text-muted">
              {deviceInfo.name} is now linked to your Opta account.
              {deviceInfo.callback
                ? ' The device has been notified.'
                : ' You can close this tab.'}
            </p>
            <a
              href="/devices"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-opta-surface/50 text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
            >
              View All Devices
            </a>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-center gap-2 text-neon-red">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Registration failed</span>
            </div>
            <p className="text-xs text-text-muted">{errorMessage}</p>
            <Button variant="glass" size="sm" onClick={handleClaim}>
              Try Again
            </Button>
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-secondary font-mono">{value}</span>
    </div>
  );
}
