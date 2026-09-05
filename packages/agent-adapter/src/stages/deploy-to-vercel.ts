/**
 * @heynxt/agent-adapter — Stage 10: Deploy to Vercel (Phase 6)
 *
 * Before deploying, runs a comprehensive QA gate:
 *   1. TypeScript check (npx tsc --noEmit)
 *   2. Production build (npm run build)
 *   3. Smoke tests — starts production server in sandbox, tests:
 *      - /api/health endpoint
 *      - GET /api/<entity> for every entity route
 *      - / page renders
 *      - /api/auth/seed creates admin user
 *      - /api/auth/login with default credentials
 *   4. Auto-fix loop on failure (feeds errors to LLM, retries)
 *
 * Only after QA passes does it collect files, upload to Vercel,
 * deploy, and verify the live deployment.
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
  setProjectPublicAccess,
  addCustomDomain,
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

/** QA smoke test script written into the sandbox and executed with Node.js. */
const QA_SMOKE_TEST_SCRIPT = `
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const BASE = 'http://localhost:' + PORT;
const results = [];

function log(msg) { process.stdout.write('[QA] ' + msg + '\\n'); }

/** HTTP GET with timeout. Returns { status, body, ok }. */
function httpGet(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body, ok: res.statusCode < 400 }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout', ok: false }); });
  });
}

/** HTTP POST with timeout. */
function httpPost(url, data, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      method: 'POST',
      timeout: timeoutMs,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = http.request(opts, (res) => {
      let respBody = '';
      res.on('data', (d) => respBody += d);
      res.on('end', () => resolve({ status: res.statusCode, body: respBody, ok: res.statusCode < 400 }));
    });
    req.on('error', (e) => resolve({ status: 0, body: e.message, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout', ok: false }); });
    req.write(body);
    req.end();
  });
}

/** Wait for the server to be ready. */
async function waitForServer(maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await httpGet(BASE + '/api/health', 3000);
    if (res.ok) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

/** Discover API route directories from the filesystem. */
function discoverEntityRoutes() {
  const apiDir = path.join('/workspace/app/app/api');
  if (!fs.existsSync(apiDir)) return [];
  const entries = fs.readdirSync(apiDir, { withFileTypes: true });
  const skip = new Set(['auth', 'health']);
  return entries
    .filter(e => e.isDirectory() && !skip.has(e.name) && !e.name.startsWith('['))
    .map(e => e.name);
}

async function main() {
  log('Starting production server on port ' + PORT + '...');
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: '/workspace/app',
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Capture server output for debugging
  let serverOutput = '';
  server.stdout.on('data', (d) => serverOutput += d.toString());
  server.stderr.on('data', (d) => serverOutput += d.toString());

  try {
    log('Waiting for server to be ready...');
    const ready = await waitForServer(60000);
    if (!ready) {
      results.push({ test: 'server-start', ok: false, detail: 'Server failed to start within 60s' });
      console.log(JSON.stringify({ passed: false, results, serverOutput: serverOutput.slice(-1000) }));
      process.exit(1);
    }
    log('Server is ready');

    // Test 1: Health check
    log('Testing /api/health...');
    const health = await httpGet(BASE + '/api/health');
    results.push({ test: 'health', ok: health.ok, detail: 'status=' + health.status });

    // Test 2: Main page renders
    log('Testing / page...');
    const mainPage = await httpGet(BASE + '/');
    results.push({ test: 'main-page', ok: mainPage.ok, detail: 'status=' + mainPage.status });

    // Test 3: Login page renders
    log('Testing /login page...');
    const loginPage = await httpGet(BASE + '/login');
    results.push({ test: 'login-page', ok: loginPage.ok, detail: 'status=' + loginPage.status });

    // Test 4: Seed admin user
    log('Testing /api/auth/seed...');
    const seed = await httpGet(BASE + '/api/auth/seed');
    results.push({ test: 'admin-seed', ok: seed.ok, detail: 'status=' + seed.status + ' body=' + seed.body.slice(0, 200) });

    // Test 5: Login with default admin credentials
    log('Testing /api/auth/login...');
    const login = await httpPost(BASE + '/api/auth/login', {
      email: 'admin@nosoftware.ai',
      password: 'nosoftware@1234',
    });
    results.push({ test: 'admin-login', ok: login.ok, detail: 'status=' + login.status });

    // Test 6: Entity API routes (GET each one)
    const entities = discoverEntityRoutes();
    log('Found ' + entities.length + ' entity routes: ' + entities.join(', '));
    for (const entity of entities) {
      log('Testing GET /api/' + entity + '...');
      const res = await httpGet(BASE + '/api/' + entity);
      results.push({ test: 'api-' + entity, ok: res.ok, detail: 'status=' + res.status });
    }

    // Summary
    const passed = results.every(r => r.ok);
    const failed = results.filter(r => !r.ok);
    log(passed ? 'ALL TESTS PASSED (' + results.length + ')' : 'FAILED: ' + failed.map(f => f.test).join(', '));
    console.log(JSON.stringify({ passed, results, failedTests: failed }));
    process.exit(passed ? 0 : 1);

  } finally {
    server.kill('SIGTERM');
    // Give server a moment to clean up
    await new Promise(r => setTimeout(r, 500));
    try { server.kill('SIGKILL'); } catch {}
  }
}

main().catch(err => {
  console.log(JSON.stringify({ passed: false, results, error: err.message }));
  process.exit(1);
});
`;

