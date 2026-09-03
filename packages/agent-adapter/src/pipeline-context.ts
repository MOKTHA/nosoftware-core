/**
 * @heynxt/agent-adapter — Pipeline Context
 *
 * Mutable shared state threaded through pipeline stages via
 * constructor injection. Stages read and write keys as they
 * execute so that downstream stages can access upstream outputs
 * (e.g. the sandbox sessionId created by the first stage).
 *
 * The context is intentionally untyped (`Record<string, unknown>`)
 * because different pipeline configurations populate different keys.
 * Each stage documents which keys it reads and writes.
 */

export interface PipelineContext {
  /** Sandbox session identifier (set by normalize-spec stage). */
  sessionId?: string;
  /** Neon database connection URI (set by normalize-spec stage). */
  databaseUrl?: string;
  /** Neon project ID (set by normalize-spec stage). */
  databaseId?: string;
  /** Whether the schema has been generated and migrated. */
  schemaGenerated?: boolean;
  /** Whether backend API routes have been generated. */
  apiRoutesGenerated?: boolean;
  /** Whether frontend pages have been generated. */
  frontendGenerated?: boolean;
  /** Whether the production build passed. */
  buildVerified?: boolean;
  /** Arbitrary extra state. */
  [key: string]: unknown;
}

/**
 * Create an empty pipeline context.
 */
export function createPipelineContext(): PipelineContext {
  return {};
}
