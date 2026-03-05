#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const vercelConfigPath = path.join(repoRoot, 'vercel.json');
const stableManifestPath = path.join(repoRoot, 'channels', 'stable.json');
const betaManifestPath = path.join(repoRoot, 'channels', 'beta.json');
const stableManagerUpdatePath = path.join(repoRoot, 'channels', 'manager-updates', 'stable.json');

const managedDownloadVersionPattern = /^\/downloads\/[^/]+\/v[^/]+\/[^/]+$/;
const internalDownloadHost = 'init.optalocal.com';
const DEFAULT_MAC_MANAGER_INSTALLER_ASSET = 'Opta-Init-Manager_aarch64.dmg';
const DEFAULT_WINDOWS_MANAGER_UPDATER_ASSET = 'Opta-Init-Manager_x64-setup.nsis.zip';
const CANONICAL_WINDOWS_MANAGER_INSTALLER_ASSET = 'opta-init-windows-x64.exe';

function ensureHttpsUrl(value, label) {
  if (typeof value !== 'string' || !value.startsWith('https://')) {
    throw new Error(`${label} must be an https URL`);
  }
}

function parseHttpsUrl(value, label) {
  ensureHttpsUrl(value, label);
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} must be a valid https URL`);
  }
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findLatestCliArtifactUrl(stableManifest) {
  const components = Array.isArray(stableManifest?.components) ? stableManifest.components : [];
  const optaCli = components.find((component) => isObject(component) && component.id === 'opta-cli');
  if (!optaCli) {
    throw new Error('stable manifest must include an opta-cli component');
  }
  if (!isObject(optaCli.artifacts)) {
    throw new Error('stable opta-cli component must include artifacts');
  }

  for (const platform of ['macos', 'windows']) {
    const artifacts = optaCli.artifacts[platform];
    if (!Array.isArray(artifacts)) {
      continue;
    }
    for (const artifact of artifacts) {
      if (isObject(artifact) && typeof artifact.url === 'string' && artifact.url.startsWith('https://')) {
        return artifact.url;
      }
    }
  }

  throw new Error('stable opta-cli component must include at least one https artifact URL');
}

function findLatestInitManagerAssetUrl(stableManagerUpdate, platformKey, fileHint) {
  const channel = stableManagerUpdate?.channel;
  const version = stableManagerUpdate?.version;
  if (channel !== 'stable') {
    throw new Error('stable manager update feed must declare channel "stable"');
  }
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error('stable manager update feed must include a non-empty version');
  }

  const platforms = isObject(stableManagerUpdate?.platforms) ? stableManagerUpdate.platforms : null;
  if (!platforms) {
    throw new Error('stable manager update feed must include platforms');
  }

  const candidate = platforms[platformKey];
  if (!isObject(candidate) || typeof candidate.url !== 'string' || !candidate.url.startsWith('https://')) {
    return { found: false, url: null };
  }

  const parsed = parseHttpsUrl(candidate.url, `stable manager ${platformKey} url`);
  const expectedPrefix = `/desktop-updates/manager/${channel}/${version}/`;
  if (parsed.hostname !== internalDownloadHost || !parsed.pathname.startsWith(expectedPrefix)) {
    throw new Error(
      `stable manager ${platformKey} url must be under https://${internalDownloadHost}${expectedPrefix}`
    );
  }

  if (fileHint) {
    const assetName = parsed.pathname.split('/').filter(Boolean).pop();
    if (!assetName || !assetName.includes(fileHint)) {
      // keep explicit behavior permissive here: only enforce naming intent when provided
    }
  }

  return {
    found: true,
    url: candidate.url,
    assetName: parsed.pathname.split('/').filter(Boolean).pop() ?? `${platformKey}.artifact`,
  };
}

