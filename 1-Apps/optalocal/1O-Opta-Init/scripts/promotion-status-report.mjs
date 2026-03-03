#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const stableManifestPath = path.join(repoRoot, 'channels', 'stable.json');
const betaManifestPath = path.join(repoRoot, 'channels', 'beta.json');
const stableManagerPath = path.join(repoRoot, 'channels', 'manager-updates', 'stable.json');
const betaManagerPath = path.join(repoRoot, 'channels', 'manager-updates', 'beta.json');
const requiredManagerTargets = ['darwin-aarch64', 'darwin-x86_64', 'windows-x86_64'];

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/promotion-status-report.mjs [options]',
      '',
      'Options:',
      '  --output <path>             Write markdown report to file.',
      '  --assert-stable-ready       Exit non-zero when stable catalog is not fully promoted.',
      '  --required-components <ids> Comma-separated component IDs for stable readiness assertions.',
      '',
      'Examples:',
      '  node scripts/promotion-status-report.mjs',
      '  node scripts/promotion-status-report.mjs --output ./promotion-status.md',
      '  node scripts/promotion-status-report.mjs --assert-stable-ready',
    ].join('\n')
  );
}

function parseArgs(argv) {
  let outputPath = '';
  let assertStableReady = false;
  let requiredComponents = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--assert-stable-ready') {
      assertStableReady = true;
      continue;
    }
    if (arg === '--output') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--output requires a path value');
      }
      outputPath = value;
      index += 1;
      continue;
    }
    if (arg.startsWith('--output=')) {
      outputPath = arg.slice('--output='.length);
      if (!outputPath) {
        throw new Error('--output requires a path value');
      }
      continue;
    }
    if (arg === '--required-components') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--required-components requires a comma-separated value');
      }
      requiredComponents = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
    if (arg.startsWith('--required-components=')) {
      const value = arg.slice('--required-components='.length);
      requiredComponents = value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    outputPath,
    assertStableReady,
    requiredComponents,
  };
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readArtifactCount(component, platform) {
  if (!isObject(component) || !isObject(component.artifacts)) return 0;
  const artifacts = component.artifacts[platform];
  return Array.isArray(artifacts) ? artifacts.length : 0;
}

function getPromotionStatus(component) {
  const macCount = readArtifactCount(component, 'macos');
  const winCount = readArtifactCount(component, 'windows');
  if (macCount > 0 && winCount > 0) {
    return {
      label: 'PROMOTED',
      macCount,
      winCount,
      stableReady: true,
    };
  }
  if (macCount + winCount > 0) {
    return {
      label: 'PARTIAL',
      macCount,
      winCount,
      stableReady: false,
    };
  }
  return {
    label: 'NOT_PROMOTED',
    macCount,
    winCount,
    stableReady: false,
  };
}

function indexComponentsById(manifest) {
  const result = new Map();
  const components = Array.isArray(manifest?.components) ? manifest.components : [];
  for (const component of components) {
    if (!isObject(component) || typeof component.id !== 'string') continue;
    result.set(component.id, component);
  }
  return result;
}

function formatValue(value) {
  if (value === '' || value === null || value === undefined) return '-';
  return String(value);
}

function formatCount(macCount, winCount) {
  return `mac:${macCount} win:${winCount}`;
}

function detectManagerReadiness(managerManifest) {
  const missingTargets = [];
  const platforms = isObject(managerManifest?.platforms) ? managerManifest.platforms : {};
  for (const target of requiredManagerTargets) {
    if (!isObject(platforms[target])) {
      missingTargets.push(target);
      continue;
    }
    const entry = platforms[target];
    if (typeof entry.url !== 'string' || !entry.url.startsWith('https://')) {
      missingTargets.push(target);
    }
  }
  return {
    missingTargets,
    ready: missingTargets.length === 0,
    targets: Object.keys(platforms),
  };
}

