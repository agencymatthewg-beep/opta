/**
 * Authentication Middleware for Opta API Routes
 *
 * Provides flexible authentication middleware that can be configured per-route.
 * Supports multiple authentication strategies:
 * - API Key authentication
 * - JWT Bearer token authentication
 * - Session-based authentication (via cookies)
 *
 * @module @opta/api/middleware/auth
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import * as jose from 'jose';

// =============================================================================
// Types
// =============================================================================

export type AuthStrategy = 'api-key' | 'jwt' | 'session' | 'none';

export interface AuthConfig {
  /** Authentication strategy to use */
  strategy: AuthStrategy;

  /** Whether authentication is required (false = optional auth) */
  required?: boolean;

  /** Allowed roles (if using role-based access) */
  allowedRoles?: string[];

  /** Custom API key validator */
  validateApiKey?: (key: string) => Promise<ApiKeyValidationResult>;

  /** JWT configuration */
  jwt?: JWTConfig;

  /** Session configuration */
  session?: SessionConfig;

  /** Custom error handler */
  onError?: (error: AuthError) => NextResponse;

  /** Skip authentication for certain requests */
  skip?: (req: NextRequest) => boolean;
}

export interface JWTConfig {
  /** JWT secret or public key for verification */
  secret?: string;

  /** JWKS URL for key rotation support */
  jwksUrl?: string;

  /** Expected issuer */
  issuer?: string;

  /** Expected audience */
  audience?: string;

  /** Custom claims validation */
  validateClaims?: (claims: jose.JWTPayload) => Promise<boolean>;
}

export interface SessionConfig {
  /** Cookie name for session ID */
  cookieName?: string;

  /** Custom session validator */
  validateSession?: (sessionId: string) => Promise<SessionValidationResult>;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  userId?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface SessionValidationResult {
  valid: boolean;
  userId?: string;
  roles?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthenticatedUser {
  id: string;
  roles?: string[];
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthResult {
  authenticated: boolean;
  user?: AuthenticatedUser;
  strategy?: AuthStrategy;
  error?: AuthError;
}

export type AuthErrorCode =
  | 'MISSING_CREDENTIALS'
  | 'INVALID_CREDENTIALS'
  | 'EXPIRED_TOKEN'
  | 'INVALID_TOKEN'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'INVALID_API_KEY'
  | 'SESSION_EXPIRED'
  | 'CONFIGURATION_ERROR';

export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Partial<AuthConfig> = {
  strategy: 'none',
  required: true,
  jwt: {
    cookieName: 'session',
  },
  session: {
    cookieName: 'opta_session',
  },
};

// =============================================================================
// Authentication Functions
// =============================================================================

/**
 * Extract API key from request
 */
function extractApiKey(req: NextRequest): string | null {
  // Check Authorization header (Bearer or ApiKey scheme)
  const auth = req.headers.get('authorization');
  if (auth) {
    if (auth.toLowerCase().startsWith('apikey ')) {
      return auth.slice(7);
    }
    if (auth.toLowerCase().startsWith('bearer ')) {
      // Some services use Bearer for API keys
      const token = auth.slice(7);
      // If it doesn't look like a JWT, treat as API key
      if (!token.includes('.')) {
        return token;
      }
    }
  }

  // Check X-API-Key header
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    return apiKey;
  }

  // Check query parameter (not recommended for production)
  const url = new URL(req.url);
  return url.searchParams.get('api_key');
}

/**
 * Extract JWT from request
 */
function extractJWT(req: NextRequest): string | null {
  // Check Authorization header
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) {
    const token = auth.slice(7);
    // Verify it looks like a JWT (has two dots)
    if (token.split('.').length === 3) {
      return token;
    }
  }

  return null;
}

/**
 * Extract session ID from cookies
 */
function extractSessionId(req: NextRequest, cookieName: string): string | null {
  return req.cookies.get(cookieName)?.value || null;
}

/**
 * Validate API key authentication
 */
async function validateApiKeyAuth(
  req: NextRequest,
  config: AuthConfig
): Promise<AuthResult> {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return {
      authenticated: false,
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'API key is required',
      },
    };
  }

  // Use custom validator or default
  if (config.validateApiKey) {
    const result = await config.validateApiKey(apiKey);

    if (!result.valid) {
      return {
        authenticated: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key',
        },
      };
    }

    return {
      authenticated: true,
      strategy: 'api-key',
      user: {
        id: result.userId || 'api-key-user',
        scopes: result.scopes,
        metadata: result.metadata,
      },
    };
  }

  // Default: check against environment variable
  const validKey = process.env.OPTA_API_KEY;
  if (!validKey) {
    console.warn('[Auth] No API key configured (OPTA_API_KEY)');
    return {
      authenticated: false,
      error: {
        code: 'CONFIGURATION_ERROR',
        message: 'API key authentication not configured',
      },
    };
  }

  if (apiKey !== validKey) {
    return {
      authenticated: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key',
      },
    };
  }

  return {
    authenticated: true,
    strategy: 'api-key',
    user: {
      id: 'api-key-user',
    },
  };
}

