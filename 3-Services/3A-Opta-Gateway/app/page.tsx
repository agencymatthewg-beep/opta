export default function Home() {
  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>🧠 Opta AI</h1>
      <p style={{ fontSize: '20px', marginBottom: '40px', opacity: 0.9 }}>
        AI Gateway with User-Managed API Keys
      </p>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>Features</h2>
        <ul style={{ paddingLeft: '24px' }}>
          <li>✅ Support for Gemini, Claude, OpenCode, and MiniMax</li>
          <li>✅ User-managed API keys (bring your own)</li>
          <li>✅ Encrypted credential storage via Supabase</li>
          <li>✅ Automatic provider routing based on user preference</li>
          <li>✅ Simple REST API</li>
        </ul>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>Quick Start</h2>
        
        <h3 style={{ fontSize: '24px', marginTop: '24px', marginBottom: '12px' }}>1. Authenticate</h3>
        <p>Sign up or sign in via Supabase Auth to get your JWT token.</p>

        <h3 style={{ fontSize: '24px', marginTop: '24px', marginBottom: '12px' }}>2. Add API Keys</h3>
        <pre><code>{`POST /api/keys
Authorization: Bearer YOUR_SUPABASE_JWT

{
  "gemini": "YOUR_GEMINI_API_KEY",
  "claude": "YOUR_CLAUDE_API_KEY",
  "defaultProvider": "gemini"
}`}</code></pre>

        <h3 style={{ fontSize: '24px', marginTop: '24px', marginBottom: '12px' }}>3. Send Chat Request</h3>
        <pre><code>{`POST /api/chat
Authorization: Bearer YOUR_SUPABASE_JWT
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "provider": "gemini"
}`}</code></pre>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>API Endpoints</h2>
        
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
            <code style={{ color: '#4ade80' }}>POST</code> /api/chat
          </h3>
          <p>Send a chat message to configured AI provider</p>
          <p style={{ fontSize: '14px', opacity: 0.8, marginTop: '8px' }}>
            Parameters: messages (array), provider (optional), model (optional), temperature (optional)
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
            <code style={{ color: '#60a5fa' }}>GET</code> /api/keys
          </h3>
          <p>Get your configured API keys (masked for security)</p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>
            <code style={{ color: '#f59e0b' }}>PUT</code> /api/keys
          </h3>
          <p>Update your API keys</p>
          <p style={{ fontSize: '14px', opacity: 0.8, marginTop: '8px' }}>
            Parameters: gemini, claude, opencode, minimax, defaultProvider
          </p>
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '32px', marginBottom: '16px' }}>Security</h2>
        <ul style={{ paddingLeft: '24px' }}>
          <li>🔒 API keys encrypted in Supabase database</li>
          <li>🔒 Row-Level Security (RLS) ensures users only access their own data</li>
          <li>🔒 JWT-based authentication via Supabase Auth</li>
          <li>🔒 HTTPS required in production</li>
        </ul>
      </section>

      <footer style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.2)', opacity: 0.7 }}>
        <p>Built by Opta Operations | Powered by Supabase & Next.js</p>
      </footer>
    </main>
  )
}
