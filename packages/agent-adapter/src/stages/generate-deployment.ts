/**
 * @heynxt/agent-adapter — Stage 9: Generate Deployment / Verify Build (Phase 5)
 *
 * Stub mode: generates deployment artifact metadata (Dockerfile, env, etc.).
 *
 * Live mode (sandbox available): runs `npm run build` inside the sandbox
 * and stops the sandbox session on completion.
 *
 * Context reads:  sessionId
 * Context writes: buildVerified
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../generation-pipeline.js';
import type { PipelineContext } from '../pipeline-context.js';

export class GenerateDeploymentStage implements GenerationStage {
  readonly name = 'generate-deployment' as const;
  readonly description = 'Generate deployment metadata → Dockerfile, env config, health checks';

  constructor(private readonly ctx?: PipelineContext) {}

  validateInput(input: GenerationStageInput): boolean {
    return input.spec !== undefined && Object.keys(input.spec).length > 0;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const inputHash = await this.computeHash(
      JSON.stringify({
        spec: input.spec,
        blueprintPlan: input.blueprintPlan ?? null,
        params: input.params,
      }),
    );

    const warnings: string[] = [];

    // Live mode: run production build in sandbox, then stop
    if (
      this.ctx?.sessionId &&
      process.env['NEON_API_KEY']
    ) {
      const buildResult = await this.verifyBuildInSandbox();
      if (!buildResult.success) {
        warnings.push(`Build verification failed: ${buildResult.error}`);
      }
    }

    const artifacts = this.generateDeploymentArtifacts(
      input.spec,
      input.blueprintPlan ?? null,
      input.params,
    );

    return {
      inputHash,
      outputHash: inputHash,
      artifacts,
      summary: `Generated ${artifacts.length} deployment configuration files`,
      warnings,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Live mode: build verification + cleanup                          */
  /* ------------------------------------------------------------------ */

  private async verifyBuildInSandbox(): Promise<{ success: boolean; error?: string }> {
    const { SandboxSession } = await import('@heynxt/sandbox');

    const session = await SandboxSession.resume(this.ctx!.sessionId!);

    // Detect project root: find the package.json that has "next" as a dep
    const findResult = await session.runCommand(
      'find',
      ['/workspace/app', '-maxdepth', '3', '-name', 'package.json', '-not', '-path', '*/node_modules/*'],
      {},
    );
    const pkgPaths = findResult.stdout.trim().split('\n').filter(Boolean).sort((a, b) => a.length - b.length);
    let projectRoot = '/workspace/app';
    for (const pkgPath of pkgPaths) {
      try {
        const content = await session.readFile(pkgPath);
        const pkg = JSON.parse(content) as Record<string, unknown>;
        const deps = {
          ...(pkg['dependencies'] as Record<string, string> ?? {}),
          ...(pkg['devDependencies'] as Record<string, string> ?? {}),
        };
        if ('next' in deps) {
          projectRoot = pkgPath.replace(/\/package\.json$/, '');
          break;
        }
      } catch {
        // skip
      }
    }

    const result = await session.runCommand('npm', ['run', 'build'], {
      cwd: projectRoot,
    });

    if (result.exitCode !== 0) {
      return {
        success: false,
        error: result.stderr || result.stdout.slice(-500) || `Build exited with code ${result.exitCode}`,
      };
    }

    if (this.ctx) {
      this.ctx.buildVerified = true;
    }

    // Sandbox is NOT stopped here — the deploy-to-vercel stage needs it
    // to collect project files. It will be deleted after deployment.
    return { success: true };
  }

  /* ------------------------------------------------------------------ */
  /*  Stub artifact generation (always runs)                            */
  /* ------------------------------------------------------------------ */

  private generateDeploymentArtifacts(
    spec: Record<string, unknown>,
    blueprintPlan: Record<string, unknown> | null,
    params: Record<string, unknown>,
  ): Array<import('@heynxt/core-types').GenerationArtifact> {
    const artifacts: Array<import('@heynxt/core-types').GenerationArtifact> = [];

    const dockerConfig = this.generateDockerFile(spec);
    artifacts.push({
      id: crypto.randomUUID(),
      generationRunId: '00000000-0000-0000-0000-000000000000',
      stageName: this.name,
      kind: 'config-file' as const,
      relativePath: dockerConfig.path,
      contentHash: crypto.randomUUID().slice(-64),
      fileSizeBytes: 1024,
      isNew: true,
      description: dockerConfig.description,
      createdAt: new Date(),
    });

    const envConfigs = this.generateEnvConfig(spec);
    for (const config of envConfigs) {
      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'config-file' as const,
        relativePath: config.path,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 512,
        isNew: true,
        description: config.description,
        createdAt: new Date(),
      });
    }

    const healthConfig = this.generateHealthCheck();
    artifacts.push({
      id: crypto.randomUUID(),
      generationRunId: '00000000-0000-0000-0000-000000000000',
      stageName: this.name,
      kind: 'config-file' as const,
      relativePath: healthConfig.path,
      contentHash: crypto.randomUUID().slice(-64),
      fileSizeBytes: 256,
      isNew: true,
      description: healthConfig.description,
      createdAt: new Date(),
    });

    const composeConfig = this.generateDockerCompose(spec);
    artifacts.push({
      id: crypto.randomUUID(),
      generationRunId: '00000000-0000-0000-0000-000000000000',
      stageName: this.name,
      kind: 'config-file' as const,
      relativePath: composeConfig.path,
      contentHash: crypto.randomUUID().slice(-64),
      fileSizeBytes: 1536,
      isNew: true,
      description: composeConfig.description,
      createdAt: new Date(),
    });

    const deploymentManifest = this.generateDeploymentManifest(spec);
    artifacts.push({
      id: crypto.randomUUID(),
      generationRunId: '00000000-0000-0000-0000-000000000000',
      stageName: this.name,
      kind: 'deployment-config' as const,
      relativePath: deploymentManifest.path,
      contentHash: crypto.randomUUID().slice(-64),
      fileSizeBytes: 1024,
      isNew: true,
      description: deploymentManifest.description,
      createdAt: new Date(),
    });

    return artifacts;
  }

  private generateDockerFile(spec: Record<string, unknown>): { path: string; description: string } {
    const domain = this.detectDomain(spec);
    const isProduction = (spec.productionMode as boolean) ?? false;
    return {
      path: isProduction ? 'Dockerfile.prod' : 'Dockerfile',
      description: `Multi-stage Docker build for ${domain} application`,
    };
  }

  private generateEnvConfig(spec: Record<string, unknown>): Array<{ path: string; description: string }> {
    const domain = this.detectDomain(spec);
    return [
      { path: '.env.example', description: `Example environment variables for ${domain} app` },
      { path: '.env.local', description: 'Local development environment configuration' },
      { path: 'config/database.json', description: 'Database connection configuration' },
    ];
  }

  private generateHealthCheck(): { path: string; description: string } {
    return { path: 'healthcheck.sh', description: 'Container health check script' };
  }

  private generateDockerCompose(spec: Record<string, unknown>): { path: string; description: string } {
    const domain = this.detectDomain(spec);
    return { path: 'docker-compose.dev.yml', description: `Development environment with ${domain} app and database` };
  }

  private generateDeploymentManifest(spec: Record<string, unknown>): { path: string; description: string } {
    const domain = this.detectDomain(spec);
    const targetPlatform = (spec.deploymentTarget as string) ?? 'vercel';
    return {
      path: `deployment/${targetPlatform}-manifest.json`,
      description: `${this.capitalize(targetPlatform)} deployment configuration for ${domain}`,
    };
  }

  private detectDomain(spec: Record<string, unknown>): string {
    const keywords = Object.values(spec).join(' ').toLowerCase();
    if (keywords.includes('pcb') || keywords.includes('electronics')) return 'pcb';
    if (keywords.includes('extrusion') || keywords.includes('aluminum')) return 'extrusion';
    if (keywords.includes('quality') || keywords.includes('inspection')) return 'quality';
    return 'extrusion';
  }

  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
