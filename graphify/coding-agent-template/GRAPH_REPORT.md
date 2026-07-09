# Graph Report — coding-agent-template

## Repository Overview

**coding-agent-template** is an officially maintained Vercel Labs reference implementation of a "coding agent substrate": a Next.js 16 application that lets authenticated users submit natural-language coding tasks, spawns an isolated Vercel Sandbox, runs one of six supported coding-agent CLIs (Claude Code, Codex, Copilot, Cursor, Gemini, opencode) inside it, auto-commits the resulting file changes to a fresh Git branch, and pushes the result back to GitHub. Tech stack: **Next.js 16 · React 19 · TypeScript 5.9 · AI SDK 5 · Vercel Sandbox (`@vercel/sandbox`) · Drizzle + Neon Postgres · OAuth via arctic (GitHub + Vercel) · JWE sessions · AES-256-CBC per-user encryption · shadcn/ui · Tailwind 4 · Jotai · Monaco editor**. 223 TypeScript/TSX source files, 59 API route handlers, 6 agent adapters.

## What the Repo Does

1. User signs in via GitHub or Vercel OAuth, optionally connects the other provider (identity merging).
2. User submits a task: repo URL + natural-language prompt + agent choice + model + options (keepAlive, browser, maxDuration).
3. `POST /api/tasks` persists a row in `tasks`, then uses Next.js `after()` to kick off three non-blocking background flows: AI branch-name generation, AI title generation, and the actual sandbox lifecycle.
4. `createSandbox()` provisions a Vercel Sandbox from a dedicated Vercel team/project, clones the user's repo (authenticated) into `/vercel/sandbox/project`, detects package manager, installs deps (`npm`/`pnpm`/`yarn`/`pip`), optionally starts the dev server, configures git, checks out a fresh branch.
5. `executeAgentInSandbox()` dispatches by `AgentType` to one of the six adapters; each adapter (a) installs its CLI if missing, (b) writes a per-agent config file, (c) authenticates via per-user API key (proxied through Vercel AI Gateway at `ai-gateway.vercel.sh`), (d) runs the agent with `--dangerously-skip-permissions` / equivalent bypass, (e) parses stdout (often line-delimited JSON) streaming into `taskMessages`, (f) extracts a `sessionId` for resumption.
6. `pushChangesToBranch()` runs `git add .`, commits with an AI-generated commit message, pushes to origin.
7. If `keepAlive === false`, `shutdownSandbox()` immediately destroys the sandbox; if `true`, the sandbox stays alive for follow-up messages.
8. Follow-ups POST to `/api/tasks/[taskId]/continue`, which either reuses the live sandbox (with `--resume <sessionId>`) or provisions a new one.

## Top-Level Architecture

- **`app/`** — Next.js App Router: pages + 59 route handlers. Pages: home, `/tasks`, `/tasks/[taskId]`, `/repos/[owner]/[repo]/{commits,issues,pull-requests}`, `/new/[owner]/[repo]`, `/repos/new`. API tree: `/api/auth/*`, `/api/tasks` + ~40 sub-routes under `/api/tasks/[taskId]/*`, `/api/github/*`, `/api/repos/*`, `/api/connectors`, `/api/api-keys`, `/api/sandboxes`, `/api/vercel/*`.
- **`components/`** — 48 React components (~15k LOC). UI built from shadcn/ui (`components/ui/`) plus feature components (`task-chat.tsx` 1306 LOC, `task-details.tsx` 2705 LOC, `task-form.tsx` 784 LOC, `task-sidebar.tsx` 781 LOC, `repo-selector.tsx` 628 LOC). Per-agent logo components (`components/logos/`).
- **`lib/`** — Domain + infrastructure code:
  - `lib/sandbox/` — **the substrate** (see below).
  - `lib/db/` — Drizzle client + schema + 21 numbered migrations (Drizzle Kit).
  - `lib/session/` — arctic OAuth flows, JWE-encrypted cookie sessions, server session helper.
  - `lib/auth/` — auth provider registry.
  - `lib/github/` — Octokit client + per-user token + github-stars.
  - `lib/api-keys/` — per-user API key retrieval.
  - `lib/jwe/` — JWE encrypt/decrypt (session tokens).
  - `lib/vercel-client/` — Vercel SDK wrappers (projects, teams, user).
  - `lib/utils/` — branch-name/title/commit-message generators (AI SDK 5 + gateway), rate-limit, cookies, id generator, logging redaction, `TaskLogger`.
  - `lib/atoms/` — Jotai atoms (client state for agent selection, github connection, file browser, multi-repo, session, task).
  - `lib/actions/` — server actions for connectors.
  - `lib/crypto.ts` — AES-256-CBC encrypt/decrypt for stored tokens + keys.
