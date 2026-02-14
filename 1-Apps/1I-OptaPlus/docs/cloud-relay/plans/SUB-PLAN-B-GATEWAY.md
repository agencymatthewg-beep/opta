# SUB-PLAN B: OpenClaw Gateway Configuration

*For: gateway-agent*
*Estimated: 5 minutes*
*No prerequisites — can start immediately*

---

## Steps

### B1: Patch gateway config

Apply these changes to `~/.openclaw/openclaw.json`:

```json
{
  "gateway": {
    "trustedProxies": ["127.0.0.1"],
    "controlUi": {
      "allowedOrigins": [
        "http://192.168.188.9:18793",
        "http://127.0.0.1:18793",
        "http://localhost:18793",
        "http://192.168.188.9",
        "http://127.0.0.1",
        "http://localhost",
        "https://gateway.optamize.biz",
        "https://mono.optamize.biz",
        "https://opta512.optamize.biz",
        "https://floda.optamize.biz",
        "https://saturday.optamize.biz",
        "https://yj.optamize.biz"
      ]
    }
  }
}
```

**Method:** Use OpenClaw's `gateway config.patch` tool for safe patching.

**Why `trustedProxies`:** cloudflared connects to gateway from 127.0.0.1 and injects X-Forwarded-For headers. Without trustedProxies, gateway ignores these headers and treats all tunnel connections as local (which actually works for auth but breaks client IP logging).

**Why `allowedOrigins`:** Gateway's `checkBrowserOrigin()` does exact string matching via `.includes()`. The OptaPlus client sends `Origin: https://gateway.optamize.biz` when connecting remotely. This must be in the allowedOrigins list.

### B2: Restart gateway

The gateway config.patch tool auto-restarts. If manual:

```bash
openclaw gateway restart
```

### B3: Verify

```bash
# Check gateway is running
openclaw status

# Check config applied
cat ~/.openclaw/openclaw.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('trustedProxies:', d.get('gateway',{}).get('trustedProxies'))
print('allowedOrigins:', d.get('gateway',{}).get('controlUi',{}).get('allowedOrigins'))
"
```

## Mac Studio Bot Gateway Configs

Each Mac Studio bot also needs its `allowedOrigins` updated. This requires SSH access:

```bash
# For Mono (port 19001)
ssh opta@Mono512.local "cat /Users/opta/.openclaw/openclaw.json" | python3 -m json.tool | grep -A5 allowedOrigins
```

**Note:** Mac Studio bot configs may need the same `allowedOrigins` additions if they have origin checking enabled. The sub-agent should check each bot's config and patch as needed.

However, if Mac Studio bots don't have `allowedOrigins` configured (empty/absent), they may allow all origins by default. Check this during implementation.

## Validation

- [ ] `trustedProxies: ["127.0.0.1"]` present in config
- [ ] All 6 `https://*.optamize.biz` origins in allowedOrigins
- [ ] Gateway restarted and accepting connections
- [ ] Existing LAN connections (OptaPlus) still work after restart
