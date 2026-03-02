#!/usr/bin/env node

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const sources = [
  { from: "channels/stable.json", to: "public/desktop/manifest-stable.json" },
  { from: "channels/beta.json", to: "public/desktop/manifest-beta.json" },
];

const schemaSource = "channels/schema/release-manifest.v1.schema.json";
const schemaDest = "public/desktop/schema/release-manifest.v1.schema.json";

async function syncManifest(sourcePath, targetPath) {
  const absoluteSource = path.join(repoRoot, sourcePath);
  const absoluteTarget = path.join(repoRoot, targetPath);

  const raw = await readFile(absoluteSource, "utf8");
  const parsed = JSON.parse(raw);
  parsed.$schema = "./schema/release-manifest.v1.schema.json";

  await mkdir(path.dirname(absoluteTarget), { recursive: true });
  await writeFile(absoluteTarget, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log(`synced ${sourcePath} -> ${targetPath}`);
}

async function main() {
  for (const entry of sources) {
    await syncManifest(entry.from, entry.to);
  }

  const absoluteSchemaSource = path.join(repoRoot, schemaSource);
  const absoluteSchemaDest = path.join(repoRoot, schemaDest);
  await mkdir(path.dirname(absoluteSchemaDest), { recursive: true });
  await copyFile(absoluteSchemaSource, absoluteSchemaDest);
  console.log(`synced ${schemaSource} -> ${schemaDest}`);
}

main().catch((error) => {
  console.error(`sync failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
