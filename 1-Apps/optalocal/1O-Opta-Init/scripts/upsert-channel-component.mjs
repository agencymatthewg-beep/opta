#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/upsert-channel-component.mjs --channel <stable|beta> --payload-file <path> [options]",
      "  node scripts/upsert-channel-component.mjs --channel <stable|beta> --payload-json '<json>' [options]",
      "",
      "Options:",
      "  --manifest <path>                 Override channel manifest path",
      "  --published-at <iso-utc>          Override manifest publishedAt",
      "  --release-id <value>              Override release.id",
      "  --release-notes-url <https-url>   Override release.notesUrl",
      "  --release-min-manager-version <semver>  Override release.minManagerVersion",
      "  --dry-run                         Print result and do not write file",
      "  -h, --help                        Show this help",
      "",
      "Payload shape:",
      "  {",
      '    "publishedAt": "2026-03-03T10:00:00Z",',
      '    "release": { "notesUrl": "https://..." },',
      '    "component": {',
      '      "id": "opta-cli",',
      '      "version": "0.6.0",',
      '      "artifacts": { "macos": [...], "windows": [...] }',
      "    }",
      "  }",
      "",
      "A top-level component object is also accepted.",
    ].join("\n")
  );
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseArgs(argv) {
  const flags = new Set();
  const values = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "-h" || arg === "--help") {
      flags.add("help");
      continue;
    }

    if (arg === "--dry-run") {
      flags.add("dry-run");
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument '${arg}'`);
    }

    const eqIndex = arg.indexOf("=");
    if (eqIndex !== -1) {
      const key = arg.slice(2, eqIndex);
      const value = arg.slice(eqIndex + 1);
      if (value.length === 0) throw new Error(`Option '--${key}' requires a value`);
      values.set(key, value);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Option '--${key}' requires a value`);
    }
    values.set(key, next);
    index += 1;
  }

  return { flags, values };
}

function getValue(parsed, key, fallback = null) {
  return parsed.values.has(key) ? parsed.values.get(key) : fallback;
}

function normalizeIsoUtc(value) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function mergeValue(baseValue, patchValue) {
  if (patchValue === undefined) return baseValue;
  if (Array.isArray(patchValue)) return patchValue;
  if (!isObject(patchValue)) return patchValue;

  const next = isObject(baseValue) ? { ...baseValue } : {};
  for (const key of Object.keys(patchValue)) {
    next[key] = mergeValue(next[key], patchValue[key]);
  }
  return next;
}

async function readJson(jsonPath) {
  return JSON.parse(await readFile(jsonPath, "utf8"));
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.flags.has("help")) {
    usage();
    return;
  }

  const channel = getValue(parsed, "channel");
  if (!channel || !["stable", "beta"].includes(channel)) {
    throw new Error("--channel must be 'stable' or 'beta'");
  }

  const payloadFileInput = getValue(parsed, "payload-file");
  const payloadJsonInput = getValue(parsed, "payload-json");
  if (!payloadFileInput && !payloadJsonInput) {
    throw new Error("Provide one of --payload-file or --payload-json");
  }
  if (payloadFileInput && payloadJsonInput) {
    throw new Error("Provide only one of --payload-file or --payload-json");
  }

  const manifestPath = path.resolve(
    process.cwd(),
    getValue(parsed, "manifest", path.join("channels", `${channel}.json`))
  );

  const payload = payloadFileInput
    ? await readJson(path.resolve(process.cwd(), payloadFileInput))
    : JSON.parse(payloadJsonInput);

  const componentPatch =
    isObject(payload) && isObject(payload.component) ? payload.component : payload;
  const releasePatch = isObject(payload) && isObject(payload.release) ? payload.release : null;
  const payloadPublishedAt =
    isObject(payload) && typeof payload.publishedAt === "string" ? payload.publishedAt : null;

  if (!isObject(componentPatch)) {
    throw new Error("Payload must contain a component object");
  }

  const componentId = componentPatch.id;
  if (typeof componentId !== "string" || componentId.trim().length === 0) {
    throw new Error("component.id must be a non-empty string");
  }

  const manifest = await readJson(manifestPath);
  if (!isObject(manifest)) {
    throw new Error(`Manifest is not an object: ${manifestPath}`);
  }
  if (manifest.channel !== channel) {
    throw new Error(
      `Manifest channel mismatch: expected '${channel}', found '${manifest.channel}'`
    );
  }
  if (!Array.isArray(manifest.components)) {
    throw new Error("Manifest must contain a components array");
  }

  const currentIndex = manifest.components.findIndex(
    (entry) => isObject(entry) && entry.id === componentId
  );

  const componentTrackPatch = {
    ...componentPatch,
    track: channel,
  };

  if (currentIndex === -1) {
    manifest.components.push(componentTrackPatch);
  } else {
    manifest.components[currentIndex] = mergeValue(
      manifest.components[currentIndex],
      componentTrackPatch
    );
  }

  const publishedAtInput = getValue(parsed, "published-at", payloadPublishedAt);
  manifest.publishedAt = normalizeIsoUtc(publishedAtInput);

  if (!isObject(manifest.release)) {
    manifest.release = {};
  }

  if (releasePatch) {
    manifest.release = mergeValue(manifest.release, releasePatch);
  }

  const releaseId = getValue(parsed, "release-id");
  const releaseNotesUrl = getValue(parsed, "release-notes-url");
  const releaseMinManagerVersion = getValue(parsed, "release-min-manager-version");

  if (releaseId) manifest.release.id = releaseId;
  if (releaseNotesUrl) manifest.release.notesUrl = releaseNotesUrl;
  if (releaseMinManagerVersion) {
    manifest.release.minManagerVersion = releaseMinManagerVersion;
  }

  const rendered = `${JSON.stringify(manifest, null, 2)}\n`;

  if (parsed.flags.has("dry-run")) {
    process.stdout.write(rendered);
    return;
  }

  await writeFile(manifestPath, rendered, "utf8");

  const updatedComponent = manifest.components.find(
    (entry) => isObject(entry) && entry.id === componentId
  );
  const componentVersion =
    isObject(updatedComponent) && typeof updatedComponent.version === "string"
      ? updatedComponent.version
      : "unknown";

  console.log(
    `updated ${path.relative(repoRoot, manifestPath)} component=${componentId} version=${componentVersion}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