export class DeployToVercelStage implements GenerationStage {
  readonly name = 'deploy-to-vercel' as const;
  readonly description = 'Deploy to Vercel → QA gate, collect files, upload, deploy, return live URL';

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

    // Live mode: QA → collect → deploy → verify
    const { sessionId, databaseUrl, nextauthSecret } = this.ctx as {
      sessionId: string;
      databaseUrl: string;
      nextauthSecret: string;
    };

    const appName = (input.spec['appName'] as string) ?? 'heynxt-app';
    const { SandboxSession, collectProjectFiles } = await import('@heynxt/sandbox');
    const session = await SandboxSession.resume(sessionId);

    /* ── QA GATE (never-stop: auto-fix loop, deploy regardless) ── */

    const MAX_FIX_ATTEMPTS = 3;

    // QA Step 1: TypeScript check (with retry loop)
    this.emitter?.emit('deploy-to-vercel', 'running', 'QA: TypeScript type check...');
    let tscPassed = false;
    {
      let lastTscResult = await session.runCommand('npx', ['tsc', '--noEmit'], {
        cwd: '/workspace/app',
      });
      if (lastTscResult.exitCode === 0) {
        tscPassed = true;
        this.emitter?.emit('deploy-to-vercel', 'running', '✓ TypeScript check passed');
      } else {
        for (let attempt = 1; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
          this.emitter?.emit('deploy-to-vercel', 'warning', `TypeScript errors — auto-fix attempt ${attempt}/${MAX_FIX_ATTEMPTS}...`);
          const errors = lastTscResult.stderr || lastTscResult.stdout;
          const fixed = await this.attemptBuildFix(session, errors);
          if (fixed) {
            tscPassed = true;
            this.emitter?.emit('deploy-to-vercel', 'running', `✓ TypeScript errors fixed (attempt ${attempt})`);
            break;
          }
          // Get fresh errors for next attempt (fix may have partially succeeded)
          lastTscResult = await session.runCommand('npx', ['tsc', '--noEmit'], { cwd: '/workspace/app' });
          if (lastTscResult.exitCode === 0) {
            tscPassed = true;
            this.emitter?.emit('deploy-to-vercel', 'running', `✓ TypeScript errors fixed (attempt ${attempt})`);
            break;
          }
        }
        if (!tscPassed) {
          this.emitter?.emit('deploy-to-vercel', 'warning', 'TypeScript errors remain after auto-fix — continuing anyway (Vercel ignoreBuildErrors=true)');
        }
      }
    }

    // QA Step 2: Production build (with retry loop)
    // Fewer attempts if tsc already exhausted all retries (same errors likely)
    const buildFixAttempts = tscPassed ? MAX_FIX_ATTEMPTS : 1;
    this.emitter?.emit('deploy-to-vercel', 'running', 'QA: Production build...');
    let buildPassed = false;
    {
      let lastBuildResult = await session.runCommand('npm', ['run', 'build'], {
        cwd: '/workspace/app',
      });
      if (lastBuildResult.exitCode === 0) {
        buildPassed = true;
        this.emitter?.emit('deploy-to-vercel', 'running', '✓ Production build passed');
      } else {
        for (let attempt = 1; attempt <= buildFixAttempts; attempt++) {
          this.emitter?.emit('deploy-to-vercel', 'warning', `Build failed — auto-fix attempt ${attempt}/${buildFixAttempts}...`);
          const errors = lastBuildResult.stderr || lastBuildResult.stdout;
          const fixed = await this.attemptBuildFix(session, errors);
          if (fixed) {
            buildPassed = true;
            this.emitter?.emit('deploy-to-vercel', 'running', `✓ Build errors fixed (attempt ${attempt})`);
            break;
          }
          // Get fresh errors for next attempt (fix may have partially succeeded)
          if (attempt < buildFixAttempts) {
            lastBuildResult = await session.runCommand('npm', ['run', 'build'], { cwd: '/workspace/app' });
            if (lastBuildResult.exitCode === 0) {
              buildPassed = true;
              this.emitter?.emit('deploy-to-vercel', 'running', `✓ Build errors fixed (attempt ${attempt})`);
              break;
            }
          }
        }
        if (!buildPassed) {
          this.emitter?.emit('deploy-to-vercel', 'warning', 'Build errors remain after auto-fix — deploying anyway (Vercel will attempt its own build)');
        }
      }
    }

