#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const defaultSchemaPath = path.join(repoRoot, 'channels', 'schema', 'manager-updater-metadata.v1.schema.json');
const defaultManifestPaths = [
  path.join(repoRoot, 'channels', 'manager-updates', 'stable.json'),
  path.join(repoRoot, 'channels', 'manager-updates', 'beta.json'),
];

const semverRegex = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const httpsRegex = /^https:\/\//;
const platformKeyRegex = /^(darwin|windows|linux)-[A-Za-z0-9_-]+$/;
const windowsArtifactRegex = /\.(?:exe|msi|zip)(?:[?#].*)?$/i;
const macArtifactRegex = /\.(?:dmg|pkg|app\.tar\.gz)(?:[?#].*)?$/i;
const requiredPlatformKeys = new Set(['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64']);
const managerHost = 'init.optalocal.com';

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/validate-manager-update-metadata.mjs',
      '  node scripts/validate-manager-update-metadata.mjs [options] <manifest-path> [more-manifests...]',
      '',
      'Options:',
      '  --allow-partial-platforms   Allow manifests that do not include every required target',
      '',
      'Defaults to channels/manager-updates/stable.json and channels/manager-updates/beta.json.',
    ].join('\n')
  );
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === 'string' && isoDateRegex.test(value) && !Number.isNaN(Date.parse(value));
}

function validatePlatformRelease(platformId, release, location, errors, allowedPlatforms) {
  if (!isObject(release)) {
    errors.push(`${location} must be an object`);
    return;
  }

  const delimiterIndex = platformId.indexOf('-');
  const platformFromKey = delimiterIndex === -1 ? null : platformId.slice(0, delimiterIndex);

  if (platformFromKey && !allowedPlatforms.has(platformFromKey)) {
    errors.push(`${location} key prefix must be one of: ${[...allowedPlatforms].join(', ')}`);
  }

  if (typeof release.url !== 'string' || !httpsRegex.test(release.url)) {
    errors.push(`${location}.url must be an https URL`);
  } else if (platformFromKey === 'windows') {
    if (macArtifactRegex.test(release.url)) {
      errors.push(`${location}.url must not point to a macOS artifact`);
    } else if (!windowsArtifactRegex.test(release.url)) {
      errors.push(`${location}.url must point to a Windows artifact (.zip, .msi, or .exe)`);
    }
  } else if (platformFromKey === 'darwin') {
    if (/\.(?:exe|msi|nsis\.zip)(?:[?#].*)?$/i.test(release.url)) {
      errors.push(`${location}.url must not point to a Windows artifact`);
    }
  }

  if (typeof release.signature !== 'string' || release.signature.trim().length < 16) {
    errors.push(`${location}.signature must be a non-empty signature string`);
  }
}

function validateManifest(manifest, schema, manifestPath, options = {}) {
  const { allowPartialPlatforms = false } = options;
  const errors = [];
  const schemaVersion = schema?.properties?.schemaVersion?.const ?? '1.0.0';
  const manifestVersion = schema?.properties?.manifestVersion?.const ?? 1;
  const allowedChannels = new Set(schema?.properties?.channel?.enum ?? ['stable', 'beta']);
  const allowedPlatforms = new Set(['darwin', 'windows', 'linux']);

  if (!isObject(manifest)) {
    return {
      errors: ['Manifest root must be an object'],
      targetCount: 0,
    };
  }

  if (manifest.schemaVersion !== schemaVersion) {
    errors.push(`schemaVersion must be "${schemaVersion}"`);
  }

  if (manifest.manifestVersion !== manifestVersion) {
    errors.push(`manifestVersion must be ${manifestVersion}`);
  }

  if (!allowedChannels.has(manifest.channel)) {
    errors.push(`channel must be one of: ${[...allowedChannels].join(', ')}`);
  }

  const filename = path.basename(manifestPath);
  const expectedChannelByFilename = new Map([
    ['stable.json', 'stable'],
    ['beta.json', 'beta'],
  ]);
  const expectedChannel = expectedChannelByFilename.get(filename);
  if (expectedChannel && manifest.channel !== expectedChannel) {
    errors.push(`channel must be "${expectedChannel}" for ${filename}`);
  }

  if (!isIsoDate(manifest.publishedAt)) {
    errors.push('publishedAt must be an ISO-8601 UTC datetime');
  }

  if (typeof manifest.version !== 'string' || !semverRegex.test(manifest.version)) {
    errors.push('version must be a semver string');
  }

  if (typeof manifest.notes !== 'string' || manifest.notes.trim().length === 0) {
    errors.push('notes must be a non-empty string');
  }

  if (!isIsoDate(manifest.pub_date)) {
    errors.push('pub_date must be an ISO-8601 UTC datetime');
  }

  if (!isObject(manifest.platforms)) {
    errors.push('platforms must be an object');
    return {
      errors,
      targetCount: 0,
    };
  }

  const platformEntries = Object.entries(manifest.platforms);
  if (platformEntries.length === 0) {
    errors.push('platforms must contain at least one platform entry');
    return {
      errors,
      targetCount: 0,
    };
  }

  const platformUrlUsage = new Map();
  const expectedChannelValue = typeof manifest.channel === 'string' ? manifest.channel : '';
  const expectedVersionValue = typeof manifest.version === 'string' ? manifest.version : '';
  for (const [platformId, release] of platformEntries) {
    const location = `platforms.${platformId}`;
    if (!platformKeyRegex.test(platformId)) {
      errors.push(`${location} key must match ^(darwin|windows|linux)-[A-Za-z0-9_-]+$`);
    }
    validatePlatformRelease(platformId, release, location, errors, allowedPlatforms);

    if (isObject(release) && typeof release.url === 'string') {
      try {
        const parsed = new URL(release.url);
        const expectedPrefix = `/desktop-updates/manager/${expectedChannelValue}/${expectedVersionValue}/`;
        if (parsed.hostname !== managerHost || !parsed.pathname.startsWith(expectedPrefix)) {
          errors.push(
            `${location}.url must be under https://${managerHost}${expectedPrefix}`
          );
        }
      } catch {
        // URL format is validated separately in validatePlatformRelease.
      }

      const os = platformId.split('-')[0];
      const existing = platformUrlUsage.get(release.url) ?? { oses: new Set(), platforms: [] };
      existing.oses.add(os);
      existing.platforms.push(platformId);
      platformUrlUsage.set(release.url, existing);
    }
  }

  for (const [url, usage] of platformUrlUsage.entries()) {
    if (usage.oses.size > 1) {
      errors.push(`platform URLs must not be reused across OS families (${usage.platforms.join(', ')} -> ${url})`);
    }
  }

  if (!allowPartialPlatforms) {
    for (const requiredPlatform of requiredPlatformKeys) {
      if (!(requiredPlatform in manifest.platforms)) {
        errors.push(`platforms must include required target "${requiredPlatform}"`);
      }
    }
  }

  return {
    errors,
    targetCount: platformEntries.length,
  };
}

async function readJsonFile(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    return;
  }

  let allowPartialPlatforms = false;
  const manifestInputs = [];
  for (const arg of argv) {
    if (arg === '--allow-partial-platforms') {
      allowPartialPlatforms = true;
      continue;
    }
    manifestInputs.push(arg);
  }

  const schemaPath = defaultSchemaPath;
  const manifestPaths =
    manifestInputs.length > 0 ? manifestInputs.map((input) => path.resolve(process.cwd(), input)) : defaultManifestPaths;
  const schema = await readJsonFile(schemaPath);

  let hadErrors = false;
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = await readJsonFile(manifestPath);
      const { errors, targetCount } = validateManifest(manifest, schema, manifestPath, { allowPartialPlatforms });
      if (errors.length > 0) {
        hadErrors = true;
        console.error(`FAIL ${path.relative(repoRoot, manifestPath)} (${errors.length} error${errors.length === 1 ? '' : 's'})`);
        for (const error of errors) {
          console.error(`  - ${error}`);
        }
      } else {
        console.log(`PASS ${path.relative(repoRoot, manifestPath)} (${targetCount} platforms)`);
      }
    } catch (error) {
      hadErrors = true;
      console.error(`FAIL ${path.relative(repoRoot, manifestPath)} (unreadable manifest)`);
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (hadErrors) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
