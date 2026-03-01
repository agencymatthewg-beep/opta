# Clean-Machine Validation Checklist

Phase 3 gate: these steps must pass on a machine with **no prior Opta CLI install** before any public release.

## Prerequisites

- macOS 13+ with Node 20 or 22 installed (`node --version`)
- No existing `~/.config/opta/` directory
- No existing `ANTHROPIC_API_KEY`, `OPTA_API_KEY`, or `OPTA_ACCOUNTS_URL` env vars set
- Network access to 192.168.188.11 (Mono512 LAN, for LMX validation) _or_ cloud fallback

---

## Step 1 — Install from npm tarball (simulates user install)

```bash
# From GitHub release asset (replace with actual version tag)
npm install -g https://github.com/agencymatthewg-beep/opta/releases/latest/download/opta-cli-npm.tgz

# Verify install
opta --version          # Expected: 0.5.0-alpha.1
opta --help             # Expected: full command listing with no errors
```

Pass criteria:
- [ ] `opta --version` prints correct version
- [ ] `opta --help` shows all command groups: `chat`, `tui`, `do`, `daemon`, `account`, `keychain`, `completions`, `doctor`, `onboard`, `version`
- [ ] No `Error: Cannot find module` or import errors

---

## Step 2 — First-run onboarding

```bash
opta onboard
```

Expected flow:
1. LAN discovery: scans for Opta-LMX at `192.168.188.11:1234` (or times out gracefully)
2. Provider selection: offers Local LMX or Anthropic Cloud
3. Preference prompts: autonomy level, TUI default
4. Summary + confirmation
5. Creates `~/.config/opta/config.json`

Pass criteria:
- [ ] If LMX reachable: auto-discovers and confirms connection
- [ ] If LMX NOT reachable: shows clear warning, allows manual entry or Anthropic fallback, does not hard-fail
- [ ] Config file created at `~/.config/opta/config.json`
- [ ] `opta config get connection.host` shows configured host

---

## Step 3 — Doctor check

```bash
opta doctor
```

Pass criteria:
- [ ] Runs all checks without crashing
- [ ] Shows clear OK / WARN / FAIL for each check
- [ ] `opta doctor --fix` attempts auto-remediation for any FAIL (daemon not running, etc.)

---

## Step 4 — Daemon lifecycle

```bash
opta daemon start
opta daemon status
opta daemon stop
```

Pass criteria:
- [ ] Daemon starts, PID written to `~/.config/opta/daemon/`
- [ ] `status` shows uptime and connection info
- [ ] `stop` cleanly terminates

---

## Step 5 — Basic chat

```bash
# LMX path (if LAN available)
opta chat "say hello"

# Anthropic path (if LMX unavailable)
ANTHROPIC_API_KEY=<key> opta chat "say hello"
```

Pass criteria:
- [ ] Gets a streaming response without error
- [ ] Token counts shown on completion
- [ ] Clean exit (no hanging process)

---

## Step 6 — Shell completions

```bash
opta completions bash --install   # or zsh/fish
```

Pass criteria:
- [ ] Script written to correct location
- [ ] After sourcing: `opta <TAB>` shows subcommands (bash/zsh)

---

## Step 7 — Version check

```bash
opta version --check
```

Pass criteria:
- [ ] Prints current version
- [ ] Shows "Up to date" or "Update available: X.X.X" without error
- [ ] Works offline (skips check gracefully if no network)

---

## Step 8 — Keychain (macOS)

```bash
opta keychain status
opta keychain set-anthropic sk-ant-...
opta keychain status   # shows "stored"
opta keychain delete-anthropic
```

Pass criteria:
- [ ] Keychain backend shown as "available" on macOS
- [ ] Key stored and confirmed with masked display
- [ ] Key deleted cleanly

---

## Step 9 — Account flow (if Supabase configured)

```bash
opta account login
opta account status
opta account keys list
```

Pass criteria:
- [ ] Login URL opens in browser
- [ ] After auth: status shows user email
- [ ] `keys list` shows cloud-synced keys (or "none" if empty)

---

## Sign-Off

| Tester | Date | Node Version | macOS Version | Result |
|--------|------|--------------|---------------|--------|
|        |      |              |               |        |

Steps 1–7 are **required** for release. Steps 8–9 are advisory.

All 7 required steps must pass before `npm publish` and GitHub release are executed.
