import { randomBytes } from 'node:crypto';
import chalk from 'chalk';
import { execa } from 'execa';
import { getConfigStore, loadConfig } from '../core/config.js';
import { ExitError, EXIT } from '../core/errors.js';
import { resolveRemoteHostCandidates, selectReachableRemoteHost } from './update.js';

const SSH_CONNECT_TIMEOUT_SECONDS = 25;

export type KeySource = 'env' | 'config' | 'unset';

interface ResolvedKey {
  key: string | null;
  source: KeySource;
}

interface SshConfig {
  host: string;
  user: string;
  identityFile?: string;
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface KeyCreateOptions {
  value?: string;
  remote?: boolean;
  copy?: boolean;
  json?: boolean;
}

interface KeyShowOptions {
  reveal?: boolean;
  copy?: boolean;
  json?: boolean;
}

interface KeyCopyOptions {
  json?: boolean;
}

interface ParsedRemotePath {
  configPath: string | null;
}

function quoteSh(input: string): string {
  return `'${input.replace(/'/g, `'"'"'`)}'`;
}

function expandHome(input: string): string {
  if (!input.startsWith('~')) return input;
  const home = process.env['HOME'] ?? '';
  return input.replace(/^~(?=$|\/)/, home);
}

function isLocalHost(host: string): boolean {
  const lower = host.trim().toLowerCase();
  return lower === 'localhost' || lower === '127.0.0.1';
}

function summarizeOutput(raw: string): string {
  const line = raw
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return line ?? 'unknown error';
}

export function generateOptaInferenceKey(): string {
  return `opta_sk_${randomBytes(24).toString('base64url')}`;
}

export function maskKey(key: string): string {
  if (!key) return '(none)';
  if (key.length <= 10) return '*'.repeat(key.length);
  return `${key.slice(0, 7)}${'*'.repeat(Math.max(0, key.length - 11))}${key.slice(-4)}`;
}

export function resolveConfiguredInferenceKey(connection: { apiKey?: string }): ResolvedKey {
  const envKey = process.env['OPTA_API_KEY']?.trim();
  if (envKey) {
    return { key: envKey, source: 'env' };
  }

  const configKey = connection.apiKey?.trim();
  if (configKey) {
    return { key: configKey, source: 'config' };
  }

  return { key: null, source: 'unset' };
}

function parseRemoteConfigPath(output: string): ParsedRemotePath {
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim();
    const match = /^__LMX_CFG_PATH__:(.+)$/.exec(line);
    if (match) {
      return { configPath: match[1] ?? null };
    }
  }
  return { configPath: null };
}

