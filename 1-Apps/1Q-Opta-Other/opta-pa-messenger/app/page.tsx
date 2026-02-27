export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>🤖 Opta PA Messenger</h1>
      <p>Personal AI assistant webhook server for Facebook Messenger.</p>
      <p>
        Status: <a href="/api/health">Health Check</a>
      </p>
    </main>
  );
}
