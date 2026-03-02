#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const channelSet = new Set(['stable', 'beta']);
const semverRegex = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const httpsRegex = /^https:\/\//;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const platformKeys = ['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64'];

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/generate-manager-update-metadata.mjs --channel <stable|beta> --version <semver> --notes <https-url> [options]',
      '',
      'Options:',
      '  --published-at <iso-utc>              Override publish timestamp (default: now UTC)',
      '  --artifact-base-url <https-url>       Base URL when artifact filenames are provided',
      '  --output <path>                       Output file (default: channels/manager-updates/<channel>.json)',
      '  --allow-partial-platforms             Allow generating metadata with fewer than 3 target platforms',
      '  --dry-run                             Print JSON instead of writing file',
      '  --validate                            Run validate-manager-update-metadata on generated file',
      '  --validate-links                      Run validate-manager-update-links --strict on generated file',
      '  -h, --help                            Show this help message',
      '',
      'Per-platform options (repeat for each target):',
      '  --<platform>-url <https-url>',
      '  --<platform>-artifact <filename-or-path>',
      '  --<platform>-signature <value>',
      '  --<platform>-signature-file <path>',
      '',
      'Supported <platform> values:',
      `  ${platformKeys.join(', ')}`,
      '',
      'Example:',
      '  node scripts/generate-manager-update-metadata.mjs --channel stable --version 0.6.2 \\',
      '    --notes https://github.com/acme/opta/releases/tag/opta-init-manager-stable-v0.6.2 \\',
      '    --artifact-base-url https://github.com/acme/opta/releases/download/opta-init-manager-stable-v0.6.2 \\',
      '    --darwin-aarch64-artifact Opta-Init-Manager_aarch64.app.tar.gz \\',
      '    --darwin-aarch64-signature-file dist/Opta-Init-Manager_aarch64.app.tar.gz.sig \\',
      '    --darwin-x86_64-artifact Opta-Init-Manager_x64.app.tar.gz \\',
      '    --darwin-x86_64-signature-file dist/Opta-Init-Manager_x64.app.tar.gz.sig \\',
      '    --windows-x86_64-artifact Opta-Init-Manager_x64-setup.nsis.zip \\',
      '    --windows-x86_64-signature-file dist/Opta-Init-Manager_x64-setup.nsis.zip.sig --validate',
    ].join('\n')
  );
}

function parseArgs(argv) {
  const out = {
    flags: new Set(),
    values: new Map(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h') {
      out.flags.add('help');
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument '${arg}'. Use --help for usage.`);
    }

    if (arg === '--help') {
      out.flags.add('help');
      continue;
    }

    if (arg === '--allow-partial-platforms' || arg === '--dry-run' || arg === '--validate' || arg === '--validate-links') {
      out.flags.add(arg.slice(2));
      continue;
    }

    const equalsIndex = arg.indexOf('=');
    if (equalsIndex !== -1) {
      const key = arg.slice(2, equalsIndex);
      const value = arg.slice(equalsIndex + 1);
      if (value.length === 0) {
        throw new Error(`Option '--${key}' requires a value`);
      }
      out.values.set(key, value);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Option '--${key}' requires a value`);
    }
    out.values.set(key, next);
    index += 1;
  }

  return out;
}

function isIsoUtc(value) {
  return typeof value === 'string' && isoDateRegex.test(value) && !Number.isNaN(Date.parse(value));
}

function getValue(args, key, fallback = null) {
  return args.values.has(key) ? args.values.get(key) : fallback;
}

function getPlatformOptions(args, platformKey) {
  return {
    url: getValue(args, `${platformKey}-url`),
    artifact: getValue(args, `${platformKey}-artifact`),
    signature: getValue(args, `${platformKey}-signature`),
    signatureFile: getValue(args, `${platformKey}-signature-file`),
  };
}

function ensureHttpsUrl(value, keyName) {
  if (typeof value !== 'string' || !httpsRegex.test(value)) {
    throw new Error(`${keyName} must be an https URL`);
  }
}