async function runRemoteCommand(ssh: SshConfig, command: string): Promise<CommandResult> {
  const commandWithPath = `export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH; ${command}`;
  const args: string[] = [
    '-o', 'BatchMode=yes',
    '-o', `ConnectTimeout=${SSH_CONNECT_TIMEOUT_SECONDS}`,
    '-o', 'ServerAliveInterval=5',
    '-o', 'ServerAliveCountMax=2',
  ];

  if (ssh.identityFile) {
    args.push('-i', ssh.identityFile);
  }
  args.push(`${ssh.user}@${ssh.host}`, `bash -lc ${quoteSh(commandWithPath)}`);

  const result = await execa('ssh', args, { reject: false });
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function selectRemoteHost(
  host: string,
  fallbackHosts: readonly string[],
  sshUser: string,
  identityFile?: string,
): Promise<{ selectedHost: string | null; detail: string }> {
  const candidates = resolveRemoteHostCandidates(host, fallbackHosts);
  const selection = await selectReachableRemoteHost(candidates, async (candidateHost) => {
    return runRemoteCommand(
      {
        host: candidateHost,
        user: sshUser,
        identityFile,
      },
      'echo connected',
    );
  });

  if (!selection.selectedHost) {
    const detail = selection.probes.map((probe) => `${probe.host}: ${summarizeOutput(probe.detail)}`).join('; ');
    return { selectedHost: null, detail: detail || 'ssh probe failed' };
  }

  return { selectedHost: selection.selectedHost, detail: 'ok' };
}

async function applyRemoteInferenceKey(
  ssh: SshConfig,
  lmxPath: string,
  key: string,
): Promise<{ ok: boolean; configPath?: string; message: string }> {
  const script = [
    `OPTA_LMX_PATH=${quoteSh(lmxPath)};`,
    `OPTA_INFERENCE_KEY=${quoteSh(key)};`,
    'export OPTA_LMX_PATH OPTA_INFERENCE_KEY;',
    "python3 - <<'PY'",
    'import os, re, sys',
    'from pathlib import Path',
    '',
    'lmx_path = Path(os.environ["OPTA_LMX_PATH"]).expanduser()',
    'key = os.environ["OPTA_INFERENCE_KEY"]',
    '',
    'candidates = [',
    '    lmx_path / "config" / "config.yaml",',
    '    Path.home() / ".opta-lmx" / "config.yaml",',
    '    lmx_path / "config" / "mono512-current.yaml",',
    '    lmx_path / "config" / "default-config.yaml",',
    ']',
    'target = None',
    'for c in candidates:',
    '    if c.exists():',
    '        target = c',
    '        break',
    '',
    'if target is None:',
    '    print("__LMX_CFG_ERROR__:config_not_found")',
    '    sys.exit(41)',
    '',
    'text = target.read_text(encoding="utf-8")',
    'lines = text.splitlines()',
    '',
    'security_idx = None',
    'for i, line in enumerate(lines):',
    '    if re.match(r"^\\s*security:\\s*$", line):',
    '        security_idx = i',
    '        break',
    '',
    'if security_idx is None:',
    '    lines.append("security:")',
    '    lines.append(f\'  inference_api_key: "{key}"\')',
    'else:',
    '    key_idx = None',
    '    for i, line in enumerate(lines):',
    '        if re.match(r"^\\s*inference_api_key\\s*:", line):',
    '            key_idx = i',
    '            break',
    '    if key_idx is not None:',
    '        m = re.match(r"^(\\s*inference_api_key\\s*:\\s*)(.*?)(\\s*(#.*)?)$", lines[key_idx])',
    '        if m:',
    '            lines[key_idx] = f\'{m.group(1)}"{key}"{m.group(3) or ""}\'',
    '        else:',
    '            lines[key_idx] = f\'  inference_api_key: "{key}"\'',
    '    else:',
    '        lines.insert(security_idx + 1, f\'  inference_api_key: "{key}"\')',
    '',
    'updated = "\\n".join(lines)',
    'if text.endswith("\\n"):',
    '    updated += "\\n"',
    'target.write_text(updated, encoding="utf-8")',
    'print(f"__LMX_CFG_PATH__:{target}")',
    'PY',
  ].join('\n');

  const result = await runRemoteCommand(ssh, script);
  if (result.exitCode !== 0) {
    return {
      ok: false,
      message: summarizeOutput(result.stderr || result.stdout),
    };
  }

  const parsed = parseRemoteConfigPath(`${result.stdout}\n${result.stderr}`);
  if (!parsed.configPath) {
    return {
      ok: false,
      message: 'remote config updated but path marker missing',
    };
  }

  return {
    ok: true,
    configPath: parsed.configPath,
    message: 'remote inference_api_key updated',
  };
}

async function reloadLmxConfig(host: string, port: number, adminKey?: string): Promise<{ ok: boolean; message: string }> {
  if (!adminKey?.trim()) {
    return {
      ok: false,
      message: "connection.adminKey is required to trigger /admin/config/reload",
    };
  }

  try {
    const response = await fetch(`http://${host}:${port}/admin/config/reload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey.trim(),
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        ok: false,
        message: `reload failed: HTTP ${response.status} ${summarizeOutput(body || response.statusText)}`,
      };
    }
    return { ok: true, message: 'LMX config reloaded' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'reload failed';
    return { ok: false, message };
  }
}

async function verifyInferenceKey(host: string, port: number, key: string): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`http://${host}:${port}/v1/models`, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        ok: false,
        message: `verification failed: HTTP ${response.status} ${summarizeOutput(body || response.statusText)}`,
      };
    }
    return { ok: true, message: 'key accepted by /v1/models' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'verification failed',
    };
  }
}

