/**
 * @heynxt/agent-adapter — Vercel Deployment API Helpers (Phase 6)
 *
 * Thin wrappers around the Vercel REST API for:
 *   - Project creation / lookup
 *   - Environment variable injection
 *   - File upload (content-addressable)
 *   - Deployment creation & polling
 *
 * All functions read `VERCEL_TOKEN` and optionally `VERCEL_TEAM_ID`
 * from `process.env`. Team ID is added as `?teamId=` query param on
 * all requests when present.
 */

import { createHash } from 'node:crypto';

/** ------------------------------------------------------------------ */
/*  Config                                                             */
/** ------------------------------------------------------------------ */

interface VercelConfig {
  token: string;
  teamId?: string;
}

function getConfig(): VercelConfig {
  const token = process.env['VERCEL_TOKEN'];
  if (!token) throw new Error('VERCEL_TOKEN is not set');
  return { token, teamId: process.env['VERCEL_TEAM_ID'] || undefined };
}

function vercelUrl(path: string, config: VercelConfig): string {
  const base = `https://api.vercel.com${path}`;
  return config.teamId ? `${base}?teamId=${config.teamId}` : base;
}

function vercelHeaders(config: VercelConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
  };
}

/** ------------------------------------------------------------------ */
/*  Project                                                            */
/** ------------------------------------------------------------------ */

/**
 * Create a new Vercel project, or return the existing one if it
 * already exists (409 → GET by slug).
 */
export async function createOrGetVercelProject(
  slug: string,
): Promise<{ id: string; name: string }> {
  const config = getConfig();

  // Try to create
  const createRes = await fetch(vercelUrl('/v10/projects', config), {
    method: 'POST',
    headers: vercelHeaders(config),
    body: JSON.stringify({ name: slug, framework: 'nextjs' }),
  });

  if (createRes.ok) {
    const data = (await createRes.json()) as { id: string; name: string };
    return data;
  }

  if (createRes.status === 409) {
    // Already exists — fetch it
    const getRes = await fetch(
      vercelUrl(`/v10/projects/${slug}`, config),
      { headers: vercelHeaders(config) },
    );
    if (!getRes.ok) {
      throw new Error(`Failed to get Vercel project: ${await getRes.text()}`);
    }
    const data = (await getRes.json()) as { id: string; name: string };
    return data;
  }

  throw new Error(
    `Vercel project creation failed ${createRes.status}: ${await createRes.text()}`,
  );
}

/** ------------------------------------------------------------------ */
/*  Env vars                                                           */
/** ------------------------------------------------------------------ */

/**
 * Set environment variables on a Vercel project (encrypted, targeting
 * production + preview). Uses upsert: updates existing vars, creates new ones.
 * Each build provisions a fresh Neon DB, so DATABASE_URL must always be updated.
 */
export async function setVercelProjectEnvVars(
  projectId: string,
  vars: Record<string, string>,
): Promise<void> {
  const config = getConfig();

  // 1. Fetch existing env vars to find IDs for update
  const listRes = await fetch(
    vercelUrl(`/v9/projects/${projectId}/env`, config),
    { headers: vercelHeaders(config) },
  );

  const existingByKey = new Map<string, string>(); // key → env var id
  if (listRes.ok) {
    const data = (await listRes.json()) as {
      envs: Array<{ id: string; key: string }>;
    };
    for (const env of data.envs) {
      existingByKey.set(env.key, env.id);
    }
  }

  // 2. For each var: PATCH if it exists, POST if new
  for (const [key, value] of Object.entries(vars)) {
    const envId = existingByKey.get(key);

    if (envId) {
      // Update existing env var
      const patchRes = await fetch(
        vercelUrl(`/v9/projects/${projectId}/env/${envId}`, config),
        {
          method: 'PATCH',
          headers: vercelHeaders(config),
          body: JSON.stringify({
            value,
            type: 'encrypted',
            target: ['production', 'preview'],
          }),
        },
      );
      if (!patchRes.ok) {
        const body = await patchRes.text();
        throw new Error(`Failed to update env var ${key}: ${body}`);
      }
    } else {
      // Create new env var
      const postRes = await fetch(
        vercelUrl(`/v10/projects/${projectId}/env`, config),
        {
          method: 'POST',
          headers: vercelHeaders(config),
          body: JSON.stringify([{
            key,
            value,
            type: 'encrypted',
            target: ['production', 'preview'],
          }]),
        },
      );
      if (!postRes.ok) {
        const body = await postRes.text();
        if (!body.includes('already exists')) {
          throw new Error(`Failed to create env var ${key}: ${body}`);
        }
      }
    }
  }
}

