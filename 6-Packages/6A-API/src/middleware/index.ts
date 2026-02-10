/**
 * Middleware exports for @opta/api
 */

export {
  // Authentication
  authenticate,
  withAuth,
  authMiddleware,
  hasRole,
  hasScope,
  type AuthConfig,
  type AuthResult,
  type AuthenticatedUser,
  type AuthError,
  type AuthErrorCode,
  type AuthStrategy,
  type JWTConfig,
  type SessionConfig,
  type ApiKeyValidationResult,
  type SessionValidationResult,
} from './auth';
