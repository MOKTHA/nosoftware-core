/**
 * @heynxt/agent-adapter — GitHub API Integration (Phase 7.4)
 *
 * Provides GitHub API client for creating pull requests and attaching validation evidence as comments.
 */

import { Octokit } from '@octokit/rest';
import type { Endpoints } from '@octokit/types';
import { z } from 'zod';

// Type aliases for GitHub API response data types
type PullCreateResponse = Endpoints['POST /repos/{owner}/{repo}/pulls']['response']['data'];
type IssueCommentCreateResponse = Endpoints['POST /repos/{owner}/{repo}/issues/{issue_number}/comments']['response']['data'];
type CompareCommitsWithBaseheadResponse = Endpoints['GET /repos/{owner}/{repo}/compare/{basehead}']['response']['data'];

/** Configuration for GitHub API access. */
export const GitHubConfig = z.object({
  /** Personal Access Token or OAuth token with repo scope. */
  token: z.string().min(1),
  /** Repository owner (organization or username). */
  repoOwner: z.string(),
  /** Repository name. */
  repoName: z.string(),
  /** Default base branch for PRs. */
  baseBranch: z.string(),
});

export type GitHubConfig = z.infer<typeof GitHubConfig>;

/** Validation check status enum for PR comments. */
export const CheckStatusEnum = z.enum(['passed', 'failed', 'skipped']);
export type CheckStatus = z.infer<typeof CheckStatusEnum>;

/** Schema for validation summary to attach in PR comment. */
export const ValidationSummaryComment = z.object({
  /** Unique run identifier. */
  runId: z.string().uuid(),
  /** Timestamp of the validation run. */
  timestamp: z.string().datetime(),
  /** Overall pass/fail status. */
  overallStatus: z.enum(['passed', 'failed']),
  /** Individual check results. */
  checks: z.array(
    z.object({
      checkType: z.string(),
      status: CheckStatusEnum,
      summary: z.string().optional(),
      issueCount: z.number().int().nonnegative().optional(),
    })
  ),
  /** Whether PR can be merged (all checks passed). */
  canMerge: z.boolean(),
});

export type ValidationSummaryComment = z.infer<typeof ValidationSummaryComment>;

