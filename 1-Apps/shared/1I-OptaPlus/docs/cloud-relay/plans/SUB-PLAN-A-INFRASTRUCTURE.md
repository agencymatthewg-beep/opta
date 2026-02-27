# SUB-PLAN A: Cloudflare Tunnel Infrastructure

*For: infra-agent (or Matthew manual steps)*
*Estimated: 15 minutes*
*Prerequisite: Matthew must authenticate with Cloudflare (browser login)*

---

## Pre-requisites

- [x] `cloudflared` installed: v2026.2.0 via Homebrew
- [x] Domain `optamize.biz` on Cloudflare (NS: beau.ns.cloudflare.com, desi.ns.cloudflare.com)
- [ ] `cloudflared tunnel login` — requires browser auth (Matthew must do this)

## Steps

### A1: Authenticate cloudflared

```bash
cloudflared tunnel login
```

This opens a browser to Cloudflare, authenticates, and saves `~/.cloudflared/cert.pem`.

**Note:** This is a one-time step. The cert persists across reboots.

### A2: Create tunnel

```bash
cloudflared tunnel create optaplus
```

Output: Tunnel UUID and credentials file path.
Credentials saved to: `~/.cloudflared/<UUID>.json`

### A3: Write config.yml

```bash
cat > ~/.cloudflared/config.yml << 'EOF'
# OptaPlus Cloud Relay — Cloudflare Tunnel Config
# Routes traffic from *.optamize.biz to local OpenClaw gateways

tunnel: <TUNNEL_UUID>
credentials-file: /Users/matthewbyrden/.cloudflared/<TUNNEL_UUID>.json

# Keep tunnel alive
originRequest:
  connectTimeout: 30s
  noHappyEyeballs: false
  keepAliveTimeout: 90s
  keepAliveConnections: 10

ingress:
  # Opta Max (MacBook Pro — localhost)
  - hostname: gateway.optamize.biz
    service: http://localhost:18793
    originRequest:
      httpHostHeader: gateway.optamize.biz

  # Mono (Mac Studio)
  - hostname: mono.optamize.biz
    service: http://192.168.188.11:19001
    originRequest:
      httpHostHeader: mono.optamize.biz

  # Opta512 (Mac Studio)
  - hostname: opta512.optamize.biz
    service: http://192.168.188.11:19000
    originRequest:
      httpHostHeader: opta512.optamize.biz

  # Floda (Mac Studio)
  - hostname: floda.optamize.biz
    service: http://192.168.188.11:19002
    originRequest:
      httpHostHeader: floda.optamize.biz

  # Saturday (Mac Studio)
  - hostname: saturday.optamize.biz
    service: http://192.168.188.11:19003
    originRequest:
      httpHostHeader: saturday.optamize.biz

  # YJ (Mac Studio)
  - hostname: yj.optamize.biz
    service: http://192.168.188.11:19005
    originRequest:
      httpHostHeader: yj.optamize.biz

  # Catch-all (404 for unknown hostnames)
  - service: http_status:404
EOF
```

**Replace `<TUNNEL_UUID>` with actual UUID from step A2.**

### A4: Create DNS records

```bash
cloudflared tunnel route dns optaplus gateway.optamize.biz
cloudflared tunnel route dns optaplus mono.optamize.biz
cloudflared tunnel route dns optaplus opta512.optamize.biz
cloudflared tunnel route dns optaplus floda.optamize.biz
cloudflared tunnel route dns optaplus saturday.optamize.biz
cloudflared tunnel route dns optaplus yj.optamize.biz
```

Each command creates a CNAME record: `<subdomain>.optamize.biz → <UUID>.cfargotunnel.com` (proxied).

### A5: Test tunnel

```bash
# Run in foreground first to verify
cloudflared tunnel run optaplus
```

Expected output:
```
INF Starting tunnel tunnelID=<UUID>
INF Connection registered connIndex=0 ...
INF Connection registered connIndex=1 ...
```

Test WebSocket:
```bash
# From another terminal (or any machine)
wscat -c wss://gateway.optamize.biz
```

Should receive connect.challenge event from gateway.

### A6: Install as persistent service

```bash
# Install as launch agent (starts on login)
cloudflared service install

# OR: Install as launch daemon (starts on boot, even without login)
sudo cloudflared service install
```

**Recommendation: Launch agent (no sudo)** — tunnel should only run when Matthew is logged in (if laptop is closed/sleeping, tunnel pauses anyway).

Verify:
```bash
# Check service is running
launchctl list | grep cloudflare
# Check logs
tail -f /Library/Logs/com.cloudflare.cloudflared.out.log
```

### A7: Verify WebSocket handshake

```bash
# Test from external network (or use curl)
curl -s -o /dev/null -w "%{http_code}" https://gateway.optamize.biz
# Should return 426 (Upgrade Required) or similar — means gateway is reachable

# Full WebSocket test
wscat -c wss://gateway.optamize.biz
# Should receive: {"type":"event","event":"connect.challenge",...}
```

## Validation Checklist

- [ ] `~/.cloudflared/cert.pem` exists
- [ ] `~/.cloudflared/<UUID>.json` exists
- [ ] `~/.cloudflared/config.yml` has correct ingress rules
- [ ] `dig gateway.optamize.biz` returns Cloudflare IPs
- [ ] `curl https://gateway.optamize.biz` returns response (not timeout)
- [ ] WebSocket handshake succeeds through tunnel
- [ ] Service persists across terminal close
- [ ] Service starts on login/boot

## Rollback

```bash
# Stop and remove service
cloudflared service uninstall
# Or: sudo cloudflared service uninstall

# Delete tunnel (also removes DNS records)
cloudflared tunnel delete optaplus

# Remove config
rm ~/.cloudflared/config.yml
```