- **`public/`** — static assets.
- **`scripts/`** — `migrate-production.ts`.

## Key Architectural Insights

### 1. Adapter pattern for agents (`lib/sandbox/agents/index.ts`)
A single exported function `executeAgentInSandbox(sandbox, instruction, agentType, logger, …)` does:
- pre-flight cancellation check;
- special-case GitHub-token resolution for Copilot (`getUserGitHubToken()`);
- **temporary override of `process.env` with per-user API keys** (OPENAI/GEMINI/CURSOR/ANTHROPIC/AI_GATEWAY/GH_TOKEN), wrapped in `try/finally` to restore the original env;
- `switch` dispatch to `executeClaudeInSandbox` / `executeCodexInSandbox` / `executeCopilotInSandbox` / `executeCursorInSandbox` / `executeGeminiInSandbox` / `executeOpenCodeInSandbox`.

Every adapter returns the **uniform contract** `AgentExecutionResult`:
```ts
{ success, output?, agentResponse?, cliName?, changesDetected?, error?, streamingLogs?, logs?, sessionId? }
```

### 2. Sandboxed execution (`lib/sandbox/creation.ts` + `lib/sandbox/commands.ts`)
- `Sandbox.create({teamId, projectId, token, timeout, ports, runtime:'node22', resources:{vcpus:4}})` — Vercel Sandbox SDK.
- `PROJECT_DIR = '/vercel/sandbox/project'` — hard-coded mount point all agents operate in.
- `runCommandInSandbox(sandbox, cmd, args)` wraps `sandbox.runCommand` and normalizes `{success, exitCode, output, error}`.
- `runInProject(sandbox, cmd, args)` = `sh -c "cd $PROJECT_DIR && <cmd> <args>"` with proper single-quote escaping — the workhorse every adapter uses.
- `createSandbox` orchestrates: validate env → create sandbox → clone repo → detect pkg manager → install deps → start dev server if applicable → install `agent-browser` (Chromium + skills file) if `enableBrowser` → configure git user → handle empty repos (README + initial commit) → checkout/create branch.

### 3. Streaming JSON output (claude.ts — reference implementation)
- CLI invoked with `--output-format stream-json --verbose`.
- `sandbox.runCommand({... stdout: captureStdout, stderr: captureStderr})` with custom `Writable` streams.
- The `captureStdout.write` chunk-splitter parses each newline-delimited JSON:
  - `type === 'assistant'` + `message.content[]` → accumulate text blocks AND render tool_use as human-readable status lines (`Editing path`, `Reading path`, `Running: cmd`, `Searching files: pattern`, `Grep: pattern`) directly into the `taskMessages.content` row — UI sees live "agent is doing X" updates.
  - `type === 'result'` captures `session_id` and flips `isCompleted = true`.
- A 1-second polling loop waits for `isCompleted` instead of awaiting the process directly (sandbox timeout is the hard limit).
- After completion, `git status --porcelain` detects `changesDetected`.
- Other adapters use similar `Writable`-stream patterns but with text-diff parsing (Copilot) or line-prefix filtering (Codex) rather than JSON. Copilot streams HTML-wrapped (`<pre>`) content.

### 4. Session resumption
- Each adapter extracts `sessionId` from the run and returns it.
- Stored in `tasks.agentSessionId`.
- Follow-up calls via `POST /api/tasks/[taskId]/continue` set `isResumed=true, sessionId=…`.
- Per-agent resume semantics:
  - Claude/Cursor: `--resume <sessionId>` flag.
  - Codex: `codex resume --last` (no explicit id).
  - Copilot: `--resume <sessionId>` flag.
  - OpenCode: `--resume <sessionId>` flag.
  - Gemini: no session resumption (no `isResumed` param).

### 5. Background orchestration via Next.js `after()`
`app/api/tasks/route.ts` POST:
1. Validates + inserts task row (synchronous → response returned).
2. Kicks off **three parallel `after()` blocks**:
   - AI branch-name generation (`generateBranchName` via AI SDK 5 + gateway) → updates `tasks.branchName`.
   - AI title generation → updates `tasks.title`.
   - `processTaskWithTimeout(...)` — the whole sandbox lifecycle.
