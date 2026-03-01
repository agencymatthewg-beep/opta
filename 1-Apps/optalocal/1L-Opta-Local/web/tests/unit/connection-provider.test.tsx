import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ConnectionProvider,
  useConnectionContextSafe,
} from '@/components/shared/ConnectionProvider';
import {
  CONNECTION_SETTINGS_UPDATED_EVENT,
  DEFAULT_SETTINGS,
  getConnectionSettings,
  type ConnectionSettings,
} from '@/lib/connection';
import { useConnection, type UseConnectionReturn } from '@/hooks/useConnection';

vi.mock('@/hooks/useConnection', () => ({
  useConnection: vi.fn(),
}));

vi.mock('@/lib/connection', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/connection')>('@/lib/connection');
  return {
    ...actual,
    getConnectionSettings: vi.fn(),
  };
});

function createConnectionResult(settings: ConnectionSettings): UseConnectionReturn {
  return {
    connectionType: 'lan',
    baseUrl: `http://${settings.host}:${settings.port}`,
    isConnected: true,
    latencyMs: 12,
    error: null,
    diagnostic: 'OK',
    recheckNow: vi.fn(),
    client: {} as UseConnectionReturn['client'],
    adminKey: settings.adminKey,
  };
}

function ContextProbe() {
  const connection = useConnectionContextSafe();

  if (!connection) {
    return <div data-testid="context-output">no-context</div>;
  }

  return (
    <div data-testid="context-output">
      {[
        connection.connectionType,
        connection.baseUrl,
        String(connection.isConnected),
        connection.adminKey,
      ].join('|')}
    </div>
  );
}

describe('ConnectionProvider', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('loads settings and provides connection context to descendants', async () => {
    const settings: ConnectionSettings = {
      ...DEFAULT_SETTINGS,
      host: '10.0.0.42',
      port: 9000,
      adminKey: 'secret-key',
    };

    const getSettingsMock = vi.mocked(getConnectionSettings);
    const useConnectionMock = vi.mocked(useConnection);

    getSettingsMock.mockResolvedValue(settings);
    useConnectionMock.mockImplementation((nextSettings) =>
      createConnectionResult(nextSettings),
    );

    render(
      <ConnectionProvider>
        <ContextProbe />
      </ConnectionProvider>,
    );

    expect(screen.getByTestId('context-output').textContent).toBe('no-context');

    await waitFor(() => {
      expect(screen.getByTestId('context-output').textContent).toBe(
        'lan|http://10.0.0.42:9000|true|secret-key',
      );
    });

    expect(getSettingsMock).toHaveBeenCalledTimes(1);
    expect(useConnectionMock).toHaveBeenCalledWith(settings);
  });

  it('reloads settings when CONNECTION_SETTINGS_UPDATED_EVENT is dispatched', async () => {
    const initialSettings: ConnectionSettings = {
      ...DEFAULT_SETTINGS,
      host: '192.168.1.10',
      port: 1234,
      adminKey: 'alpha',
    };
    const updatedSettings: ConnectionSettings = {
      ...DEFAULT_SETTINGS,
      host: '192.168.1.11',
      port: 2345,
      adminKey: 'beta',
    };

    const getSettingsMock = vi.mocked(getConnectionSettings);
    const useConnectionMock = vi.mocked(useConnection);

    getSettingsMock
      .mockResolvedValueOnce(initialSettings)
      .mockResolvedValueOnce(updatedSettings);
    useConnectionMock.mockImplementation((nextSettings) =>
      createConnectionResult(nextSettings),
    );

    render(
      <ConnectionProvider>
        <ContextProbe />
      </ConnectionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('context-output').textContent).toBe(
        'lan|http://192.168.1.10:1234|true|alpha',
      );
    });

    window.dispatchEvent(new Event(CONNECTION_SETTINGS_UPDATED_EVENT));

    await waitFor(() => {
      expect(screen.getByTestId('context-output').textContent).toBe(
        'lan|http://192.168.1.11:2345|true|beta',
      );
    });

    expect(getSettingsMock).toHaveBeenCalledTimes(2);
    expect(useConnectionMock).toHaveBeenLastCalledWith(updatedSettings);
  });

  it('falls back to DEFAULT_SETTINGS when loading settings fails', async () => {
    const getSettingsMock = vi.mocked(getConnectionSettings);
    const useConnectionMock = vi.mocked(useConnection);

    getSettingsMock.mockRejectedValue(new Error('read failed'));
    useConnectionMock.mockImplementation((nextSettings) =>
      createConnectionResult(nextSettings),
    );

    render(
      <ConnectionProvider>
        <ContextProbe />
      </ConnectionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('context-output').textContent).toBe(
        `lan|http://${DEFAULT_SETTINGS.host}:${DEFAULT_SETTINGS.port}|true|${DEFAULT_SETTINGS.adminKey}`,
      );
    });

    expect(useConnectionMock).toHaveBeenCalledWith(DEFAULT_SETTINGS);
  });
});
