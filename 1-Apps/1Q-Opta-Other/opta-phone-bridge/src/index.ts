import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./context";
import { getHistory, addMessage, sessionCount } from "./session";

const PORT = parseInt(process.env.PORT ?? "3333");
const MODEL = process.env.MODEL ?? "claude-sonnet-4-6";
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS ?? "1024");
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY not set");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: API_KEY });

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function getSessionId(req: Request, url: URL): string {
  return (
    req.headers.get("x-session-id") ??
    req.headers.get("xi-conversation-id") ??
    url.searchParams.get("session_id") ??
    "default"
  );
}

async function handleChatCompletions(req: Request, url: URL): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const messages: Array<{ role: string; content: string }> = body.messages ?? [];
  if (!messages.length) {
    return new Response(JSON.stringify({ error: "No messages" }), { status: 400 });
  }

  const sessionId = getSessionId(req, url);
  const isStream = body.stream === true;

  // Get last user message
  const lastMsg = messages[messages.length - 1];
  const userText = typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content);

  log(`[${sessionId}] user: ${userText.slice(0, 80)}`);

  // Build context
  const systemPrompt = await buildSystemPrompt();
  const history = getHistory(sessionId);
  addMessage(sessionId, "user", userText);

  const anthropicMessages = [
    ...history,
    { role: "user" as const, content: userText },
  ];

  if (isStream) {
    // Server-Sent Events streaming
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();

        const send = (data: object) => {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          let fullText = "";
          const id = `chatcmpl-${Date.now()}`;
          const created = Math.floor(Date.now() / 1000);

          const anthropicStream = await anthropic.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: systemPrompt,
            messages: anthropicMessages,
          });

          for await (const chunk of anthropicStream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              const text = chunk.delta.text;
              fullText += text;
              send({
                id,
                object: "chat.completion.chunk",
                created,
                model: MODEL,
                choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
              });
            }
          }

          // Done chunk
          send({
            id,
            object: "chat.completion.chunk",
            created,
            model: MODEL,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          });

          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();

          addMessage(sessionId, "assistant", fullText);
          log(`[${sessionId}] assistant: ${fullText.slice(0, 80)}`);
        } catch (err: any) {
          log(`[${sessionId}] ERROR: ${err.message}`);
          send({ error: { message: err.message } });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } else {
    // Non-streaming
    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: anthropicMessages,
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      addMessage(sessionId, "assistant", text);
      log(`[${sessionId}] assistant: ${text.slice(0, 80)}`);

      return new Response(
        JSON.stringify({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: MODEL,
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: text },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: response.usage.input_tokens,
            completion_tokens: response.usage.output_tokens,
            total_tokens: response.usage.input_tokens + response.usage.output_tokens,
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      log(`ERROR: ${err.message}`);
      return new Response(JSON.stringify({ error: { message: err.message } }), { status: 500 });
    }
  }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Health
    if (req.method === "GET" && url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", version: "1.0.0", sessions: sessionCount() }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Chat completions
    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      return handleChatCompletions(req, url);
    }

    return new Response("Not found", { status: 404 });
  },
});

log(`🥷🏿 opta-phone-bridge running on http://localhost:${PORT}`);
log(`Model: ${MODEL} | Max tokens: ${MAX_TOKENS}`);
