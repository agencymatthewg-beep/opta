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
const targetKeyRegex = /^(darwin|windows|linux)-[A-Za-z0-9_-]+$/;

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/validate-manager-update-metadata.mjs',
      '  node scripts/validate-manager-update-metadata.mjs <manifest-path> [more-manifests...]',
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

function validateTargetMetadata(targetId, target, location, errors, allowedPlatforms) {
  if (!isObject(target)) {
    errors.push(`${location} must be an object`);
    return;
  }

  const delimiterIndex = targetId.indexOf('-');
  const platformFromTarget = delimiterIndex === -1 ? null : targetId.slice(0, delimiterIndex);

  if (!allowedPlatforms.has(target.platform)) {
    errors.push(`${location}.platform must be one of: ${[...allowedPlatforms].join(', ')}`);
  }

  if (platformFromTarget && target.platform !== platformFromTarget) {
    errors.push(`${location}.platform must match target key prefix "${platformFromTarget}"`);
  }

  if (typeof target.url !== 'string' || !httpsRegex.test(target.url)) {
    errors.push(`${location}.url must be an https URL`);
  }

  if (typeof target.signature !== 'string' || target.signature.trim().length < 16) {
    errors.push(`${location}.signature must be a non-empty signature string`);
  }

  if (typeof target.version !== 'string' || !semverRegex.test(target.version)) {
    errors.push(`${location}.version must be a semver string`);
  }

  if (typeof target.notes !== 'string' || target.notes.trim().length === 0) {
    errors.push(`${location}.notes must be a non-empty string`);
  }

  if (!isIsoDate(target.date)) {
    errors.push(`${location}.date must be an ISO-8601 UTC datetime`);
  }
}

function validateManifest(manifest, schema) {
  const errors = [];
  const schemaVersion = schema?.properties?.schemaVersion?.const ?? '1.0.0';
  const manifestVersion = schema?.properties?.manifestVersion?.const ?? 1;
  const allowedChannels = new Set(schema?.properties?.channel?.enum ?? ['stable', 'beta']);
  const allowedPlatforms = new Set(schema?.$defs?.targetMetadata?.properties?.platform?.enum ?? ['darwin', 'windows', 'linux']);

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

  if (!isIsoDate(manifest.publishedAt)) {
    errors.push('publishedAt must be an ISO-8601 UTC datetime');
  }

  if (!isObject(manifest.targets)) {
    errors.push('targets must be an object');
    return {
      errors,
      targetCount: 0,
    };
  }

  const targetEntries = Object.entries(manifest.targets);
  if (targetEntries.length === 0) {
    errors.push('targets must contain at least one target entry');
    return {
      errors,
      targetCount: 0,
    };
  }

  for (const [targetId, target] of targetEntries) {
    const location = `targets.${targetId}`;
    if (!targetKeyRegex.test(targetId)) {
      errors.push(`${location} target key must match ^(darwin|windows|linux)-[A-Za-z0-9_-]+$`);
    }
    validateTargetMetadata(targetId, target, location, errors, allowedPlatforms);
  }

  return {
    errors,
    targetCount: targetEntries.length,
  };
}

async function readJsonFile(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    return;
  }

  const schemaPath = defaultSchemaPath;
  const manifestPaths = args.length > 0 ? args.map((input) => path.resolve(process.cwd(), input)) : defaultManifestPaths;
  const schema = await readJsonFile(schemaPath);

  let hadErrors = false;
  for (const manifestPath of manifestPaths) {
    try {
      const manifest = await readJsonFile(manifestPath);
      const { errors, targetCount } = validateManifest(manifest, schema);
      if (errors.length > 0) {
        hadErrors = true;
        console.error(`FAIL ${path.relative(repoRoot, manifestPath)} (${errors.length} error${errors.length === 1 ? '' : 's'})`);
        for (const error of errors) {
          console.error(`  - ${error}`);
        }
      } else {
        console.log(`PASS ${path.relative(repoRoot, manifestPath)} (${targetCount} targets)`);
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
