#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const defaultSchemaPath = path.join(repoRoot, 'channels', 'schema', 'release-manifest.v1.schema.json');
const defaultManifestPaths = [
  path.join(repoRoot, 'channels', 'stable.json'),
  path.join(repoRoot, 'channels', 'beta.json'),
];

const semverRegex = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const sha256Regex = /^[A-Fa-f0-9]{64}$/;
const httpsRegex = /^https:\/\//;

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/validate-release-manifests.mjs',
      '  node scripts/validate-release-manifests.mjs <manifest-path> [more-manifests...]',
      '',
      'Defaults to channels/stable.json and channels/beta.json.',
    ].join('\n')
  );
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value) {
  return typeof value === 'string' && isoDateRegex.test(value) && !Number.isNaN(Date.parse(value));
}

function validateRollout(rollout, location, errors, allowedStrategies) {
  if (!isObject(rollout)) {
    errors.push(`${location} must be an object`);
    return;
  }
  if (!allowedStrategies.has(rollout.strategy)) {
    errors.push(`${location}.strategy must be one of: ${[...allowedStrategies].join(', ')}`);
  }
  if (!Number.isInteger(rollout.percentage) || rollout.percentage < 0 || rollout.percentage > 100) {
    errors.push(`${location}.percentage must be an integer between 0 and 100`);
  }
  if (typeof rollout.cohort !== 'string' || rollout.cohort.trim().length === 0) {
    errors.push(`${location}.cohort must be a non-empty string`);
  }
  if (!isIsoDate(rollout.startsAt)) {
    errors.push(`${location}.startsAt must be an ISO-8601 UTC datetime`);
  }
  if (typeof rollout.allowDowngrade !== 'boolean') {
    errors.push(`${location}.allowDowngrade must be a boolean`);
  }
}

function validateComponentRollout(rollout, location, errors) {
  if (!isObject(rollout)) {
    errors.push(`${location} must be an object`);
    return;
  }
  if (!Number.isInteger(rollout.percentage) || rollout.percentage < 0 || rollout.percentage > 100) {
    errors.push(`${location}.percentage must be an integer between 0 and 100`);
  }
  if (!Number.isInteger(rollout.priority) || rollout.priority < 1 || rollout.priority > 100) {
    errors.push(`${location}.priority must be an integer between 1 and 100`);
  }
}

function validateArtifact(artifact, location, expectedPlatform, errors, allowedPackageTypes, allowedSignatureTypes, allowedArchValues) {
  if (!isObject(artifact)) {
    errors.push(`${location} must be an object`);
    return;
  }
  if (artifact.platform !== expectedPlatform) {
    errors.push(`${location}.platform must be "${expectedPlatform}"`);
  }
  if (!allowedArchValues.has(artifact.arch)) {
    errors.push(`${location}.arch must be one of: ${[...allowedArchValues].join(', ')}`);
  }
  if (!allowedPackageTypes.has(artifact.packageType)) {
    errors.push(`${location}.packageType must be one of: ${[...allowedPackageTypes].join(', ')}`);
  }
  if (typeof artifact.url !== 'string' || !httpsRegex.test(artifact.url)) {
    errors.push(`${location}.url must be an https URL`);
  }
  if (!Number.isInteger(artifact.sizeBytes) || artifact.sizeBytes < 1) {
    errors.push(`${location}.sizeBytes must be a positive integer`);
  }
  if (!isObject(artifact.checksum)) {
    errors.push(`${location}.checksum must be an object`);
  } else {
    if (artifact.checksum.algorithm !== 'sha256') {
      errors.push(`${location}.checksum.algorithm must be "sha256"`);
    }
    if (typeof artifact.checksum.value !== 'string' || !sha256Regex.test(artifact.checksum.value)) {
      errors.push(`${location}.checksum.value must be a 64-char hex sha256 digest`);
    }
  }
  if (!isObject(artifact.signature)) {
    errors.push(`${location}.signature must be an object`);
  } else {
    if (!allowedSignatureTypes.has(artifact.signature.type)) {
      errors.push(`${location}.signature.type must be one of: ${[...allowedSignatureTypes].join(', ')}`);
    }
    if (typeof artifact.signature.url !== 'string' || !httpsRegex.test(artifact.signature.url)) {
      errors.push(`${location}.signature.url must be an https URL`);
    }
  }
}

