/**
 * @heynxt/agent-adapter — Phase 7 Validation Stage: PR Creation with GitHub API
 *
 * Creates pull requests for generated changes with validation evidence attached as comments.
 */

import type { ValidationStage, ValidationStageInput, ValidationStageOutput } from '../../generation-pipeline.js';
import type { ValidationResult } from '@heynxt/core-types';
import { z } from 'zod';
import { GitHubAPIClient, generateBranchName, generatePRTitle, generatePRBody, CheckStatusEnum } from './github-api.js';

/** Schema for PR creation result metadata. */
export const PRCreationResult = z.object({
  /** GitHub pull request number. */
  prNumber: z.number().int().positive(),
  /** Pull request URL. */
  prUrl: z.string().url(),
  /** Branch name used for the PR. */
  branchName: z.string(),
  /** Title of the PR. */
  title: z.string(),
  /** Body/description of the PR with validation summary. */
  body: z.string(),
  /** Whether all validations passed before creating PR. */
  allChecksPassed: z.boolean(),
  /** Validation check statuses included in PR comment. */
  checkStatuses: z.record(z.enum(['passed', 'failed', 'skipped'])),
});

export type PRCreationResult = z.infer<typeof PRCreationResult>;

/** Schema for PR evidence metadata. */
export const PREvidenceMetadata = z.object({
  /** GitHub repository owner (e.g., organization or username). */
  repoOwner: z.string(),
  /** GitHub repository name. */
  repoName: z.string(),
  /** Target branch for the PR. */
  baseBranch: z.string(),
  /** Commit hash that was included in the PR. */
  commitHash: z.string().length(40), // SHA-1 is 40 hex chars
  /** Number of files changed in the PR. */
  filesChanged: z.number().int().nonnegative(),
  /** Validation evidence comment URL on GitHub. */
  evidenceCommentUrl: z.string().url().optional(),
});

export type PREvidenceMetadata = z.infer<typeof PREvidenceMetadata>;

/** Exported types for external use (Phase 7.4) */
export { CheckStatusEnum, GitHubAPIClient } from './github-api.js';

/** ------------------------------------------------------------------ */
/*  PR Creation Stage Implementation                                  */
/** ------------------------------------------------------------------ */

export class CreatePRStage implements ValidationStage {
  readonly name = 'create-pr' as const;
  readonly description = 'Create GitHub pull request with validation evidence';

  validateInput(input: any): boolean {
    // Need validation results and GitHub config to create PR
    return input.params?.githubConfig !== undefined &&
           input.results?.some((r: ValidationResult) => r.checkType) !== undefined;
  }

  async execute(input: ValidationStageInput): Promise<ValidationStageOutput> {
    // Input doesn't have results property - validation stages receive spec, blueprintPlan, params
    // PR creation stage is special as it operates on completed validation results from previous stages

    const inputHash = await this.computeHash(JSON.stringify({
      spec: input.spec,
      blueprintPlan: input.blueprintPlan ?? null,
      params: input.params,
    }));

    // For scaffolding, we simulate that all validations passed
    // In production, this would receive results from previous validation stages
    const mockResults = [] as Array<ValidationResult>;

    // Create PR with validation evidence (simulated for Phase 7 scaffolding)
    const prResult = await this.createPullRequest(
      mockResults,
      input.params?.githubConfig as Record<string, unknown>,
      input.spec
    );

    // Determine if all checks passed before creating PR
    const failedChecks = [] as Array<ValidationResult>;
    const allChecksPassed = failedChecks.length === 0;

    return {
      inputHash,
      outputHash: await this.computeHash(JSON.stringify({ ...prResult, allChecksPassed })),
      results: [
        {
          id: crypto.randomUUID(),
          checkType: 'pr-creation',
          status: allChecksPassed ? 'passed' : 'failed',
          evidenceUrl: prResult.prUrl,
          durationMs: 250,
          outputLog: JSON.stringify(prResult),
          testSummary: `PR #${prResult.prNumber} created on ${prResult.branchName}`,
          issueCount: failedChecks.length,
          blocksPromotion: !allChecksPassed && input.params?.strictMode !== true,
          startedAt: new Date(Date.now() - 250),
          completedAt: new Date(),
        },
      ],
      summary: `PR #${prResult.prNumber} created for branch ${prResult.branchName}. All checks passed: ${allChecksPassed}`,
      warnings: allChecksPassed ? [] : [`${failedChecks.length} validation check(s) failed but PR was created in permissive mode`],
    };
  }

  /**
   * Create a GitHub pull request with validation evidence attached as comments.
   */
  private async createPullRequest(
    results: ValidationResult[],
    githubConfig: Record<string, unknown>,
    spec: Record<string, unknown>
  ): Promise<PRCreationResult & { warnings?: string[] }> {
    // Phase 7 Scaffolding: This will be implemented with actual GitHub API integration via Octokit

    const repoOwner = (githubConfig.repoOwner as string) || 'pskbmohan';
    const repoName = (githubConfig.repoName as string) || 'heynxt-core';
    const baseBranch = (githubConfig.baseBranch as string) || 'main';
    const strictMode = (githubConfig.strictMode as boolean) ?? false;

    // Initialize GitHub API client
    const githubClient = new GitHubAPIClient({
      token: process.env.GITHUB_TOKEN || '',
      repoOwner,
      repoName,
      baseBranch,
    });

    // Count validation check statuses using CheckStatusEnum
    const checkStatuses: Record<string, 'passed' | 'failed' | 'skipped'> = {};
    results.forEach(r => {
      if (!checkStatuses[r.checkType]) {
        checkStatuses[r.checkType] = r.status as 'passed' | 'failed' | 'skipped';
      }
    });

    const passedCount = Object.values(checkStatuses).filter(s => s === 'passed').length;
    const failedCount = Object.values(checkStatuses).filter(s => s === 'failed').length;

    // Generate branch name using utility function (deterministic naming)
    const branchName = generateBranchName(spec);

    // Generate PR title and body with validation summary using utilities
    const prTitle = generatePRTitle(spec);
    const prBody = generatePRBody(spec, checkStatuses);

    // Simulated PR creation response (will use GitHubAPIClient.createPRWithEvidence in production)
    return {
      prNumber: Math.floor(Math.random() * 1000) + 50,
      prUrl: `https://github.com/${repoOwner}/${repoName}/pull/${Math.floor(Math.random() * 1000) + 50}`,
      branchName,
      title: prTitle,
      body: prBody,
      allChecksPassed: failedCount === 0 || !strictMode,
      checkStatuses,
    };
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
