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
});
