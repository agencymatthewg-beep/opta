# Canonical LAN Setup (Setup Once)

This is the baseline Opta CLI setup for a single primary LMX host with failover and remote SSH operations.

## 1) Primary host + port

```bash
opta config set connection.host 192.168.188.11
opta config set connection.port 1234
```

## 2) Host failover (fallbackHosts)

Use one stable primary host and add fallbacks for LAN failover:

```bash
opta config set connection.fallbackHosts mono512.local,192.168.188.12
```

Opta will try `connection.host` first, then entries in `connection.fallbackHosts`.

## 3) Inference API key (OpenAI-style workflow)

Generate one key string, sync it to Studio, and copy it:

```bash
opta key create
```

Show/copy it any time later:

```bash
opta key show          # masked
opta key show --reveal # full key
opta key copy          # copy to clipboard
```

Notes:
- `opta key create` stores the key in `connection.apiKey`.
- It also attempts to sync `security.inference_api_key` on the Studio host over SSH.
- Use `opta key create --no-remote` if you only want local key setup.
- `OPTA_API_KEY` env var still overrides config when set.

OpenAI-compatible client values:

```text
base_url = http://<LMX_HOST>:1234/v1
api_key  = opta_sk_...
```

## 4) SSH key setup (remote update/serve flows)

```bash
opta config set connection.ssh.user opta
opta config set connection.ssh.identityFile ~/.ssh/id_ed25519
opta config set connection.ssh.connectTimeoutSec 20
opta config set connection.ssh.lmxPath /Users/Shared/312/Opta/1-Apps/1M-Opta-LMX
opta config set connection.ssh.pythonPath /Users/opta/.mlx-env/bin/python
```

SSH is required for remote update/serve flows. Inference requests from apps use HTTP + API key and do not require SSH.

## 5) Verify once

```bash
opta status
opta doctor
```

## Optional admin key

If your `/admin/*` endpoints are protected, also configure:

```bash
export OPTA_ADMIN_KEY="your-admin-key"
opta config set connection.adminKey "$OPTA_ADMIN_KEY"
```