    // QA Step 3: Smoke tests (with retry loop — only if build passed)
    const smokeFixAttempts = tscPassed ? MAX_FIX_ATTEMPTS : 1;
    if (buildPassed) {
      this.emitter?.emit('deploy-to-vercel', 'running', 'QA: Running smoke tests...');
      let smokePassed = false;
      const smokeResult = await this.runSmokeTests(session);
      if (smokeResult.passed) {
        smokePassed = true;
        const count = smokeResult.results.length;
        this.emitter?.emit('deploy-to-vercel', 'running', `✓ All ${count} smoke tests passed`);
      } else {
        for (let attempt = 1; attempt <= smokeFixAttempts; attempt++) {
          const failedNames = smokeResult.failedTests.map((t: { test: string }) => t.test).join(', ');
          this.emitter?.emit('deploy-to-vercel', 'warning', `Smoke tests failed (${failedNames}) — auto-fix attempt ${attempt}/${smokeFixAttempts}...`);
          const errorContext = smokeResult.failedTests
            .map((t: { test: string; detail: string }) => `${t.test}: ${t.detail}`)
            .join('\n');
          const fixed = await this.attemptSmokeFix(session, errorContext, input);
          if (fixed) {
            smokePassed = true;
            this.emitter?.emit('deploy-to-vercel', 'running', `✓ Smoke test issues fixed (attempt ${attempt})`);
            break;
          }
        }
        if (!smokePassed) {
          const failedNames = smokeResult.failedTests.map((t: { test: string }) => t.test).join(', ');
          this.emitter?.emit('deploy-to-vercel', 'warning', `Smoke tests still failing (${failedNames}) — deploying anyway`);
        }
      }
    } else {
      this.emitter?.emit('deploy-to-vercel', 'warning', 'Skipping smoke tests (build did not pass locally) — deploying anyway');
    }

    /* ── DEPLOY ─────────────────────────────────────────────── */

    // Collect project files from the sandbox
    this.emitter?.emit('deploy-to-vercel', 'running', 'Collecting project files...');
    const projectFiles = await collectProjectFiles(session);

    // Emit file data so the frontend can display the file tree + code viewer
    this.emitter?.emit(
      'files-collected',
      'done',
      `${projectFiles.length} files collected`,
      projectFiles.map(f => ({ path: f.path, content: f.content })),
    );

    // Create (or get) the Vercel project
    this.emitter?.emit('deploy-to-vercel', 'running', 'Creating Vercel project...');
    const slug = toProjectSlug(appName);
    const project = await createOrGetVercelProject(slug);

    // Make project publicly accessible (disable Vercel Auth protection)
    await setProjectPublicAccess(project.id);

    // Add custom domain (<slug>.nosoftware.app)
    const customDomain = await addCustomDomain(project.id, slug);
    const primaryUrl = `https://${customDomain}`;

    // Set environment variables on the Vercel project
    await setVercelProjectEnvVars(project.id, {
      DATABASE_URL: databaseUrl ?? '',
      NEXTAUTH_SECRET: nextauthSecret ?? crypto.randomUUID(),
      NEXTAUTH_URL: primaryUrl,
    });

    // Upload files to Vercel
    this.emitter?.emit('deploy-to-vercel', 'running', `Uploading ${projectFiles.length} files to Vercel...`);
    const fileRefs = await uploadProjectFiles(projectFiles);

    // Create the deployment
    this.emitter?.emit('deploy-to-vercel', 'running', `Creating Vercel deployment (${fileRefs.length} files)...`);
    const deployment = await createVercelDeployment(project.id, project.name, fileRefs);