- `processTaskWithTimeout` = `Promise.race([processTask(…), setTimeout(TASK_TIMEOUT_MS)])` with a 1-minute-early warning log.
- This keeps the HTTP response sub-second while letting sandbox execution run for up to 5 hours.

### 6. Per-user encrypted API keys + AI Gateway proxying
- `lib/crypto.ts` = AES-256-CBC, `iv:hex:ciphertext:hex`, key from `ENCRYPTION_KEY` env.
- `keys` table stores per-user (userId, provider∈{anthropic,openai,cursor,gemini,aigateway}), encrypted `value`.
- `getUserApiKeys()` returns the decrypted map; passed into `executeAgentInSandbox` which temporarily binds them to `process.env`.
- All agent traffic is **proxied through Vercel AI Gateway** (`https://ai-gateway.vercel.sh`): Claude uses `ANTHROPIC_BASE_URL`, Codex uses `base_url` in `~/.codex/config.toml`. This centralizes observability, quota, and key management. (Inferred: heynxt-core may prefer a different gateway or direct provider calls — the *pattern* is what transfers, not the URL.)
- MCP server envs and OAuth client secrets are also encrypted in the `connectors` table.

## Module Inventory

| Path | Purpose | Status |
|---|---|---|
| `app/page.tsx` | Marketing landing page | Stable |
| `app/tasks/[taskId]/page.tsx` | Task detail view | Stable |
| `app/api/tasks/route.ts` | Task CRUD + orchestration entry point | **Critical** |
| `app/api/tasks/[taskId]/continue/route.ts` | Follow-up message handler | Stable |
| `app/api/auth/github/*`, `/callback/vercel/*` | OAuth flows (arctic) | Stable |
| `app/api/connectors/route.ts` | MCP server CRUD | Stable |
| `app/api/api-keys/route.ts` | Per-user API key CRUD | Stable |
| `app/api/github/*`, `/repos/*` | GitHub data proxy (commits/issues/PRs) | Stable |
| `lib/sandbox/agents/index.ts` | Agent dispatcher (the adapter switch) | **Critical** |
| `lib/sandbox/agents/claude.ts` | Reference adapter — streaming JSON | **Critical** |
| `lib/sandbox/agents/codex.ts` | Codex adapter (TOML config, Vercel+OpenAI key paths) | Stable |
| `lib/sandbox/agents/copilot.ts` | Copilot adapter (GitHub-token auth, MCP config JSON) | Stable |
| `lib/sandbox/agents/cursor.ts` | Cursor adapter (cursor-agent binary install) | Stable |
| `lib/sandbox/agents/gemini.ts` | Gemini adapter (no session resumption) | Stable |
| `lib/sandbox/agents/opencode.ts` | OpenCode adapter (dual Anthropic/AI Gateway) | Stable |
| `lib/sandbox/types.ts` | `SandboxConfig`, `SandboxResult`, `AgentExecutionResult` | **Critical** |
| `lib/sandbox/creation.ts` | Sandbox provisioning & dependency install | **Critical** |
| `lib/sandbox/commands.ts` | `runCommandInSandbox`, `runInProject`, `PROJECT_DIR` | **Critical** |
| `lib/sandbox/git.ts` | `pushChangesToBranch`, `shutdownSandbox` | Stable |
| `lib/sandbox/config.ts` | Env-var validation per agent | Stable |
| `lib/sandbox/package-manager.ts` | Detect npm/pnpm/yarn, install deps | Stable |
| `lib/sandbox/port-detection.ts` | Pick dev-server port from repo heuristics | Stable |
| `lib/sandbox/sandbox-registry.ts` | In-memory taskId→Sandbox map (for keepAlive) | Stable |
| `lib/db/schema.ts` | Drizzle schema: users, tasks, connectors, accounts, keys, taskMessages, settings | **Critical** |
| `lib/db/client.ts` | Neon serverless Postgres client | Stable |
| `lib/db/settings.ts` | Per-user setting overrides (`maxMessagesPerDay`, `maxSandboxDuration`) | Stable |
| `lib/crypto.ts` | AES-256 encrypt/decrypt | Stable |
| `lib/session/*` | Arctic OAuth + JWE sessions + server helpers | Stable |
| `lib/utils/task-logger.ts` | `TaskLogger` — unified logger updating both DB + in-memory | Stable |
| `lib/utils/branch-name-generator.ts` | AI SDK + AI Gateway branch name with fallback | Stable |
| `lib/utils/title-generator.ts` | AI SDK + AI Gateway task title with fallback | Stable |
| `lib/utils/commit-message-generator.ts` | AI SDK + AI Gateway commit message with fallback | Stable |
| `lib/utils/rate-limit.ts` | Daily message quota | Stable |
| `lib/utils/logging.ts` | `redactSensitiveInfo` | Stable |
| `lib/utils/id.ts` | `generateId` (nanoid wrapper) | Stable |
| `lib/atoms/*` | Jotai atoms for client state | Stable |
| `lib/api-keys/user-keys.ts` | Load + decrypt user's provider keys | Stable |
| `lib/github/*` | Octokit client factory, per-user token, stars | Stable |
| `lib/vercel-client/*` | Vercel projects/teams/user wrappers | Stable |
| `components/task-*.tsx` | Task UI (chat, details, form, sidebar) | Stable |
| `components/repo-*.tsx` | Repo tabs (commits/issues/PRs) | Stable |
| `components/ui/*` | shadcn/ui primitive components | Stable |
| `components/logos/*` | Per-agent logo components (Claude, Codex, …) | Stable |
| `drizzle.config.ts`, `next.config.ts`, `tsconfig.json`, `vercel.json` | Config files | Stable |
| `scripts/migrate-production.ts` | Production migration runner | Stable |