function validateManifest(manifest, schema, manifestPath) {
  const errors = [];
  const schemaVersion = schema?.properties?.schemaVersion?.const ?? '1.0.0';
  const manifestVersion = schema?.properties?.manifestVersion?.const ?? 1;
  const allowedChannels = new Set(schema?.properties?.channel?.enum ?? ['stable', 'beta']);
  const allowedStrategies = new Set(schema?.$defs?.rollout?.properties?.strategy?.enum ?? ['immediate', 'phased', 'holdback']);
  const allowedPackageTypes = new Set(
    schema?.$defs?.artifact?.properties?.packageType?.enum ?? ['pkg', 'dmg', 'zip', 'tar.gz', 'msi', 'exe']
  );
  const allowedSignatureTypes = new Set(
    schema?.$defs?.signature?.properties?.type?.enum ?? ['codesign', 'authenticode', 'cosign', 'minisign', 'sigstore']
  );
  const allowedArchValues = new Set(schema?.$defs?.artifact?.properties?.arch?.enum ?? ['x64', 'arm64', 'universal']);
  const allowedComponentIds = new Set(
    schema?.$defs?.component?.properties?.id?.enum ?? ['opta-cli', 'opta-lmx', 'opta-code-universal', 'opta-daemon']
  );

  if (!isObject(manifest)) {
    return {
      errors: ['Manifest root must be an object'],
      componentCount: 0,
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

  if (!isObject(manifest.release)) {
    errors.push('release must be an object');
  } else {
    if (typeof manifest.release.id !== 'string' || manifest.release.id.trim().length < 3) {
      errors.push('release.id must be a non-empty string');
    }
    if (typeof manifest.release.notesUrl !== 'string' || !httpsRegex.test(manifest.release.notesUrl)) {
      errors.push('release.notesUrl must be an https URL');
    }
    if (typeof manifest.release.minManagerVersion !== 'string' || !semverRegex.test(manifest.release.minManagerVersion)) {
      errors.push('release.minManagerVersion must be a semver string');
    }
  }

  validateRollout(manifest.rollout, 'rollout', errors, allowedStrategies);

  if (!Array.isArray(manifest.components) || manifest.components.length === 0) {
    errors.push('components must be a non-empty array');
    return {
      errors,
      componentCount: 0,
    };
  }

  const seenComponentIds = new Set();
  for (let index = 0; index < manifest.components.length; index += 1) {
    const component = manifest.components[index];
    const loc = `components[${index}]`;
    if (!isObject(component)) {
      errors.push(`${loc} must be an object`);
      continue;
    }

    if (!allowedComponentIds.has(component.id)) {
      errors.push(`${loc}.id must be one of: ${[...allowedComponentIds].join(', ')}`);
    }
    if (seenComponentIds.has(component.id)) {
      errors.push(`${loc}.id "${component.id}" is duplicated`);
    }
    seenComponentIds.add(component.id);

    if (typeof component.displayName !== 'string' || component.displayName.trim().length === 0) {
      errors.push(`${loc}.displayName must be a non-empty string`);
    }
    if (typeof component.version !== 'string' || !semverRegex.test(component.version)) {
      errors.push(`${loc}.version must be a semver string`);
    }
    if (typeof component.minManagerVersion !== 'string' || !semverRegex.test(component.minManagerVersion)) {
      errors.push(`${loc}.minManagerVersion must be a semver string`);
    }
    if (component.track !== manifest.channel) {
      errors.push(`${loc}.track must match manifest channel "${manifest.channel}"`);
    }

    validateComponentRollout(component.rollout, `${loc}.rollout`, errors);

    if (!isObject(component.artifacts)) {
      errors.push(`${loc}.artifacts must be an object`);
      continue;
    }

    for (const platform of ['macos', 'windows']) {
      const artifacts = component.artifacts[platform];
      const artifactsLoc = `${loc}.artifacts.${platform}`;
      if (!Array.isArray(artifacts) || artifacts.length === 0) {
        errors.push(`${artifactsLoc} must be a non-empty array`);
        continue;
      }

      const seenArtifactKeys = new Set();
      for (let artifactIndex = 0; artifactIndex < artifacts.length; artifactIndex += 1) {
        const artifact = artifacts[artifactIndex];
        const artifactLoc = `${artifactsLoc}[${artifactIndex}]`;
        validateArtifact(
          artifact,
          artifactLoc,
          platform,
          errors,
          allowedPackageTypes,
          allowedSignatureTypes,
          allowedArchValues
        );
        if (isObject(artifact)) {
          const dedupeKey = `${artifact.platform}|${artifact.arch}|${artifact.packageType}`;
          if (seenArtifactKeys.has(dedupeKey)) {
            errors.push(`${artifactLoc} duplicates another artifact variant (${dedupeKey})`);
          }
          seenArtifactKeys.add(dedupeKey);
        }
      }
    }
  }

  return {
    errors,
    componentCount: manifest.components.length,
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
      const { errors, componentCount } = validateManifest(manifest, schema, manifestPath);
      if (errors.length > 0) {
        hadErrors = true;
        console.error(`FAIL ${path.relative(repoRoot, manifestPath)} (${errors.length} error${errors.length === 1 ? '' : 's'})`);
        for (const error of errors) {
          console.error(`  - ${error}`);
        }
      } else {
        console.log(`PASS ${path.relative(repoRoot, manifestPath)} (${componentCount} components)`);
      }
    } catch (error) {
      hadErrors = true;
      console.error(`FAIL ${path.relative(repoRoot, manifestPath)} (unreadable manifest)`);
      console.error(`  - ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (hadErrors) {
    process.exitCode = 1;
    return;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