/**
 * Validate JWT authentication
 */
async function validateJWTAuth(
  req: NextRequest,
  config: AuthConfig
): Promise<AuthResult> {
  const token = extractJWT(req);

  if (!token) {
    return {
      authenticated: false,
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Authorization token is required',
      },
    };
  }

  const jwtConfig = config.jwt || {};

  try {
    let payload: jose.JWTPayload;

    if (jwtConfig.jwksUrl) {
      // Use JWKS for key rotation support
      const JWKS = jose.createRemoteJWKSet(new URL(jwtConfig.jwksUrl));
      const { payload: p } = await jose.jwtVerify(token, JWKS, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
      payload = p;
    } else if (jwtConfig.secret) {
      // Use symmetric secret
      const secret = new TextEncoder().encode(jwtConfig.secret);
      const { payload: p } = await jose.jwtVerify(token, secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
      });
      payload = p;
    } else {
      // Try environment variable
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return {
          authenticated: false,
          error: {
            code: 'CONFIGURATION_ERROR',
            message: 'JWT authentication not configured',
          },
        };
      }
      const secretKey = new TextEncoder().encode(secret);
      const { payload: p } = await jose.jwtVerify(token, secretKey);
      payload = p;
    }

    // Custom claims validation
    if (jwtConfig.validateClaims) {
      const valid = await jwtConfig.validateClaims(payload);
      if (!valid) {
        return {
          authenticated: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token claims validation failed',
          },
        };
      }
    }

    return {
      authenticated: true,
      strategy: 'jwt',
      user: {
        id: (payload.sub as string) || 'jwt-user',
        roles: payload.roles as string[] | undefined,
        scopes: payload.scope ? (payload.scope as string).split(' ') : undefined,
        metadata: { claims: payload },
      },
    };
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      return {
        authenticated: false,
        error: {
          code: 'EXPIRED_TOKEN',
          message: 'Token has expired',
        },
      };
    }

    return {
      authenticated: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token',
        details: { error: String(error) },
      },
    };
  }
}

/**
 * Validate session authentication
 */
async function validateSessionAuth(
  req: NextRequest,
  config: AuthConfig
): Promise<AuthResult> {
  const sessionConfig = config.session || {};
  const cookieName = sessionConfig.cookieName || 'opta_session';
  const sessionId = extractSessionId(req, cookieName);

  if (!sessionId) {
    return {
      authenticated: false,
      error: {
        code: 'MISSING_CREDENTIALS',
        message: 'Session cookie is required',
      },
    };
  }

  if (sessionConfig.validateSession) {
    const result = await sessionConfig.validateSession(sessionId);

    if (!result.valid) {
      return {
        authenticated: false,
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session is invalid or expired',
        },
      };
    }

    return {
      authenticated: true,
      strategy: 'session',
      user: {
        id: result.userId || 'session-user',
        roles: result.roles,
        metadata: result.metadata,
      },
    };
  }

  // Without a custom validator, we can't validate sessions
  return {
    authenticated: false,
    error: {
      code: 'CONFIGURATION_ERROR',
      message: 'Session validation not configured',
    },
  };
}

