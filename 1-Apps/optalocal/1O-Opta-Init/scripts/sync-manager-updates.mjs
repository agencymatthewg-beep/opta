#!/usr/bin/env node

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const sources = [
  { from: "channels/manager-updates/stable.json", to: "public/desktop-updates/stable.json" },
  { from: "channels/manager-updates/beta.json", to: "public/desktop-updates/beta.json" },
];

const schemaSource = "channels/schema/manager-updater-metadata.v1.schema.json";
const schemaDest = "public/desktop-updates/schema/manager-updater-metadata.v1.schema.json";

async function syncChannelFile(sourcePath, targetPath) {
  const absoluteSource = path.join(repoRoot, sourcePath);
  const absoluteTarget = path.join(repoRoot, targetPath);

  const raw = await readFile(absoluteSource, "utf8");
  const parsed = JSON.parse(raw);
  const runtimeFeed = {
    version: parsed.version,
    notes: parsed.notes,
    pub_date: parsed.pub_date,
    platforms: parsed.platforms,
  };

  await mkdir(path.dirname(absoluteTarget), { recursive: true });
  await writeFile(absoluteTarget, `${JSON.stringify(runtimeFeed, null, 2)}\n`, "utf8");
  console.log(`synced ${sourcePath} -> ${targetPath}`);
}

async function main() {
  for (const entry of sources) {
    await syncChannelFile(entry.from, entry.to);
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
