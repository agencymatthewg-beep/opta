import { existsSync, unlinkSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { execa } from 'execa';

const LABEL = 'com.opta.daemon';
const SYSTEMD_SERVICE_NAME = 'opta-daemon';
const SCHTASKS_NAME = 'Opta Daemon';

function daemonLogDir(): string {
  return join(homedir(), '.config', 'opta', 'daemon');
}

async function getOptaBinPath(): Promise<string> {
  // If running from the installed binary, process.execPath points to node;
  // the actual opta binary is argv[1] only when invoked via `opta`.
  // Prefer `which opta` to find the installed binary.
  try {
    const { stdout } = await execa('which', ['opta']);
    const resolved = stdout.trim();
    if (resolved) return resolved;
  } catch {
    // fall through
  }
  return process.execPath;
}

function plistPath(): string {
  return join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

function systemdServicePath(): string {
  return join(homedir(), '.config', 'systemd', 'user', `${SYSTEMD_SERVICE_NAME}.service`);
}

/** Escape a string for safe embedding inside an XML <string> element. */
function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Produce a systemd-safe ExecStart path.
 * Paths containing spaces must be quoted; systemd uses shell quoting rules
 * for ExecStart only when the path starts with `-`, `@`, `+`, `!` or `!!`.
 * The safest approach is to wrap in double-quotes and escape internal quotes.
 */
function escapeSystemdExecPath(raw: string): string {
  // systemd accepts C-style escaped strings. Wrap in double-quotes and
  // escape backslashes and double-quotes inside the path.
  const inner = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${inner}"`;
}

function buildPlist(optaBin: string, logsDir: string): string {
  const safeOptaBin = escapeXml(optaBin);
  const safeStdout = escapeXml(`${logsDir}/launchd-stdout.log`);
  const safeStderr = escapeXml(`${logsDir}/launchd-stderr.log`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${safeOptaBin}</string><string>daemon</string><string>run</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${safeStdout}</string>
  <key>StandardErrorPath</key><string>${safeStderr}</string>
</dict>
</plist>`;
}

function buildSystemdUnit(optaBin: string): string {
  const safeOptaBin = escapeSystemdExecPath(optaBin);
  return `[Unit]
Description=Opta Daemon
After=network.target

[Service]
ExecStart=${safeOptaBin} daemon run
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target`;
}

// --- macOS ---

async function installMacOS(): Promise<void> {
  const optaBin = await getOptaBinPath();
  const logsDir = daemonLogDir();
  await mkdir(logsDir, { recursive: true });

  const plist = plistPath();
  await mkdir(dirname(plist), { recursive: true });
  await writeFile(plist, buildPlist(optaBin, logsDir), 'utf-8');
  await execa('launchctl', ['load', '-w', plist]);
}

async function uninstallMacOS(): Promise<void> {
  const plist = plistPath();
  if (existsSync(plist)) {
    try {
      await execa('launchctl', ['unload', '-w', plist]);
    } catch {
      // Service may not be loaded
    }
    unlinkSync(plist);
  }
}

async function statusMacOS(): Promise<'installed-running' | 'installed-stopped' | 'not-installed'> {
  if (!existsSync(plistPath())) return 'not-installed';
  try {
    await execa('launchctl', ['list', LABEL]);
    return 'installed-running';
  } catch {
    return 'installed-stopped';
  }
}

// --- Linux ---

async function installLinux(): Promise<void> {
  const optaBin = await getOptaBinPath();
  const servicePath = systemdServicePath();
  await mkdir(dirname(servicePath), { recursive: true });
  await writeFile(servicePath, buildSystemdUnit(optaBin), 'utf-8');
  await execa('systemctl', ['--user', 'enable', '--now', SYSTEMD_SERVICE_NAME]);
}

async function uninstallLinux(): Promise<void> {
  try {
    await execa('systemctl', ['--user', 'disable', '--now', SYSTEMD_SERVICE_NAME]);
  } catch {
    // Service may not exist
  }
  const servicePath = systemdServicePath();
  if (existsSync(servicePath)) {
    unlinkSync(servicePath);
  }
}

async function statusLinux(): Promise<'installed-running' | 'installed-stopped' | 'not-installed'> {
  if (!existsSync(systemdServicePath())) return 'not-installed';
  try {
    const { stdout } = await execa('systemctl', [
      '--user',
      'is-active',
      SYSTEMD_SERVICE_NAME,
    ]);
    return stdout.trim() === 'active' ? 'installed-running' : 'installed-stopped';
  } catch {
    return 'installed-stopped';
  }
}

// --- Windows ---

async function installWindows(): Promise<void> {
  const optaBin = await getOptaBinPath();
  // schtasks /TR expects a quoted command string. Paths containing double-quotes
  // must have those quotes escaped as "". Wrapping the binary path in quotes
  // handles spaces in the install prefix.
  const safeOptaBin = optaBin.replace(/"/g, '""');
  await execa('schtasks', [
    '/Create',
    '/F',
    '/SC',
    'ONLOGON',
    '/TN',
    SCHTASKS_NAME,
    '/TR',
    `"${safeOptaBin}" daemon run`,
  ]);
}

async function uninstallWindows(): Promise<void> {
  await execa('schtasks', ['/Delete', '/F', '/TN', SCHTASKS_NAME]);
}

async function statusWindows(): Promise<'installed-running' | 'installed-stopped' | 'not-installed'> {
  try {
    const { stdout } = await execa('schtasks', ['/Query', '/TN', SCHTASKS_NAME, '/FO', 'CSV']);
    if (stdout.includes('Running')) return 'installed-running';
    return 'installed-stopped';
  } catch {
    return 'not-installed';
  }
}

// --- Public API ---

export async function installDaemonService(): Promise<void> {
  switch (process.platform) {
    case 'darwin':
      return installMacOS();
    case 'linux':
      return installLinux();
    case 'win32':
      return installWindows();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

export async function uninstallDaemonService(): Promise<void> {
  switch (process.platform) {
    case 'darwin':
      return uninstallMacOS();
    case 'linux':
      return uninstallLinux();
    case 'win32':
      return uninstallWindows();
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

export async function getDaemonServiceStatus(): Promise<
  'installed-running' | 'installed-stopped' | 'not-installed'
> {
  switch (process.platform) {
    case 'darwin':
      return statusMacOS();
    case 'linux':
      return statusLinux();
    case 'win32':
      return statusWindows();
    default:
      return 'not-installed';
  }
}