async function copyToClipboard(value: string): Promise<{ ok: boolean; message: string }> {
  const text = value.trim();
  if (!text) return { ok: false, message: 'empty key cannot be copied' };

  if (process.platform === 'darwin') {
    try {
      const result = await execa('pbcopy', [], { input: text, reject: false });
      return result.exitCode === 0
        ? { ok: true, message: 'copied to clipboard (pbcopy)' }
        : { ok: false, message: result.stderr || 'pbcopy failed' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'pbcopy failed',
      };
    }
  }

  const linuxCandidates: Array<{ cmd: string; args: string[] }> = [
    { cmd: 'wl-copy', args: [] },
    { cmd: 'xclip', args: ['-selection', 'clipboard'] },
    { cmd: 'xsel', args: ['--clipboard', '--input'] },
  ];
  const attempts: string[] = [];
  for (const candidate of linuxCandidates) {
    try {
      const result = await execa(candidate.cmd, candidate.args, {
        input: text,
        reject: false,
      });
      if (result.exitCode === 0) {
        return { ok: true, message: `copied to clipboard (${candidate.cmd})` };
      }
      attempts.push(`${candidate.cmd}: ${result.stderr || `exit ${result.exitCode ?? 1}`}`);
    } catch (err) {
      attempts.push(
        `${candidate.cmd}: ${err instanceof Error ? err.message : 'failed to execute'}`,
      );
    }
  }

  if (attempts.length > 0) {
    return { ok: false, message: `no clipboard utility succeeded (${attempts.join('; ')})` };
  }
  return { ok: false, message: 'no supported clipboard utility found' };
}