## Entry Points

- **HTTP entry**: `app/api/tasks/route.ts` — `POST` creates & orchestrates a task; `GET` lists user's tasks; `DELETE` bulk-soft-deletes by status.
- **Follow-up entry**: `app/api/tasks/[taskId]/continue/route.ts` — `POST` schedules continuation.
- **Lifecycle entries**: `/api/tasks/[taskId]/start-sandbox`, `/stop-sandbox`, `/restart-dev`, `/sandbox-health`.
- **UI entry**: `app/page.tsx` (landing) → `app/tasks/[taskId]/page.tsx` (detail) via `components/task-page-client.tsx`.

## Critical Files / High Blast Radius

| File | Why critical |
|---|---|
| `lib/sandbox/agents/index.ts` | Dispatcher — every new agent and every API-key/env-handling change touches it |
| `lib/sandbox/agents/claude.ts` | Reference adapter — streaming JSON parser, MCP installer, session-id extraction. Template for any new adapter or schema change |
| `lib/sandbox/types.ts` | `AgentExecutionResult` + `SandboxConfig`. Every adapter implements these; breaking changes propagate to 6 files |
| `lib/sandbox/creation.ts` | Sandbox lifecycle — clone, pkg manager, dev server, git init, branch checkout, browser install. ~1000 lines, most-complex orchestration |
| `app/api/tasks/route.ts` | Orchestration entry — `after()` blocks, timeout race, MCP loading, env capture before `after()`. Changes here change the entire task semantics |
| `lib/db/schema.ts` | Source of truth for all 7 tables; any drift requires a new numbered snapshot migration under `lib/db/migrations/meta/` |

## Safe to Extend

- **Adding a new agent backend** = add `lib/sandbox/agents/myagent.ts` exporting `executeMyAgentInSandbox` returning `AgentExecutionResult`, then add one `case` in `lib/sandbox/agents/index.ts` switch. Add the new agent literal to `AgentType` union. Optionally extend `lib/sandbox/config.ts` validation and `insertTaskSchema.selectedAgent` enum in schema.
- **Adding a new REST route under `/api/tasks/[taskId]/*`** — drop a `route.ts` in the right folder. Route handlers are isolated.
- **Adding UI components** — use `pnpm dlx shadcn@latest add <name>`. Existing feature components live alongside in `components/`.
- **Adding MCP connector types, API-key providers, OAuth providers** — each has its own bounded table + enum.

## Edit with Caution

