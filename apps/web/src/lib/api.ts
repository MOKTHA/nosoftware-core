/**
 * Shared API helpers — standardised response shapes and error handling.
 *
 * All API routes under `apps/web/src/app/api/` import from here rather than
 * constructing responses manually. The helpers encode the project's REST
 * conventions:
 *   - JSON bodies only
 *   - Consistent error shape `{ error, code, fields? }`
 *   - `NextApiError` base class so routes can `throw new NextApiError(...)`
 *     and let `wrapHandler()` convert it to a typed response.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { NotAuthenticatedError } from './session';

/**
 * Canonical error response body. Matches the shape used across all API routes.
 */
export interface ApiErrorBody {
  error: string;
  code: string;
  fields?: Record<string, string[]>;
}

/**
 * Base class for API errors. Thrown inside `wrapHandler`; converted to a
 * JSON response with the appropriate HTTP status.
 */
export class NextApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'NextApiError';
  }
}

export const badRequest = (
  message: string,
  code = 'BAD_REQUEST',
  fields?: Record<string, string[]>,
) => new NextApiError(message, 400, code, fields);

export const notFound = (message: string, code = 'NOT_FOUND') =>
  new NextApiError(message, 404, code);

/**
 * Build a ForbiddenError for permission-denied cases. Separate from
 * NextApiError so the 403 path goes through the dedicated ForbiddenError
 * branch in errorResponse() — cleaner than a 403 NextApiError because
 * the code is always 'FORBIDDEN' and no extra fields are needed.
 */
export const forbidden = (message = 'Insufficient permissions') =>
  new ForbiddenError(message);

export const internalError = (message: string, code = 'INTERNAL_ERROR') =>
  new NextApiError(message, 500, code);

/**
 * Raised when the authenticated user lacks the required permission for
 * the requested operation. Mapped to 403 FORBIDDEN by errorResponse().
 *
 * Distinct from NotAuthenticatedError (401) — the user is logged in,
 * but their role assignments don't include the required permission for
 * this workspace. See apps/web/src/lib/rbac.ts for the enforcement
 * layer that raises this.
 */
export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Convert a thrown error into a JSON response.
 *   - NotAuthenticatedError → 401 UNAUTHENTICATED
 *   - ForbiddenError        → 403 FORBIDDEN
 *   - NextApiError          → status + body from the error
 *   - ZodError              → 400 with `fields` derived from `error.issues`
 *   - Otherwise             → 500 INTERNAL_ERROR
 */
export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof NotAuthenticatedError) {
    return NextResponse.json<ApiErrorBody>(
      { error: err.message, code: 'UNAUTHENTICATED' },
      { status: 401 },
    );
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json<ApiErrorBody>(
      { error: err.message, code: 'FORBIDDEN' },
      { status: 403 },
    );
  }
  if (err instanceof NextApiError) {
    return NextResponse.json<ApiErrorBody>(
      { error: err.message, code: err.code, ...(err.fields ? { fields: err.fields } : {}) },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_root';
      (fields[key] ??= []).push(issue.message);
    }
    return NextResponse.json<ApiErrorBody>(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', fields },
      { status: 400 },
    );
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  return NextResponse.json<ApiErrorBody>(
    { error: message, code: 'INTERNAL_ERROR' },
    { status: 500 },
  );
}

/**
 * Wrapper that:
 *   - Reads the JSON body from a request (or `null` when missing/empty).
 *   - Catches any thrown error and converts it via `errorResponse`.
 *
 * Routes call `withJson(getHandler, postHandler)` to opt in.
 */
export async function parseJsonBody(req: NextRequest): Promise<unknown> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw badRequest('Content-Type must be application/json', 'INVALID_CONTENT_TYPE');
  }
  try {
    return await req.json();
  } catch {
    throw badRequest('Request body is not valid JSON', 'INVALID_JSON');
  }
}
