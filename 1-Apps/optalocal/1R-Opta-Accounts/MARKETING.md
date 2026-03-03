# Opta Accounts — Marketing & Capabilities

**Tagline:** Unified Identity & Security for the Local Stack.

## 🎯 The Purpose
Opta Accounts (`accounts.optalocal.com`) is the secure identity broker that bridges your isolated local desktop tools with your global cloud profile. It ensures that your provider preferences, model aliases, and security autonomy limits sync effortlessly across the CLI, the Desktop IDE, and the Web Dashboard.

## ✨ Core Marketing Points (What makes it impressive?)
*   **Terminal-to-Browser Auth:** Brings modern OAuth (Google, Apple) securely to the terminal. Typing `opta login` automatically opens your browser, securely authenticates you, and relays the token directly back to your local port without you ever copy-pasting a key.
*   **Universal SSO:** Built on Supabase, it leverages a sophisticated `.optalocal.com` cookie strategy. Log in once on the accounts portal, and you are instantly authenticated across the LMX dashboard, Opta Home, and your local desktop applications.
*   **Device & Capability Scoping:** Your identity isn't just an email; it's a capability profile. Opta Accounts tracks what hardware you are running (e.g., M3 Max vs M1) and automatically tailors what models and tool autonomy limits your local CLI is authorized to run.
*   **No Hardcoded Secrets:** Mandates an ecosystem where API keys are never stored in plaintext config files, relying purely on secure OS keychain integration and cloud-backed identity tokens.

## 🛠 Features & Capabilities
*   **Multi-Provider Login:** Supports Email/Password, Phone, Google OAuth, and Apple OAuth.
*   **Cross-Subdomain SSO:** Middleware-driven session refreshing ensures seamless movement across `auth.optalocal.com` and `login.optalocal.com`.
*   **Profile Sync:** Instantly syncs your preferred fallback APIs (Anthropic/OpenAI) to any new machine you log into via the CLI.
*   **Security Allow-listing:** Strict redirect validation prevents open-redirect vulnerabilities during terminal OAuth callbacks.