/** GitHub API client for creating PRs and attaching evidence. */
export class GitHubAPIClient {
  private readonly octokit: Octokit;
  private readonly repoOwner: string;
  private readonly repoName: string;
  private readonly baseBranch: string;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.repoOwner = config.repoOwner;
    this.repoName = config.repoName;
    this.baseBranch = config.baseBranch;
  }

  /**
   * Create a pull request with validation evidence attached as a comment.
   */
  async createPRWithEvidence(params: {
    branchName: string;
    title: string;
    body: string;
    validationResults: ValidationSummaryComment['checks'];
  }): Promise<{ prNumber: number; prUrl: string; commentId?: number }> {
    try {
      // Create PR via GitHub API
      const response = await this.octokit.rest.pulls.create({
        owner: this.repoOwner,
        repo: this.repoName,
        title: params.title,
        body: params.body,
        head: params.branchName,
        base: this.baseBranch,
        draft: false,
      });

      const prNumber = response.data.number;
      const prUrl = response.data.html_url;

      console.log(`[GitHubAPI] Created PR #${prNumber} from ${params.branchName} to ${this.baseBranch}`);

      // Attach validation evidence as comment
      let commentId: number | undefined = undefined;
      if (params.validationResults.length > 0) {
        const commentResponse = await this.attachEvidenceComment({
          prNumber,
          runId: crypto.randomUUID(),
          timestamp: new Date(),
          overallStatus: params.validationResults.every(c => c.status === 'passed') ? 'passed' : 'failed',
          checks: params.validationResults,
        });
        commentId = commentResponse;
      }

      return { prNumber, prUrl, commentId };
    } catch (error) {
      console.error('[GitHubAPI] Failed to create PR:', error);
      throw new Error(`Failed to create pull request: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Attach validation results as a GitHub PR comment.
   */
  async attachEvidenceComment(params: {
    prNumber: number;
    runId: string;
    timestamp: Date;
    overallStatus: 'passed' | 'failed';
    checks: Array<{
      checkType: string;
      status: CheckStatus;
      summary?: string;
      issueCount?: number;
    }>;
  }): Promise<number> {
    const commentBody = this.formatEvidenceComment(params);

    try {
      const response = await this.octokit.rest.issues.createComment({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: params.prNumber,
        body: commentBody,
      });

      console.log(`[GitHubAPI] Attached evidence comment to PR #${params.prNumber}`);
      return (response.data as IssueCommentCreateResponse).id;
    } catch (error) {
      console.error('[GitHubAPI] Failed to attach comment:', error);
      throw new Error(`Failed to attach validation comment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Format validation results as a GitHub-flavored markdown comment.
   */
  private formatEvidenceComment(params: {
    runId: string;
    timestamp: Date;
    overallStatus: 'passed' | 'failed';
    checks: Array<{ checkType: string; status: CheckStatus; summary?: string }>;
  }): string {
    const statusIcon = params.overallStatus === 'passed' ? '✅' : '❌';

    const checkRows = params.checks.map(check => {
      const icon = check.status === 'passed' ? '✅' : check.status === 'failed' ? '❌' : '⚪';
      return `| ${icon} \`${check.checkType}\` | ${check.status.toUpperCase()} | ${check.summary || ''} |`;
    }).join('\n');

    return `## Validation Evidence for Run **${params.runId}**

Status: **${statusIcon} ${params.overallStatus === 'passed' ? 'All Checks Passed' : 'Some Checks Failed'}**
Timestamp: \`${new Date(params.timestamp).toISOString()}\`

| Check | Status | Summary |
|-------|--------|---------|
${checkRows}

---
*Generated by HeyNXT Core v0.7.4 - [View Full Report](/validation-runs/${params.runId})*`;
  }

  /**
   * Get validation status for a PR (used in review workflows).
   */
  async getPRValidationStatus(params: { prNumber: number }): Promise<{
    canMerge: boolean;
    requiredChecks: Array<{ checkType: string; status: CheckStatus }>;
    completedAt?: Date;
  }> {
    try {
      // Query GitHub PR for combined status of all checks
      const response = await this.octokit.rest.pulls.get({
        owner: this.repoOwner,
        repo: this.repoName,
        pull_number: params.prNumber,
      });

      const merged = response.data.merged;
      const mergeable = response.data.mergeable !== null && response.data.mergeable !== undefined;

      return {
        canMerge: merged || (mergeable === true),
        requiredChecks: [], // Would be populated from GitHub check runs API
        completedAt: response.data.merged_at ? new Date(response.data.merged_at) : undefined,
      };
    } catch (error) {
      console.error('[GitHubAPI] Failed to get PR validation status:', error);
      return { canMerge: false, requiredChecks: [] };
    }
  }

  /**
   * Verify branch exists and is up-to-date with base branch.
   */
  async verifyBranch(params: { branchName: string }): Promise<{ exists: boolean; ahead?: number; behind?: number }> {
    try {
      const response = await this.octokit.rest.repos.compareCommitsWithBasehead({
        owner: this.repoOwner,
        repo: this.repoName,
        basehead: `${this.baseBranch}...${params.branchName}`,
      });

      return {
        exists: true,
        ahead: (response.data as any).ahead_count,
        behind: (response.data as any).behind_count,
      };
    } catch (error) {
      // Branch doesn't exist or error accessing it
      return { exists: false };
    }
  }
}

/**
 * Create a deterministic branch name based on task spec.
 */
export function generateBranchName(spec: Record<string, unknown>): string {
  const taskId = (spec.taskId as string) || crypto.randomUUID().slice(0, 8);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  return `gen/${taskId}/${timestamp}`;
}

/**
 * Generate a PR title from spec and validation results.
 */
export function generatePRTitle(spec: Record<string, unknown>): string {
  const specTitle = (spec.title as string) || 'Generated Application';
  return `[Auto-Generated] ${specTitle} - Validation Run`;
}

/**
 * Generate a PR body with validation summary.
 */
export function generatePRBody(
  spec: Record<string, unknown>,
  checkStatuses: Record<string, CheckStatus>
): string {
  const passedCount = Object.values(checkStatuses).filter(s => s === 'passed').length;
  const failedCount = Object.values(checkStatuses).filter(s => s === 'failed').length;

  const specTitle = (spec.title as string) || 'Generated Application';

  const checkSummaryLines = Object.entries(checkStatuses).map(
    ([checkType, status]) => {
      const icon = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⚪';
      return `- **${icon} ${checkType.toUpperCase()}**: ${status === 'passed' ? 'Passed' : status === 'failed' ? 'Failed' : 'Skipped'}`;
    }
  );

  return `## Generated Application: \`${specTitle}\`

This pull request was automatically generated by HeyNXT Core based on the following specification.

### Validation Results
${checkSummaryLines.join('\n')}

### Summary
- **Total Checks**: ${Object.keys(checkStatuses).length}
- **Passed**: ${passedCount}
- **Failed**: ${failedCount}

### Next Steps
1. Review the generated changes in this PR
2. Verify validation results (see comments below)
3. Approve to merge or request changes with feedback

---
*Generated by HeyNXT Core v0.7.4 - [View Validation Dashboard](/validation-runs)*`;
}
