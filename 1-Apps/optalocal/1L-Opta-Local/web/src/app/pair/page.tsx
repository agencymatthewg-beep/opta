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
import {
  Server,
  Monitor,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Info,
} from 'lucide-react';
import { Button, cn } from '@opta/ui';

import { useAuthSafe } from '@/components/shared/AuthProvider';
import { buildAccountSignInHref } from '@/lib/auth-utils';
import type { DeviceRole } from '@/types/cloud';

type PairStatus = 'pending' | 'claiming' | 'success' | 'error';
type CallbackStatus =
  | 'idle'
  | 'sending'
  | 'success'
  | 'failed'
  | 'not_required';
type StepState = 'upcoming' | 'active' | 'done' | 'warning';

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
  const pairNextPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/pair?${query}` : '/pair';
  }, [searchParams]);
  const signInHref = useMemo(
    () => buildAccountSignInHref(pairNextPath),
    [pairNextPath],
  );

  // Parse device info from query params
  const deviceInfo = useMemo(() => {
    const requestedRole = searchParams.get('role');
    const role: DeviceRole =
      requestedRole === 'llm_host' ? 'llm_host' : 'workstation';
    const requestedPort = Number(searchParams.get('lan_port'));

    return {
      name: searchParams.get('device_name') ?? 'Unknown Device',
      role,
      hostname: searchParams.get('hostname') ?? null,
      lan_ip: searchParams.get('lan_ip') ?? null,
      lan_port:
        Number.isFinite(requestedPort) && requestedPort > 0 ? requestedPort : 1234,
      callback: searchParams.get('callback') ?? null,
    };
  }, [searchParams]);

  const [status, setStatus] = useState<PairStatus>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [callbackStatus, setCallbackStatus] = useState<CallbackStatus>('idle');
  const [callbackMessage, setCallbackMessage] = useState<string | null>(null);
  const [pairedDeviceId, setPairedDeviceId] = useState<string | null>(null);

  const RoleIcon = deviceInfo.role === 'llm_host' ? Server : Monitor;
  const roleLabel =
    deviceInfo.role === 'llm_host' ? 'LLM Host' : 'Workstation';

  const handleClaim = useCallback(async () => {
    if (!auth?.supabase || !auth.user) return;

    setStatus('claiming');
    setErrorMessage(null);
    setPairedDeviceId(null);
    setCallbackStatus(deviceInfo.callback ? 'idle' : 'not_required');
    setCallbackMessage(null);

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

      setPairedDeviceId(deviceId);
      setStatus('success');

      // If a callback URL was provided, send the device ID back
      if (deviceInfo.callback) {
        setCallbackStatus('sending');
        try {
          const callbackResponse = await fetch(deviceInfo.callback, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              device_id: deviceId,
              user_id: auth.user.id,
              status: 'paired',
            }),
          });

          if (!callbackResponse.ok) {
            throw new Error(`Callback returned ${callbackResponse.status}`);
          }

          setCallbackStatus('success');
          setCallbackMessage('Device callback confirmed pairing.');
        } catch {
          // Callback failure is non-fatal — device is registered either way
          console.warn('[pair] Failed to notify device callback');
          setCallbackStatus('failed');
          setCallbackMessage(
            'Device callback failed. Re-run the pairing command on the device to retry.',
          );
        }
      } else {
        setCallbackStatus('not_required');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to register device',
      );
    }
  }, [auth, deviceInfo]);

  const stepStates = useMemo(
    () => ({
      review:
        status === 'pending' ? 'active' : ('done' as StepState),
      claim:
        status === 'error'
          ? ('warning' as StepState)
          : status === 'pending' || status === 'claiming'
            ? ('active' as StepState)
            : ('done' as StepState),
      callback: deviceInfo.callback
        ? status !== 'success'
          ? ('upcoming' as StepState)
          : callbackStatus === 'failed'
            ? ('warning' as StepState)
            : callbackStatus === 'success' || callbackStatus === 'not_required'
              ? ('done' as StepState)
              : ('active' as StepState)
        : status === 'success'
          ? ('done' as StepState)
          : ('upcoming' as StepState),
    }),
    [callbackStatus, deviceInfo.callback, status],
  );

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
          <p className="text-xs text-text-muted mb-5">
            After sign-in, you will return here to confirm pairing.
          </p>
          <a
            href={signInHref}
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
        className="glass-subtle rounded-xl p-6 md:p-8 max-w-lg w-full border border-opta-border"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <RoleIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">
              Pair {deviceInfo.name}
            </h1>
            <p className="text-xs text-text-muted mt-1">
              Register this {roleLabel} to your Opta account.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-opta-border bg-opta-surface/40 p-3 mb-5 space-y-2">
          <PairingStep
            step={1}
            title="Review device details"
            description="Confirm this is the machine you intended to pair."
            state={stepStates.review}
          />
          <PairingStep
            step={2}
            title="Claim device in cloud"
            description="Creates or updates this device record in your account."
            state={stepStates.claim}
          />
          <PairingStep
            step={3}
            title={deviceInfo.callback ? 'Notify local callback' : 'Finish pairing'}
            description={
              deviceInfo.callback
                ? 'Sends pairing confirmation back to the waiting device process.'
                : 'No callback URL provided. You can close this tab after success.'
            }
            state={stepStates.callback}
          />
        </div>

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
          {deviceInfo.callback && (
            <DetailLine label="Callback" value="Configured" />
          )}
        </div>

        {/* Status-dependent content */}
        {status === 'pending' && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              Ready to link this device? You can safely retry if the network is
              interrupted.
            </p>
            <Button variant="glass" onClick={handleClaim} className="w-full">
              Claim Device
            </Button>
          </div>
        )}

        {status === 'claiming' && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Claiming device and updating cloud record...
            </div>
          </div>
        )}

        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-neon-green">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Device registered</span>
            </div>
            <p className="text-xs text-text-muted text-left">
              {deviceInfo.name} is linked to your account.
            </p>
            {pairedDeviceId && (
              <div className="rounded-lg border border-opta-border p-2">
                <DetailLine label="Device ID" value={pairedDeviceId} />
              </div>
            )}
            {deviceInfo.callback && (
              <div
                className={cn(
                  'rounded-lg border p-3 text-left',
                  callbackStatus === 'failed'
                    ? 'border-neon-red/20 bg-neon-red/5'
                    : callbackStatus === 'success'
                      ? 'border-neon-green/20 bg-neon-green/5'
                      : 'border-primary/20 bg-primary/5',
                )}
              >
                <p
                  className={cn(
                    'text-xs font-medium flex items-center gap-2',
                    callbackStatus === 'failed'
                      ? 'text-neon-red'
                      : callbackStatus === 'success'
                        ? 'text-neon-green'
                        : 'text-text-secondary',
                  )}
                >
                  {callbackStatus === 'failed' ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : callbackStatus === 'success' ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  {callbackStatus === 'failed'
                    ? 'Callback not delivered'
                    : callbackStatus === 'success'
                      ? 'Callback delivered'
                      : 'Notifying callback...'}
                </p>
                {callbackMessage && (
                  <p className="text-xs text-text-muted mt-1">{callbackMessage}</p>
                )}
              </div>
            )}
            {!deviceInfo.callback && (
              <div className="rounded-lg border border-opta-border p-3 text-left">
                <p className="text-xs text-text-secondary flex items-center gap-2">
                  <Info className="h-3.5 w-3.5" />
                  No callback URL was provided. You can close this tab.
                </p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <a
                href="/devices"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-opta-surface/50 text-text-secondary hover:text-text-primary text-xs font-medium transition-colors"
              >
                View All Devices
              </a>
              {callbackStatus === 'failed' && (
                <Button variant="glass" size="sm" onClick={handleClaim}>
                  Retry Callback
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2 text-neon-red">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Registration failed</span>
            </div>
            <p className="text-xs text-text-muted text-left">{errorMessage}</p>
            <p className="text-xs text-text-muted text-left">
              Confirm you are signed in and that this device can reach Supabase,
              then retry.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="glass" size="sm" onClick={handleClaim}>
                Try Again
              </Button>
              <a
                href="/devices"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </a>
            </div>
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
      <span className="text-text-secondary font-mono break-all text-right pl-3">
        {value}
      </span>
    </div>
  );
}

function PairingStep({
  step,
  title,
  description,
  state,
}: {
  step: number;
  title: string;
  description: string;
  state: StepState;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={cn(
          'mt-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center',
          state === 'done' && 'bg-neon-green/15 text-neon-green',
          state === 'active' && 'bg-primary/15 text-primary',
          state === 'warning' && 'bg-neon-red/15 text-neon-red',
          state === 'upcoming' && 'bg-opta-surface text-text-muted',
        )}
      >
        {step}
      </span>
      <div className="space-y-0.5">
        <p
          className={cn(
            'text-xs font-medium',
            state === 'warning' ? 'text-neon-red' : 'text-text-primary',
          )}
        >
          {title}
        </p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
    </div>
  );
}
