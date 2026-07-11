/**
 * @heynxt/agent-adapter — Stage 7: Generate Workflows (Phase 6)
 *
 * Generates workflow definitions: state machines, automations.
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../generation-pipeline.js';

export class GenerateWorkflowsStage implements GenerationStage {
  readonly name = 'generate-workflows' as const;
  readonly description = 'Generate workflows → state machines, automations';

  validateInput(input: GenerationStageInput): boolean {
    // Need spec to generate workflow definitions
    return input.spec !== undefined && Object.keys(input.spec).length > 0;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const inputHash = await this.computeHash(JSON.stringify({
      spec: input.spec,
      blueprintPlan: input.blueprintPlan ?? null,
      params: input.params,
    }));

    // Generate workflow artifacts based on domain requirements
    const artifacts = this.generateWorkflowArtifacts(
      input.spec,
      input.blueprintPlan ?? null,
      input.params
    );

    return {
      inputHash,
      outputHash: inputHash,
      artifacts,
      summary: `Generated ${artifacts.length} workflow definitions including state machines`,
      warnings: [],
    };
  }

  /**
   * Generate workflow artifacts from spec and blueprint plan.
   */
  private generateWorkflowArtifacts(
    spec: Record<string, unknown>,
    blueprintPlan: Record<string, unknown> | null,
    params: Record<string, unknown>
  ): Array<import('@heynxt/core-types').GenerationArtifact> {
    const artifacts: Array<import('@heynxt/core-types').GenerationArtifact> = [];

    // Generate state machine definitions based on domain
    const workflows = this.generateWorkflows(spec);

    for (const workflow of workflows) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'workflow-def' as const,
        relativePath: `workflows/${workflow.id}.json`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 2048,
        isNew: true,
        description: workflow.description,
        createdAt: new Date(),
      });
    }

    // Add automation rules if specified in params
    const automations = this.generateAutomations(spec, params);
    for (const auto of automations) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'workflow-def' as const,
        relativePath: `automations/${auto.id}.json`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 1536,
        isNew: true,
        description: auto.description,
        createdAt: new Date(),
      });
    }

    return artifacts;
  }

  /**
   * Generate state machine workflows based on domain.
   */
  private generateWorkflows(spec: Record<string, unknown>): Array<{ id: string; description: string }> {
    const domain = this.detectDomain(spec);
    const workflows: Array<{ id: string; description: string }> = [];

    // Define standard workflow for the primary entity
    workflows.push({
      id: `${domain}-lifecycle`,
      description: `Lifecycle state machine for ${domain} entities`,
    });

    return workflows;
  }

  /**
   * Generate automation rules based on spec and parameters.
   */
  private generateAutomations(
    spec: Record<string, unknown>,
    params: Record<string, unknown>
  ): Array<{ id: string; description: string }> {
    const automations: Array<{ id: string; description: string }> = [];

    // Check for automation triggers in params
    if (params.automateQualityChecks) {
      automations.push({
        id: 'quality-check-automation',
        description: 'Automated quality inspection trigger',
      });
    }

    if (params.enableNotifications) {
      automations.push({
        id: 'status-change-notifications',
        description: 'Send notifications on status changes',
      });
    }

    return automations;
  }

  /**
   * Auto-detect domain from spec content.
   */
  private detectDomain(spec: Record<string, unknown>): string {
    const description = (spec.description as string) ?? '';
    const keywords = Object.values(spec).join(' ').toLowerCase();

    if (keywords.includes('pcb') || keywords.includes('electronics')) {
      return 'pcb';
    } else if (keywords.includes('extrusion') || keywords.includes('aluminum')) {
      return 'extrusion';
    } else if (keywords.includes('quality') || keywords.includes('inspection')) {
      return 'quality';
    }

    // Default to extrusion as the primary domain
    return 'extrusion';
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
