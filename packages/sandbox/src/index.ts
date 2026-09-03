/**
 * @heynxt/sandbox
 *
 * Vercel Sandbox integration for the HeyNXT generation pipeline.
 *
 * Provides:
 *   SandboxSession  — thin wrapper over @vercel/sandbox
 *   writeNextJsScaffold — writes a base Next.js 15 project into the sandbox
 *   provisionDatabase — creates a Neon Postgres project via API
 */

export { SandboxSession } from './session.js';
export type { SandboxConfig, RunCommandResult } from './session.js';

export { writeNextJsScaffold } from './scaffold.js';

export { provisionDatabase } from './neon.js';
export type { NeonProvisionResult } from './neon.js';
