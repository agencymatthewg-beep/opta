/**
 * @fileoverview Feedback Routes
 * @description API endpoints for user feedback on recommendations
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

/** Maximum length for feedback text */
const MAX_FEEDBACK_TEXT_LENGTH = 500;

export const feedbackRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

/** Feedback submission request schema */
const feedbackSchema = z.object({
  /** ID of the scan being rated */
  scanId: z.string().min(1),
  /** Whether user followed the recommendation */
  acceptedRecommendation: z.boolean(),
  /** What the user actually chose (if different from recommendation) */
  actualChoice: z.string().optional(),
  /** Optional text feedback from user */
  feedbackText: z.string().max(MAX_FEEDBACK_TEXT_LENGTH).optional(),
});

/** Type for validated feedback request */
type FeedbackRequest = z.infer<typeof feedbackSchema>;

// ============================================
// Route Handlers
// ============================================

/**
 * POST /v1/feedback
 * Submit feedback on a recommendation
 */
feedbackRouter.post('/', zValidator('json', feedbackSchema), async (c: Context) => {
  const body = c.req.valid('json') as FeedbackRequest;

  // Log feedback for debugging (TODO: store in database for ML training)
  console.log('Feedback received:', {
    scanId: body.scanId,
    accepted: body.acceptedRecommendation,
    actualChoice: body.actualChoice ?? 'not specified',
  });

  // TODO: Store feedback in database for learning
  // TODO: Update user preference model based on feedback
  // TODO: Track acceptance rate metrics

  return c.json({
    success: true,
    message: 'Thanks for your feedback! This helps Opta learn.',
  });
});