function toMarkdown({
  generatedAt,
  componentRows,
  stableManager,
  betaManager,
  stableManagerReadiness,
  issues,
}) {
  const lines = [];
  lines.push('# Opta Init Promotion Status');
  lines.push('');
  lines.push(`Generated at: ${generatedAt}`);
  lines.push('');
  lines.push('## Components');
  lines.push('');
  lines.push('| Component | Stable Version | Stable Artifacts | Beta Version | Beta Artifacts | Promotion Status |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const row of componentRows) {
    lines.push(
      `| ${row.componentId} | ${formatValue(row.stableVersion)} | ${row.stableArtifacts} | ${formatValue(row.betaVersion)} | ${row.betaArtifacts} | ${row.status} |`
    );
  }

  lines.push('');
  lines.push('## Manager Updater');
  lines.push('');
  lines.push(`- Stable version: ${formatValue(stableManager?.version)}`);
  lines.push(`- Stable targets: ${stableManagerReadiness.targets.join(', ') || '-'}`);
  lines.push(`- Stable readiness: ${stableManagerReadiness.ready ? 'READY' : `MISSING (${stableManagerReadiness.missingTargets.join(', ')})`}`);
  lines.push(`- Beta version: ${formatValue(betaManager?.version)}`);
  lines.push(`- Beta targets: ${Object.keys(betaManager?.platforms ?? {}).join(', ') || '-'}`);

  lines.push('');
  lines.push('## Readiness');
  lines.push('');
  if (issues.length === 0) {
    lines.push('- Stable catalog is fully promoted across required components and manager targets.');
  } else {
    for (const issue of issues) {
      lines.push(`- ${issue}`);
    }
  }

  lines.push('');
  return `${lines.join('\n')}`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function main() {
  const { outputPath, assertStableReady, requiredComponents } = parseArgs(process.argv.slice(2));

  const [stableManifest, betaManifest, stableManager, betaManager] = await Promise.all([
    readJson(stableManifestPath),
    readJson(betaManifestPath),
    readJson(stableManagerPath),
    readJson(betaManagerPath),
  ]);

  const stableComponents = indexComponentsById(stableManifest);
  const betaComponents = indexComponentsById(betaManifest);
  const allComponentIds = [...new Set([...stableComponents.keys(), ...betaComponents.keys()])].sort();
  const assertionComponents = requiredComponents && requiredComponents.length > 0 ? requiredComponents : allComponentIds;

  const componentRows = [];
  const issues = [];

  for (const componentId of allComponentIds) {
    const stableComponent = stableComponents.get(componentId);
    const betaComponent = betaComponents.get(componentId);
    const stableState = getPromotionStatus(stableComponent);
    const betaState = getPromotionStatus(betaComponent);

    componentRows.push({
      componentId,
      stableVersion: stableComponent?.version ?? '',
      stableArtifacts: formatCount(stableState.macCount, stableState.winCount),
      betaVersion: betaComponent?.version ?? '',
      betaArtifacts: formatCount(betaState.macCount, betaState.winCount),
      status: stableState.label,
    });
  }

  for (const componentId of assertionComponents) {
    const stableComponent = stableComponents.get(componentId);
    if (!stableComponent) {
      issues.push(`component "${componentId}" is missing from stable manifest`);
      continue;
    }
    const state = getPromotionStatus(stableComponent);
    if (!state.stableReady) {
      issues.push(
        `component "${componentId}" is not fully promoted in stable (requires macOS and Windows artifacts, found ${formatCount(
          state.macCount,
          state.winCount
        )})`
      );
    }
  }

  const stableManagerReadiness = detectManagerReadiness(stableManager);
  if (!stableManagerReadiness.ready) {
    issues.push(
      `manager stable feed is missing required targets: ${stableManagerReadiness.missingTargets.join(', ')}`
    );
  }

  const markdown = toMarkdown({
    generatedAt: new Date().toISOString(),
    componentRows,
    stableManager,
    betaManager,
    stableManagerReadiness,
    issues,
  });

  if (outputPath) {
    const absoluteOutputPath = path.isAbsolute(outputPath) ? outputPath : path.resolve(process.cwd(), outputPath);
    await writeFile(absoluteOutputPath, markdown, 'utf8');
    console.log(`Wrote promotion report: ${absoluteOutputPath}`);
  } else {
    console.log(markdown);
  }

  if (assertStableReady && issues.length > 0) {
    console.error('');
    console.error('Stable promotion readiness check failed:');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
