import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import parityArtifactJson from '@/lib/capabilities/parity.generated.json';
import {
  CAPABILITY_PARITY_CATEGORIES,
  type CapabilityParityArtifact,
  type CapabilityParityCategory,
} from '@/lib/capabilities/types';

const GENERATED_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'src/lib/capabilities/parity.generated.json',
);
const REPO_ROOT = path.resolve(process.cwd(), '..');
const artifact = parityArtifactJson as CapabilityParityArtifact;

function sortStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

describe('capability parity artifact', () => {
  it('exists on disk', () => {
    expect(fs.existsSync(GENERATED_ARTIFACT_PATH)).toBe(true);
  });

  it('matches schema and allowed categories', () => {
    expect(artifact.categories).toEqual([...CAPABILITY_PARITY_CATEGORIES]);
    expect(Array.isArray(artifact.endpoints)).toBe(true);
    expect(artifact.endpoints.length).toBeGreaterThan(0);

    const byCategoryKeys = Object.keys(artifact.byCategory);
    expect(sortStrings(byCategoryKeys)).toEqual(
      sortStrings([...CAPABILITY_PARITY_CATEGORIES]),
    );

    for (const endpoint of artifact.endpoints) {
      expect(typeof endpoint.path).toBe('string');
      expect(endpoint.path.startsWith('/')).toBe(true);
      expect(
        CAPABILITY_PARITY_CATEGORIES.includes(
          endpoint.category as CapabilityParityCategory,
        ),
      ).toBe(true);
    }

    expect(typeof artifact.sources?.lmxApiDir).toBe('string');
    expect(typeof artifact.sources?.dashboardClientPath).toBe('string');
    expect(
      fs.existsSync(path.resolve(REPO_ROOT, artifact.sources.lmxApiDir)),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.resolve(REPO_ROOT, artifact.sources.dashboardClientPath),
      ),
    ).toBe(true);
  });

  it('has no uncategorized endpoints', () => {
    const grouped = new Map<string, CapabilityParityCategory>();

    for (const category of CAPABILITY_PARITY_CATEGORIES) {
      for (const endpointPath of artifact.byCategory[category]) {
        expect(grouped.has(endpointPath)).toBe(false);
        grouped.set(endpointPath, category);
      }
    }

    for (const endpoint of artifact.endpoints) {
      expect(grouped.get(endpoint.path)).toBe(endpoint.category);
    }

    const endpointPaths = artifact.endpoints.map((endpoint) => endpoint.path);
    expect(sortStrings([...grouped.keys()])).toEqual(sortStrings(endpointPaths));
  });

  it('is deterministically sorted', () => {
    const sortedEndpoints = [...artifact.endpoints].sort((left, right) =>
      left.path.localeCompare(right.path),
    );
    expect(artifact.endpoints).toEqual(sortedEndpoints);

    for (const category of CAPABILITY_PARITY_CATEGORIES) {
      expect(artifact.byCategory[category]).toEqual(
        sortStrings(artifact.byCategory[category]),
      );
    }
  });
});