/** ------------------------------------------------------------------ */
/*  File upload                                                        */
/** ------------------------------------------------------------------ */

interface VercelFileRef {
  /** Relative path, e.g. "src/app/page.tsx". */
  file: string;
  /** SHA-1 hex digest of the file content. */
  sha: string;
  /** File size in bytes. */
  size: number;
}

/**
 * Upload project files to Vercel's content-addressable file store.
 * Returns file references for use in `createVercelDeployment`.
 */
export async function uploadProjectFiles(
  files: Array<{ path: string; content: string }>,
): Promise<VercelFileRef[]> {
  const config = getConfig();
  const refs: VercelFileRef[] = [];

  for (const f of files) {
    const buffer = Buffer.from(f.content, 'utf8');
    const sha = createHash('sha1').update(buffer).digest('hex');
    const size = buffer.byteLength;

    const res = await fetch(
      `https://api.vercel.com/v2/files${config.teamId ? `?teamId=${config.teamId}` : ''}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/octet-stream',
          'x-now-digest': sha,
          'x-now-size': String(size),
        },
        body: buffer,
      },
    );

    // 200 = uploaded, 409 = already exists — both OK
    if (!res.ok && res.status !== 409) {
      throw new Error(`File upload failed for ${f.path}: ${await res.text()}`);
    }

    refs.push({ file: f.path, sha, size });
  }

  return refs;
}

/** ------------------------------------------------------------------ */
/*  Deployment                                                         */
/** ------------------------------------------------------------------ */

/**
 * Create a Vercel deployment from uploaded file references.
 * Returns the deployment ID and URL.
 */
export async function createVercelDeployment(
  projectId: string,
  projectName: string,
  fileRefs: VercelFileRef[],
): Promise<{ id: string; url: string }> {
  const config = getConfig();

  const res = await fetch(vercelUrl('/v13/deployments', config), {
    method: 'POST',
    headers: vercelHeaders(config),
    body: JSON.stringify({
      name: projectName,
      project: projectId,
      target: 'production',
      files: fileRefs,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Deployment creation failed ${res.status}: ${await res.text()}`,
    );
  }

  const data = (await res.json()) as { id: string; url: string };
  return data;
}

/**
 * Poll a Vercel deployment until it reaches READY or ERROR state.
 *
 * @param deploymentId - Vercel deployment ID.
 * @param opts.intervalMs - Poll interval in ms (default 5000).
 * @param opts.maxAttempts - Max poll attempts (default 36 = 3 min).
 * @returns The live HTTPS URL of the deployment.
 * @throws {Error} If the deployment errors out or times out.
 */
export async function pollDeployment(
  deploymentId: string,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<string> {
  const config = getConfig();
  const intervalMs = opts.intervalMs ?? 5000;
  const maxAttempts = opts.maxAttempts ?? 72; // 6 minutes max (first builds include npm install)

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      vercelUrl(`/v13/deployments/${deploymentId}`, config),
      { headers: vercelHeaders(config) },
    );

    if (!res.ok) {
      throw new Error(`Failed to poll deployment: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      readyState: string;
      url: string;
      errorMessage?: string;
      errorCode?: string;
    };

    if (data.readyState === 'READY') return `https://${data.url}`;
    if (data.readyState === 'ERROR') {
      const msg = data.errorMessage ?? 'unknown error';
      const code = data.errorCode ? ` [${data.errorCode}]` : '';

      // Fetch build logs for actionable error details
      let buildLogs = '';
      try {
        const logsRes = await fetch(
          vercelUrl(`/v7/deployments/${deploymentId}/events`, config),
          { headers: vercelHeaders(config) },
        );
        if (logsRes.ok) {
          const events = (await logsRes.json()) as Array<{
            type: string;
            payload?: { text?: string };
          }>;
          // Extract the last 30 log lines for error context
          const logLines = events
            .filter(e => e.payload?.text)
            .map(e => e.payload!.text!)
            .slice(-30);
          buildLogs = logLines.join('\n');
        }
      } catch {
        // Non-critical — continue with the basic error message
      }

      const detail = buildLogs
        ? `Vercel deployment failed${code}: ${msg}\n\nBuild logs (last 30 lines):\n${buildLogs}`
        : `Vercel deployment failed${code}: ${msg}`;
      throw new Error(detail);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Deployment timed out after 6 minutes');
}
