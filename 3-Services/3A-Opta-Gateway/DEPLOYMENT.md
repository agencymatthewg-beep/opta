# 🚀 Deployment Guide - Opta AI LM Gateway

## Quick Deploy to Vercel (Recommended)

### Option 1: Deploy via Vercel CLI (Fastest)

**1. Install Vercel CLI:**
```bash
npm install -g vercel
```

**2. Login to Vercel:**
```bash
vercel login
```

**3. Deploy:**
```bash
cd /Users/Shared/312/Opta/1-Apps/opta-lm-backend
vercel --prod
```

**4. Add Environment Variables:**

When prompted, add these environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://cytjsmezyldytbmjrolyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGpzbWV6eWR5dGJtanJvbHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTcyNDUsImV4cCI6MjA4NjU3MzI0NX0.DuYyYixsjdl9R5Uq4hIL4TQMGvCCssw_1wNo-J7De6Q
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5dGpzbWV6eWR5dGJtanJvbHl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDk5NzI0NSwiZXhwIjoyMDg2NTczMjQ1fQ.XLpqeLBcPTGNFE4SHhfcxS6YL3YD-ngb0fbHoq6c2CA
NEXTAUTH_SECRET=opta-lm-production-secret-$(openssl rand -base64 32)
NEXTAUTH_URL=https://lm.optamize.biz
```

---

### Option 2: Deploy via Vercel Web UI (Easier)

**1. Push to GitHub:**

```bash
# Create new repo on GitHub: opta-lm-backend
# Then:
cd /Users/Shared/312/Opta/1-Apps/opta-lm-backend
git remote add origin https://github.com/YOUR_USERNAME/opta-lm-backend.git
git push -u origin main
```

**2. Deploy via Vercel Dashboard:**

1. Visit https://vercel.com/new
2. Click "Import Git Repository"
3. Select `opta-lm-backend`
4. Click "Deploy"

**3. Add Environment Variables:**

In Vercel dashboard → Settings → Environment Variables, add:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://cytjsmezyldytbmjrolyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` (see above) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (see above) |
| `NEXTAUTH_SECRET` | Generate via `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://lm.optamize.biz` |

**4. Redeploy:**

Click "Redeploy" after adding environment variables.

---

## Configure Custom Domain (lm.optamize.biz)

### In Vercel Dashboard:

1. Go to your project → Settings → Domains
2. Click "Add Domain"
3. Enter: `lm.optamize.biz`
4. Copy the DNS records shown

### In Your DNS Provider (e.g., Cloudflare):

Add these DNS records:

| Type | Name | Value |
|------|------|-------|
| CNAME | lm | cname.vercel-dns.com |

Or if you need A records:

| Type | Name | Value |
|------|------|-------|
| A | lm | 76.76.21.21 |
| A | lm | 76.76.19.19 |

Wait 5-10 minutes for DNS propagation, then verify at https://lm.optamize.biz

---

## Testing After Deployment

### 1. Test Homepage

Visit: https://lm.optamize.biz

You should see the API documentation page.

### 2. Test Authentication

**Sign Up:**
```bash
curl -X POST https://cytjsmezyldytbmjrolyz.supabase.co/auth/v1/signup \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

**Response:** You'll get a JWT token in the response.

### 3. Test API Keys Endpoint

```bash
curl -X PUT https://lm.optamize.biz/api/keys \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "gemini": "AIzaSyDa6-K4vJl1lewF9rxw-m8aDU9WDallCB8",
    "defaultProvider": "gemini"
  }'
```

### 4. Test Chat Endpoint

```bash
curl -X POST https://lm.optamize.biz/api/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello! What is 2+2?"}
    ],
    "provider": "gemini"
  }'
```

**Expected Response:**
```json
{
  "provider": "gemini",
  "model": "gemini-2.0-flash-exp",
  "content": "2 + 2 = 4",
  "usage": {...}
}
```

---

## Troubleshooting

### "Module not found" errors
- Run `npm install` in project directory
- Redeploy after installing dependencies

### "Invalid or expired token"
- Get a fresh JWT from Supabase auth
- Verify token is included in `Authorization: Bearer ...` header

### CORS errors
- Check `next.config.js` has correct CORS headers
- Verify request includes proper headers

### "No AI provider keys configured"
- Add your API keys via `PUT /api/keys`
- Verify you're authenticated with valid JWT

### DNS not resolving
- Wait 10-15 minutes for propagation
- Use `dig lm.optamize.biz` to check DNS
- Clear browser DNS cache

---

## Monitoring

### Vercel Dashboard

Monitor deployment health at:
- https://vercel.com/dashboard
- Check logs for errors
- View analytics and bandwidth usage

### Supabase Dashboard

Monitor database and auth at:
- https://cytjsmezyldytbmjrolyz.supabase.co

### Key Metrics

- API response time (<500ms target)
- Error rate (<1% target)
- Auth success rate (>95% target)
- Database connections (monitor RLS performance)

---

## Security Checklist

- [x] Environment variables configured (not in code)
- [x] HTTPS enforced (automatic with Vercel)
- [x] Row-Level Security (RLS) enabled in Supabase
- [x] API keys encrypted in database
- [x] JWT-based authentication
- [x] CORS headers configured
- [x] .env.local in .gitignore

---

## Rollback Plan

If deployment fails:

1. **Revert to previous deployment:**
   - Vercel dashboard → Deployments → Previous version → Promote to Production

2. **Check logs:**
   - Vercel dashboard → View Function Logs
   - Look for error stack traces

3. **Local testing:**
   ```bash
   npm run dev
   # Test locally before redeploying
   ```

---

## Next Steps After Deployment

1. ✅ Deploy to Vercel
2. ✅ Configure lm.optamize.biz domain
3. ✅ Test authentication + API endpoints
4. 🔜 **Phase 4:** Simplify Opta Life iOS (remove OpenClaw)
5. 🔜 **Phase 5:** Enhance Opta Plus iOS (add Opta Life tab)

---

**Need Help?**

Contact: matthew@optamize.biz

Built by Opta Operations | Powered by Supabase, Next.js, Vercel