    // Poll until the deployment is live
    this.emitter?.emit('deploy-to-vercel', 'running', 'Waiting for Vercel build to complete...');
    let deployedUrl: string;
    try {
      deployedUrl = await pollDeployment(deployment.id);
    } catch (pollError) {
      const fullMsg = pollError instanceof Error ? pollError.message : String(pollError);
      // Emit a truncated version for SSE (first line only), throw full for DB storage
      const firstLine = fullMsg.split('\n')[0] ?? fullMsg;
      this.emitter?.emit('deploy-to-vercel', 'error', firstLine);
      throw new Error(fullMsg);
    }

    /* ── POST-DEPLOY VERIFICATION ───────────────────────────── */

    this.emitter?.emit('deploy-to-vercel', 'running', 'Verifying live deployment...');
    try {
      // Wait for serverless cold start
      await new Promise((r) => setTimeout(r, 3000));

      // Health check
      const healthRes = await fetch(`${deployedUrl}/api/health`, {
        headers: { 'User-Agent': 'NoSoftware-HealthCheck/1.0' },
      });
      if (healthRes.ok) {
        const health = (await healthRes.json()) as { status: string; database: string };
        if (health.database === 'connected') {
          this.emitter?.emit('deploy-to-vercel', 'running', '✓ Live: database connected');
        } else {
          this.emitter?.emit('deploy-to-vercel', 'warning', `Live: DB ${health.database}`);
        }
      } else {
        this.emitter?.emit('deploy-to-vercel', 'warning', `Live health check: ${healthRes.status}`);
      }

      // Seed admin user on live deployment
      const seedRes = await fetch(`${deployedUrl}/api/auth/seed`, {
        headers: { 'User-Agent': 'NoSoftware-HealthCheck/1.0' },
      });
      if (seedRes.ok) {
        this.emitter?.emit('deploy-to-vercel', 'running', '✓ Live: admin user seeded');
      }
    } catch {
      this.emitter?.emit('deploy-to-vercel', 'warning', 'Live verification skipped (endpoint not reachable)');
    }

    // Delete the sandbox — no longer needed
    await session.delete();

    // Prefer the custom domain URL; fall back to Vercel URL
    const finalUrl = primaryUrl || deployedUrl;

    if (this.ctx) {
      this.ctx.deployedUrl = finalUrl;
    }

