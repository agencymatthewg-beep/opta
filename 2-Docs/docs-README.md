# Opta Nexus Documentation

Central documentation for the Opta Nexus infrastructure.

## Location

**On Mac Studio:** `~/opta-docs/` or `/Users/opta/opta-docs/`

**From network devices:**
```bash
ssh opta@192.168.188.144 "cat ~/opta-docs/INFRASTRUCTURE.md"
```

Or mount via SSHFS/SFTP for direct access.

---

## Documents

| File | Purpose |
|------|---------|
| [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) | Hardware specs, services, memory allocation, endpoints |
| [OPERATIONS.md](./OPERATIONS.md) | Daily operations, use cases, troubleshooting |
| [CLAUDE.md](./CLAUDE.md) | Template for agent context (copy to projects) |
| README.md | This index |

---

## Quick Access

### Copy CLAUDE.md to a project
```bash
cp ~/opta-docs/CLAUDE.md ~/my-project/CLAUDE.md
```

### View infrastructure details
```bash
cat ~/opta-docs/INFRASTRUCTURE.md
```

### View operations guide
```bash
cat ~/opta-docs/OPERATIONS.md
```

---

## Clawdbot Workspace

Clawdbot's workspace at `~/clawd/` also contains context files:
- `AGENTS.md` — Agent behavior + infrastructure context
- `SOUL.md` — Personality and communication style
- `CLAUDE.md` — Compact agent context
- `USER.md` — User preferences

These are automatically loaded by Clawdbot each session.

---

## Network Access Setup

### From MacBook Pro (or other Mac)

**Option 1: SSH directly**
```bash
ssh opta@192.168.188.144
cat ~/opta-docs/INFRASTRUCTURE.md
```

**Option 2: Mount via SSHFS**
```bash
# Install macFUSE + sshfs first
sshfs opta@192.168.188.144:/Users/opta/opta-docs ~/mnt/opta-docs
```

**Option 3: Screen Sharing**
Connect via VNC: `vnc://192.168.188.144`

### From Windows PC

**Option 1: SSH (PowerShell/WSL)**
```powershell
ssh opta@192.168.188.144
```

**Option 2: WinSCP/FileZilla**
SFTP to `opta@192.168.188.144:/Users/opta/opta-docs/`

---

## Updating Documentation

These docs should be updated when:
- IP address changes
- New services are added
- Configuration changes significantly
- New use cases emerge

Edit directly on Mac Studio or via SSH.
