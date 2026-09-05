/**
 * /api/builds/[buildId]/github — Push code to GitHub or pull from a repo.
 *
 * POST { action: 'push', repo: 'owner/repo', branch: 'main', files: [...] }
 *   → Creates/updates files in the repo via GitHub API (commit via tree/blob)
 *
 * POST { action: 'pull', repo: 'owner/repo', branch: 'main' }
 *   → Fetches all files from the repo at the given branch
 *
 * Requires GITHUB_TOKEN env var (personal access token with repo scope).
 */

export async function POST(
  req: Request,
  props: { params: Promise<{ buildId: string }> },
) {
  const { buildId } = await props.params;

  const token = process.env['GITHUB_TOKEN'];
  if (!token) {
    return Response.json(
      { error: 'GITHUB_TOKEN not configured. Add a GitHub personal access token with repo scope to your environment.' },
      { status: 500 },
    );
  }

  const body = (await req.json()) as {
    action: 'push' | 'pull';
    repo: string;
    branch?: string;
    files?: Array<{ path: string; content: string }>;
  };

  const { action, repo, branch = 'main' } = body;

  if (!repo || !repo.includes('/')) {
    return Response.json({ error: 'repo must be in owner/repo format' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  try {
    if (action === 'push') {
      return await handlePush(repo, branch, body.files ?? [], headers, buildId);
    } else if (action === 'pull') {
      return await handlePull(repo, branch, headers);
    } else {
      return Response.json({ error: 'action must be push or pull' }, { status: 400 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Push: commit files to a GitHub repo                                */
/* ------------------------------------------------------------------ */

async function handlePush(
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string }>,
  headers: Record<string, string>,
  buildId: string,
) {
  if (!files.length) {
    return Response.json({ error: 'No files to push' }, { status: 400 });
  }

  const base = `https://api.github.com/repos/${repo}`;

  // 1. Get the latest commit SHA on the branch
  let parentSha: string;
  let treeSha: string;

  try {
    const refRes = await fetch(`${base}/git/ref/heads/${branch}`, { headers });
    if (refRes.status === 404) {
      // Branch doesn't exist — check if repo exists first
      const repoRes = await fetch(base, { headers });
      if (!repoRes.ok) {
        throw new Error(`Repository ${repo} not found or not accessible`);
      }
      // Try the default branch
      const repoData = (await repoRes.json()) as { default_branch: string };
      const defaultRef = await fetch(`${base}/git/ref/heads/${repoData.default_branch}`, { headers });
      if (!defaultRef.ok) {
        throw new Error(`Cannot find branch ${branch} or default branch`);
      }
      const defaultRefData = (await defaultRef.json()) as { object: { sha: string } };
      parentSha = defaultRefData.object.sha;
      // Get the tree SHA
      const commitRes = await fetch(`${base}/git/commits/${parentSha}`, { headers });
      const commitData = (await commitRes.json()) as { tree: { sha: string } };
      treeSha = commitData.tree.sha;
      // Create the new branch from default
      await fetch(`${base}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: parentSha }),
      });
    } else if (!refRes.ok) {
      throw new Error(`Failed to get branch reference: ${refRes.status}`);
    } else {
      const refData = (await refRes.json()) as { object: { sha: string } };
      parentSha = refData.object.sha;
      const commitRes = await fetch(`${base}/git/commits/${parentSha}`, { headers });
      const commitData = (await commitRes.json()) as { tree: { sha: string } };
      treeSha = commitData.tree.sha;
    }
  } catch (err) {
    throw new Error(`GitHub access error: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Create blobs for each file
  const treeItems: Array<{
    path: string;
    mode: '100644';
    type: 'blob';
    sha: string;
  }> = [];

  for (const file of files) {
    const blobRes = await fetch(`${base}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
    });
    if (!blobRes.ok) throw new Error(`Failed to create blob for ${file.path}`);
    const blobData = (await blobRes.json()) as { sha: string };
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    });
  }

  // 3. Create a new tree
  const treeRes = await fetch(`${base}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base_tree: treeSha, tree: treeItems }),
  });
  if (!treeRes.ok) throw new Error('Failed to create tree');
  const treeData = (await treeRes.json()) as { sha: string };

  // 4. Create a commit
  const commitRes = await fetch(`${base}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: `Update from NoSoftware build ${buildId.slice(0, 8)}`,
      tree: treeData.sha,
      parents: [parentSha],
    }),
  });
  if (!commitRes.ok) throw new Error('Failed to create commit');
  const commitData = (await commitRes.json()) as { sha: string; html_url: string };

  // 5. Update the branch reference
  const updateRefRes = await fetch(`${base}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: commitData.sha }),
  });
  if (!updateRefRes.ok) throw new Error('Failed to update branch');

  return Response.json({
    message: `Pushed ${files.length} files to ${repo}/${branch}`,
    commitUrl: commitData.html_url,
  });
}

/* ------------------------------------------------------------------ */
/*  Pull: fetch files from a GitHub repo                               */
/* ------------------------------------------------------------------ */

async function handlePull(
  repo: string,
  branch: string,
  headers: Record<string, string>,
) {
  const base = `https://api.github.com/repos/${repo}`;

  // Get the tree recursively
  const treeRes = await fetch(`${base}/git/trees/${branch}?recursive=1`, { headers });
  if (!treeRes.ok) {
    throw new Error(`Failed to fetch repo tree: ${treeRes.status}`);
  }

  const treeData = (await treeRes.json()) as {
    tree: Array<{ path: string; type: string; sha: string; size?: number }>;
    truncated: boolean;
  };

  // Filter to blob (file) entries, skip very large files
  const fileEntries = treeData.tree.filter(
    (e) => e.type === 'blob' && (e.size ?? 0) < 500_000,
  );

  // Fetch content for each file (up to 100 files)
  const files: Array<{ path: string; content: string }> = [];
  const maxFiles = Math.min(fileEntries.length, 100);

  for (let i = 0; i < maxFiles; i++) {
    const entry = fileEntries[i]!;
    // Skip binary-looking files
    if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp4|mp3|pdf|zip|tar|gz)$/i.test(entry.path)) {
      continue;
    }

    const blobRes = await fetch(`${base}/git/blobs/${entry.sha}`, { headers });
    if (!blobRes.ok) continue;

    const blobData = (await blobRes.json()) as { content: string; encoding: string };
    let content: string;
    if (blobData.encoding === 'base64') {
      content = Buffer.from(blobData.content, 'base64').toString('utf-8');
    } else {
      content = blobData.content;
    }

    files.push({ path: entry.path, content });
  }

  return Response.json({
    message: `Pulled ${files.length} files from ${repo}/${branch}`,
    files,
  });
}
