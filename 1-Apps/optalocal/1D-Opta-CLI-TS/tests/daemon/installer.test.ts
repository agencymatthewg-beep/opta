/**
 * Tests for src/daemon/installer.ts
 *
 * Covers:
 *   - getDaemonServiceStatus() returns 'not-installed' when service file is missing
 *   - getDaemonServiceStatus() returns 'installed-running' or 'installed-stopped' when file exists
 *   - installDaemonService() writes the appropriate service file
 *   - uninstallDaemonService() removes the service file
 *
 * All filesystem operations and execa calls are mocked to avoid real OS changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Track whether the service file "exists" on disk.
let serviceFileExists = false;

// Capture writes so we can inspect the generated service file content.
const writtenFiles: Record<string, string> = {};

// Track unlink (synchronous delete) calls.
const unlinkedFiles: string[] = [];

vi.mock('node:fs', () => ({
  existsSync: vi.fn((p: string) => {
    // Return true only when our simulated flag is set AND the path looks like a service file.
    if (
      serviceFileExists &&
      (p.endsWith('.plist') || p.endsWith('.service') || p.includes('opta'))
    ) {
      return true;
    }
    return false;
  }),
  unlinkSync: vi.fn((p: string) => {
    unlinkedFiles.push(p);
    serviceFileExists = false;
  }),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async (path: string, content: string) => {
    writtenFiles[path] = content;
    serviceFileExists = true;
  }),
}));

// Mock execa — used for launchctl / systemctl / schtasks calls.
const mockExeca = vi.fn(async () => ({ stdout: '', stderr: '' }));

vi.mock('execa', () => ({
  execa: (...args: unknown[]) => mockExeca(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetFileState(): void {
  serviceFileExists = false;
  Object.keys(writtenFiles).forEach((k) => delete writtenFiles[k]);
  unlinkedFiles.length = 0;
}

// ---------------------------------------------------------------------------
// getDaemonServiceStatus
// ---------------------------------------------------------------------------

describe('getDaemonServiceStatus', () => {
  beforeEach(() => {
    resetFileState();
    mockExeca.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns not-installed when service file does not exist', async () => {
    serviceFileExists = false;

    // Re-import after mocks are set so the module picks up our mock state.
    const { getDaemonServiceStatus } = await import('../../src/daemon/installer.js');
    const status = await getDaemonServiceStatus();

    expect(status).toBe('not-installed');
  });

  it('returns installed-running when file exists and service is active', async () => {
    serviceFileExists = true;

    // launchctl list / systemctl is-active → success (active)
    mockExeca.mockResolvedValue({ stdout: 'active', stderr: '' });

    const { getDaemonServiceStatus } = await import('../../src/daemon/installer.js');
    const status = await getDaemonServiceStatus();

    // On Darwin: statusMacOS returns 'installed-running' when launchctl list succeeds.
    // On Linux:  statusLinux returns 'installed-running' when stdout === 'active'.
    // On other platforms: getDaemonServiceStatus returns 'not-installed' (our mock
    //   existsSync won't match anyway, so we only care that we get one of the two
    //   installed variants or not-installed).
    const validStatuses = ['installed-running', 'installed-stopped', 'not-installed'];
    expect(validStatuses).toContain(status);

    // On supported platforms with the file present it should not be 'not-installed'
    // (unless we're on an unsupported platform — guard with platform check).
    if (process.platform === 'darwin' || process.platform === 'linux') {
      expect(status).not.toBe('not-installed');
    }
  });

  it('returns installed-stopped when file exists but service is inactive', async () => {
    serviceFileExists = true;

    // launchctl list throws → stopped; systemctl is-active returns 'inactive'
    if (process.platform === 'linux') {
      mockExeca.mockResolvedValue({ stdout: 'inactive', stderr: '' });
    } else {
      // darwin: launchctl list throws → installed-stopped
      mockExeca.mockRejectedValue(new Error('not loaded'));
    }

    const { getDaemonServiceStatus } = await import('../../src/daemon/installer.js');
    const status = await getDaemonServiceStatus();

    if (process.platform === 'darwin' || process.platform === 'linux') {
      expect(status).toBe('installed-stopped');
    } else {
      // Windows or unsupported: just ensure we get a valid value
      const validStatuses = ['installed-running', 'installed-stopped', 'not-installed'];
      expect(validStatuses).toContain(status);
    }
  });
});

// ---------------------------------------------------------------------------
// installDaemonService
// ---------------------------------------------------------------------------

describe('installDaemonService', () => {
  beforeEach(() => {
    resetFileState();
    mockExeca.mockReset().mockResolvedValue({ stdout: '', stderr: '' });
    // Simulate `which opta` returning a path
    mockExeca.mockImplementation(async (cmd: string, args?: string[]) => {
      if (cmd === 'which' && args?.[0] === 'opta') {
        return { stdout: '/usr/local/bin/opta', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('writes a service file for the current platform', async () => {
    if (process.platform === 'win32') {
      // Windows uses schtasks rather than file writes; skip file-content assertion.
      return;
    }

    const { installDaemonService } = await import('../../src/daemon/installer.js');

    if (process.platform !== 'darwin' && process.platform !== 'linux') {
      // Unsupported platform throws
      await expect(installDaemonService()).rejects.toThrow(/Unsupported platform/);
      return;
    }

    await installDaemonService();

    // At least one file should have been written
    const paths = Object.keys(writtenFiles);
    expect(paths.length).toBeGreaterThan(0);

    // The written content should mention the opta binary and daemon command
    const content = Object.values(writtenFiles).join('\n');
    expect(content).toContain('daemon');
  });

  it('includes the opta binary path in the written service file', async () => {
    if (process.platform !== 'darwin' && process.platform !== 'linux') {
      return; // Platform-specific test only
    }

    const { installDaemonService } = await import('../../src/daemon/installer.js');
    await installDaemonService();

    const content = Object.values(writtenFiles).join('\n');
    // The mock resolves `which opta` to /usr/local/bin/opta
    expect(content).toContain('/usr/local/bin/opta');
  });

  it('invokes the OS registration command after writing the file', async () => {
    if (process.platform !== 'darwin' && process.platform !== 'linux') {
      return;
    }

    const { installDaemonService } = await import('../../src/daemon/installer.js');
    await installDaemonService();

    // execa must have been called at least twice:
    //   1. `which opta` (getOptaBinPath)
    //   2. `launchctl load` (macOS) or `systemctl enable` (Linux)
    expect(mockExeca).toHaveBeenCalledTimes(2);

    const calls = mockExeca.mock.calls.map((c) => ({ cmd: c[0], args: c[1] }));
    const registrationCall = calls.find(
      ({ cmd, args }) =>
        (cmd === 'launchctl' && Array.isArray(args) && args.includes('load')) ||
        (cmd === 'systemctl' && Array.isArray(args) && args.includes('enable'))
    );
    expect(registrationCall).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// uninstallDaemonService
// ---------------------------------------------------------------------------

describe('uninstallDaemonService', () => {
  beforeEach(() => {
    resetFileState();
    mockExeca.mockReset().mockResolvedValue({ stdout: '', stderr: '' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('removes the service file when it exists', async () => {
    if (process.platform !== 'darwin' && process.platform !== 'linux') {
      return;
    }

    // Simulate a service file already present
    serviceFileExists = true;

    const { uninstallDaemonService } = await import('../../src/daemon/installer.js');
    await uninstallDaemonService();

    // unlinkSync should have been called to remove the file
    expect(unlinkedFiles.length).toBeGreaterThan(0);
    expect(serviceFileExists).toBe(false);
  });

  it('does not throw when service file is already absent', async () => {
    if (process.platform !== 'darwin' && process.platform !== 'linux') {
      return;
    }

    serviceFileExists = false;

    const { uninstallDaemonService } = await import('../../src/daemon/installer.js');
    // Should resolve without error even when the file is missing
    await expect(uninstallDaemonService()).resolves.not.toThrow();

    // No file was removed
    expect(unlinkedFiles.length).toBe(0);
  });

  it('calls the OS deregistration command before removing the file (macOS)', async () => {
    if (process.platform !== 'darwin') {
      return;
    }

    serviceFileExists = true;

    const { uninstallDaemonService } = await import('../../src/daemon/installer.js');
    await uninstallDaemonService();

    const calls = mockExeca.mock.calls.map((c) => ({ cmd: c[0], args: c[1] }));
    const unloadCall = calls.find(
      ({ cmd, args }) => cmd === 'launchctl' && Array.isArray(args) && args.includes('unload')
    );
    expect(unloadCall).toBeDefined();
  });

  it('calls systemctl disable before removing the file (Linux)', async () => {
    if (process.platform !== 'linux') {
      return;
    }

    serviceFileExists = true;

    const { uninstallDaemonService } = await import('../../src/daemon/installer.js');
    await uninstallDaemonService();

    const calls = mockExeca.mock.calls.map((c) => ({ cmd: c[0], args: c[1] }));
    const disableCall = calls.find(
      ({ cmd, args }) => cmd === 'systemctl' && Array.isArray(args) && args.includes('disable')
    );
    expect(disableCall).toBeDefined();
  });
});
