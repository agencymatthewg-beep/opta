'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, cn } from '@opta/ui';
import {
  Boxes,
  Loader2,
  RefreshCw,
  FlaskConical,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { OptaStatusPill, OptaSurface } from '@/components/shared/OptaPrimitives';

type RequestState = 'idle' | 'loading' | 'success' | 'error';
type ServicesAction = 'test' | 'setup';

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response
      .json()
      .catch(() => ({ error: 'Response was not valid JSON' }));
  }

  const text = await response.text().catch(() => '');
  return text ? { message: text } : null;
}

export default function ServicesSettingsPage() {
  const [statusState, setStatusState] = useState<RequestState>('idle');
  const [statusPayload, setStatusPayload] = useState<unknown>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [payloadText, setPayloadText] = useState('{}');
  const [actionState, setActionState] = useState<RequestState>('idle');
  const [actionType, setActionType] = useState<ServicesAction | null>(null);
  const [actionPayload, setActionPayload] = useState<unknown>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatusState('loading');
    setStatusError(null);

    try {
      const response = await fetch('/api/services/status', {
        method: 'GET',
        cache: 'no-store',
      });

      const payload = await readJsonResponse(response);

      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof payload.error === 'string'
            ? payload.error
            : `Status check failed (${response.status})`;
        throw new Error(message);
      }

      setStatusPayload(payload);
      setStatusState('success');
    } catch (error) {
      setStatusState('error');
      setStatusError(
        error instanceof Error
          ? error.message
          : 'Failed to fetch services status',
      );
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const runAction = useCallback(
    async (action: ServicesAction) => {
      let payload: unknown = {};

      try {
        if (payloadText.trim()) {
          payload = JSON.parse(payloadText) as unknown;
        }
      } catch {
        setActionState('error');
        setActionType(action);
        setActionError('Payload must be valid JSON');
        return;
      }

      setActionState('loading');
      setActionType(action);
      setActionError(null);

      try {
        const response = await fetch(`/api/services/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const body = await readJsonResponse(response);

        if (!response.ok) {
          const message =
            typeof body === 'object' &&
            body !== null &&
            'error' in body &&
            typeof body.error === 'string'
              ? body.error
              : `${action} failed (${response.status})`;
          throw new Error(message);
        }

        setActionPayload(body);
        setActionState('success');
        void refreshStatus();
      } catch (error) {
        setActionState('error');
        setActionError(
          error instanceof Error ? error.message : `Failed to ${action} services`,
        );
      }
    },
    [payloadText, refreshStatus],
  );

  const statusLabel = useMemo(() => {
    if (statusState === 'loading') return 'Checking status...';
    if (statusState === 'success') return 'Status loaded';
    if (statusState === 'error') return statusError ?? 'Status unavailable';
    return 'Idle';
  }, [statusError, statusState]);

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Services</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Inspect and manage daemon-managed service integrations.
        </p>
      </div>

      <OptaSurface hierarchy="raised" padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-neon-blue" />
            <h3 className="text-base font-semibold text-text-primary">
              Service Status
            </h3>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => void refreshStatus()}
            disabled={statusState === 'loading'}
          >
            {statusState === 'loading' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>

        <OptaStatusPill
          status={
            statusState === 'success'
              ? 'success'
              : statusState === 'error'
                ? 'danger'
                : 'neutral'
          }
          label={statusLabel}
          icon={
            statusState === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : undefined
          }
        />

        <pre className="max-h-80 overflow-auto rounded-xl border border-opta-border bg-opta-surface p-4 text-xs text-text-secondary">
          {JSON.stringify(statusPayload, null, 2)}
        </pre>
      </OptaSurface>

      <OptaSurface hierarchy="base" padding="lg" className="space-y-5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-neon-amber" />
          <h3 className="text-base font-semibold text-text-primary">
            Test / Setup
          </h3>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="services-payload"
            className="text-sm font-medium text-text-secondary"
          >
            Request Payload (JSON)
          </label>
          <textarea
            id="services-payload"
            value={payloadText}
            onChange={(event) => setPayloadText(event.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full rounded-xl border border-opta-border bg-opta-surface px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="{}"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="md"
            onClick={() => void runAction('test')}
            disabled={actionState === 'loading'}
          >
            {actionState === 'loading' && actionType === 'test' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <FlaskConical className="mr-2 h-4 w-4" />
                Test Services
              </>
            )}
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => void runAction('setup')}
            disabled={actionState === 'loading'}
          >
            {actionState === 'loading' && actionType === 'setup' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                <Wrench className="mr-2 h-4 w-4" />
                Setup Services
              </>
            )}
          </Button>
        </div>

        {(actionError !== null || actionPayload !== null) && (
          <div
            className={cn(
              'space-y-2 rounded-xl border p-3',
              actionError
                ? 'border-neon-red/30 bg-neon-red/5'
                : 'border-opta-border bg-opta-surface',
            )}
          >
            {actionError ? (
              <p className="text-sm text-neon-red">{actionError}</p>
            ) : (
              <pre className="max-h-80 overflow-auto text-xs text-text-secondary">
                {JSON.stringify(actionPayload, null, 2)}
              </pre>
            )}
          </div>
        )}
      </OptaSurface>
    </div>
  );
}
