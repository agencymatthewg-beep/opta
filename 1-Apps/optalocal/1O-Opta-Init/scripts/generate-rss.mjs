#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, "..");
const channelsDir = path.join(appRoot, "channels");
const outputPath = path.join(appRoot, "public", "rss.xml");

function toTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function readManifest(filename) {
  const fullPath = path.join(channelsDir, filename);
  const raw = await fs.readFile(fullPath, "utf-8");
  const manifest = JSON.parse(raw);
  return {
    channel: manifest.channel,
    releaseId: manifest.release?.id ?? "unknown",
    notesUrl: manifest.release?.notesUrl ?? "https://init.optalocal.com/changelog",
    publishedAt: manifest.publishedAt ?? new Date().toISOString(),
    summary: `Opta Init ${manifest.channel} release ${manifest.release?.id ?? "unknown"}`,
  };
}

async function main() {
  const entries = await Promise.all([readManifest("stable.json"), readManifest("beta.json")]);
  entries.sort((a, b) => toTimestamp(b.publishedAt) - toTimestamp(a.publishedAt));

  const now = new Date().toUTCString();
  const items = entries
    .map((entry) => {
      const title = `Opta Init ${entry.channel} — ${entry.releaseId}`;
      return [
        "    <item>",
        `      <title>${xmlEscape(title)}</title>`,
        `      <link>${xmlEscape(entry.notesUrl)}</link>`,
        `      <guid>${xmlEscape(entry.notesUrl)}</guid>`,
        `      <pubDate>${new Date(entry.publishedAt).toUTCString()}</pubDate>`,
        `      <description>${xmlEscape(entry.summary)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>Opta Init Releases</title>",
    "    <link>https://init.optalocal.com/changelog</link>",
    "    <description>Release announcements for Opta Init manager channels.</description>",
    `    <lastBuildDate>${now}</lastBuildDate>`,
    "    <language>en-us</language>",
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  await fs.writeFile(outputPath, xml, "utf-8");
  console.log(`Wrote ${path.relative(appRoot, outputPath)}`);
}

await main();
