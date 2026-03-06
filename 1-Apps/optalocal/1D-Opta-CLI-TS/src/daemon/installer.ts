import { existsSync, unlinkSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { execa } from 'execa';
import { getDaemonDir } from '../platform/paths.js';
import { isDaemonRunning, readDaemonState } from './lifecycle.js';

const LABEL = 'com.opta.daemon';
const SYSTEMD_SERVICE_NAME = 'opta-daemon';
const SCHTASKS_NAME = 'Opta Daemon';

interface ServiceInvocation {
  executable: string;
  args: string[];
}

function daemonLogDir(): string {
  return getDaemonDir();
}

function splitNonEmptyLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function looksRunnableOnWindows(path: string): boolean {
  return !/\.[A-Za-z0-9]+$/.test(path) || /\.(exe|cmd|bat)$/i.test(path);
}

function pickLookupCandidate(rawOutput: string): string | null {
  const candidates = splitNonEmptyLines(rawOutput);
  if (candidates.length === 0) return null;

  if (process.platform === 'win32') {
    const runnable = candidates.find(looksRunnableOnWindows);
    if (runnable) return runnable;
  }

  return candidates[0] ?? null;
}

async function lookupOptaBinary(): Promise<string | null> {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  try {
    const { stdout } = await execa(lookupCommand, ['opta']);
    return pickLookupCandidate(stdout);
  } catch {
    return null;
  }
}

async function resolveDaemonInvocation(): Promise<ServiceInvocation> {
  const optaBinary = await lookupOptaBinary();
  if (optaBinary) {
    return {
      executable: optaBinary,
      args: ['daemon', 'run'],
    };
  }

  const argvEntry = process.argv[1];
  if (argvEntry) {
    const scriptPath = resolve(argvEntry);
    if (existsSync(scriptPath)) {
      return {
        executable: process.execPath,
        args: [scriptPath, 'daemon', 'run'],
      };
    }
  }

  return {
    executable: process.execPath,
    args: ['daemon', 'run'],
  };
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

function escapeSystemdToken(raw: string): string {
  const inner = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${inner}"`;
}

function buildPlist(invocation: ServiceInvocation, logsDir: string): string {
  const safeStdout = escapeXml(`${logsDir}/launchd-stdout.log`);
  const safeStderr = escapeXml(`${logsDir}/launchd-stderr.log`);
  const argsXml = [invocation.executable, ...invocation.args]
    .map((arg) => `<string>${escapeXml(arg)}</string>`)
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>${argsXml}</array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${safeStdout}</string>
  <key>StandardErrorPath</key><string>${safeStderr}</string>
</dict>
</plist>`;
}

function buildSystemdUnit(invocation: ServiceInvocation): string {
  const execStart = [invocation.executable, ...invocation.args]
    .map((token) => escapeSystemdToken(token))
    .join(' ');

  return `[Unit]
Description=Opta Daemon
After=network.target

[Service]
ExecStart=${execStart}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target`;
}

function escapeWindowsQuoted(raw: string): string {
  return raw.replace(/"/g, '""');
}

function needsWindowsQuotes(raw: string): boolean {
  return /[\s"]/u.test(raw);
}

function formatWindowsArgument(raw: string): string {
  const escaped = escapeWindowsQuoted(raw);
  return needsWindowsQuotes(raw) ? `"${escaped}"` : escaped;
}

function buildWindowsTaskCommand(invocation: ServiceInvocation): string {
  if (/\.(cmd|bat)$/i.test(invocation.executable)) {
    const exe = escapeWindowsQuoted(invocation.executable);
    const tail = invocation.args.map((arg) => escapeWindowsQuoted(arg)).join(' ');
    return `cmd.exe /d /s /c ""${exe}"${tail.length > 0 ? ` ${tail}` : ''}"`;
  }

  return [formatWindowsArgument(invocation.executable), ...invocation.args.map(formatWindowsArgument)]
    .join(' ');
}

async function hasWindowsTask(): Promise<boolean> {
  try {
    const result = await execa('schtasks', ['/Query', '/TN', SCHTASKS_NAME], {
      reject: false,
    });
    return (result.exitCode ?? 1) === 0;
  } catch {
    return false;
  }
}

// --- macOS ---

async function installMacOS(): Promise<void> {
  const invocation = await resolveDaemonInvocation();
  const logsDir = daemonLogDir();
  await mkdir(logsDir, { recursive: true });

  const plist = plistPath();
  await mkdir(dirname(plist), { recursive: true });
  await writeFile(plist, buildPlist(invocation, logsDir), 'utf-8');
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
  const invocation = await resolveDaemonInvocation();
  const servicePath = systemdServicePath();
  await mkdir(dirname(servicePath), { recursive: true });
  await writeFile(servicePath, buildSystemdUnit(invocation), 'utf-8');
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
  const invocation = await resolveDaemonInvocation();
  await execa('schtasks', [
    '/Create',
    '/F',
    '/SC',
    'ONLOGON',
    '/RL',
    'LIMITED',
    '/TN',
    SCHTASKS_NAME,
    '/TR',
    buildWindowsTaskCommand(invocation),
  ]);

  // Best-effort immediate start for the current login session.
  await execa('schtasks', ['/Run', '/TN', SCHTASKS_NAME], { reject: false });
}

async function uninstallWindows(): Promise<void> {
  if (!(await hasWindowsTask())) return;
  await execa('schtasks', ['/Delete', '/F', '/TN', SCHTASKS_NAME]);
}

async function statusWindows(): Promise<'installed-running' | 'installed-stopped' | 'not-installed'> {
  if (!(await hasWindowsTask())) return 'not-installed';

  const state = await readDaemonState();
  if (state && await isDaemonRunning(state)) {
    return 'installed-running';
  }
  return 'installed-stopped';
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
