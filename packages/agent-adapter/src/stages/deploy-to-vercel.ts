/**
 * @heynxt/agent-adapter — Stage 10: Deploy to Vercel (Phase 6)
 *
 * Collects the built source files from the sandbox, uploads them to
 * Vercel's file API, creates a deployment, and polls until it goes
 * live. Returns the live URL and deletes the sandbox.
 *
 * Context reads:  sessionId, databaseUrl, nextauthSecret
 * Context writes: deployedUrl
 */

import type {
  GenerationStage,
  GenerationStageInput,
  GenerationStageOutput,
} from '../generation-pipeline.js';
import type { PipelineContext } from '../pipeline-context.js';
import type { BuildEventEmitter } from '../sse.js';
import {
  createOrGetVercelProject,
  setVercelProjectEnvVars,
  uploadProjectFiles,
  createVercelDeployment,
  pollDeployment,
} from '../vercel-api.js';

/** Convert an app name to a URL-safe Vercel project slug (max 52 chars). */
function toProjectSlug(appName: string): string {
  return appName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52);
}

export class DeployToVercelStage implements GenerationStage {
  readonly name = 'deploy-to-vercel' as const;
  readonly description = 'Deploy to Vercel → collect files, upload, deploy, return live URL';

  constructor(
    private readonly ctx?: PipelineContext,
    private readonly emitter?: BuildEventEmitter,
  ) {}

  validateInput(input: GenerationStageInput): boolean {
    return input.spec !== undefined && Object.keys(input.spec).length > 0;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const inputHash = await this.computeHash(
      JSON.stringify({ spec: input.spec, params: input.params }),
    );

    // Stub mode: skip deployment when no sandbox session is available
    if (
      !this.ctx?.sessionId ||
      !process.env['VERCEL_TOKEN']
    ) {
      return {
        inputHash,
        outputHash: inputHash,
        artifacts: [{
          id: crypto.randomUUID(),
          generationRunId: '00000000-0000-0000-0000-000000000000',
          stageName: this.name,
          kind: 'summary' as const,
          relativePath: 'deployment/stub.md',
          contentHash: inputHash.slice(-64),
          fileSizeBytes: 256,
          isNew: true,
          description: 'Deploy-to-Vercel skipped (stub mode — no VERCEL_TOKEN or sandbox session)',
          createdAt: new Date(),
        }],
        summary: 'Deploy-to-Vercel skipped (stub mode)',
        warnings: ['No VERCEL_TOKEN or sandbox session — deployment skipped'],
      };
    }

    // Live mode: collect files, deploy, poll
    const { sessionId, databaseUrl, nextauthSecret } = this.ctx as {
      sessionId: string;
      databaseUrl: string;
      nextauthSecret: string;
    };

    const appName = (input.spec['appName'] as string) ?? 'heynxt-app';

    // 1. Collect project files from the sandbox
    this.emitter?.emit('deploy-to-vercel', 'running', 'Collecting project files...');
    const { SandboxSession, collectProjectFiles } = await import('@heynxt/sandbox');
    const session = await SandboxSession.resume(sessionId);
    const projectFiles = await collectProjectFiles(session);

    // 2. Create (or get) the Vercel project
    this.emitter?.emit('deploy-to-vercel', 'running', 'Creating Vercel project...');
    const slug = toProjectSlug(appName);
    const project = await createOrGetVercelProject(slug);

    // 3. Set environment variables on the Vercel project
    await setVercelProjectEnvVars(project.id, {
      DATABASE_URL: databaseUrl ?? '',
      NEXTAUTH_SECRET: nextauthSecret ?? crypto.randomUUID(),
      NEXTAUTH_URL: `https://${project.name}.vercel.app`,
    });

    // 4. Upload files to Vercel
    this.emitter?.emit('deploy-to-vercel', 'running', `Uploading ${projectFiles.length} files to Vercel...`);
    const fileRefs = await uploadProjectFiles(projectFiles);

    // 5. Create the deployment
    this.emitter?.emit('deploy-to-vercel', 'running', `Creating Vercel deployment (${fileRefs.length} files)...`);
    const deployment = await createVercelDeployment(project.id, project.name, fileRefs);

    // 6. Poll until the deployment is live
    this.emitter?.emit('deploy-to-vercel', 'running', 'Waiting for Vercel build to complete...');
    let deployedUrl: string;
    try {
      deployedUrl = await pollDeployment(deployment.id);
    } catch (pollError) {
      // Don't delete sandbox on deploy failure — aids debugging
      throw pollError;
    }

    // 7. Delete the sandbox — no longer needed (deployment succeeded)
    await session.delete();

    // 8. Write to shared context for downstream consumers
    if (this.ctx) {
      this.ctx.deployedUrl = deployedUrl;
    }

    return {
      inputHash,
      outputHash: await this.computeHash(deployedUrl),
      artifacts: [{
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'deployment-config' as const,
        relativePath: 'deployment/vercel-deployment.json',
        contentHash: (await this.computeHash(deployedUrl)).slice(-64),
        fileSizeBytes: Buffer.byteLength(deployedUrl),
        isNew: true,
        description: `Deployed to ${deployedUrl}`,
        createdAt: new Date(),
      }],
      summary: deployedUrl,
      warnings: [],
    };
  }

  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
