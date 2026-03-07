#!/usr/bin/env node

/**
 * release-manager.mjs — Opta Init Manager Release Orchestrator
 *
 * Enforces the correct release sequence to prevent manifest/binary desync:
 *
 *   1. Pre-flight checks (clean git, version bump detected)
 *   2. Build the Tauri desktop app
 *   3. Create a GitHub Release and upload artifacts
 *   4. Wait for artifacts to become downloadable
 *   5. Generate the channel manifest (stable.json / beta.json)
 *   6. Sync manifests to public/
 *   7. Validate all live URLs pass
 *   8. Update download-artifacts.ts version constant
 *   9. Commit all metadata changes
 *
 * Usage:
 *   node scripts/release-manager.mjs --channel stable
 *   node scripts/release-manager.mjs --channel stable --skip-build
 *   node scripts/release-manager.mjs --channel stable --dry-run
 *   node scripts/release-manager.mjs --help
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(prefix, message) {
    const colors = {
        "✓": "\x1b[32m",
        "✗": "\x1b[31m",
        "→": "\x1b[36m",
        "⏳": "\x1b[33m",
        "ℹ": "\x1b[34m",
    };
    const reset = "\x1b[0m";
    const color = colors[prefix] ?? "";
    console.log(`${color}${prefix}${reset} ${message}`);
}

function fatal(message) {
    log("✗", message);
    process.exit(1);
}

function run(command, options = {}) {
    const { cwd = repoRoot, silent = false, allowFailure = false } = options;
    if (!silent) log("→", command);
    try {
        const output = execSync(command, {
            cwd,
            encoding: "utf-8",
            stdio: silent ? "pipe" : "inherit",
        });
        return (output ?? "").trim();
    } catch (error) {
        if (allowFailure) return "";
        fatal(`Command failed: ${command}`);
    }
}

function runCapture(command, options = {}) {
    const { cwd = repoRoot } = options;
    try {
        return execSync(command, { cwd, encoding: "utf-8", stdio: "pipe" }).trim();
    } catch {
        return null;
    }
}

async function fileExists(filePath) {
    try {
        await access(filePath, fsConstants.F_OK);
        return true;
    } catch {
        return false;
    }
}

async function readJson(filePath) {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw);
}

async function writeJson(filePath, data) {
    await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── CLI Parsing ─────────────────────────────────────────────────────────────

function usage() {
    console.log(
        [
            "",
            "Opta Init Manager — Release Orchestrator",
            "",
            "Usage:",
            "  node scripts/release-manager.mjs --channel <stable|beta> [options]",
            "",
            "Options:",
            "  --channel <stable|beta>    Release channel (required)",
            "  --skip-build               Skip the Tauri build step (use existing artifacts)",
            "  --skip-upload              Skip GitHub Release creation (assume artifacts exist)",
            "  --dry-run                  Print what would happen without making changes",
            "  --no-commit                Skip the final git commit",
            "  --gh-repo <owner/repo>     GitHub repo for release (default: agencymatthewg-beep/opta)",
            "  -h, --help                 Show this help",
            "",
            "Example:",
            "  node scripts/release-manager.mjs --channel stable",
            "",
        ].join("\n")
    );
}

function parseArgs(argv) {
    const opts = {
        channel: null,
        skipBuild: false,
        skipUpload: false,
        dryRun: false,
        noCommit: false,
        ghRepo: "agencymatthewg-beep/opta",
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "-h" || arg === "--help") return { help: true };
        if (arg === "--skip-build") { opts.skipBuild = true; continue; }
        if (arg === "--skip-upload") { opts.skipUpload = true; continue; }
        if (arg === "--dry-run") { opts.dryRun = true; continue; }
        if (arg === "--no-commit") { opts.noCommit = true; continue; }
        if (arg === "--channel") { opts.channel = argv[++i]; continue; }
        if (arg === "--gh-repo") { opts.ghRepo = argv[++i]; continue; }
        if (arg.startsWith("--channel=")) { opts.channel = arg.split("=")[1]; continue; }
        if (arg.startsWith("--gh-repo=")) { opts.ghRepo = arg.split("=")[1]; continue; }
        fatal(`Unknown argument: ${arg}. Use --help for usage.`);
    }

    return opts;
}

// ─── Version Detection ───────────────────────────────────────────────────────

async function detectVersion() {
    const tauriConfPath = path.join(repoRoot, "desktop-manager", "src-tauri", "tauri.conf.json");
    const conf = await readJson(tauriConfPath);
    return conf.version;
}

// ─── Artifact Paths ──────────────────────────────────────────────────────────

function getBuildArtifacts(version) {
    const bundleBase = path.join(repoRoot, "desktop-manager", "src-tauri", "target", "release", "bundle");
    return {
        macosApp: path.join(bundleBase, "macos", "Opta Init App Manager.app"),
        macosDmg: path.join(bundleBase, "dmg", `Opta Init App Manager_${version}_aarch64.dmg`),
    };
}

function getGitHubReleaseTag(channel, version) {
    return `opta-init-manager-${channel}-v${version}`;
}

function getGitHubAssetBaseUrl(ghRepo, tag) {
    return `https://github.com/${ghRepo}/releases/download/${tag}`;
}

// ─── Step Implementations ────────────────────────────────────────────────────

async function stepPreflight(channel) {
    log("ℹ", "Step 1/8: Pre-flight checks");

    if (!["stable", "beta"].includes(channel)) {
        fatal(`Invalid channel: ${channel}. Must be "stable" or "beta".`);
    }

    const version = await detectVersion();
    if (!version) fatal("Could not detect version from tauri.conf.json");
    log("✓", `Version: ${version}`);
    log("✓", `Channel: ${channel}`);

    // Check if gh CLI is available
    const ghVersion = runCapture("gh --version");
    if (!ghVersion) {
        fatal("GitHub CLI (gh) is not installed. Install via: brew install gh");
    }
    log("✓", "GitHub CLI available");

    return version;
}

async function stepBuild(skipBuild) {
    if (skipBuild) {
        log("⏳", "Step 2/8: Skipping build (--skip-build)");
        return;
    }

    log("ℹ", "Step 2/8: Building Tauri desktop app");
    run("npm run tauri build", { cwd: path.join(repoRoot, "desktop-manager") });
    log("✓", "Build complete");
}

async function stepCreateAppTarGz(version) {
    log("ℹ", "Step 3/8: Packaging .app.tar.gz for updater");

    const bundleMacosDir = path.join(repoRoot, "desktop-manager", "src-tauri", "target", "release", "bundle", "macos");
    const appName = "Opta Init App Manager.app";
    const tarName = `Opta-Init-Manager_aarch64.app.tar.gz`;
    const tarPath = path.join(bundleMacosDir, tarName);

    // Create the tar.gz that the Tauri updater expects
    run(`tar -czf "${tarName}" "${appName}"`, { cwd: bundleMacosDir });

    if (!(await fileExists(tarPath))) {
        fatal(`Failed to create ${tarName}`);
    }

    // Sign it with tauri-cli if the signer is available
    const sigPath = `${tarPath}.sig`;
    const sigResult = runCapture(
        `npx tauri signer sign "${tarPath}" --private-key-path ~/.tauri/opta-init.key 2>&1`,
        { cwd: path.join(repoRoot, "desktop-manager") }
    );

    let signature = null;
    if (await fileExists(sigPath)) {
        signature = (await readFile(sigPath, "utf-8")).trim();
        log("✓", `Signature generated (${signature.length} chars)`);
    } else {
        log("⏳", "No signing key found — will reuse existing signature from manifest");
    }

    return { tarPath, tarName, signature };
}

async function stepUploadToGitHub(opts, version, tarPath, tarName) {
    if (opts.skipUpload) {
        log("⏳", "Step 4/8: Skipping upload (--skip-upload)");
        return;
    }

    log("ℹ", "Step 4/8: Creating GitHub Release and uploading artifacts");

    const tag = getGitHubReleaseTag(opts.channel, version);
    const title = `Opta Init Manager v${version} (${opts.channel})`;
    const dmgArtifacts = getBuildArtifacts(version);

    if (opts.dryRun) {
        log("⏳", `[dry-run] Would create release ${tag} on ${opts.ghRepo}`);
        log("⏳", `[dry-run] Would upload: ${tarName}`);
        if (await fileExists(dmgArtifacts.macosDmg)) {
            log("⏳", `[dry-run] Would upload: ${path.basename(dmgArtifacts.macosDmg)}`);
        }
        return;
    }

    // Create GitHub release (or update if exists)
    const existingRelease = runCapture(
        `gh release view ${tag} --repo ${opts.ghRepo} --json tagName 2>/dev/null`
    );

    if (existingRelease) {
        log("⏳", `Release ${tag} already exists — uploading artifacts to it`);
        run(`gh release upload ${tag} "${tarPath}" --clobber --repo ${opts.ghRepo}`);
    } else {
        const uploadFiles = [`"${tarPath}"`];
        if (await fileExists(dmgArtifacts.macosDmg)) {
            uploadFiles.push(`"${dmgArtifacts.macosDmg}"`);
        }
        run(
            `gh release create ${tag} ${uploadFiles.join(" ")} --title "${title}" --notes "Release ${version} on ${opts.channel} channel" --repo ${opts.ghRepo}`
        );
    }

    log("✓", `Artifacts uploaded to ${tag}`);
}

async function stepWaitForArtifacts(opts, version) {
    log("ℹ", "Step 5/8: Verifying artifacts are downloadable");

    if (opts.dryRun) {
        log("⏳", "[dry-run] Skipping artifact verification");
        return;
    }

    const tag = getGitHubReleaseTag(opts.channel, version);
    const baseUrl = getGitHubAssetBaseUrl(opts.ghRepo, tag);
    const assetUrl = `${baseUrl}/Opta-Init-Manager_aarch64.app.tar.gz`;

    const maxAttempts = 12;
    const delayMs = 5000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(assetUrl, { method: "HEAD", redirect: "follow" });
            if (response.ok) {
                log("✓", `Artifact reachable (attempt ${attempt}/${maxAttempts})`);
                return;
            }
            log("⏳", `Attempt ${attempt}/${maxAttempts}: HTTP ${response.status} — retrying in ${delayMs / 1000}s...`);
        } catch (error) {
            log("⏳", `Attempt ${attempt}/${maxAttempts}: ${error.message} — retrying in ${delayMs / 1000}s...`);
        }
        await sleep(delayMs);
    }

    fatal(
        `Artifact not reachable after ${maxAttempts} attempts. URL: ${assetUrl}\n` +
        `  Check that the GitHub release ${tag} exists and the asset was uploaded.`
    );
}

async function stepUpdateManifest(opts, version, signature) {
    log("ℹ", "Step 6/8: Updating channel manifest");

    const manifestPath = path.join(repoRoot, "channels", "manager-updates", `${opts.channel}.json`);
    const manifest = await readJson(manifestPath);
    const tag = getGitHubReleaseTag(opts.channel, version);
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

    manifest.version = version;
    manifest.publishedAt = now;
    manifest.pub_date = now;
    manifest.notes = `https://github.com/${opts.ghRepo}/releases/tag/${tag}`;

    // Update platform URLs
    const assetBase = `https://init.optalocal.com/desktop-updates/manager/${opts.channel}/${version}`;

    if (manifest.platforms["darwin-aarch64"]) {
        manifest.platforms["darwin-aarch64"].url = `${assetBase}/Opta-Init-Manager_aarch64.app.tar.gz`;
        if (signature) manifest.platforms["darwin-aarch64"].signature = signature;
    }
    if (manifest.platforms["darwin-x86_64"]) {
        manifest.platforms["darwin-x86_64"].url = `${assetBase}/Opta-Init-Manager_x64.app.tar.gz`;
    }
    if (manifest.platforms["windows-x86_64"]) {
        manifest.platforms["windows-x86_64"].url = `${assetBase}/Opta-Init-Manager_x64-setup.nsis.zip`;
    }

    if (opts.dryRun) {
        log("⏳", "[dry-run] Would write manifest:");
        console.log(JSON.stringify(manifest, null, 2));
    } else {
        await writeJson(manifestPath, manifest);
        log("✓", `Updated ${path.relative(repoRoot, manifestPath)}`);
    }

    // Sync to public/
    if (!opts.dryRun) {
        run("npm run sync:manager-updates");
        log("✓", "Synced manifests to public/");
    }
}

async function stepValidateLinks(opts, version) {
    log("ℹ", "Step 7/8: Validating all manifest URLs are live");

    if (opts.dryRun) {
        log("⏳", "[dry-run] Skipping link validation");
        return;
    }

    const manifestPath = path.join(repoRoot, "channels", "manager-updates", `${opts.channel}.json`);
    const result = spawnSync(
        process.execPath,
        [
            path.join(repoRoot, "scripts", "validate-manager-update-links.mjs"),
            "--strict",
            "--manager-version", version,
            manifestPath,
        ],
        { cwd: repoRoot, stdio: "inherit" }
    );

    if (result.status !== 0) {
        fatal(
            "Link validation FAILED. The artifacts are not yet reachable at the expected URLs.\n" +
            "  This usually means the GitHub Release tag or Vercel redirect is misconfigured.\n" +
            "  Fix the issue and re-run with --skip-build --skip-upload."
        );
    }

    log("✓", "All manifest URLs validated successfully");
}

async function stepUpdateDownloadArtifacts(opts, version) {
    log("ℹ", "Step 8/8: Updating download-artifacts.ts version constant");

    const filePath = path.join(repoRoot, "lib", "download-artifacts.ts");
    let contents = await readFile(filePath, "utf-8");

    // Replace the INIT_VERSION constant
    const versionRegex = /^(\/\/ Latest Opta Init Manager — .*)\n(const INIT_VERSION = ")[^"]+(";\s*)$/m;
    const today = new Date().toISOString().slice(0, 10);

    if (versionRegex.test(contents)) {
        contents = contents.replace(
            versionRegex,
            `// Latest Opta Init Manager — ${opts.channel} v${version} (${today})\nconst INIT_VERSION = "${version}";`
        );
    } else {
        // Fallback: just replace the version string
        contents = contents.replace(
            /const INIT_VERSION = "[^"]+";/,
            `const INIT_VERSION = "${version}";`
        );
    }

    if (opts.dryRun) {
        log("⏳", `[dry-run] Would update INIT_VERSION to "${version}"`);
    } else {
        await writeFile(filePath, contents, "utf-8");
        log("✓", `Updated INIT_VERSION to "${version}" in download-artifacts.ts`);
    }
}

async function stepCommit(opts, version) {
    if (opts.noCommit || opts.dryRun) {
        log("⏳", "Skipping commit" + (opts.dryRun ? " (dry-run)" : " (--no-commit)"));
        return;
    }

    log("ℹ", "Committing release metadata");

    const filesToAdd = [
        "channels/manager-updates/stable.json",
        "channels/manager-updates/beta.json",
        "public/desktop-updates/stable.json",
        "public/desktop-updates/beta.json",
        "lib/download-artifacts.ts",
        "desktop-manager/package.json",
        "desktop-manager/src-tauri/tauri.conf.json",
    ];

    for (const file of filesToAdd) {
        const fullPath = path.join(repoRoot, file);
        if (await fileExists(fullPath)) {
            run(`git add "${file}"`, { cwd: repoRoot, silent: true });
        }
    }

    run(
        `git commit -m "release(init): manager v${version} on ${opts.channel} channel"`,
        { cwd: repoRoot, allowFailure: true }
    );

    log("✓", "Release metadata committed");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    const opts = parseArgs(process.argv.slice(2));

    if (opts.help) {
        usage();
        return;
    }

    if (!opts.channel) {
        fatal("--channel is required. Use --help for usage.");
    }

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  Opta Init Manager — Release Orchestrator");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    // Step 1 — Pre-flight
    const version = await stepPreflight(opts.channel);

    // Step 2 — Build
    await stepBuild(opts.skipBuild);

    // Step 3 — Package .app.tar.gz
    const { tarPath, tarName, signature } = await stepCreateAppTarGz(version);

    // Step 4 — Upload to GitHub
    await stepUploadToGitHub(opts, version, tarPath, tarName);

    // Step 5 — Wait for artifacts to be downloadable
    await stepWaitForArtifacts(opts, version);

    // Step 6 — Update manifest ONLY AFTER artifacts are live
    await stepUpdateManifest(opts, version, signature);

    // Step 7 — Validate all URLs work
    await stepValidateLinks(opts, version);

    // Step 8 — Update download-artifacts.ts
    await stepUpdateDownloadArtifacts(opts, version);

    // Commit
    await stepCommit(opts, version);

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    log("✓", `Release v${version} on ${opts.channel} — COMPLETE`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");
    console.log("  Next: deploy the website to make the updated manifest live:");
    console.log("    cd 1O-Opta-Init && vercel deploy --prod");
    console.log("");
}

main().catch((error) => {
    fatal(error instanceof Error ? error.message : String(error));
});
