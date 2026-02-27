'use client';

import { useEffect } from 'react';

import { CopyableValue } from '@/components/shared/CopyableValue';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteAction {
  label: string;
  command: string;
  run?: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions: PaletteAction[] = [
    {
      label: 'Open Operations',
      command: '/operations',
      run: () => {
        window.location.assign('/operations');
        onClose();
      },
    },
    {
      label: 'Open Agent Runs',
      command: '/agents/runs',
      run: () => {
        window.location.assign('/agents/runs');
        onClose();
      },
    },
    {
      label: 'Open Skills',
      command: '/skills',
      run: () => {
        window.location.assign('/skills');
        onClose();
      },
    },
    {
      label: 'Run Parity Gate',
      command: 'pnpm check:parity',
    },
  ];

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/35 p-4 pt-20">
      <button
        type="button"
        aria-label="Close palette"
        className="absolute inset-0"
        onClick={onClose}
      />
      <section className="relative z-10 w-full max-w-xl rounded-xl border border-opta-border bg-white p-4 shadow-2xl">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Command Palette</h2>
        <div className="space-y-2">
          {actions.map((action) => (
            <div key={action.label} className="rounded border border-opta-border p-2">
              <CopyableValue label={action.label} value={action.command} mono />
              {action.run ? (
                <button
                  type="button"
                  className="mt-2 rounded border border-opta-border px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
                  onClick={action.run}
                >
                  Run now
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

