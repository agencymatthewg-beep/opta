'use client';

import { useMemo, useState } from 'react';

import { CapabilityList } from '@/components/operations/CapabilityList';
import { CapabilityPanel } from '@/components/operations/CapabilityPanel';
import parityArtifact from '@/lib/capabilities/parity.generated.json';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';

export default function OperationsPage() {
  const connection = useConnectionContextSafe();
  const baseUrl = connection?.baseUrl ?? '';
  const adminKey = connection?.adminKey ?? '';

  const capabilities = useMemo(
    () => [...parityArtifact.byCategory.in_lmx_not_dashboard].sort(),
    [],
  );

  const [selectedPath, setSelectedPath] = useState<string | null>(
    capabilities[0] ?? null,
  );

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-text-primary">Operations</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Capability parity console for LMX endpoints not yet surfaced in primary
          dashboard workflows.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
        <CapabilityList
          capabilities={capabilities}
          selectedPath={selectedPath}
          onSelect={setSelectedPath}
        />
        <CapabilityPanel
          endpointPath={selectedPath}
          baseUrl={baseUrl}
          adminKey={adminKey}
        />
      </div>
    </main>
  );
}

