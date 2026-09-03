/**
 * @heynxt/sandbox — Project File Collection
 *
 * Collects all source files from the sandbox at /workspace/app,
 * excluding node_modules, .next, and .git directories.
 *
 * Used by the deploy-to-vercel stage to upload project files
 * to the Vercel deployment API.
 */

import type { SandboxSession } from './session.js';

export interface ProjectFile {
  /** Relative path from /workspace/app, e.g. "src/app/page.tsx". */
  path: string;
  /** File content as a UTF-8 string. */
  content: string;
}

/**
 * Collects all source files from the sandbox at /workspace/app,
 * excluding node_modules, .next, and .git.
 *
 * @param session - Active sandbox session to read files from.
 * @returns Array of project files with relative paths and content.
 * @throws {Error} If the `find` command fails inside the sandbox.
 */
export async function collectProjectFiles(
  session: SandboxSession,
): Promise<ProjectFile[]> {
  const result = await session.runCommand(
    'find',
    [
      '/workspace/app',
      '-type', 'f',
      '-not', '-path', '*/node_modules/*',
      '-not', '-path', '*/.next/*',
      '-not', '-path', '*/.git/*',
    ],
    {},
  );

  if (result.exitCode !== 0) {
    throw new Error(`find command failed:\n${result.stderr}`);
  }

  const absolutePaths = result.stdout
    .trim()
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  const files = await Promise.all(
    absolutePaths.map(async (absPath) => ({
      path: absPath.replace('/workspace/app/', ''),
      content: await session.readFile(absPath),
    })),
  );

  return files;
}
