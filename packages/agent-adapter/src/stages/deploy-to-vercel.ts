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

    // 1. Run production build in sandbox to catch errors before deploying
    this.emitter?.emit('deploy-to-vercel', 'running', 'Running production build (QA check)...');
    const { SandboxSession, collectProjectFiles } = await import('@heynxt/sandbox');
    const session = await SandboxSession.resume(sessionId);

    const buildResult = await session.runCommand('npm', ['run', 'build'], {
      cwd: '/workspace/app',
    });

    if (buildResult.exitCode !== 0) {
      // Attempt an auto-fix: feed build errors back to LLM and retry once
      this.emitter?.emit('deploy-to-vercel', 'warning', 'Build failed — attempting auto-fix...');
      const fixed = await this.attemptBuildFix(session, buildResult.stderr || buildResult.stdout);
      if (!fixed) {
        throw new Error(
          `Production build failed (QA gate):\n${(buildResult.stderr || buildResult.stdout).slice(0, 2000)}`,
        );
      }
      this.emitter?.emit('deploy-to-vercel', 'running', 'Auto-fix applied — continuing...');
    }

    // 2. Collect project files from the sandbox
    this.emitter?.emit('deploy-to-vercel', 'running', 'Collecting project files...');
    const projectFiles = await collectProjectFiles(session);

    // 3. Create (or get) the Vercel project
    this.emitter?.emit('deploy-to-vercel', 'running', 'Creating Vercel project...');
    const slug = toProjectSlug(appName);
    const project = await createOrGetVercelProject(slug);

    // 4. Set environment variables on the Vercel project
    await setVercelProjectEnvVars(project.id, {
      DATABASE_URL: databaseUrl ?? '',
      NEXTAUTH_SECRET: nextauthSecret ?? crypto.randomUUID(),
      NEXTAUTH_URL: `https://${project.name}.vercel.app`,
    });

    // 5. Upload files to Vercel
    this.emitter?.emit('deploy-to-vercel', 'running', `Uploading ${projectFiles.length} files to Vercel...`);
    const fileRefs = await uploadProjectFiles(projectFiles);

    // 6. Create the deployment
    this.emitter?.emit('deploy-to-vercel', 'running', `Creating Vercel deployment (${fileRefs.length} files)...`);
    const deployment = await createVercelDeployment(project.id, project.name, fileRefs);

    // 7. Poll until the deployment is live
    this.emitter?.emit('deploy-to-vercel', 'running', 'Waiting for Vercel build to complete...');
    let deployedUrl: string;
    try {
      deployedUrl = await pollDeployment(deployment.id);
    } catch (pollError) {
      // Don't delete sandbox on deploy failure — aids debugging
      throw pollError;
    }

    // 8. Delete the sandbox — no longer needed (deployment succeeded)
    await session.delete();

    // 9. Write to shared context for downstream consumers
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

  /**
   * Attempt to fix build errors by feeding them back to the LLM.
   * Reads the broken files, asks the LLM to fix them, writes them back,
   * and retries the build. Returns true if the retry succeeds.
   */
  private async attemptBuildFix(
    session: import('@heynxt/sandbox').SandboxSession,
    buildErrors: string,
  ): Promise<boolean> {
    try {
      const { callOpenRouter } = await import('../llm.js');

      // Extract file paths from build errors (Next.js format: ./app/path/file.tsx)
      const errorFiles = new Set<string>();
      const fileRegex = /\.\/([^\s:]+\.tsx?)/g;
      let match: RegExpExecArray | null;
      while ((match = fileRegex.exec(buildErrors)) !== null) {
        errorFiles.add(match[1]!);
      }

      if (errorFiles.size === 0) return false;

      // Read the broken files
      const fileContents: string[] = [];
      for (const filePath of errorFiles) {
        try {
          const content = await session.readFile(`/workspace/app/${filePath}`);
          fileContents.push(`// FILE: ${filePath}\n${content}`);
        } catch {
          // Skip unreadable files
        }
      }

      if (fileContents.length === 0) return false;

      // Ask LLM to fix
      const fixedCode = await callOpenRouter({
        model: 'anthropic/claude-sonnet-4',
        systemPrompt: [
          'You are a Next.js 15 build error fixer.',
          'Given files with build errors, output the FIXED versions.',
          'Fix ALL TypeScript and import errors. Keep the same functionality.',
          'EVERY file MUST start with: export const dynamic = "force-dynamic";',
          'Wrap all database queries in try/catch.',
          'Only import from: "next/server", "next/link", "next/navigation", "react", "@/lib/db", "@/lib/schema", "drizzle-orm".',
          'Separate each file with "// FILE: <path>" on its own line.',
          'Output ONLY TypeScript/TSX. No markdown fences, no explanations.',
        ].join('\n'),
        userPrompt: `Build errors:\n${buildErrors.slice(0, 3000)}\n\nFiles with errors:\n${fileContents.join('\n\n')}`,
      });

      // Parse and write fixed files
      const output = fixedCode.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '');
      const parts = output.split(/^\/\/\s*FILE:\s*/m);
      for (const part of parts) {
        if (!part.trim()) continue;
        const newlineIdx = part.indexOf('\n');
        if (newlineIdx === -1) continue;
        let path = part.slice(0, newlineIdx).trim();
        const content = part.slice(newlineIdx + 1).trim();
        if (path.startsWith('src/')) path = path.slice(4);
        path = path.replace(/\([^)]+\)\//g, '');
        if (path && content) {
          await session.writeFile(`/workspace/app/${path}`, content);
        }
      }

      // Retry build
      const retryResult = await session.runCommand('npm', ['run', 'build'], {
        cwd: '/workspace/app',
      });

      return retryResult.exitCode === 0;
    } catch {
      return false;
    }
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