function resolveStableManagerRelease(stableManagerUpdate) {
  const channel = stableManagerUpdate?.channel;
  const version = stableManagerUpdate?.version;
  if (channel !== 'stable') {
    throw new Error('stable manager update feed must declare channel "stable"');
  }
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error('stable manager update feed must include a non-empty version');
  }

  return { channel, version };
}

function isSelfRedirect(source, destination) {
  let parsed;
  try {
    parsed = new URL(destination);
  } catch {
    return false;
  }

  return (
    parsed.hostname === internalDownloadHost &&
    parsed.pathname === source &&
    parsed.search.length === 0 &&
    parsed.hash.length === 0
  );
}

function buildStaticRedirects(latestCliArtifactUrl, latestInitManagerMacAsset, latestInitManagerWindowsAsset) {
  ensureHttpsUrl(latestCliArtifactUrl, 'stable opta-cli artifact url');
  const managerCanonicalPrefix =
    `https://${internalDownloadHost}/desktop-updates/manager/${latestInitManagerMacAsset.channel}/${latestInitManagerMacAsset.version}`;
  const managerMacInstallerUrl = `${managerCanonicalPrefix}/${DEFAULT_MAC_MANAGER_INSTALLER_ASSET}`;
  const managerWindowsUpdaterAsset =
    latestInitManagerWindowsAsset.assetName || DEFAULT_WINDOWS_MANAGER_UPDATER_ASSET;
  const managerWindowsInstallerUrl =
    `${managerCanonicalPrefix}/${CANONICAL_WINDOWS_MANAGER_INSTALLER_ASSET}`;
  const managerWindowsUpdaterUrl = `${managerCanonicalPrefix}/${managerWindowsUpdaterAsset}`;
  ensureHttpsUrl(managerMacInstallerUrl, 'stable init manager mac installer url');
  ensureHttpsUrl(managerWindowsInstallerUrl, 'stable init manager windows installer url');
  ensureHttpsUrl(managerWindowsUpdaterUrl, 'stable init manager windows updater url');
  return [
    {
      source: '/desktop-updates/manager/stable/:version/:asset',
      destination:
        'https://github.com/agencymatthewg-beep/opta/releases/download/opta-init-manager-stable-v:version/:asset',
      permanent: false,
    },
    {
      source: '/desktop-updates/manager/beta/:version/:asset',
      destination:
        'https://github.com/agencymatthewg-beep/opta/releases/download/opta-init-manager-beta-v:version/:asset',
      permanent: false,
    },
    {
      source: '/downloads/opta-cli/latest',
      destination: latestCliArtifactUrl,
      permanent: false,
    },
    {
      source: '/downloads/cli',
      destination: '/downloads/opta-cli/latest',
      permanent: false,
    },
    {
      source: '/downloads/opta-init/latest/opta-init-mac.dmg',
      destination: managerMacInstallerUrl,
      permanent: false,
    },
    {
      source: '/downloads/opta-init/latest/opta-init-windows-x64.exe',
      destination: managerWindowsInstallerUrl,
      permanent: false,
    },
    {
      source: `/downloads/opta-init/latest/${managerWindowsUpdaterAsset}`,
      destination: managerWindowsUpdaterUrl,
      permanent: false,
    },
    {
      source: '/downloads/opta-init/latest',
      destination: '/downloads/opta-init/latest/opta-init-mac.dmg',
      permanent: false,
    },
  ];
}

