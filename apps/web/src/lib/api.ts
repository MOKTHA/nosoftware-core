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

export const internalError = (message: string, code = 'INTERNAL_ERROR') =>
  new NextApiError(message, 500, code);

/**
 * Convert a thrown error into a JSON response.
 *   - NextApiError  → status + body from the error
 *   - ZodError      → 400 with `fields` derived from `error.issues`
 *   - Otherwise     → 500 INTERNAL_ERROR
 */
export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
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