export async function keyCreate(opts?: KeyCreateOptions): Promise<void> {
  const config = await loadConfig();
  const key = opts?.value?.trim() || generateOptaInferenceKey();

  const store = await getConfigStore();
  store.set('connection.apiKey', key);

  const remoteRequested = opts?.remote !== false;
  const shouldCopy = opts?.copy !== false;
  const remoteHost = config.connection.host;
  const output: Record<string, unknown> = {
    key,
    source: 'config',
    remote: null,
    copy: null,
  };

  if (remoteRequested && !isLocalHost(remoteHost)) {
    const selected = await selectRemoteHost(
      remoteHost,
      config.connection.fallbackHosts,
      config.connection.ssh.user,
      expandHome(config.connection.ssh.identityFile),
    );
    if (!selected.selectedHost) {
      output.remote = { ok: false, message: `ssh unavailable: ${selected.detail}` };
      if (!opts?.json) {
        console.log(chalk.yellow('!') + ` Studio sync skipped: ${selected.detail}`);
      }
    } else {
      const ssh: SshConfig = {
        host: selected.selectedHost,
        user: config.connection.ssh.user,
        identityFile: expandHome(config.connection.ssh.identityFile),
      };
      const remoteApply = await applyRemoteInferenceKey(ssh, config.connection.ssh.lmxPath, key);
      if (!remoteApply.ok) {
        output.remote = { ok: false, message: remoteApply.message };
        if (!opts?.json) {
          console.log(chalk.red('✗') + ` Studio key update failed: ${remoteApply.message}`);
        }
      } else {
        const reload = await reloadLmxConfig(ssh.host, config.connection.port, config.connection.adminKey);
        const verify = await verifyInferenceKey(ssh.host, config.connection.port, key);
        output.remote = {
          ok: remoteApply.ok && reload.ok && verify.ok,
          host: ssh.host,
          configPath: remoteApply.configPath,
          reload: reload.message,
          verify: verify.message,
        };

        if (!opts?.json) {
          console.log(chalk.green('✓') + ` Studio key synced on ${ssh.host}`);
          console.log(chalk.dim(`  Config: ${remoteApply.configPath}`));
          console.log(chalk.dim(`  Reload: ${reload.message}`));
          console.log(chalk.dim(`  Verify: ${verify.message}`));
        }
      }
    }
  } else if (remoteRequested) {
    output.remote = { ok: true, message: 'remote sync skipped for localhost' };
  } else {
    output.remote = { ok: true, message: 'remote sync disabled (--no-remote)' };
  }

  if (shouldCopy) {
    const copied = await copyToClipboard(key);
    output.copy = copied;
    if (!opts?.json) {
      if (copied.ok) {
        console.log(chalk.green('✓') + ` ${copied.message}`);
      } else {
        console.log(chalk.yellow('!') + ` ${copied.message}`);
      }
    }
  }

  if (opts?.json) {
    const safeOutput = { ...output };
    if (typeof safeOutput['key'] === 'string') safeOutput['key'] = maskKey(safeOutput['key'] as string);
    console.log(JSON.stringify(safeOutput, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.bold('Opta Inference API Key'));
  console.log(`Base URL: http://${config.connection.host}:${config.connection.port}/v1`);
  console.log(`API Key:  ${maskKey(key)}`);
  console.log(chalk.dim('(Full key was copied to clipboard — paste it now, it will not be shown again)'));
  console.log(chalk.dim('Use in clients as Authorization: Bearer <API Key>'));
}

export async function keyShow(opts?: KeyShowOptions): Promise<void> {
  const config = await loadConfig();
  const resolved = resolveConfiguredInferenceKey(config.connection);

  if (!resolved.key) {
    if (opts?.json) {
      console.log(JSON.stringify({
        key: null,
        source: resolved.source,
        configured: false,
      }, null, 2));
      return;
    }
    console.log(chalk.yellow('!') + ' No inference API key configured yet.');
    console.log(chalk.dim('Run: opta key create'));
    return;
  }

  const displayKey = opts?.reveal ? resolved.key : maskKey(resolved.key);
  if (opts?.copy) {
    const copied = await copyToClipboard(resolved.key);
    if (!opts?.json) {
      if (copied.ok) console.log(chalk.green('✓') + ` ${copied.message}`);
      else console.log(chalk.yellow('!') + ` ${copied.message}`);
    }
  }

  if (opts?.json) {
    console.log(JSON.stringify({
      key: opts?.reveal ? resolved.key : displayKey,
      source: resolved.source,
      configured: true,
    }, null, 2));
    return;
  }

  console.log(`Key (${resolved.source}): ${displayKey}`);
  if (!opts?.reveal) {
    console.log(chalk.dim('Tip: use --reveal to print full key, or --copy to copy.'));
  }
}

export async function keyCopy(opts?: KeyCopyOptions): Promise<void> {
  const config = await loadConfig();
  const resolved = resolveConfiguredInferenceKey(config.connection);
  if (!resolved.key) {
    const message = 'No inference API key configured yet. Run: opta key create';
    if (opts?.json) {
      console.log(JSON.stringify({ ok: false, message }, null, 2));
    } else {
      console.log(chalk.yellow('!') + ` ${message}`);
    }
    throw new ExitError(EXIT.NOT_FOUND);
  }

  const copied = await copyToClipboard(resolved.key);
  if (opts?.json) {
    console.log(JSON.stringify(copied, null, 2));
  }

  if (copied.ok) {
    if (!opts?.json) {
      console.log(chalk.green('✓') + ` ${copied.message}`);
    }
    return;
  }

  if (!opts?.json) {
    console.log(chalk.red('✗') + ` Failed to copy key: ${copied.message}`);
  }
  throw new ExitError(EXIT.ERROR);
}
