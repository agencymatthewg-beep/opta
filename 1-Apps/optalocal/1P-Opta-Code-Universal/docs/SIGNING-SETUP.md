# Code Signing Setup — Opta Code Desktop

This document contains the exact steps to configure signing and notarization for macOS and Windows distributions. Once completed, Gatekeeper quarantine and SmartScreen warnings are eliminated.

---

## macOS — Apple Developer ID Signing + Notarization

### Prerequisites

- Apple Developer account (paid, $99/yr)
- **Developer ID Application** certificate installed in your Keychain
  - Check: `security find-identity -v -p codesigning | grep "Developer ID Application"`

### Step 1 — Export the certificate as a `.p12`

1. Open **Keychain Access** → **My Certificates**
2. Find **Developer ID Application: Your Name (TEAMID)**
3. Right-click → **Export** → format: **.p12**, set a strong passphrase
4. Save as `opta-developer-id.p12` somewhere temporary

### Step 2 — Base64-encode the `.p12`

```bash
base64 -i opta-developer-id.p12 | pbcopy
# Clipboard now holds the base64-encoded certificate
```

### Step 3 — Create an App-Specific Password for notarization

1. Go to [appleid.apple.com](https://appleid.apple.com) → **Sign-In and Security** → **App-Specific Passwords**
2. Generate a new password, name it `opta-ci-notarize`
3. Copy the password (shown once)

### Step 4 — Find your Team ID

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
# Output: ... "Developer ID Application: Your Name (XXXXXXXXXX)"
# XXXXXXXXXX is your Team ID
```

### Step 5 — Set GitHub repository secrets

Go to **GitHub → opta repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `APPLE_CERTIFICATE` | Base64 string from Step 2 |
| `APPLE_CERTIFICATE_PASSWORD` | Passphrase you set in Step 1 |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Your Name (XXXXXXXXXX)` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password from Step 3 |
| `APPLE_TEAM_ID` | 10-character Team ID from Step 4 |

### Step 6 — Trigger the build

```bash
gh workflow run "Opta Code — macOS Build" --repo agencymatthewg-beep/opta
```

The CI will:
1. Import the certificate into the runner Keychain via `apple-actions/import-codesign-certs@v3`
2. Build the Tauri DMG with `APPLE_SIGNING_IDENTITY` (code-signed)
3. Submit to Apple notary service using `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID`
4. Staple the notarization ticket to the DMG

### Verification

After a successful CI run, download the DMG artifact and run:

```bash
spctl --assess --type open --context context:primary-signature -v /path/to/OptaCode.dmg
# Expected: source=Notarized Developer ID
```

---

## Windows — Authenticode Signing (future)

Windows signing is currently skipped. SmartScreen will show an "Unknown publisher" warning on first install — users click **More info → Run anyway**.

When you're ready to eliminate SmartScreen warnings:

### What you need

- An **Authenticode code signing certificate** (EV or OV)
  - Recommended: [DigiCert](https://www.digicert.com) or [Sectigo](https://sectigo.com)
  - EV cert (~$350/yr) builds SmartScreen reputation faster
  - OV cert (~$200/yr) is cheaper but takes longer to clear SmartScreen

### Setup steps (when cert is obtained)

1. Export the PFX from your certificate store
2. Base64-encode: `certutil -encode cert.pfx cert.txt` (then copy content)
3. Set GitHub secrets:

| Secret name | Value |
|---|---|
| `WINDOWS_CERTIFICATE` | Base64-encoded PFX |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX passphrase |

The Windows CI workflow already has the signing infrastructure wired in (`Configure Authenticode signing` step). It activates automatically when both secrets are present.

> **Note:** For release tags (`v*`), the workflow enforces that `WINDOWS_CERTIFICATE` is set. Non-tag builds proceed unsigned.

---

## Local Verification Commands

### macOS

```bash
# Verify signing
codesign --verify --deep --strict --verbose=2 "/Applications/Opta Code.app"

# Verify notarization
spctl --assess --verbose "/Applications/Opta Code.app"

# Full desktop check (typecheck + tests + build)
npm run check:desktop
```

### Windows (in PowerShell)

```powershell
# Verify signing (after install)
Get-AuthenticodeSignature "C:\Program Files\Opta Code\opta-code.exe" | Select-Object Status, SignerCertificate

# Full desktop check
npm run check:desktop
```