- **`lib/sandbox/types.ts`** — `AgentExecutionResult` changes cascade to all 6 adapters + the dispatcher + every consumer in `app/api/tasks/*`.
- **`lib/db/schema.ts`** — any column change requires a new Drizzle Kit migration snapshot (already at 0021). Existing data migrations must be planned.
- **`lib/sandbox/agents/index.ts`** — the `process.env` override / restore block is delicate; leaking state across requests breaks multi-tenant isolation on shared Next.js workers.
- **`app/api/tasks/route.ts`** — the three parallel `after()` blocks have a subtle dependency: the main `processTask` awaits `waitForBranchName(taskId, 10000)`. Changing ordering/liveness checks can race.
- **`lib/crypto.ts`** — rotating `ENCRYPTION_KEY` invalidates every stored token/key. Any change must preserve backwards compatibility.

## Workflows Implemented

1. **Full task lifecycle**: POST `/api/tasks` → `createSandbox` (validate env → provision → clone → install deps → start dev server → git init/branch) → `executeAgentInSandbox` (CLI install → config → authenticate via gateway → run with streaming capture → extract sessionId) → push to branch → (conditional) shutdown.
2. **Keep-alive follow-ups**: POST `/api/tasks/[taskId]/continue` → reuses live sandbox when possible → replays with `--resume <sessionId>` → re-pushes branch.
3. **Background AI metadata**: branch name, task title, commit message — all generated via AI SDK 5 through the gateway inside `after()` blocks with fallbacks.
4. **Task cancellation**: `status === 'stopped'` checked at 7 cancellation points in `createSandbox` + before agent execution.
5. **PR lifecycle**: `/api/tasks/[taskId]/pr`, `close-pr`, `merge-pr`, `reopen-pr`, `sync-pr`, `create-file`, `delete-file`, `save-file`, `diff`, `files`, `lsp`, `terminal`, `deployment`, `check-runs`, `pr-comments`, `file-operation`, `reset-changes`, `discard-file-changes`.

## API Boundaries

| Route group | Purpose |
|---|---|
| `/api/auth/*` | OAuth signin (github, vercel), callbacks, disconnect, status, signout, rate-limit, info |
| `/api/tasks`, `/api/tasks/[taskId]/*` | Task lifecycle + ~40 sub-routes (continue, files, pr, terminal, lsp, diff, sandbox controls, etc.) |
| `/api/github/*` | user, orgs, repos, user-repos, stars, verify-repo, repos/create, plus `repos/[owner]/[repo]/{commits,issues,pull-requests}` |
| `/api/repos/[owner]/[repo]/*` | Repo data (commits, issues, PRs, PR check-task/close) |
| `/api/connectors` | MCP server registry CRUD |
| `/api/api-keys` | Per-user API key CRUD + `/check` |
| `/api/sandboxes` | List sandboxes |
| `/api/vercel/teams` | Vercel team listing |
| `/api/github-stars` | GitHub stars button data |

## Uncertain / Inferred

- The AI SDK 5 calls behind `generateBranchName`, `generateTaskTitle`, `generateCommitMessage` appear to use Vercel AI Gateway as the sole model endpoint (inferred from `AI_GATEWAY_API_KEY` gating and the URL constant; source files not deeply read).
- `lib/sandbox/sandbox-registry.ts` is an in-memory `Map<taskId, Sandbox>`; correctness across a horizontally-scaled Vercel deployment is **not guaranteed** — it is a best-effort cache for `keepAlive` sandboxes on a single host (inferred).
- `lib/actions/connectors.ts` is the only server-action file found; other mutations go through route handlers (inferred).
- The README claims "Next.js 15's `after()`" in prose but `package.json` pins `next: 16.0.10`; the behavior is identical — `after()` graduated from canary to stable (inferred).
- `opensrc/` dependency source cache referenced in AGENTS.md was not enumerated — likely stripped from the clone (inferred).
- Whether `@vercel/sandbox` supports multi-host reattachment of a `sandboxId` (and therefore the keepAlive feature across cold starts) is not determined from the source read (inferred).

---

## Session Memory

**Repo role.** `coding-agent-template` is Vercel Labs' reference substrate for spawning coding agents inside sandboxes and committing their output back to GitHub. It is the **archetype** for heynxt-core's agent substrate: the contract patterns, dispatcher design, streaming persistence, and sandbox orchestration should be adopted; the Vercel-specific infrastructure (`@vercel/sandbox`, `ai-gateway.vercel.sh`, Vercel OAuth, Neon via Vercel integration) should be re-implemented against whatever runtime heynxt-core targets (Fly, Modal, Docker, E2B, K8s pods, etc.).

