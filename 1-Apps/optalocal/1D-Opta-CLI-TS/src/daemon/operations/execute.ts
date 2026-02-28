import { z } from 'zod';
import { EXIT, ExitError } from '../../core/errors.js';
import {
  OperationExecuteErrorResponseSchema,
  OperationExecuteRequestSchema,
  OperationExecuteResponseSchema,
  OperationListResponseSchema,
  type OperationExecuteErrorResponse,
  type OperationExecuteResponse,
  type OperationId,
  type OperationListResponse,
} from '../../protocol/v3/operations.js';
import { getRegisteredOperation, listRegisteredOperations } from './registry.js';

export interface ExecuteDaemonOperationInput {
  id: OperationId;
  input: unknown;
  confirmDangerous?: boolean;
}

export interface ExecuteDaemonOperationResult {
  statusCode: number;
  body:
    | OperationExecuteResponse
    | {
        error: string;
        details?: unknown;
      };
}

function executionErrorResponse(
  id: OperationId,
  safety: 'read' | 'write' | 'dangerous',
  code: string,
  message: string,
  details?: unknown
): OperationExecuteErrorResponse {
  return OperationExecuteErrorResponseSchema.parse({
    ok: false,
    id,
    safety,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  });
}

function mapOperationExecutionError(err: unknown): {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
} {
  if (err instanceof ExitError) {
    switch (err.exitCode) {
      case EXIT.MISUSE:
        return {
          statusCode: 400,
          code: 'misuse',
          message: 'Operation rejected invalid input.',
        };
      case EXIT.NOT_FOUND:
        return {
          statusCode: 404,
          code: 'not_found',
          message: 'Operation target not found.',
        };
      case EXIT.PERMISSION:
        return {
          statusCode: 403,
          code: 'permission_denied',
          message: 'Operation denied by permission policy.',
        };
      case EXIT.NO_CONNECTION:
        return {
          statusCode: 503,
          code: 'upstream_unavailable',
          message: 'Required service is unavailable.',
        };
      default:
        return {
          statusCode: 500,
          code: 'execution_failed',
          message: 'Operation failed.',
        };
    }
  }

  if (err instanceof z.ZodError) {
    return {
      statusCode: 400,
      code: 'validation_error',
      message: 'Operation validation failed.',
      details: err.issues,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    statusCode: 500,
    code: 'execution_failed',
    message: message || 'Operation failed.',
  };
}

export function listDaemonOperationsResponse(): OperationListResponse {
  return OperationListResponseSchema.parse({
    operations: listRegisteredOperations(),
  });
}

export async function executeDaemonOperation(
  input: ExecuteDaemonOperationInput
): Promise<ExecuteDaemonOperationResult> {
  const parsed = OperationExecuteRequestSchema.safeParse({
    id: input.id,
    input: input.input ?? {},
    confirmDangerous: input.confirmDangerous,
  });
  if (!parsed.success) {
    return {
      statusCode: 400,
      body: {
        error: 'Invalid request body',
        details: parsed.error.issues,
      },
    };
  }

  const operation = getRegisteredOperation(parsed.data.id);
  if (operation.safety === 'dangerous' && parsed.data.confirmDangerous !== true) {
    return {
      statusCode: 403,
      body: executionErrorResponse(
        parsed.data.id,
        operation.safety,
        'dangerous_confirmation_required',
        `Operation "${parsed.data.id}" requires confirmDangerous=true.`
      ),
    };
  }

  try {
    const result = await operation.execute(parsed.data.input as never);
    const response = OperationExecuteResponseSchema.parse({
      ok: true,
      id: parsed.data.id,
      safety: operation.safety,
      result,
    });
    return {
      statusCode: 200,
      body: response,
    };
  } catch (err) {
    const mapped = mapOperationExecutionError(err);
    return {
      statusCode: mapped.statusCode,
      body: executionErrorResponse(
        parsed.data.id,
        operation.safety,
        mapped.code,
        mapped.message,
        mapped.details
      ),
    };
  }
}