// =============================================================================
// Main Authentication Function
// =============================================================================

/**
 * Authenticate a request based on the provided configuration
 */
export async function authenticate(
  req: NextRequest,
  config: AuthConfig
): Promise<AuthResult> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Check if we should skip authentication
  if (mergedConfig.skip?.(req)) {
    return { authenticated: true };
  }

  // No authentication required
  if (mergedConfig.strategy === 'none') {
    return { authenticated: true };
  }

  let result: AuthResult;

  switch (mergedConfig.strategy) {
    case 'api-key':
      result = await validateApiKeyAuth(req, mergedConfig);
      break;
    case 'jwt':
      result = await validateJWTAuth(req, mergedConfig);
      break;
    case 'session':
      result = await validateSessionAuth(req, mergedConfig);
      break;
    default:
      result = {
        authenticated: false,
        error: {
          code: 'CONFIGURATION_ERROR',
          message: `Unknown auth strategy: ${mergedConfig.strategy}`,
        },
      };
  }

  // Check role-based access
  if (result.authenticated && mergedConfig.allowedRoles?.length) {
    const userRoles = result.user?.roles || [];
    const hasAllowedRole = mergedConfig.allowedRoles.some((role) =>
      userRoles.includes(role)
    );

    if (!hasAllowedRole) {
      return {
        authenticated: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions',
        },
      };
    }
  }

  return result;
}

// =============================================================================
// Middleware Wrapper
// =============================================================================

/**
 * Default error response generator
 */
function defaultErrorResponse(error: AuthError): NextResponse {
  const statusCode = {
    MISSING_CREDENTIALS: 401,
    INVALID_CREDENTIALS: 401,
    EXPIRED_TOKEN: 401,
    INVALID_TOKEN: 401,
    INVALID_API_KEY: 401,
    SESSION_EXPIRED: 401,
    INSUFFICIENT_PERMISSIONS: 403,
    CONFIGURATION_ERROR: 500,
  }[error.code] || 401;

  return NextResponse.json(
    {
      error: error.code,
      message: error.message,
    },
    {
      status: statusCode,
      headers: {
        'WWW-Authenticate': 'Bearer',
      },
    }
  );
}

/**
 * Creates an authenticated API handler
 *
 * @example
 * ```ts
 * import { withAuth } from '@opta/api/middleware/auth';
 *
 * export const GET = withAuth(
 *   async (req, user) => {
 *     // user is available here
 *     return NextResponse.json({ userId: user?.id });
 *   },
 *   { strategy: 'jwt', required: true }
 * );
 * ```
 */
export function withAuth(
  handler: (req: NextRequest, user?: AuthenticatedUser) => Promise<NextResponse>,
  config: AuthConfig
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    const result = await authenticate(req, config);

    if (!result.authenticated && config.required !== false) {
      const errorHandler = config.onError || defaultErrorResponse;
      return errorHandler(result.error!);
    }

    return handler(req, result.user);
  };
}

// =============================================================================
// Pre-configured Auth Middleware
// =============================================================================

/**
 * Pre-configured authentication middleware for common use cases
 */
export const authMiddleware = {
  /** Require valid API key */
  apiKey: (options?: Partial<AuthConfig>) =>
    withAuth.bind(null, { strategy: 'api-key' as const, ...options }),

  /** Require valid JWT */
  jwt: (options?: Partial<AuthConfig>) =>
    withAuth.bind(null, { strategy: 'jwt' as const, ...options }),

  /** Require valid session */
  session: (options?: Partial<AuthConfig>) =>
    withAuth.bind(null, { strategy: 'session' as const, ...options }),

  /** No authentication required (explicit opt-out) */
  public: () => withAuth.bind(null, { strategy: 'none' as const }),
};

/**
 * Utility to check if user has required role
 */
export function hasRole(user: AuthenticatedUser | undefined, role: string): boolean {
  return user?.roles?.includes(role) || false;
}

/**
 * Utility to check if user has required scope
 */
export function hasScope(user: AuthenticatedUser | undefined, scope: string): boolean {
  return user?.scopes?.includes(scope) || false;
}
