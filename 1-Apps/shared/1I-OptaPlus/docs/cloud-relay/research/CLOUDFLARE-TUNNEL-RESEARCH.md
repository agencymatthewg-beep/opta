# Cloudflare Tunnel Research — OptaPlus Remote Access

*Compiled: 2026-02-14*

---

## How It Works

Cloudflare Tunnel (`cloudflared`) creates an **outbound-only** encrypted connection from your machine to Cloudflare's edge network. No ports are opened on your router/firewall. Traffic flows:

```
Client (OptaPlus) → wss://gateway.optamize.biz → Cloudflare Edge → Tunnel → localhost:18793
```

### Key Facts (Verified from Cloudflare Docs)

1. **WebSocket support is automatic** — no additional config needed when proxied (orange cloud)
2. **Free tier limits**: 100,000 concurrent WebSocket connections per domain, 50 Access seats
3. **Timeout**: 100 seconds of inactivity (keepalive/ping-pong solves this)
4. **Counting**: Each WS connection = 1 long-lived HTTP request
5. **TLS**: Automatic edge certificates for all domains on Cloudflare
6. **Multi-service**: Single tunnel can route to multiple hostnames via ingress rules

### Tunnel Service Types

| Protocol | Service Value | Use Case |
|----------|--------------|----------|
| HTTP | `http://localhost:18793` | **Our use case** — WS upgrades from HTTP |
| HTTPS | `https://localhost:18793` | If gateway had TLS |
| TCP | `tcp://localhost:18793` | Raw TCP (needs cloudflared on client) |

**We use HTTP** — Cloudflare terminates TLS at edge, forwards plain HTTP/WS to gateway.

### Ingress Rules (Multi-Bot Routing)

One tunnel can serve all 7 bots via hostname-based routing:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: ~/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: gateway.optamize.biz
    service: http://localhost:18793
  - hostname: mono.optamize.biz
    service: http://192.168.188.11:19001
  - hostname: opta512.optamize.biz
    service: http://192.168.188.11:19000
  - hostname: floda.optamize.biz
    service: http://192.168.188.11:19002
  - hostname: saturday.optamize.biz
    service: http://192.168.188.11:19003
  - hostname: yj.optamize.biz
    service: http://192.168.188.11:19005
  - service: http_status:404
```

### macOS Service (launchd)

```bash
# Install as launch daemon (starts at boot)
sudo cloudflared service install

# Plist location
/Library/LaunchDaemons/com.cloudflare.cloudflared.plist

# Config location (when installed as service)
/etc/cloudflared/config.yml

# Logs
/Library/Logs/com.cloudflare.cloudflared.err.log
/Library/Logs/com.cloudflare.cloudflared.out.log
```

---

## OpenClaw Gateway Compatibility

### Current Config
```json
{
  "gateway": {
    "port": 18793,
    "bind": "lan",
    "auth": { "mode": "token", "token": "8c081eb5..." },
    "controlUi": {
      "allowedOrigins": ["http://192.168.188.9:18793", ...],
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true
    }
  }
}
```

### Required Changes for Tunnel

1. **`gateway.bind`**: Keep `"lan"` (cloudflared on same LAN can reach it). Alternatively `"loopback"` if tunnel runs on same machine.
2. **`gateway.trustedProxies`**: Add `["127.0.0.1"]` so gateway trusts `X-Forwarded-For` from cloudflared
3. **`gateway.controlUi.allowedOrigins`**: Add `"https://gateway.optamize.biz"`
4. **Origin header**: Cloudflare will forward the original `Origin` header from the client. OptaPlus should set `Origin: https://gateway.optamize.biz`

### Gateway Origin Check Logic (from source)

```javascript
// dist/gateway-cli-BNSFqWAT.js:16788
function checkBrowserOrigin(upgradeReq, configSnapshot) {
  // 1. Parse origin → if missing/invalid → REJECT
  // 2. If allowedOrigins.includes(parsedOrigin.origin) → OK
  // 3. If parsedOrigin.host === requestHost → OK  
  // 4. If both loopback → OK
  // 5. Else → REJECT
}
```

Since cloudflared forwards origin headers, OptaPlus sets `Origin: https://gateway.optamize.biz`, and the request arrives at gateway with:
- `Host: gateway.optamize.biz` (from Cloudflare)
- `Origin: https://gateway.optamize.biz` (from client)
- Check #3: `parsedOrigin.host === requestHost` → both are `gateway.optamize.biz` → **PASS** ✅

### Trusted Proxy Handling

When `trustedProxies: ["127.0.0.1"]` is set:
- Gateway reads `X-Forwarded-For` to determine real client IP
- `isLocalDirectRequest()` checks real IP, not proxy IP
- Cloudflared runs on localhost, so its connections come from 127.0.0.1
- Client IP from X-Forwarded-For will be the Cloudflare edge IP (not local)
- This means gateway won't auto-approve device pairing (correct for remote)
- Token auth still required (already configured)

---

## Security Considerations

1. **TLS termination**: Cloudflare terminates TLS at edge. Traffic from CF edge → cloudflared → gateway is encrypted by the tunnel but not TLS. This is acceptable since tunnel is encrypted.
2. **Auth**: Gateway requires token auth. Token travels over TLS (client → CF) then tunnel (CF → gateway). Secure.
3. **DDoS**: Cloudflare edge provides DDoS protection automatically.
4. **Origin validation**: Gateway checks Origin header. Adding `https://gateway.optamize.biz` to allowedOrigins is sufficient.
5. **No port exposure**: Gateway never exposed to public internet directly.

### Optional: Cloudflare Access (Zero Trust)

Add email OTP authentication in front of the tunnel:
- User visits gateway.optamize.biz → Cloudflare Access login → email OTP → allowed
- **Tradeoff**: Adds friction (login step), but prevents unauthorized access even if token leaks
- **Recommendation**: Skip for now, add later if needed. Token auth + TLS is sufficient for personal use.

---

## Existing Resources

1. **harshil.dev guide**: Full OpenClaw + Cloudflare Workers VPC setup (over-engineered for our needs — we don't need Workers VPC, direct tunnel is simpler)
2. **Cloudflare docs**: Tunnel ingress rules, macOS service, WebSocket support
3. **OpenClaw docs**: `/gateway/tailscale.md`, `/gateway/security/index.md`, `/platforms/mac/remote.md`
4. **OpenClaw gateway source**: Origin check, trusted proxies, auth flow all documented in source

---

## Alternatives Considered

| Approach | Verdict |
|----------|---------|
| Tailscale Serve | Good but requires VPN app on phone |
| Tailscale Funnel | Good, no VPN, but ugly domain + password auth required |
| Cloudflare Workers VPC | Over-engineered — adds Worker as middleman unnecessarily |
| Cloudflare Tunnel (direct) | ✅ **BEST** — simplest, uses your domain, free, auto-TLS |
| WireGuard | Manual, needs port forward + static IP |
| ngrok | Paid for custom domain, random URLs otherwise |

---

## Implementation Priority

1. **Phase 1**: Cloudflare Tunnel (MacBook gateway only) — `gateway.optamize.biz`
2. **Phase 2**: Multi-bot ingress (all Mac Studio bots via subdomains)
3. **Phase 3**: OptaPlus auto-detect (LAN vs remote URL switching)
4. **Phase 4**: Optional Cloudflare Access (if security hardening needed)
5. **Phase 5**: Mac Studio tunnel (run cloudflared on Mac Studio for direct routing)
