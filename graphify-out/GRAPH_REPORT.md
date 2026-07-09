# HeyNXT Core — Structural Knowledge Graph Report

> Generated: 2026-07-09 | Total files: 33 | Total modules: 6

---

## Repository Overview

HeyNXT Core is the **product control plane and orchestration layer** for an industrial AI app builder. It integrates coding-agent execution patterns (from Vercel's coding-agent-template) with industrial manufacturing blueprints (from two FactoryNXT reference repos) to enable AI-driven application generation for manufacturing use cases. The repo currently sits at **Phase 0 (foundation complete)** — the monorepo scaffold is in place, package boundaries declared, and TypeScript + pnpm + Turbo toolchain configs committed, but no dependencies installed and no code beyond stub `index.ts` files.

---

## What the Repo Does

### Current State (Phase 0 scaffold only)
- Declares a monorepo of 1 app (`apps/web`) + 5 packages (core-types, prompt-spec, agent-adapter, blueprint-registry, domain-models)
- Establishes workspace, turbo tasks, tsconfig inheritance, and strict TypeScript
- Contains zero business logic, zero schemas, zero dependencies installed

### Planned State (Phases 1–9 per `buildplan.md`)
- **Prompt-to-spec transformation** — convert natural language prompts into structured application specifications
- **Agent execution integration** — spawn and monitor coding agents that build apps from specs
- **Blueprint registry** — catalog of industrial manufacturing blueprints as source material
- **Domain model extraction** — normalize FactoryNXT Python entities into shared TypeScript types
- **Control plane UI** — Next.js web app for users to create projects, run agents, review generated apps
- **Validation loop** — ensure generated apps conform to blueprint constraints
- **Industrial runtime services** — eventual runtime for generated apps (Phase 8+)

---

## Top-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    apps/web  (Next.js UI)                       │
│                    Control Plane — user-facing                  │
└───────────────┬────────────────────────────────┬────────────────┘
                │                                │
┌───────────────▼─────────┐  ┌───────────────────▼───────────────┐
│ packages/prompt-spec    │  │ packages/agent-adapter            │
│ (natural language →     │  │ (agent spawn/execute/monitor)     │
│  structured spec)       │  │                                   │
└───────────────┬─────────┘  └───────────────────┬───────────────┘
                │                                │
┌───────────────▼──────────────────┐  ┌──────────▼───────────────┐
│ packages/blueprint-registry     │  │ packages/domain-models   │
│ (industrial blueprint catalog)  │  │ (FactoryNXT entities)    │
└───────────────┬─────────────────┘  └──────────┬───────────────┘
                │                                │
                └────────────────┬───────────────┘
                                 │
              ┌──────────────────▼──────────────────┐
              │    packages/core-types              │
              │    (Zod schemas + shared TS types)  │
              │    <<< leaf dependency >>>          │
              └─────────────────────────────────────┘
```

Data flow (planned): `prompt → prompt-spec → spec → agent-adapter → generated app ← blueprint-registry + domain-models ← core-types (contracts throughout)`

---

## Module Inventory

| Module path | Purpose | Status | Depends On |
|---|---|---|---|
| `apps/web` | Next.js control plane UI | scaffolded (no `src/` yet) | `@heynxt/*` (all 5 packages) |
| `packages/core-types` | Shared Zod schemas and TypeScript types (leaf) | stub | (none — leaf) |
| `packages/prompt-spec` | Prompt-to-spec transformation | stub | `core-types` |
| `packages/agent-adapter` | Coding-agent execution adapter | stub | `core-types`, `prompt-spec` |
| `packages/blueprint-registry` | Industrial blueprint catalog | stub | `core-types`, `domain-models` |
| `packages/domain-models` | Industrial domain entities (plant/line/station/etc.) | stub | `core-types` |

---

## Entry Points

- `apps/web/src/` — **does not exist yet** (package.json present, README present; no `src/` dir)
- `packages/core-types/src/index.ts` — stub: `export {};` with JSDoc TODO list
- `packages/prompt-spec/src/index.ts` — stub: `export {};` with JSDoc TODO list
- `packages/agent-adapter/src/index.ts` — stub: `export {};` with JSDoc TODO list
- `packages/blueprint-registry/src/index.ts` — stub: `export {};` with JSDoc TODO list
- `packages/domain-models/src/index.ts` — stub: `export {};` with JSDoc TODO list

---

## Package Dependency Graph (acyclic)

```
@heynxt/web  ───┐
                ├─→ @heynxt/core-types
                ├─→ @heynxt/prompt-spec ─→ @heynxt/core-types
                ├─→ @heynxt/agent-adapter ─→ { @heynxt/core-types, @heynxt/prompt-spec }
                ├─→ @heynxt/blueprint-registry ─→ { @heynxt/core-types, @heynxt/domain-models }
                └─→ @heynxt/domain-models ─→ @heynxt/core-types

@heynxt/core-types ─→ (no workspace deps — leaf)
```

External dep shared across all packages: `zod ^3.23.0`. Build tooling: `turbo ^2.0.0`, `typescript ^5.5.0`.

---

## Hub Files / High Blast Radius List

| File | Blast Radius | Why |
|---|---|---|
| `package.json` (root) | HIGH | workspace scripts, dev deps (turbo, typescript), engine constraints |
| `turbo.json` | HIGH | defines all task orchestration rules (`build`, `dev`, `lint`, `typecheck`, `test`, `clean`) |
| `tsconfig.base.json` | HIGH | strict compiler options inherited by every `packages/*/tsconfig.json` |
| `tsconfig.json` (root) | MEDIUM | root project config, excludes `apps/` and `packages/` (each has own) |
| `pnpm-workspace.yaml` | HIGH | workspace member globs (`apps/*`, `packages/*`) |
| `<not yet present> packages/core-types/src/schemas/*.ts` | HIGH | (inferred) — every schema added here cascades to all other packages that import it |
| `CLAUDE.md` | HIGH | dictates all future Claude Code session behavior |
| `buildplan.md` | MEDIUM | phase plan and exit criteria; edits cascade to task sequencing |

---

## Safe to Edit

- Any `packages/*/src/index.ts` stub (currently empty `export {}`)
- `apps/web/src/` — does not exist yet; creating it is safe (expected next step)
- `CLAUDE.md` — designed to be extended
- `docs/adr/*.md` (ADR-0001, ADR-0002, ADR-0003) — append-only decision records
- `FOUNDATION.md` — descriptive doc, no downstream consumers
- `README.md` — informational
- `docs/architecture/overview.md` — informational
- `.env.example` — add keys as needed
- `.gitignore` — additive only
- `.claude/settings.json` — scoped to local Claude Code harness

---

## Edit with Caution

- `turbo.json` — changing task pipeline rules cascades to every package's build/lint/typecheck behavior
- `tsconfig.base.json` — any flag change (e.g., toggling `strict`, `module`, `target`) propagates to all packages simultaneously
- `package.json` (root) — workspace globs, engine constraints, dev dependency versions
- `pnpm-workspace.yaml` — workspace glob changes affect what pnpm treats as a package
- Any package's `package.json` — adding/removing `workspace:*` deps changes the dependency graph (which is currently enforced only by convention, not by a tool like `manypkg`)

---

## Workflows

| Workflow | Status | Steps |
|---|---|---|
| Prompt → Spec | planned | user prompt → `prompt-spec` → structured `PromptSpec` → validation via `core-types` |
| Spec → Agent Execution | planned | `PromptSpec` → `agent-adapter` → spawning coding agent → streaming result |
| Blueprint Selection | planned | query `blueprint-registry` → filter by domain → load compatible blueprints |
| Generation Pipeline | planned | `prompt-spec` + `blueprint-registry` + `domain-models` → `agent-adapter` → generated app |
| Validation Loop | planned | generated app + blueprint constraints → verify conformance → feedback to agent |
| Local Dev | planned (not implemented) | `pnpm install` → `pnpm dev` → web + types watched (currently no deps installed) |

No workflow is implemented yet — all six are planned per `buildplan.md`.

---

## API Boundaries

- **Public exports only**: every package uses conditional `exports` field:
  ```json
  ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  ```
  Consumers (`apps/web`, `agent-adapter`, etc.) must import `@heynxt/xxx`, never `@heynxt/xxx/src/...` or `@heynxt/xxx/dist/...`.
- **No internal path imports across packages** — enforced by convention (no lint rule yet)
- **All types cross boundaries via `core-types`** — Zod schemas are the single source of truth (inferred — currently no schemas exist yet)
- **No runtime APIs** — no HTTP routes, no database, no external endpoints defined yet (inferred from absence of `prisma`, `drizzle`, `next/routes`, etc.)

---

## Uncertain / Inferred Relationships

- **(inferred)** Cross-package runtime dependencies are declared in `package.json` but not yet validated (no `pnpm install` run; no lockfile). If `pnpm install` fails, the dependency graph needs re-examination.
- **(inferred)** `apps/web` depends on all 5 packages per its `package.json`, but this means `prompt-spec`, `agent-adapter`, `blueprint-registry`, `domain-models` are all direct web deps — this could be reduced later if web routes only use some of them.
- **(inferred)** No runtime service (DB, cache, queue) is configured yet. The build plan mentions Neon serverless / Postgres in Phase 1; this is not represented in the scaffold.
- **(inferred)** `.env.example` is empty-ish (not read, but listed). Env var schema is not yet defined.
- **(inferred)** `apps/web/README.md` exists but `apps/web/src/` does not — the Next.js app cannot run yet.
- **(inferred)** All 5 `index.ts` stubs are semantically equivalent (just `export {}` with JSDoc TODOs). No real types exist yet.

---

## Session Memory

> **Paste this block verbatim at the top of any future Claude Code session prompt before opening a file in this repo:**

```
You are working in /Users/pskbmohan/Documents/GitHub/heynxt-core — an
industrial AI app builder monorepo. Phase 0 (foundation) is complete;
NO implementations exist yet — only stubs.

CURRENT STATE (2026-07-09):
- 33 files total. 1 app (apps/web/ — no src/ dir), 5 packages
  (core-types, prompt-spec, agent-adapter, blueprint-registry,
  domain-models). Every package's src/index.ts is a stub (export {}).
- Toolchain: pnpm 9 workspaces + Turbo 2 + TypeScript 5.5 strict.
- pnpm install has NOT been run; no node_modules, no pnpm-lock.yaml.
- Zod ^3.23.0 declared as the only runtime dep (unused).
- No schemas, no routes, no DB, no tests, no CI.

PACKAGE BOUNDARIES (acyclic, core-types is leaf):
  web → {prompt-spec, agent-adapter, blueprint-registry, domain-models, core-types}
  agent-adapter → {prompt-spec, core-types}
  blueprint-registry → {domain-models, core-types}
  prompt-spec → {core-types}
  domain-models → {core-types}
  core-types → (none)

READ FIRST: CLAUDE.md → buildplan.md → README.md → package.json
READ WHEN IMPLEMENTING: docs/adr/0001, 0002, 0003 (in that order)
DO NOT TOUCH: turbo.json, tsconfig.base.json, pnpm-workspace.yaml,
              root package.json (structural — edits cascade widely)
NEXT PHASE: Phase 1 — Product Control Plane Foundation. Pick an ORM
(Drizzle vs Prisma) and DB (Neon vs local Postgres). Define first
control-plane Zod schemas in packages/core-types/src/schemas/.

CONTRACT-FIRST RULE: every new type/schema goes in @heynxt/core-types
first. Cross-package imports must use bare @heynxt/xxx, never
@heynxt/xxx/src/... or dist/.... Verify with pnpm typecheck before
claiming done.
```
