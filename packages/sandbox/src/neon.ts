/**
 * @heynxt/sandbox — Neon Database Provisioning
 *
 * Creates a Neon Postgres project via the Neon API and returns
 * the connection URI for the default database.
 *
 * Requires `NEON_API_KEY` in `process.env`.
 */

/** Result of provisioning a Neon database. */
export interface NeonProvisionResult {
  databaseUrl: string;
  databaseId: string;
}

/**
 * Provision a new Neon Postgres project for the given app.
 *
 * @param appId - Application UUID; the first 8 chars are used in the project name.
 * @returns Connection URI and project ID.
 * @throws {Error} If `NEON_API_KEY` is not set or the API call fails.
 */
export async function provisionDatabase(
  appId: string,
): Promise<NeonProvisionResult> {
  const apiKey = process.env['NEON_API_KEY'];
  if (!apiKey) throw new Error('NEON_API_KEY is not set');

  const projectName = `heynxt-${appId.slice(0, 8)}`;

  const res = await fetch('https://console.neon.tech/api/v2/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ project: { name: projectName } }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Neon API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    project: { id: string };
    connection_uris: Array<{ connection_uri: string }>;
  };

  return {
    databaseUrl: data.connection_uris[0]!.connection_uri,
    databaseId: data.project.id,
  };
}