async function readSignatureFromFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  const raw = await readFile(resolved, 'utf8');
  const signature = raw.trim();
  if (signature.length < 16) {
    throw new Error(`Signature file '${filePath}' is empty or too short`);
  }
  return signature;
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = baseUrl.trim();
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function runNodeScript(scriptPath, scriptArgs) {
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: node ${path.relative(repoRoot, scriptPath)} ${scriptArgs.join(' ')}`);
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.flags.has('help')) {
    usage();
    return;
  }

  const channel = getValue(parsed, 'channel');
  if (!channelSet.has(channel)) {
    throw new Error(`--channel must be one of: ${[...channelSet].join(', ')}`);
  }

  const version = getValue(parsed, 'version');
  if (!version || !semverRegex.test(version)) {
    throw new Error('--version must be a valid semver string');
  }

  const notes = getValue(parsed, 'notes');
  ensureHttpsUrl(notes, '--notes');

  const publishedAtInput = getValue(parsed, 'published-at');
  const publishedAt = publishedAtInput ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (!isIsoUtc(publishedAt)) {
    throw new Error('--published-at must be ISO-8601 UTC (e.g. 2026-03-02T06:10:00Z)');
  }

  const outputPath = path.resolve(
    process.cwd(),
    getValue(parsed, 'output', `channels/manager-updates/${channel}.json`)
  );

  const allowPartialPlatforms = parsed.flags.has('allow-partial-platforms');
  const artifactBaseUrlInput = getValue(parsed, 'artifact-base-url');
  const artifactBaseUrl = artifactBaseUrlInput ? normalizeBaseUrl(artifactBaseUrlInput) : null;

  if (artifactBaseUrl) {
    ensureHttpsUrl(artifactBaseUrl, '--artifact-base-url');
  }

  const platforms = {};

  for (const platformKey of platformKeys) {
    const platform = getPlatformOptions(parsed, platformKey);

    if (platform.url && platform.artifact) {
      throw new Error(`Provide only one of --${platformKey}-url or --${platformKey}-artifact`);
    }

    if (platform.signature && platform.signatureFile) {
      throw new Error(`Provide only one of --${platformKey}-signature or --${platformKey}-signature-file`);
    }

    const hasLocationInput = Boolean(platform.url || platform.artifact);
    const hasSignatureInput = Boolean(platform.signature || platform.signatureFile);

    if (!hasLocationInput && !hasSignatureInput) {
      continue;
    }

    if (!hasLocationInput || !hasSignatureInput) {
      throw new Error(`Platform '${platformKey}' requires both artifact/url and signature`);
    }

    let url;
    if (platform.url) {
      ensureHttpsUrl(platform.url, `--${platformKey}-url`);
      url = platform.url;
    } else {
      if (!artifactBaseUrl) {
        throw new Error(`--artifact-base-url is required when using --${platformKey}-artifact`);
      }
      const artifactName = path.basename(platform.artifact);
      url = `${artifactBaseUrl}/${artifactName}`;
    }

    let signature;
    if (platform.signature) {
      signature = platform.signature.trim();
    } else {
      signature = await readSignatureFromFile(platform.signatureFile);
    }

    if (signature.length < 16) {
      throw new Error(`Platform '${platformKey}' signature must be at least 16 characters`);
    }

    platforms[platformKey] = {
      url,
      signature,
    };
  }

  const platformCount = Object.keys(platforms).length;
  if (!allowPartialPlatforms && platformCount !== platformKeys.length) {
    throw new Error(
      `All platforms are required by default. Got ${platformCount}/${platformKeys.length}. Use --allow-partial-platforms to override.`
    );
  }

  if (platformCount === 0) {
    throw new Error('No platform entries were provided');
  }

  const metadata = {
    $schema: '../schema/manager-updater-metadata.v1.schema.json',
    schemaVersion: '1.0.0',
    manifestVersion: 1,
    channel,
    publishedAt,
    version,
    notes,
    pub_date: publishedAt,
    platforms,
  };

  const rendered = `${JSON.stringify(metadata, null, 2)}\n`;

  if (parsed.flags.has('dry-run')) {
    process.stdout.write(rendered);
  } else {
    await writeFile(outputPath, rendered, 'utf8');
    console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
  }

  if (parsed.flags.has('validate')) {
    const relativeOutput = path.relative(repoRoot, outputPath);
    runNodeScript(path.join(repoRoot, 'scripts', 'validate-manager-update-metadata.mjs'), [relativeOutput]);
  }

  if (parsed.flags.has('validate-links')) {
    const relativeOutput = path.relative(repoRoot, outputPath);
    runNodeScript(path.join(repoRoot, 'scripts', 'validate-manager-update-links.mjs'), ['--strict', relativeOutput]);
  }

  console.log(`generated manager updater metadata for channel=${channel} version=${version} (${platformCount} platform(s))`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
