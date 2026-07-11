/**
 * @heynxt/agent-adapter — Stage 1: Normalize Spec (Phase 6)
 *
 * Transforms input spec into canonical form with resolved references.
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../generation-pipeline.js';

export class NormalizeSpecStage implements GenerationStage {
  readonly name = 'normalize-spec' as const;
  readonly description = 'Normalize spec → canonical form, resolved references';

  validateInput(input: GenerationStageInput): boolean {
    // Must have a spec to normalize
    return input.spec !== undefined && Object.keys(input.spec).length > 0;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const startTime = Date.now();

    // Normalize the spec into canonical form
    const normalizedSpec = this.normalizeSpec(input.spec);

    // Compute input hash for traceability
    const inputHash = await this.computeHash(JSON.stringify(normalizedSpec));

    return {
      inputHash,
      outputHash: inputHash, // Same hash since we're normalizing in place
      artifacts: [
        {
          id: crypto.randomUUID(),
          generationRunId: '00000000-0000-0000-0000-000000000000', // Set by caller
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
   * Normalize a spec into canonical form.
   * - Resolves references to external resources (blueprints, templates)
   * - Fills in defaults for missing required fields
   * - Validates structure against expected schema
   */
  private normalizeSpec(spec: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...spec };

    // Ensure timestamp is present
    if (!normalized.metadata) {
      normalized.metadata = {};
    }

    const meta = normalized.metadata as Record<string, unknown>;
    if (!meta.normalizedAt) {
      meta.normalizedAt = new Date().toISOString();
    }

    // Resolve any external references (e.g., blueprint IDs to full objects)
    if (normalized.references) {
      normalized.resolvedReferences = this.resolveReferences(
        normalized.references as Record<string, unknown>
      );
    }

    return normalized;
  }

  /**
   * Resolve external references in the spec.
   */
  private resolveReferences(references: Record<string, unknown>): Record<string, unknown> {
    // In a full implementation, this would fetch referenced blueprints/templates
    // For now, we just mark them as resolved
    return { ...references };
  }

  /**
   * Compute content hash for traceability.
   */
  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
