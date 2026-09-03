/**
 * @heynxt/sandbox — Project File Collection
 *
 * Collects all source files from the sandbox, auto-detecting the
 * project root (wherever `package.json` lives) so that file paths
 * are relative to it — e.g. `src/app/page.tsx`, `package.json`.
 *
 * Excludes node_modules, .next, and .git directories.
 *
 * Used by the deploy-to-vercel stage to upload project files
 * to the Vercel deployment API.
 */

import type { SandboxSession } from './session.js';

export interface ProjectFile {
  /** Relative path from the project root, e.g. "src/app/page.tsx". */
  path: string;
  /** File content as a UTF-8 string. */
  content: string;
}

/**
 * Find the actual project root by locating `package.json`.
 *
 * The LLM may scaffold files at `/workspace/app/` or inside a
 * subdirectory like `/workspace/app/src/`. We use the directory
 * containing the first `package.json` as the canonical root so
 * that all relative paths start from there.
 */
async function detectProjectRoot(session: SandboxSession): Promise<string> {
  // Find all package.json files and pick the one that contains "next"
  // as a dependency — that's the actual Next.js project root.
  //
  // The sandbox workspace may have a bare package.json at /workspace/app/
  // while the LLM scaffolds the real project inside /workspace/app/src/.
  // Both levels may also have next.config.*, so we must inspect content.
  const result = await session.runCommand(
    'find',
    [
      '/workspace/app',
      '-maxdepth', '3',
      '-name', 'package.json',
      '-not', '-path', '*/node_modules/*',
    ],
    {},
  );

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return '/workspace/app';
  }

  const candidates = result.stdout
    .trim()
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .sort((a, b) => a.length - b.length); // shallowest first

  // Check each package.json for "next" dependency (the real project)
  for (const pkgPath of candidates) {
    try {
      const content = await session.readFile(pkgPath);
      const pkg = JSON.parse(content) as Record<string, unknown>;
      const deps = {
        ...(pkg['dependencies'] as Record<string, string> ?? {}),
        ...(pkg['devDependencies'] as Record<string, string> ?? {}),
      };
      if ('next' in deps) {
        return pkgPath.replace(/\/package\.json$/, '');
      }
    } catch {
      // Skip unreadable / unparseable files
    }
  }

  // Fallback: shallowest package.json
  return candidates[0]!.replace(/\/package\.json$/, '');
}

/**
 * Collects all source files from the sandbox project,
 * excluding node_modules, .next, and .git.
 *
 * Auto-detects the project root (where `package.json` lives)
 * so paths are always relative to the project root, regardless
 * of whether the LLM scaffolded at `/workspace/app` or inside
 * a subdirectory.
 *
 * @param session - Active sandbox session to read files from.
 * @returns Array of project files with relative paths and content.
 * @throws {Error} If the `find` command fails inside the sandbox.
 */
export async function collectProjectFiles(
  session: SandboxSession,
): Promise<ProjectFile[]> {
  const projectRoot = await detectProjectRoot(session);

  const result = await session.runCommand(
    'find',
    [
      projectRoot,
      '-type', 'f',
      '-not', '-path', '*/node_modules/*',
      '-not', '-path', '*/.next/*',
      '-not', '-path', '*/.git/*',
      '-not', '-path', '*/drizzle/meta/*',
      '-not', '-name', '.env',
      '-not', '-name', '.env.*',
    ],
    {},
  );

  if (result.exitCode !== 0) {
    throw new Error(`find command failed:\n${result.stderr}`);
  }

  const prefix = projectRoot.endsWith('/') ? projectRoot : `${projectRoot}/`;
  const absolutePaths = result.stdout
    .trim()
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  const files = await Promise.all(
    absolutePaths.map(async (absPath) => ({
      path: absPath.startsWith(prefix)
        ? absPath.slice(prefix.length)
        : absPath.replace('/workspace/app/', ''),
      content: await session.readFile(absPath),
    })),
  );

  return files;
}
