import chalk from 'chalk';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadConfig } from '../core/config.js';
import { agentLoop } from '../core/agent.js';
import { createSession, loadSession, saveSession } from '../memory/store.js';
import { EXIT } from '../core/errors.js';

// --- Server Handler (testable without HTTP) ---

interface ServerHandlerOptions {
  model: string;
  host: string;
  port: number;
}

interface HealthResponse {
  status: 'ok';
  model: string;
  uptime: number;
  version: string;
}

interface ChatValidation {
  valid: boolean;
  error?: string;
  message?: string;
  sessionId?: string;
}

export function createServerHandler(opts: ServerHandlerOptions) {
  const startTime = Date.now();

  return {
    handleHealth(): HealthResponse {
      return {
        status: 'ok',
        model: opts.model,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: '0.4.0',
      };
    },

    validateChatRequest(body: Record<string, unknown>): ChatValidation {
      if (!body.message || typeof body.message !== 'string') {
        return { valid: false, error: 'Missing required field: message (string)' };
      }
      return {
        valid: true,
        message: body.message,
        sessionId: typeof body.session_id === 'string' ? body.session_id : undefined,
      };
    },
  };
}

// --- HTTP Server ---

interface ServerOptions {
  port?: number;
  host?: string;
  model?: string;
}

export async function startServer(opts: ServerOptions): Promise<void> {
  const overrides: Record<string, unknown> = {};
  if (opts.model) {
    overrides['model'] = { default: opts.model };
  }

  const config = await loadConfig(overrides);

  if (!config.model.default) {
    console.error(
      chalk.red('\u2717') + ' No model configured\n\n' +
      chalk.dim('Run ') + chalk.cyan('opta status') + chalk.dim(' to check your LMX connection')
    );
    process.exit(EXIT.NO_CONNECTION);
  }

  const serverPort = opts.port ?? 3456;
  const serverHost = opts.host ?? '127.0.0.1';

  const handler = createServerHandler({
    model: config.model.default,
    host: config.connection.host,
    port: config.connection.port,
  });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url ?? '/';

    // GET /health
    if (url === '/health' && req.method === 'GET') {
      const health = handler.handleHealth();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(health));
      return;
    }

    // POST /v1/chat
    if (url === '/v1/chat' && req.method === 'POST') {
      try {
        const body = await readBody(req);
        const validation = handler.validateChatRequest(body);

        if (!validation.valid) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: validation.error }));
          return;
        }

        // Create or resume session
        let session;
        if (validation.sessionId) {
          try {
            session = await loadSession(validation.sessionId);
          } catch {
            session = await createSession(config.model.default);
          }
        } else {
          session = await createSession(config.model.default);
        }

        // Run agent loop
        const result = await agentLoop(validation.message!, config, {
          existingMessages: session.messages,
          sessionId: session.id,
          silent: true,
        });

        session.messages = result.messages;
        session.toolCallCount += result.toolCallCount;
        await saveSession(session);

        // Extract final assistant message
        const assistantMsgs = result.messages.filter(m => m.role === 'assistant');
        const finalMsg = assistantMsgs[assistantMsgs.length - 1];

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          session_id: session.id,
          response: finalMsg?.content ?? '',
          tool_calls: result.toolCallCount,
          model: config.model.default,
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', endpoints: ['GET /health', 'POST /v1/chat'] }));
  });

  server.listen(serverPort, serverHost, () => {
    console.log(
      '\n' + chalk.bold('Opta Server') + chalk.dim(' running at ') +
      chalk.cyan(`http://${serverHost}:${serverPort}`)
    );
    console.log(chalk.dim(`  Model: ${config.model.default}`));
    console.log(chalk.dim(`  LMX:   ${config.connection.host}:${config.connection.port}`));
    console.log();
    console.log(chalk.dim('Endpoints:'));
    console.log(chalk.dim(`  GET  /health   — Server status`));
    console.log(chalk.dim(`  POST /v1/chat  — Send a message`));
    console.log();
    console.log(chalk.dim('Press Ctrl+C to stop\n'));
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.dim('\nShutting down...'));
    server.close(() => {
      process.exit(0);
    });
  });
}

// --- Helpers ---

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}
