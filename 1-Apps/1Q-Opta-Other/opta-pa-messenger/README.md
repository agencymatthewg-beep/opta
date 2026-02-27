# Opta PA Messenger

Personal AI assistant webhook server for Facebook Messenger integration. Powered by Claude Sonnet 4.5.

## Architecture

- **Platform:** Next.js 15 (App Router)
- **Deployment:** Vercel at `pa.optamize.biz`
- **AI:** Anthropic Claude (`claude-sonnet-4-5`)
- **Storage:** In-memory conversation history (20 messages per user)

## Features

- ✅ Meta webhook verification
- ✅ Webhook signature validation (X-Hub-Signature-256)
- ✅ Async message processing (avoids Meta timeout)
- ✅ Typing indicators while generating responses
- ✅ Automatic message chunking for long responses (>2000 chars)
- ✅ Conversation history (sliding window, last 20 messages)
- ✅ Error handling and graceful failures
- ✅ Health check endpoint

## API Routes

### `GET /api/webhook/messenger`
Webhook verification endpoint. Meta sends verification request during setup.

**Query Parameters:**
- `hub.mode` - Should be "subscribe"
- `hub.verify_token` - Must match `META_VERIFY_TOKEN`
- `hub.challenge` - Returned if verification succeeds

### `POST /api/webhook/messenger`
Incoming message webhook. Receives messages from Meta Messenger API.

**Headers:**
- `X-Hub-Signature-256` - HMAC signature for validation

**Payload:** Meta Messenger webhook format

### `GET /api/health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": "123s",
  "conversations": 5,
  "timestamp": "2026-02-20T06:12:00.000Z"
}
```

## Environment Variables

Create `.env` file with:

```bash
META_PAGE_ACCESS_TOKEN=your_page_access_token
META_APP_SECRET=your_app_secret
META_VERIFY_TOKEN=opta-messenger-verify-2026
ANTHROPIC_API_KEY=your_anthropic_api_key
```

See `.env.example` for template.

## Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Server runs at http://localhost:3000
```

## Deployment

### Vercel Setup

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```

3. **Set environment variables in Vercel dashboard:**
   - `META_PAGE_ACCESS_TOKEN`
   - `META_APP_SECRET`
   - `META_VERIFY_TOKEN`
   - `ANTHROPIC_API_KEY`

4. **Configure custom domain:** Point `pa.optamize.biz` to Vercel

### Meta Messenger Setup

1. Create Facebook App at [developers.facebook.com](https://developers.facebook.com)
2. Add Messenger product
3. Generate Page Access Token
4. Set webhook URL: `https://pa.optamize.biz/api/webhook/messenger`
5. Set verify token: `opta-messenger-verify-2026`
6. Subscribe to webhook events: `messages`, `messaging_postbacks`

## Design Decisions

### 1. Immediate 200 Response
Meta requires webhook responses within 20 seconds. We return `200 OK` immediately and process messages asynchronously to avoid timeouts.

### 2. Message Chunking
Messenger has a 2000 character limit. Long responses are automatically split at sentence boundaries.

### 3. Typing Indicators
Shows "typing..." bubble while Claude generates response for better UX.

### 4. Signature Verification
All webhooks are validated using HMAC-SHA256 signature to prevent spoofing.

### 5. In-Memory Storage
Current implementation uses in-memory Map for conversation history. This is simple but:
- ⚠️ Data lost on server restart
- ⚠️ Won't scale across multiple Vercel instances

**TODO:** Migrate to Supabase or Redis for production.

### 6. Conversation Windowing
Keeps last 20 messages (10 exchanges) per user to balance context and token usage.

## Project Structure

```
opta-pa-messenger/
├── app/
│   ├── api/
│   │   ├── health/
│   │   │   └── route.ts          # Health check
│   │   └── webhook/
│   │       └── messenger/
│   │           └── route.ts      # Main webhook handler
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Homepage
├── lib/
│   ├── anthropic.ts              # Claude API client
│   ├── messenger.ts              # Messenger Send API utilities
│   ├── conversation.ts           # In-memory conversation store
│   └── system-prompt.ts          # AI personality & instructions
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

## Monitoring

Check Vercel logs for:
- Webhook verification events
- Incoming messages
- Claude API responses
- Errors and failures

## Future Enhancements

- [ ] Migrate to Supabase for persistent conversation storage
- [ ] Add user commands (`/clear`, `/help`, etc.)
- [ ] Implement rate limiting
- [ ] Add analytics and usage tracking
- [ ] Support for images, attachments, quick replies
- [ ] Multi-user access control
- [ ] Conversation export/backup

## License

Private project for Matthew's personal use.
