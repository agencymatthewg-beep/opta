/**
 * @fileoverview Scan Routes
 * @description API endpoints for image and text-based scanning
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { visionService } from '../services/vision.js';
import { optimizerService } from '../services/optimizer.js';
import { generateId } from '@opta/shared';
import type { ScanResponse, PriorityWeights } from '@opta/shared';

/** Minimum base64 image length to be considered valid */
const MIN_IMAGE_LENGTH = 100;

/** Minimum query length for text scans */
const MIN_QUERY_LENGTH = 5;

/** Maximum query length for text scans */
const MAX_QUERY_LENGTH = 1000;

/** HTTP status codes */
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
} as const;

/** ID prefix for scan records */
const SCAN_ID_PREFIX = 'scan';

export const scanRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

/** Shared constraints schema for dietary/price/calorie limits */
const constraintsSchema = z.object({
  maxPrice: z.number().optional(),
  maxCalories: z.number().optional(),
  dietary: z.array(z.string()).optional(),
}).optional();

/** Shared priorities schema (0-1 range) */
const prioritiesSchema = z.record(z.number().min(0).max(1)).optional();

/** Image scan request schema */
const scanRequestSchema = z.object({
  image: z.string().min(MIN_IMAGE_LENGTH),
  priorities: prioritiesSchema,
  constraints: constraintsSchema,
  context: z.string().optional(),
});

/** Text scan request schema */
const textScanSchema = z.object({
  query: z.string().min(MIN_QUERY_LENGTH).max(MAX_QUERY_LENGTH),
  priorities: prioritiesSchema,
  constraints: constraintsSchema,
});

/** Re-optimize request schema */
const reoptimizeSchema = z.object({
  scanId: z.string(),
  priorities: z.record(z.number().min(0).max(1)),
  constraints: constraintsSchema,
});

// ============================================
// Route Handlers
// ============================================

/**
 * POST /v1/scan
 * Main scan endpoint - accepts image, returns optimization
 */
scanRouter.post('/', zValidator('json', scanRequestSchema), async (c: Context) => {
  const startTime = Date.now();
  const body = c.req.valid('json');

  try {
    // Step 1: Extract options from image using Vision AI
    const extraction = await visionService.extractFromImage(body.image, body.context);

    // Validate extraction returned options
    if (extraction.options.length === 0) {
      return c.json({
        success: false,
        error: {
          code: 'NO_OPTIONS_FOUND',
          message: "I couldn't find distinct options in this image. Try scanning something with clear choices.",
        },
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Step 2: Score and rank options based on user priorities
    const priorities = body.priorities as PriorityWeights | undefined;
    const recommendation = optimizerService.optimize(
      extraction.options,
      priorities,
      body.constraints
    );

    // Step 3: Build and return response
    const processingTimeMs = Date.now() - startTime;
    const response: ScanResponse = {
      success: true,
      scanId: generateId(SCAN_ID_PREFIX),
      contentType: extraction.contentType,
      recommendation,
      allOptions: recommendation.alternatives,
      confidence: extraction.confidence,
      processingTimeMs,
    };

    return c.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Scan error:', errorMessage);

    return c.json({
      success: false,
      error: {
        code: 'EXTRACTION_FAILED',
        message: 'Failed to analyze the image. Please try again.',
      },
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * POST /v1/scan/text
 * Text-only scan - natural language query
 */
scanRouter.post('/text', zValidator('json', textScanSchema), async (c: Context) => {
  const startTime = Date.now();
  const body = c.req.valid('json');

  try {
    // Extract options from text query using LLM
    const extraction = await visionService.extractFromText(body.query);

    // Validate extraction returned options
    if (extraction.options.length === 0) {
      return c.json({
        success: false,
        error: {
          code: 'NO_OPTIONS_FOUND',
          message: "I couldn't identify distinct options from your query. Try being more specific about the choices you're comparing.",
        },
      }, HTTP_STATUS.BAD_REQUEST);
    }

    // Score and rank options
    const priorities = body.priorities as PriorityWeights | undefined;
    const recommendation = optimizerService.optimize(
      extraction.options,
      priorities,
      body.constraints
    );

    // Build and return response
    const processingTimeMs = Date.now() - startTime;
    const response: ScanResponse = {
      success: true,
      scanId: generateId(SCAN_ID_PREFIX),
      contentType: extraction.contentType,
      recommendation,
      allOptions: recommendation.alternatives,
      confidence: extraction.confidence,
      processingTimeMs,
    };

    return c.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Text scan error:', errorMessage);

    return c.json({
      success: false,
      error: {
        code: 'EXTRACTION_FAILED',
        message: 'Failed to process your query. Please try again.',
      },
    }, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * POST /v1/scan/reoptimize
 * Re-score existing extraction with new priorities
 */
scanRouter.post('/reoptimize', zValidator('json', reoptimizeSchema), async (c: Context) => {
  // Validate request body (unused until persistence is implemented)
  const _body = c.req.valid('json');

  // TODO: Retrieve stored extraction from database by scanId
  // TODO: Call optimizerService.reoptimize with stored options and new priorities

  return c.json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Reoptimize requires saved scan data. Coming soon.',
    },
  }, HTTP_STATUS.NOT_IMPLEMENTED);
});
