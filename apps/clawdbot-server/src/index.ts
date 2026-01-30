/**
 * Clawdbot Server Entry Point
 * WebSocket server for Opta Life Manager AI integration.
 */

import { getConfig } from './config/env';
import { ClawdbotServer } from './websocket/server';
import { createLLMRouter, LLMRouter } from './llm/router';
import { createOptaClient, OptaClient } from './actions/opta-client';
import type { Connection } from './websocket/connection';
import type { ChatMessage } from './protocol/types';

// Load configuration
const config = getConfig();

// Initialize services
const llmRouter: LLMRouter = createLLMRouter(config);
const optaClient: OptaClient = createOptaClient(config.optaApiUrl);

// Message handler - processes incoming chat messages
async function handleMessage(connection: Connection, message: ChatMessage): Promise<void> {
  console.log(`[Main] Processing message from ${connection.data.id}: ${message.content.substring(0, 50)}...`);

  try {
    // Fetch context on first message (or periodically)
    // This could be optimized to cache context
    const context = await optaClient.getContext();
    const contextString = optaClient.formatContextForLLM(context);

    // Add context to the LLM session if it's a new conversation
    // (In production, track this more intelligently)
    if (message.content.toLowerCase().includes('refresh') ||
        message.content.toLowerCase().includes('update context')) {
      await llmRouter.addContext(connection.data.id, contextString);
      connection.sendChatMessage('Context updated! I now have your latest schedule and tasks.');
      return;
    }

    // Process through LLM with streaming response
    await llmRouter.processMessage(connection, message);
  } catch (error) {
    console.error('[Main] Error handling message:', error);
    connection.sendError(
      'PROCESSING_ERROR',
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

// Create and start server
const server = new ClawdbotServer({
  config,
  onMessage: handleMessage,
});

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\n[Main] Received ${signal}, shutting down...`);
  server.stop();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start server
console.log('╔═══════════════════════════════════════════════╗');
console.log('║       🤖 Clawdbot Server Starting...          ║');
console.log('╠═══════════════════════════════════════════════╣');
console.log(`║  Port: ${config.wsPort.toString().padEnd(38)}║`);
console.log(`║  Model: ${config.geminiModel.padEnd(37)}║`);
console.log(`║  Heartbeat: ${(config.heartbeatIntervalMs / 1000 + 's').padEnd(33)}║`);
console.log('╚═══════════════════════════════════════════════╝');

server.start();