**What to read first (in order):**
1. `lib/sandbox/agents/index.ts` — the dispatcher and the uniform contract boundary.
2. `lib/sandbox/agents/claude.ts` — the reference adapter: CLI install, gateway auth, MCP server wiring, stream-JSON parsing, sessionId extraction, cancellation, resumption.
3. `lib/sandbox/types.ts` — `SandboxConfig`, `SandboxResult`, `AgentExecutionResult`. The contract you must preserve when adapting.
4. `app/api/tasks/route.ts` — end-to-end orchestration showing how Next.js `after()` hands off long-running sandbox work; the timeout race; the three parallel `after()` blocks (branch name, title, task execution); the "capture session state before entering after() because session is not accessible inside" pattern.
5. `lib/sandbox/creation.ts` — sandbox provisioning reference (clone, install, dev server, git branch, browser skill install).
6. `lib/db/schema.ts` — the 7 tables (users, tasks, connectors, accounts, keys, taskMessages, settings) and their encryption story.

**Six adapters, one contract.** Each file in `lib/sandbox/agents/{claude,codex,copilot,cursor,gemini,opencode}.ts` exports one function `(sandbox, instruction, logger, …) => Promise<AgentExecutionResult>`. They differ only in: CLI install mechanism, config-file format (JSON / TOML / JSON+CLI flags), auth (gateway vs direct API key vs GitHub token), streaming parser (JSON / text / HTML), and resume flag syntax. Adding a 7th agent = write a new file + one switch case. This is the pattern heynxt-core should copy verbatim.

**Sandbox + streaming pattern to adopt.**
- Run the agent CLI inside an isolated container via an SDK that exposes `runCommand({cmd, args, env, cwd, stdout: Writable, stderr: Writable, detached, sudo})`.
- For JSON-streaming agents, feed a `Writable` whose `write(chunk)` splits on `\n`, parses each line, and incrementally updates a DB row via `drizzle.update(...).set({content: accumulated}).where(eq(taskMessages.id, agentMessageId))`. Fire-and-forget `.then().catch()` — UI polls the row.
- For non-JSON agents, line-prefix-filter and wrap in `<pre>` for HTML rendering.
- Completion signal = either an explicit chunk (`type === 'result'`) or process exit. Poll loop is safer than awaiting the detached process directly.
- Always redact secrets via `redactSensitiveInfo()` before logging, and never log dynamic user values in logger calls (see `AGENTS.md`).

**Session resumption to adopt.** Store `sessionId` on the task row after each run. Follow-up messages pass `(isResumed: true, sessionId)` and the adapter translates to the per-agent resume flag. Keep the sandbox alive if `keepAlive: true`; otherwise destroy after completion.

**What NOT to re-implement.**
- Vercel Sandbox provisioning internals (`Sandbox.create({teamId, projectId, token, timeout, ports, runtime, resources})`) — this is Vercel-specific. Reimplement against your chosen container runtime but preserve the `create/configure/execute/teardown` lifecycle shape.
- AI Gateway URL (`https://ai-gateway.vercel.sh`) — substitute your own gateway or direct provider SDKs. Keep the *pattern* of proxying all model traffic through a single observable egress.
- Vercel OAuth + GitHub OAuth via arctic as configured — heynxt-core will have its own auth. Keep the *pattern* of identity merging (user signs in with A, connects B, future sign-in with B recognizes same user).
- AES-256-CBC via Node `crypto` — adopt a modern KMS or the framework's built-in secret management; keep the *pattern* of per-user encrypted keys.
- Neon-specific Postgres client. Use any Drizzle-compatible driver; keep the schema shape.
- JWE session implementation — use your framework's session mechanism; keep the *pattern* of encrypted, server-readable sessions carrying user id + provider tokens.
- Agent CLI install scripts (curl installer URLs, npm package names). Treat them as content, not architecture.

**What to re-implement from scratch for heynxt-core.**
- The container runtime and its lifecycle hooks.
- The model gateway / key management surface.
- Authentication and identity merging against whatever providers heynxt-core supports.
- The task queue / background execution mechanism (Next.js `after()` is a convenience; a proper queue is likely better).

**Files that matter most when adapting.** Keep the 4-file core stable across adaptations: `dispatcher` (agents/index.ts), `reference adapter` (claude.ts), `contract types` (types.ts), `orchestrator` (route.ts). Anything built atop these four is replaceable.