function buildComponentRedirects(manifest) {
  if (!isObject(manifest)) return [];

  const components = Array.isArray(manifest.components) ? manifest.components : [];
  const redirects = [];

  for (const component of components) {
    if (!isObject(component)) continue;
    const id = component.id;
    const version = component.version;

    if (typeof id !== 'string' || id.trim().length === 0) continue;
    if (typeof version !== 'string' || version.trim().length === 0) continue;

    const versionPrefix = `/downloads/${id}/v${version}`;
    const artifactsByPlatform = isObject(component.artifacts) ? component.artifacts : {};

    for (const platform of ['macos', 'windows']) {
      const artifacts = artifactsByPlatform[platform];
      if (!Array.isArray(artifacts)) {
        continue;
      }

      for (const artifact of artifacts) {
        if (!isObject(artifact) || typeof artifact.url !== 'string' || !artifact.url.startsWith('https://')) {
          continue;
        }

        const artifactName = artifact.url.split('/').filter(Boolean).pop();
        if (!artifactName) {
          continue;
        }
        const source = `${versionPrefix}/${artifactName}`;
        if (!isSelfRedirect(source, artifact.url)) {
          redirects.push({
            source,
            destination: artifact.url,
            permanent: false,
          });
        }

        if (artifact.signature && typeof artifact.signature.url === 'string' && artifact.signature.url.startsWith('https://')) {
          const signatureName = artifact.signature.url.split('/').filter(Boolean).pop();
          if (signatureName) {
            const signatureSource = `${versionPrefix}/${signatureName}`;
            if (!isSelfRedirect(signatureSource, artifact.signature.url)) {
              redirects.push({
                source: signatureSource,
                destination: artifact.signature.url,
                permanent: false,
              });
            }
          }
        }
      }
    }
  }

  return redirects;
}

function dedupeRedirects(entries) {
  const bySource = new Map();

  for (const entry of entries) {
    const existing = bySource.get(entry.source);
    if (!existing) {
      bySource.set(entry.source, entry);
      continue;
    }

    if (existing.destination !== entry.destination) {
      throw new Error(
        `Redirect source conflict for '${entry.source}': '${existing.destination}' vs '${entry.destination}'`
      );
    }
  }

  return [...bySource.values()];
}

function isManagedRedirectSource(source) {
  return (
    source === '/desktop-updates/manager/stable/:version/:asset' ||
    source === '/desktop-updates/manager/beta/:version/:asset' ||
    source === '/downloads/opta-cli/latest' ||
    source === '/downloads/cli' ||
    source === '/downloads/opta-init/latest' ||
    source === '/downloads/opta-init/latest/opta-init-mac.dmg' ||
    source === '/downloads/opta-init/latest/opta-init-windows-x64.exe' ||
    source.startsWith('/downloads/opta-init/latest/') ||
    managedDownloadVersionPattern.test(source)
  );
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function main() {
  const [vercelConfig, stableManifest, betaManifest, stableManagerUpdate] = await Promise.all([
    readJson(vercelConfigPath),
    readJson(stableManifestPath),
    readJson(betaManifestPath),
    readJson(stableManagerUpdatePath),
  ]);

  const existingRedirects = Array.isArray(vercelConfig.redirects) ? vercelConfig.redirects : [];
  const preservedRedirects = existingRedirects.filter(
    (entry) => entry && typeof entry.source === 'string' && !isManagedRedirectSource(entry.source)
  );

  const latestCliArtifactUrl = findLatestCliArtifactUrl(stableManifest);

  const latestInitManagerMacAsset = resolveStableManagerRelease(stableManagerUpdate);
  const latestInitManagerWindowsAsset = findLatestInitManagerAssetUrl(stableManagerUpdate, "windows-x86_64");
  const generatedRedirects = dedupeRedirects([
    ...buildComponentRedirects(stableManifest),
    ...buildComponentRedirects(betaManifest),
    ...buildStaticRedirects(
      latestCliArtifactUrl,
      latestInitManagerMacAsset,
      latestInitManagerWindowsAsset
    ),
  ]);

  vercelConfig.redirects = dedupeRedirects([...generatedRedirects, ...preservedRedirects]);

  await writeFile(vercelConfigPath, `${JSON.stringify(vercelConfig, null, 2)}\n`, 'utf8');

  console.log(`synced redirects in ${path.relative(repoRoot, vercelConfigPath)}`);
  console.log(
    `managed redirects: ${generatedRedirects.length}, preserved redirects: ${preservedRedirects.length}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