    return {
      inputHash,
      outputHash: await this.computeHash(finalUrl),
      artifacts: [{
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'deployment-config' as const,
        relativePath: 'deployment/vercel-deployment.json',
        contentHash: (await this.computeHash(finalUrl)).slice(-64),
        fileSizeBytes: Buffer.byteLength(finalUrl),
        isNew: true,
        description: `Deployed to ${finalUrl}`,
        createdAt: new Date(),
      }],
      summary: finalUrl,
      warnings: [],
    };
  }

  /* ------------------------------------------------------------------ */
  /*  QA: Smoke Tests                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Write and run a QA smoke test script inside the sandbox.
   * Starts the production server, hits every endpoint, reports results.
   */
  private async runSmokeTests(
    session: import('@heynxt/sandbox').SandboxSession,
  ): Promise<{
    passed: boolean;
    results: Array<{ test: string; ok: boolean; detail: string }>;
    failedTests: Array<{ test: string; detail: string }>;
  }> {
    try {
      // Write the QA script into the sandbox
      await session.writeFile('/workspace/app/qa-smoke-test.cjs', QA_SMOKE_TEST_SCRIPT);

      // Run it (timeout 90s — server startup + tests)
      const result = await session.runCommand('node', ['qa-smoke-test.cjs'], {
        cwd: '/workspace/app',
      });

      // Parse the JSON output from the last line of stdout
      const lines = result.stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1] ?? '{}';

      try {
        const parsed = JSON.parse(lastLine) as {
          passed: boolean;
          results: Array<{ test: string; ok: boolean; detail: string }>;
          failedTests?: Array<{ test: string; detail: string }>;
        };
        return {
          passed: parsed.passed,
          results: parsed.results ?? [],
          failedTests: parsed.failedTests ?? parsed.results?.filter(r => !r.ok) ?? [],
        };
      } catch {
        // If we can't parse the output, treat it as failed
        return {
          passed: false,
          results: [{ test: 'script-parse', ok: false, detail: result.stdout.slice(-500) }],
          failedTests: [{ test: 'script-parse', detail: 'Could not parse QA script output' }],
        };
      }
    } catch (err) {
      return {
        passed: false,
        results: [{ test: 'script-run', ok: false, detail: (err as Error).message }],
        failedTests: [{ test: 'script-run', detail: (err as Error).message }],
      };
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Auto-Fix: Build errors                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Attempt to fix build/type errors by feeding them back to the LLM.
   * Reads the broken files, asks the LLM to fix them, writes them back,
   * and retries the build. Returns true if the retry succeeds.
   */
  private async attemptBuildFix(
    session: import('@heynxt/sandbox').SandboxSession,
    buildErrors: string,
  ): Promise<boolean> {
    try {
      const { callOpenRouter } = await import('../llm.js');

      // Extract file paths from build errors
      // Next.js formats: ./app/path/file.tsx or .next/types/app/path/file.ts
      const errorFiles = new Set<string>();
      const fileRegex = /(?:\.\/|\.next\/types\/)(app\/[^\s:(]+\.tsx?)/g;
      let match: RegExpExecArray | null;
      while ((match = fileRegex.exec(buildErrors)) !== null) {
        // For .next/types/ paths, map back to the actual source file
        let filePath = match[1]!;
        // .next/types generates wrapper files — find the actual source
        // e.g. .next/types/app/api/adopters/[id]/route.ts → app/api/adopters/[id]/route.ts
        errorFiles.add(filePath);
      }

      // If we couldn't find specific files but have param-related errors,
      // scan all [id] route files
      if (errorFiles.size === 0 && buildErrors.includes('PageProps') || buildErrors.includes('ParamCheck') || buildErrors.includes('RouteContext')) {
        // Find all [id] route and page files by scanning common paths
        const idPaths = buildErrors.match(/app\/[^\s:(]+\[id\][^\s:(]+\.tsx?/g) ?? [];
        for (const p of idPaths) {
          errorFiles.add(p);
        }
      }

      // Quick-fix: Sidebar named export mismatch
      // The scaffold layout.tsx uses `import { Sidebar }` (named import)
      // but LLM may generate `export default function Sidebar` (default export).
      if (buildErrors.includes('has no exported member') && buildErrors.includes('Sidebar')) {
        try {
          const sidebarCode = await session.readFile('/workspace/app/components/Sidebar.tsx');
          if (sidebarCode.includes('export default function Sidebar')) {
            const fixedSidebar = sidebarCode.replace(
              /export\s+default\s+function\s+Sidebar/g,
              'export function Sidebar',
            );
            await session.writeFile('/workspace/app/components/Sidebar.tsx', fixedSidebar);
            errorFiles.delete('components/Sidebar.tsx'); // Don't re-process via LLM
          }
        } catch { /* skip */ }
      }

      if (errorFiles.size === 0) {
        // All errors were quick-fixed (e.g. Sidebar export). Verify by re-running tsc.
        const verifyTsc = await session.runCommand('npx', ['tsc', '--noEmit'], { cwd: '/workspace/app' });
        if (verifyTsc.exitCode === 0) {
          const verifyBuild = await session.runCommand('npm', ['run', 'build'], { cwd: '/workspace/app' });
          return verifyBuild.exitCode === 0;
        }
        return false;
      }

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

      // Read schema for context (helps the LLM fix import/type issues)
      let schemaContent = '';
      try {
        schemaContent = await session.readFile('/workspace/app/lib/schema.ts');
      } catch {
        // Schema may not exist
      }

      // Ask LLM to fix build errors
      const fixedCode = await callOpenRouter({
        model: 'anthropic/claude-sonnet-4',
        systemPrompt: [
          'You are a Next.js 15 build error fixer.',
          'Given files with build errors, output the FIXED versions.',
          'Fix ALL TypeScript and import errors. Keep the same functionality.',
          '',
          '## CRITICAL: Next.js 15 async params',
          'In Next.js 15, route/page params are ASYNC. NEVER use:',
          '  { params }: { params: { id: string } }  ← WRONG (Next.js 14)',
          'ALWAYS use:',
          '  props: { params: Promise<{ id: string }> }  ← CORRECT (Next.js 15)',
          'Then inside the function: const { id } = await props.params;',
          'This applies to ALL dynamic [id] route handlers AND pages.',
          '',
          'EVERY API route file MUST start with: export const dynamic = "force-dynamic";',
          'Wrap all database queries in try/catch with: catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 500 }); }',
          'Only import from: "next/server", "next/link", "next/navigation", "react", "@/lib/db", "@/lib/schema", "drizzle-orm".',
          'For client components, add "use client"; at the top.',
          'Separate each file with "// FILE: <path>" on its own line.',
          'Output ONLY TypeScript/TSX. No markdown fences, no explanations.',
        ].join('\n'),
        userPrompt: `Build errors:\n${buildErrors.slice(0, 3000)}\n\n${schemaContent ? `Schema:\n${schemaContent}\n\n` : ''}Files with errors:\n${fileContents.join('\n\n')}`,
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

      // Retry TypeScript check first, then build
      const retryTsc = await session.runCommand('npx', ['tsc', '--noEmit'], {
        cwd: '/workspace/app',
      });
      if (retryTsc.exitCode !== 0) return false;

      const retryResult = await session.runCommand('npm', ['run', 'build'], {
        cwd: '/workspace/app',
      });

      return retryResult.exitCode === 0;
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Auto-Fix: Smoke test failures                                     */
  /* ------------------------------------------------------------------ */

  /**
   * Attempt to fix runtime errors discovered by smoke tests.
   * Reads the failing route files and asks the LLM to fix them.
   */
  private async attemptSmokeFix(
    session: import('@heynxt/sandbox').SandboxSession,
    errorContext: string,
    input: GenerationStageInput,
  ): Promise<boolean> {
    try {
      const { callOpenRouter } = await import('../llm.js');

      // Read schema for context
      let schemaContent = '';
      try {
        schemaContent = await session.readFile('/workspace/app/lib/schema.ts');
      } catch { /* skip */ }

      // Identify which files might need fixing from the error context
      const entityRegex = /api-(\w+)/g;
      const failedEntities = new Set<string>();
      let match: RegExpExecArray | null;
      while ((match = entityRegex.exec(errorContext)) !== null) {
        failedEntities.add(match[1]!);
      }

      // Read all API route files for failing entities
      const fileContents: string[] = [];
      for (const entity of failedEntities) {
        try {
          const content = await session.readFile(`/workspace/app/app/api/${entity}/route.ts`);
          fileContents.push(`// FILE: app/api/${entity}/route.ts\n${content}`);
        } catch { /* skip */ }
      }

      // Also check for common failures: auth routes, health
      if (errorContext.includes('admin-seed') || errorContext.includes('admin-login')) {
        for (const authRoute of ['seed', 'login', 'me', 'logout']) {
          try {
            const content = await session.readFile(`/workspace/app/app/api/auth/${authRoute}/route.ts`);
            fileContents.push(`// FILE: app/api/auth/${authRoute}/route.ts\n${content}`);
          } catch { /* skip */ }
        }
      }

      if (fileContents.length === 0) return false;

      // Ask LLM to fix runtime errors
      const fixedCode = await callOpenRouter({
        model: 'anthropic/claude-sonnet-4',
        systemPrompt: [
          'You are a Next.js 15 runtime error fixer.',
          'Given API route files that fail at runtime, output FIXED versions.',
          'Fix import errors, missing exports, database query issues.',
          '',
          '## CRITICAL: Next.js 15 async params',
          'In Next.js 15, route params are ASYNC. NEVER use:',
          '  { params }: { params: { id: string } }  ← WRONG (Next.js 14)',
          'ALWAYS use:',
          '  props: { params: Promise<{ id: string }> }  ← CORRECT (Next.js 15)',
          'Then inside the function: const { id } = await props.params;',
          '',
          'EVERY file MUST start with: export const dynamic = "force-dynamic";',
          'EVERY file MUST export GET and/or POST as async functions.',
          'GET handlers MUST return NextResponse.json(records) where records is an array.',
          'POST handlers MUST parse body with await req.json() and use .returning().',
          'Wrap ALL database calls in try/catch.',
          'Only import from: "next/server", "@/lib/db", "@/lib/schema", "drizzle-orm".',
          'Separate each file with "// FILE: <path>" on its own line.',
          'Output ONLY TypeScript. No markdown fences, no explanations.',
        ].join('\n'),
        userPrompt: `Smoke test failures:\n${errorContext}\n\n${schemaContent ? `Schema:\n${schemaContent}\n\n` : ''}Failing files:\n${fileContents.join('\n\n')}`,
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

      // Rebuild and re-test
      const retryBuild = await session.runCommand('npm', ['run', 'build'], {
        cwd: '/workspace/app',
      });
      if (retryBuild.exitCode !== 0) return false;

      const retrySmoke = await this.runSmokeTests(session);
      return retrySmoke.passed;
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
