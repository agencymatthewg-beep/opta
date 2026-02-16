# 🧠 Opta AI - LM Gateway

AI provider routing backend with user-managed API keys. Built with Next.js, Supabase, and TypeScript.

## Features

- ✅ Multi-provider support (Gemini, Claude, OpenCode, MiniMax)
- ✅ User-managed API keys (bring your own keys)
- ✅ Encrypted credential storage via Supabase
- ✅ Automatic provider routing
- ✅ JWT-based authentication
- ✅ Row-Level Security (RLS)
- ✅ Simple REST API
- ✅ Free to use (no subscription costs)

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://cytjsmezyldytbmjrolyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Next.js
NEXTAUTH_SECRET=generate_random_secret
NEXTAUTH_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` for API documentation.

---

## API Reference

### Authentication

All API endpoints require a valid Supabase JWT token in the `Authorization` header:

```
Authorization: Bearer YOUR_SUPABASE_JWT
```

### Endpoints

#### `POST /api/chat`

Send a chat message to configured AI provider.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "provider": "gemini",
  "model": "gemini-2.0-flash-exp",
  "temperature": 0.7,
  "maxTokens": 2048
}
```

**Response:**
```json
{
  "provider": "gemini",
  "model": "gemini-2.0-flash-exp",
  "content": "Hello! How can I help you today?",
  "usage": {
    "promptTokens": 5,
    "completionTokens": 10,
    "totalTokens": 15
  }
}
```

#### `GET /api/keys`

Get your configured API keys (masked for security).

**Response:**
```json
{
  "gemini": "AIza••••••Bc8",
  "claude": null,
  "opencode": "sk-or••••••xyz",
  "minimax": null,
  "defaultProvider": "gemini"
}
```

#### `PUT /api/keys`

Update your API keys.

**Request:**
```json
{
  "gemini": "AIzaSyDa6-K4vJl1lewF9rxw-m8aDU9WDallCB8",
  "claude": "sk-ant-api03-...",
  "opencode": "sk-or-v1-...",
  "minimax": "sk-cp-...",
  "defaultProvider": "gemini"
}
```

**Response:**
```json
{
  "success": true,
  "message": "API keys updated successfully"
}
```

---

## Supported AI Providers

### Gemini (Google)
- **Default Model:** `gemini-2.0-flash-exp`
- **Get API Key:** https://makersuite.google.com/app/apikey
- **Pricing:** Free tier available (15 requests/min)

### Claude (Anthropic)
- **Default Model:** `claude-sonnet-4-5`
- **Get API Key:** https://console.anthropic.com/
- **Pricing:** Pay-as-you-go

### OpenCode (OpenRouter)
- **Default Model:** `anthropic/claude-sonnet-4-5`
- **Get API Key:** https://openrouter.ai/keys
- **Pricing:** Competitive routing pricing

### MiniMax
- **Default Model:** `MiniMax-Text-01`
- **Get API Key:** https://api.minimax.chat/
- **Pricing:** Subscription-based

---

## Security

### Encryption
- API keys are encrypted in Supabase database
- Supabase handles encryption/decryption automatically
- Keys are never exposed in responses (masked display)

### Row-Level Security (RLS)
- Users can only access their own API keys
- Enforced at the database level
- No risk of cross-user data leakage

### Authentication
- JWT-based auth via Supabase
- Tokens verified on every request
- Supports email/password, Google OAuth, Apple OAuth

---

## Deployment

### Deploy to Vercel

1. **Connect to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Visit https://vercel.com/new
   - Import your GitHub repository
   - Add environment variables from `.env.local`
   - Deploy!

3. **Custom Domain:**
   - Add `lm.optamize.biz` in Vercel dashboard
   - Update DNS: `CNAME lm → cname.vercel-dns.com`

### Deploy to Railway

```bash
railway init
railway add
railway up
```

Add environment variables in Railway dashboard.

---

## Development

### Project Structure

```
opta-lm-backend/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts       # Main AI routing endpoint
│   │   └── keys/
│   │       └── route.ts       # API key management
│   ├── layout.tsx
│   ├── page.tsx               # Homepage/docs
│   └── globals.css
├── lib/
│   └── supabase.ts            # Supabase client
├── .env.local                 # Environment variables
├── package.json
├── tsconfig.json
└── next.config.js
```

### Adding New AI Providers

1. Add API key field to `ai_provider_keys` table in Supabase
2. Update TypeScript types in `lib/supabase.ts`
3. Implement provider routing in `app/api/chat/route.ts`
4. Add to documentation

---

## Testing

### Test Authentication
```bash
curl -X POST https://cytjsmezyldytbmjrolyz.supabase.co/auth/v1/signup \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test API Keys Endpoint
```bash
curl -X GET http://localhost:3000/api/keys \
  -H "Authorization: Bearer YOUR_JWT"
```

### Test Chat Endpoint
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "provider": "gemini"
  }'
```

---

## Troubleshooting

### "No AI provider keys configured"
- Add your API keys via `PUT /api/keys`
- Ensure you're authenticated with a valid JWT

### "Invalid or expired token"
- Refresh your Supabase session
- Re-authenticate if needed

### "Gemini API error: ..."
- Check your Gemini API key is valid
- Verify you haven't hit rate limits (15 req/min free tier)

### CORS errors
- Ensure `Access-Control-Allow-Origin` headers are set
- Check `next.config.js` configuration

---

## Roadmap

- [ ] Streaming responses (SSE)
- [ ] Usage analytics dashboard
- [ ] Cost tracking per provider
- [ ] Automatic fallback to secondary provider
- [ ] Web UI for API key management
- [ ] iOS/macOS SDK

---

## License

MIT

---

## Support

For issues or questions, contact: matthew@optamize.biz

Built by **Opta Operations** | Powered by Supabase & Next.js
