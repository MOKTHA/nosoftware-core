/**
 * @heynxt/agent-adapter — Stage 1: Normalize Spec / Setup Sandbox (Phase 6)
 *
 * In stub mode (no sandbox dependency): normalizes the input spec into
 * canonical form with resolved references — the original Phase 6 behaviour.
 *
 * In live mode (sandbox + Neon available): provisions a Neon database,
 * creates a Vercel Sandbox, and writes the Next.js scaffold into it.
 *
 * Context keys written: sessionId, databaseUrl, databaseId
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../generation-pipeline.js';
import type { PipelineContext } from '../pipeline-context.js';

export class NormalizeSpecStage implements GenerationStage {
  readonly name = 'normalize-spec' as const;
  readonly description = 'Normalize spec → canonical form, resolved references';

  constructor(private readonly ctx?: PipelineContext) {}

  validateInput(input: GenerationStageInput): boolean {
    return input.spec !== undefined && Object.keys(input.spec).length > 0;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const normalizedSpec = this.normalizeSpec(input.spec);
    const inputHash = await this.computeHash(JSON.stringify(normalizedSpec));

    // If sandbox dependencies are available and context is provided,
    // provision infrastructure. Otherwise fall back to stub behaviour.
    if (this.ctx && process.env['NEON_API_KEY'] && process.env['OPENROUTER_API_KEY']) {
      await this.provisionSandbox(input);
    }

    return {
      inputHash,
      outputHash: inputHash,
      artifacts: [
        {
          id: crypto.randomUUID(),
          generationRunId: '00000000-0000-0000-0000-000000000000',
          stageName: this.name,
          kind: 'summary' as const,
          relativePath: 'canonical/spec.json',
          contentHash: inputHash.slice(-64),
          fileSizeBytes: Buffer.byteLength(JSON.stringify(normalizedSpec)),
          isNew: true,
          description: 'Normalized spec in canonical form',
          createdAt: new Date(),
        },
      ],
      summary: `Normalized ${Object.keys(input.spec).length} fields into canonical form`,
      warnings: [],
    };
  }

  /**
   * Provision a Neon database and Vercel Sandbox, then write the scaffold.
   * Writes sessionId, databaseUrl, databaseId to the shared pipeline context.
   */
  private async provisionSandbox(input: GenerationStageInput): Promise<void> {
    // Dynamic imports to avoid hard dependency on @heynxt/sandbox
    const { provisionDatabase, SandboxSession, writeNextJsScaffold } =
      await import('@heynxt/sandbox');

    const appId = (input.spec['appId'] as string) ?? crypto.randomUUID();
    const appName = (input.spec['appName'] as string) ?? 'heynxt-app';
    const sessionId = `build-${appId}`;

    const { databaseUrl, databaseId } = await provisionDatabase(appId);

    const session = await SandboxSession.create({
      sessionId,
      env: {
        DATABASE_URL: databaseUrl,
        NEXTAUTH_SECRET: crypto.randomUUID(),
        OPENROUTER_API_KEY: process.env['OPENROUTER_API_KEY'] ?? '',
        NODE_ENV: 'production',
      },
    });

    await writeNextJsScaffold(session, appName);

    // Write to shared context for downstream stages
    if (this.ctx) {
      this.ctx.sessionId = sessionId;
      this.ctx.databaseUrl = databaseUrl;
      this.ctx.databaseId = databaseId;
    }
  }

  private normalizeSpec(spec: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...spec };
    if (!normalized['metadata']) {
      normalized['metadata'] = {};
    }
    const meta = normalized['metadata'] as Record<string, unknown>;
    if (!meta['normalizedAt']) {
      meta['normalizedAt'] = new Date().toISOString();
    }
    if (normalized['references']) {
      normalized['resolvedReferences'] = { ...(normalized['references'] as Record<string, unknown>) };
    }
    return normalized;
  }

  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
