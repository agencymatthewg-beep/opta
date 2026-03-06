import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OPERATION_IDS } from "@opta/protocol-shared";

const OPERATION_ID_SET = new Set<string>(OPERATION_IDS as readonly string[]);
const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }

    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function collectRunOperationIds(): Map<string, Set<string>> {
  const idsByFile = new Map<string, Set<string>>();
  const files = collectSourceFiles(SOURCE_ROOT);

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    const found = new Set<string>();

    for (const match of source.matchAll(/daemonClient\.runOperation\(\s*[^,]+,\s*["']([^"']+)["']/g)) {
      found.add(match[1]);
    }

    for (const match of source.matchAll(/\brunOperation\(\s*["']([^"']+)["']/g)) {
      found.add(match[1]);
    }

    if (found.size > 0) {
      idsByFile.set(filePath, found);
    }
  }

  return idsByFile;
}

/**
 * For each runOperation call, extract the keys inside `input: { ... }`.
 * Returns a map from operation ID to the set of input key names used in the desktop.
 */
function collectOperationInputKeys(): Map<string, Set<string>> {
  const keysByOpId = new Map<string, Set<string>>();
  const files = collectSourceFiles(SOURCE_ROOT);

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");

    // Match: runOperation(conn, "op.id", { input: { key1: ..., key2: ... } })
    // Capture the op ID and the payload object literal (up to the outer closing brace)
    const callPattern = /runOperation\(\s*[^,]+,\s*["']([^"']+)["']\s*,\s*(\{[^;]{0,500}?\})\s*\)/gs;

    for (const callMatch of source.matchAll(callPattern)) {
      const opId = callMatch[1];
      const payload = callMatch[2];

      // Extract keys from `input: { key1: ..., key2: ... }`
      const inputMatch = payload.match(/input\s*:\s*\{([^}]*)\}/);
      if (!inputMatch) continue;

      const inner = inputMatch[1];
      const keys = new Set<string>();
      for (const keyMatch of inner.matchAll(/(\w+)\s*:/g)) {
        keys.add(keyMatch[1]);
      }

      if (keys.size > 0) {
        const existing = keysByOpId.get(opId) ?? new Set<string>();
        for (const k of keys) existing.add(k);
        keysByOpId.set(opId, existing);
      }
    }
  }

  return keysByOpId;
}

describe("runOperation ID parity", () => {
  it("keeps 1P operation IDs inside 1D OPERATION_IDS", () => {
    const idsByFile = collectRunOperationIds();
    const drift: Array<{ id: string; file: string }> = [];

    for (const [filePath, ids] of idsByFile.entries()) {
      for (const id of ids) {
        if (!OPERATION_ID_SET.has(id)) {
          drift.push({
            id,
            file: path.relative(SOURCE_ROOT, filePath),
          });
        }
      }
    }

    expect(drift).toEqual([]);
  });

  it("reports input keys for each registered operation (snapshot for drift detection)", () => {
    const keysByOpId = collectOperationInputKeys();

    // Snapshot: verify known operations have the expected input key shapes.
    // Add new entries here when adding new operations so drift is caught immediately.
    const expectedInputKeys: Record<string, string[]> = {
      "config.get": ["key"],
      "config.set": ["key", "value"],
      "env.save": ["name", "vars", "description"],
      "env.show": ["name"],
      "env.use": ["name"],
      "env.delete": ["name"],
      "sessions.get": ["id"],
      "sessions.search": ["query", "limit"],
      "sessions.export": ["sessionId", "format", "outputPath"],
      "sessions.delete": ["sessionId"],
      "daemon.logs": ["lines"],
      "models.aliases.set": ["alias", "target", "provider"],
      "models.aliases.delete": ["alias"],
      "models.browse.library": ["query", "limit"],
      "audio.transcribe": ["audioPath"],
      "audio.tts": ["text"],
    };

    const mismatches: Array<{ opId: string; expected: string[]; found: string[] }> = [];

    for (const [opId, expectedKeys] of Object.entries(expectedInputKeys)) {
      const foundKeys = keysByOpId.get(opId);
      if (!foundKeys) continue; // operation not called in desktop (skip — ID test covers existence)

      const missing = expectedKeys.filter((k) => !foundKeys.has(k));
      if (missing.length > 0) {
        mismatches.push({
          opId,
          expected: expectedKeys,
          found: [...foundKeys],
        });
      }
    }

    expect(mismatches).toEqual([]);
  });
});
