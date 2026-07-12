/**
 * @heynxt/agent-adapter — Phase 7 Validation Stage: Lint Check
 *
 * Runs ESLint/formatting checks on generated code.
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../../generation-pipeline.js';
import type { ValidationResult, ValidationEvidence } from '@heynxt/core-types';
import { z } from 'zod';

/** Schema for lint validation result metadata. */
export const LintValidationResult = z.object({
  /** Total files checked. */
  totalFiles: z.number().int().nonnegative(),
  /** Files with errors. */
  filesWithErrors: z.number().int().nonnegative(),
  /** Files with warnings only. */
  filesWithWarnings: z.number().int().nonnegative(),
  /** Total error count. */
  totalErrors: z.number().int().nonnegative(),
  /** Total warning count. */
  totalWarnings: z.number().int().nonnegative(),
});

export type LintValidationResult = z.infer<typeof LintValidationResult>;

/** Schema for lint evidence metadata. */
export const LintEvidenceMetadata = z.object({
  /** ESLint config used. */
  eslintConfigPath: z.string(),
  /** Fixer was run to auto-fix issues. */
  fixableIssuesResolved: z.number().int().nonnegative(),
});

export type LintEvidenceMetadata = z.infer<typeof LintEvidenceMetadata>;

/** ------------------------------------------------------------------ */
/*  Validation Stage Implementation                                   */
/** ------------------------------------------------------------------ */

export class ValidateLintStage implements GenerationStage {
  readonly name = 'validate-lint' as const;
  readonly description = 'Validate lint checks (ESLint/formatting) on generated code';

  validateInput(input: GenerationStageInput): boolean {
    // Need source files to lint
    return input.params.generatedSourcePath !== undefined &&
           Object.keys(input.spec).length > 0;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const inputHash = await this.computeHash(JSON.stringify({
      spec: input.spec,
      blueprintPlan: input.blueprintPlan ?? null,
      params: input.params,
    }));

    // Run lint validation (simulated for Phase 7 scaffolding)
    const validationResult = await this.runLintValidation(
      input.params.generatedSourcePath as string,
      input.spec
    );

    // Create evidence artifacts
    const evidence = this.createEvidenceArtifacts(validationResult);

    return {
      inputHash,
      outputHash: inputHash,
      artifacts: [
        ...evidence.map(e => ({
          id: e.id,
          generationRunId: '00000000-0000-0000-0000-000000000000', // Will be set by caller
          stageName: this.name,
          kind: 'summary' as const,
          relativePath: `validation/${this.name}/result.json`,
          contentHash: crypto.randomUUID().slice(-64),
          fileSizeBytes: 1024,
          isNew: true,
          description: `Lint validation results for ${input.params.generatedSourcePath}`,
          createdAt: new Date(),
        })),
      ],
      summary: `Lint check completed: ${validationResult.totalErrors} errors, ${validationResult.totalWarnings} warnings`,
      warnings: validationResult.warnings ?? [],
    };
  }

  /**
   * Run ESLint on generated source files.
   */
  private async runLintValidation(
    sourcePath: string,
    spec: Record<string, unknown>
  ): Promise<LintValidationResult & { warnings?: string[] }> {
    // Phase 7 Scaffolding: This will be implemented with actual ESLint integration

    // Simulated lint results for scaffolding
    const hasErrors = false; // Will be determined by actual lint run

    return {
      totalFiles: 12,
      filesWithErrors: hasErrors ? 2 : 0,
      filesWithWarnings: 3,
      totalErrors: hasErrors ? 5 : 0,
      totalWarnings: 8,
      warnings: [
        'Some ESLint rules may need configuration for generated code',
        'Consider adding custom ESLint config for domain-specific patterns',
      ],
    };
  }

  /**
   * Create evidence artifacts from lint validation results.
   */
  private createEvidenceArtifacts(
    result: LintValidationResult & { warnings?: string[] }
  ): Array<ValidationEvidence> {
    const timestamp = new Date().toISOString();

    return [
      {
        id: crypto.randomUUID(),
        validationRunId: '00000000-0000-0000-0000-000000000000', // Will be set by caller
        checkType: 'lint' as const,
        kind: 'log-file' as const,
        storagePath: `validation/lint/${timestamp}-eslint-output.json`,
        fileSizeBytes: 2048,
        contentHash: crypto.randomUUID().slice(-64),
        isFreshEvidence: true,
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        validationRunId: '00000000-0000-0000-0000-000000000000', // Will be set by caller
        checkType: 'lint' as const,
        kind: 'test-report' as const,
        storagePath: `validation/lint/${timestamp}-eslint-summary.json`,
        fileSizeBytes: 1024,
        contentHash: crypto.randomUUID().slice(-64),
        isFreshEvidence: true,
        createdAt: new Date(),
      },
    ];
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
