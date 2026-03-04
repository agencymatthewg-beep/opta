---
description: Sync the Windows stable release to match the macOS release
---

When running the `/windows` command to catch Windows up with Mac:

1. **Update `public/desktop-updates/stable.json`**:
   - Parse `public/desktop-updates/beta.json` and extract the `windows-x86_64` platform object.
   - Insert the `windows-x86_64` object into the `platforms` dictionary in `public/desktop-updates/stable.json`.

2. **Update `channels/stable.json`**:
   - Check `channels/beta.json` for any `windows` artifacts inside the `components` array (e.g., `opta-cli`).
   - Copy those artifact arrays into the corresponding components in `channels/stable.json`.

3. **Update `lib/download-artifacts.ts`**:
   - Locate the `windows` platform targeting in `export const DOWNLOAD_TARGETS`.
   - Replace `manifestUrl: "/desktop-updates/beta.json"` with `manifestUrl: "/desktop-updates/stable.json"`.

4. **Sync Channels/Manifests**:
// turbo
   - Run `node scripts/sync-desktop-manifests.mjs` to ensure the `channels/` schemas and JSON files are correctly exported to `public/desktop/`.

5. **Commit the Changes**:
// turbo
   - Automatically commit the changes with the message "chore(release): sync Windows stable release with macOS".
