/**
 * @fileoverview Opta API Server Entry Point
 * @description Hono-based API server with routing and middleware
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { scanRouter } from './routes/scan.js';
import { userRouter } from './routes/user.js';
import { feedbackRouter } from './routes/feedback.js';

/** API version string */
const API_VERSION = '0.1.0';

/** Service name for identification */
const SERVICE_NAME = 'opta-api';

/** Default port if not specified in environment */
const DEFAULT_PORT = 3001;

/** HTTP status codes */
const HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

/** Error codes for API responses */
const ERROR_CODES = {
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const;

// Initialize Hono app
const app = new Hono();

// ============================================
// Middleware Configuration
// ============================================

// Request logging
app.use('*', logger());

// CORS configuration
app.use('*', cors({
  origin: '*', // TODO: Configure for production with specific origins
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================
// Health Check Endpoints
// ============================================

/** Root endpoint - basic API info */
app.get('/', (c: Context) => c.json({
  status: 'ok',
  service: SERVICE_NAME,
  version: API_VERSION,
}));

/** Health check endpoint for monitoring */
app.get('/health', (c: Context) => c.json({ status: 'healthy' }));

// ============================================
// API Routes
// ============================================

// Mount routers on both /api and /v1 prefixes for compatibility
const routePrefixes = ['/api', '/v1'] as const;

for (const prefix of routePrefixes) {
  app.route(`${prefix}/scan`, scanRouter);
  app.route(`${prefix}/user`, userRouter);
  app.route(`${prefix}/feedback`, feedbackRouter);
}

// ============================================
// Error Handling
// ============================================

/** Global error handler */
app.onError((err: Error, c: Context) => {
  console.error('Unhandled error:', err.message);
  return c.json({
    success: false,
    error: {
      code: ERROR_CODES.SERVER_ERROR,
      message: 'An unexpected error occurred',
    },
  }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
});

/** 404 Not Found handler */
app.notFound((c: Context) => {
  return c.json({
    success: false,
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: 'Endpoint not found',
    },
  }, HTTP_STATUS.NOT_FOUND);
});

// ============================================
// Server Configuration
// ============================================

/** Parse port from environment or use default */
const port = parseInt(process.env.API_PORT ?? process.env.PORT ?? String(DEFAULT_PORT), 10);

console.log(`Opta API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
