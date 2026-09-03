/**
 * @heynxt/sandbox — Sandbox Session Wrapper
 *
 * Thin adapter over `@vercel/sandbox` that exposes the subset of
 * operations the generation pipeline stages need: file I/O, command
 * execution, and lifecycle management.
 *
 * Every method maps 1-to-1 onto the underlying Sandbox API so that
 * test code can provide a mock SandboxSession via the constructor
 * without pulling in the Vercel SDK.
 */

import { Sandbox } from '@vercel/sandbox';

/** ------------------------------------------------------------------ */
/*  Public types                                                      */
/** ------------------------------------------------------------------ */

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SandboxConfig {
  /** Used as sandbox name for resume. */
  sessionId: string;
  /** Environment variables injected at creation. */
  env: Record<string, string>;
  /** Auto-terminate timeout in ms (default 15 minutes). */
  timeoutMs?: number;
  /** Vercel API token (falls back to VERCEL_TOKEN env var). */
  token?: string;
  /** Vercel team ID (falls back to VERCEL_TEAM_ID env var). */
  teamId?: string;
  /** Vercel project ID (falls back to VERCEL_PROJECT_ID env var). */
  projectId?: string;
}

/** ------------------------------------------------------------------ */
/*  SandboxSession                                                    */
/** ------------------------------------------------------------------ */

export class SandboxSession {
  private constructor(private readonly sandbox: Sandbox) {}

  /** Create a fresh sandbox with the given config. */
  static async create(config: SandboxConfig): Promise<SandboxSession> {
    const token = config.token ?? process.env['VERCEL_TOKEN'];
    const teamId = config.teamId ?? process.env['VERCEL_TEAM_ID'];
    const projectId = config.projectId ?? process.env['VERCEL_PROJECT_ID'];

    const sandbox = await Sandbox.create({
      name: config.sessionId,
      timeout: config.timeoutMs ?? 15 * 60 * 1000,
      env: config.env,
      // Pass credentials explicitly so the SDK doesn't need OIDC context
      ...(token && teamId && projectId ? { token, teamId, projectId } : {}),
    });
    return new SandboxSession(sandbox);
  }

  /** Resume an existing sandbox by session ID. */
  static async resume(sessionId: string): Promise<SandboxSession> {
    const token = process.env['VERCEL_TOKEN'];
    const teamId = process.env['VERCEL_TEAM_ID'];
    const projectId = process.env['VERCEL_PROJECT_ID'];

    const sandbox = await Sandbox.get({
      name: sessionId,
      // Pass credentials explicitly so the SDK doesn't need OIDC context
      ...(token && teamId && projectId ? { token, teamId, projectId } : {}),
    });
    return new SandboxSession(sandbox);
  }

  /** Write a text file into the sandbox filesystem. */
  async writeFile(path: string, content: string): Promise<void> {
    await this.sandbox.writeFiles([{ path, content }]);
  }

  /** Read a text file from the sandbox filesystem. */
  async readFile(path: string): Promise<string> {
    const buf = await this.sandbox.readFileToBuffer({ path });
    if (!buf) throw new Error(`File not found in sandbox: ${path}`);
    return buf.toString('utf8');
  }

  /** Run a command and collect stdout / stderr / exit code. */
  async runCommand(
    cmd: string,
    args: string[],
    opts?: { cwd?: string },
  ): Promise<RunCommandResult> {
    const command = await this.sandbox.runCommand({
      cmd,
      args,
      ...(opts?.cwd ? { cwd: opts.cwd } : {}),
    });

    let stdout = '';
    let stderr = '';
    for await (const log of command.logs()) {
      if (log.stream === 'stdout') stdout += log.data;
      if (log.stream === 'stderr') stderr += log.data;
    }

    return { stdout, stderr, exitCode: command.exitCode };
  }

  /** List files in a directory. */
  async listFiles(path: string): Promise<string[]> {
    return this.sandbox.fs.readdir(path, { withFileTypes: false });
  }

  /** Stop the sandbox (can be resumed later). */
  async stop(): Promise<void> {
    await this.sandbox.stop();
  }

  /** Permanently delete the sandbox. */
  async delete(): Promise<void> {
    await this.sandbox.delete();
  }
}
