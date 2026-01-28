/**
 * @fileoverview User Routes
 * @description API endpoints for user preferences and account management
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { DEFAULT_PRIORITIES } from '@opta/shared';

/** Default profile ID when no auth is implemented */
const DEFAULT_PROFILE_ID = 'default';

/** Default profile name */
const DEFAULT_PROFILE_NAME = 'Default';

/** Default subscription tier for unauthenticated users */
const DEFAULT_TIER = 'free';

/** Default pagination limit */
const DEFAULT_PAGINATION_LIMIT = 20;

/** Default pagination offset */
const DEFAULT_PAGINATION_OFFSET = 0;

/** Free tier save limit per month */
const FREE_TIER_SAVE_LIMIT = 10;

export const userRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

/** Constraints schema for user preferences */
const constraintsSchema = z.object({
  maxPrice: z.number().optional(),
  maxCalories: z.number().optional(),
  dietary: z.array(z.string()).optional(),
}).optional();

/** Update priorities request schema */
const updatePrioritiesSchema = z.object({
  priorities: z.record(z.number().min(0).max(1)),
  constraints: constraintsSchema,
});

// ============================================
// Route Handlers
// ============================================

/**
 * GET /v1/user/priorities
 * Get user's saved priority profile
 */
userRouter.get('/priorities', async (c: Context) => {
  // TODO: Get from database based on authenticated user
  // TODO: Support multiple named profiles per user

  return c.json({
    success: true,
    data: {
      id: DEFAULT_PROFILE_ID,
      name: DEFAULT_PROFILE_NAME,
      priorities: DEFAULT_PRIORITIES,
      constraints: {},
      isDefault: true,
    },
  });
});

/**
 * PUT /v1/user/priorities
 * Update user's priority profile
 */
userRouter.put('/priorities', zValidator('json', updatePrioritiesSchema), async (c: Context) => {
  const body = c.req.valid('json');

  // TODO: Validate user is authenticated
  // TODO: Save priorities to database
  // TODO: Support creating/updating multiple profiles

  return c.json({
    success: true,
    data: {
      id: DEFAULT_PROFILE_ID,
      name: DEFAULT_PROFILE_NAME,
      priorities: body.priorities,
      constraints: body.constraints ?? {},
      isDefault: true,
    },
  });
});

/**
 * GET /v1/user/limits
 * Get user's current usage and limits
 */
userRouter.get('/limits', async (c: Context) => {
  // TODO: Get actual usage from database based on authenticated user
  // TODO: Calculate remaining quota based on subscription tier

  return c.json({
    success: true,
    data: {
      tier: DEFAULT_TIER,
      scansThisMonth: 0,
      savesThisMonth: 0,
      limits: {
        scansPerMonth: Infinity,
        savesPerMonth: FREE_TIER_SAVE_LIMIT,
      },
    },
  });
});

/**
 * GET /v1/user/history
 * Get user's scan history with pagination
 */
userRouter.get('/history', async (c: Context) => {
  const limitParam = c.req.query('limit');
  const offsetParam = c.req.query('offset');

  const limit = parseInt(limitParam ?? String(DEFAULT_PAGINATION_LIMIT), 10);
  const offset = parseInt(offsetParam ?? String(DEFAULT_PAGINATION_OFFSET), 10);

  // TODO: Get from database based on authenticated user
  // TODO: Support filtering by date range, content type

  return c.json({
    success: true,
    data: {
      scans: [],
      total: 0,
      limit,
      offset,
    },
  });
});
