# Deployment Guide

## Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **Facebook Developer Account** - [developers.facebook.com](https://developers.facebook.com)
3. **Anthropic API Key** - Get from [console.anthropic.com](https://console.anthropic.com)
4. **Domain Access** - `pa.optamize.biz` DNS control

## Step 1: Facebook App Setup

### 1.1 Create Facebook App
1. Go to [Meta for Developers](https://developers.facebook.com/apps/)
2. Click "Create App"
3. Select "Business" app type
4. Fill in app details:
   - App Name: "Opta PA Messenger"
   - Contact Email: your@email.com

### 1.2 Add Messenger Product
1. In your app dashboard, click "Add Product"
2. Find "Messenger" and click "Set Up"
3. Under "Access Tokens", generate a Page Access Token:
   - Select your Facebook Page
   - Grant permissions: `pages_messaging`, `pages_read_engagement`
   - **Copy the token** → This is your `META_PAGE_ACCESS_TOKEN`

### 1.3 Get App Secret
1. Go to Settings → Basic
2. Click "Show" next to App Secret
3. **Copy the secret** → This is your `META_APP_SECRET`

## Step 2: Vercel Deployment

### 2.1 Install Vercel CLI
```bash
npm install -g vercel
```

### 2.2 Deploy
```bash
cd /Users/Shared/312/Opta/1-Apps/opta-pa-messenger
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Scope? Select your account
- Link to existing project? **No**
- Project name? **opta-pa-messenger**
- Directory? **./** (current directory)
- Modify settings? **No**

### 2.3 Set Environment Variables

In Vercel dashboard or via CLI:

```bash
vercel env add META_PAGE_ACCESS_TOKEN
# Paste your token from Step 1.2

vercel env add META_APP_SECRET
# Paste your secret from Step 1.3

vercel env add META_VERIFY_TOKEN
# Enter: opta-messenger-verify-2026

vercel env add ANTHROPIC_API_KEY
# Paste your Anthropic API key
```

Make sure to set variables for **Production**, **Preview**, and **Development** environments.

### 2.4 Redeploy with Environment Variables
```bash
vercel --prod
```

### 2.5 Set Custom Domain
1. Go to Vercel dashboard → Your project → Settings → Domains
2. Add domain: `pa.optamize.biz`
3. Follow DNS instructions to point domain to Vercel

**DNS Configuration:**
- Type: CNAME
- Name: `pa` (or `@` for root)
- Value: `cname.vercel-dns.com`

Wait for DNS propagation (can take up to 48 hours, usually <1 hour).

## Step 3: Configure Meta Webhook

### 3.1 Set Webhook URL
1. Go to your Facebook App → Messenger → Settings
2. In "Webhooks" section, click "Add Callback URL"
3. Enter:
   - **Callback URL:** `https://pa.optamize.biz/api/webhook/messenger`
   - **Verify Token:** `opta-messenger-verify-2026`
4. Click "Verify and Save"

**If verification fails:**
- Check Vercel deployment logs for errors
- Ensure `META_VERIFY_TOKEN` env var is set correctly
- Test health endpoint: `https://pa.optamize.biz/api/health`

### 3.2 Subscribe to Webhook Events
1. In Webhooks section, click "Add Subscriptions"
2. Select these fields:
   - ✅ `messages`
   - ✅ `messaging_postbacks`
   - ✅ `messaging_optins` (optional)
3. Click "Save"

## Step 4: Test the Integration

### 4.1 Test Webhook Verification
```bash
curl "https://pa.optamize.biz/api/webhook/messenger?hub.mode=subscribe&hub.verify_token=opta-messenger-verify-2026&hub.challenge=test123"
# Should return: test123
```

### 4.2 Test Health Endpoint
```bash
curl https://pa.optamize.biz/api/health
# Should return JSON with status: "ok"
```

### 4.3 Send Test Message
1. Go to your Facebook Page
2. Click "Send Message" (or use Messenger mobile app)
3. Send a message to your page
4. You should receive a response from Opta within a few seconds

## Step 5: Monitor & Debug

### Check Vercel Logs
```bash
vercel logs --prod
```

Or view in Vercel dashboard → Your Project → Logs

### Common Issues

**Webhook verification fails:**
- Verify `META_VERIFY_TOKEN` matches in both Meta and Vercel
- Check deployment logs for errors
- Ensure URL is exactly: `https://pa.optamize.biz/api/webhook/messenger`

**Messages not being received:**
- Check Meta webhook subscriptions are active
- Verify Page Access Token has correct permissions
- Check Vercel function logs for errors
- Test signature verification in logs

**Claude responses failing:**
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check API key has credits/quota
- Review Anthropic API status

**Long response delays:**
- Normal: Claude takes 2-5 seconds to respond
- Check Vercel function timeout (currently set to 30s in vercel.json)
- Review conversation history size (currently limited to 20 messages)

## Step 6: Security Checklist

- ✅ Webhook signature verification enabled
- ✅ Environment variables stored securely in Vercel
- ✅ No secrets committed to git
- ✅ HTTPS enforced (handled by Vercel)
- ✅ App Secret not exposed in logs

## Production Considerations

### Current Limitations
1. **In-memory storage** - Conversations lost on deployment/restart
2. **Single instance** - Won't scale across multiple Vercel instances
3. **No rate limiting** - Vulnerable to spam

### Recommended Upgrades
1. **Add Supabase** for persistent conversation storage
2. **Add Redis** for rate limiting and caching
3. **Add monitoring** (Sentry, LogRocket, etc.)
4. **Add analytics** to track usage

## Maintenance

### Update Dependencies
```bash
npm update
vercel --prod
```

### View Metrics
- Vercel Dashboard → Analytics
- Meta Developer Dashboard → Analytics → Messenger

### Rotate Secrets
If you need to rotate tokens:
1. Generate new token/secret in Meta dashboard
2. Update in Vercel: `vercel env add META_PAGE_ACCESS_TOKEN`
3. Redeploy: `vercel --prod`

## Support

- **Vercel Docs:** [vercel.com/docs](https://vercel.com/docs)
- **Meta Messenger Platform:** [developers.facebook.com/docs/messenger-platform](https://developers.facebook.com/docs/messenger-platform)
- **Anthropic API:** [docs.anthropic.com](https://docs.anthropic.com)
