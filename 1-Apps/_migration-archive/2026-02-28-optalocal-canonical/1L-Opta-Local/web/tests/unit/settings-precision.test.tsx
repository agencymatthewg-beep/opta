import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SettingsPage from '@/app/settings/page';
import { SETTINGS_CHANGE_GUARD } from '@/lib/safety/change-scope-guard';

describe('settings precision guard', () => {
  afterEach(() => {
    cleanup();
  });

  it('rejects unrelated key mutations for connection:update scope', () => {
    const before = {
      host: '192.168.188.11',
      port: 1234,
      adminKey: '',
      useTunnel: false,
      tunnelUrl: '',
      densityMode: 'compact',
    };
    const after = {
      ...before,
      host: '10.0.0.42',
      densityMode: 'comfortable',
    };

    const validation = SETTINGS_CHANGE_GUARD.validate('connection:update', before, after);
    expect(validation.ok).toBe(false);
    expect(validation.blockedKeys).toEqual(['densityMode']);
  });

  it('applies scoped host change without mutating density setting', () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByTestId('settings-host-input'), {
      target: { value: '10.10.1.5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Connection Settings' }));

    expect(screen.getByTestId('applied-host').textContent).toBe('10.10.1.5');
    expect(screen.getByTestId('applied-density').textContent).toBe('compact');
  });

  it('blocks apply when unrelated setting changed in same mutation', () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByTestId('settings-host-input'), {
      target: { value: '10.10.1.5' },
    });
    fireEvent.change(screen.getByLabelText('Density Mode (unrelated)'), {
      target: { value: 'comfortable' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Connection Settings' }));

    expect(screen.getByText(/blocked change/i).textContent).toContain('densityMode');
    expect(screen.getByTestId('applied-host').textContent).toBe('192.168.188.11');
    expect(screen.getByTestId('applied-density').textContent).toBe('compact');
  });
});

