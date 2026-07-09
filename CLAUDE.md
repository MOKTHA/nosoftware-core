# HeyNXT Core — Claude Instructions

## Repository Role

This repository is the **product and control plane** for an industrial AI app builder platform. It is the product control plane and orchestration layer, implemented as a monorepo with pnpm workspaces and Turbo for task orchestration.

It must integrate:
- coding-agent execution concepts from `vercel-labs/coding-agent-template`
- industrial blueprint concepts from `FactoryNXT_PY_v2_Extrusion`
- industrial blueprint concepts from `FactoryNxT_PY_V2`

**Do not treat heynxt-core as a greenfield app. Audit first.** The foundation is scaffolded (Phase 0 complete); implementation follows the phase plan in `buildplan.md`.

---

## External Reference Repositories

### 1) Coding agent execution reference
- `https://github.com/vercel-labs/coding-agent-template`

Use as reference for:
- task execution patterns and sandbox workflow
- uniform agent contract (one dispatcher switching on agent type)
- streaming JSON stdout capturing to persistent storage
- branch-per-task concepts and Git-backed implementation workflow
- task state and progress tracking, persistent run records
- session resumption for long-running agent work

Do not reimplement these primitives unless heynxt-core has a verified requirement the template cannot satisfy.

### 2) Industrial blueprint reference — aluminum extrusion
- `https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion`
- Local path: `/Users/pskbmohan/Documents/GitHub/FactoryNXT_PY_v2_Extrusion`

Use as reference for:
- Extrusion-specific entities: billets, dies (lifecycle), setpoint profiles, heat treatment programs, process runs
- APS engine scheduling patterns (finite-capacity, deterministic)
- Visual routing builder (DAG) + immutable `WorkOrderRoutingSnapshot` pattern
- Service adapters: ERP, PLC; engines: KPI, process simulator
- Quality, traceability, production, material, maintenance logic

### 3) Industrial blueprint reference — PCB/electronics MES
- `https://github.com/pskbmohan/FactoryNXT_PY_V2`
- Local path: `/Users/pskbmohan/Documents/GitHub/FactoryNXT_PY_V2`

Use as reference for:
- PCB/electronics entities: SMT line, feeder reels, stencils, PCB panels/boards, genealogy
- Operation execution engine (barcode-scan station, enforces routing order)
- Work order lifecycle FSM (DRAFT → RELEASED → RUNNING → COMPLETED)
- Quality (NCR, CAPA, inspection plans, AQL sampling, golden boards)
- Role-driven application behavior, operator certifications, audit log

**Do not invent generic replacements for industrial models that already exist in these repos.** Extract, normalize, and compose instead.

---

## Architecture Principles

1. **Layered Separation** — Control plane, agent adapter, blueprint registry, prompt-to-spec, and domain models are separate packages with explicit boundaries
2. **Contract-First** — All inter-package communication goes through Zod schemas defined in `@heynxt/core-types`
3. **Acyclic Dependencies** — Package dependency graph has no cycles; `core-types` is the leaf
4. **Type Safety** — TypeScript strict mode across all packages
5. **Audit Before Change** — Read relevant heynxt-core files first; check current state vs. target plan
6. **Reuse, Don't Rebuild** — Reuse patterns from Vercel template and FactoryNXT repos
7. **No Premature Implementation** — Follow the phase plan; smallest enabling task per step

---

## Priority Order

Work on heynxt-core follows this priority. Don't jump ahead without justification.

1. Repository audit (read first, understand current state)
2. Control plane entities (Phase 1 — product control plane foundation)
3. Agent execution integration (Phase 2)
4. Blueprint extraction registry (Phase 3)
5. Prompt-to-spec engine (Phase 4)
6. Blueprint selection and composition (Phase 5)
7. Generation pipeline (Phase 6)
8. Validation loop (Phase 7)
9. Industrial runtime services (Phase 8)
10. Governance and hardening (Phase 9)

See `buildplan.md` for the full phase breakdown with exit criteria.

---

## Work Order

For any significant task, do this in order:

1. **Read** the relevant heynxt-core files
2. **Read** the relevant reference repo patterns conceptually (Vercel template or FactoryNXT as appropriate)
3. **Compare** current repo state vs target plan (`buildplan.md` phase / exit criteria)
4. **Propose** the smallest enabling task
5. **Implement** within the appropriate package boundary
6. **Verify** with the relevant checks (`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`)
7. **Report** evidence (see Reporting Format below)

---

## Key Directories

```
apps/
  web/                    # Next.js control plane UI
packages/
  core-types/             # Shared Zod schemas and TypeScript types (leaf dependency)
  prompt-spec/            # Prompt-to-spec transformation logic
  agent-adapter/          # Coding agent execution adapter
  blueprint-registry/     # Industrial blueprint catalog
  domain-models/          # Industrial domain entities
docs/
  architecture/           # Architecture documentation (overview.md)
  adr/                    # Architecture Decision Records (0001-0003)
```

---

## Package Dependencies

```
@heynxt/web depends on:
  - @heynxt/core-types
  - @heynxt/prompt-spec
  - @heynxt/agent-adapter
  - @heynxt/blueprint-registry
  - @heynxt/domain-models

@heynxt/agent-adapter depends on:
  - @heynxt/core-types
  - @heynxt/prompt-spec

@heynxt/blueprint-registry depends on:
  - @heynxt/core-types
  - @heynxt/domain-models

@heynxt/prompt-spec depends on:
  - @heynxt/core-types

@heynxt/domain-models depends on:
  - @heynxt/core-types

@heynxt/core-types depends on:
  - (none — foundation package)
```

Rules:
- Cross-package imports go through public exports only (no internal path imports)
- No circular dependencies — enforced via TypeScript path resolution
- If adding a new schema, define it in `packages/core-types/src/schemas/` first

---

## Core Rules

**Do:**
- Extend the foundation — it was scaffolded deliberately
- Follow `TODO` markers in each package — they guide implementation order
- Follow the contract-first approach with Zod schemas
- Create ADRs in `docs/adr/` for architectural changes
- Implement within the appropriate package boundary
- Keep changes small, merge-safe, and verifiable
- Ask before making major architectural rewrites
- **Refresh the relevant graph in `graphify/<repo>/` after structural refactors, package moves, or major workflow additions** — re-run Graphify (or spawn a Graphify agent) so future sessions read an accurate map instead of stale architecture. Applies to heynxt-core and each reference repo. See `graphify/README.md` for refresh guidance.

**Do Not:**
- Rebuild the foundation from scratch
- Implement features outside their designated package
- Skip verification evidence (see Task Completion Standard)
- Treat heynxt-core as a greenfield app — audit first
- Reimplement patterns that already exist in the reference repos
- Reinvent generic replacements for verified industrial models
- Fabricate APIs, DB tables, env vars, or routes without file evidence
- Invent stack assumptions without file evidence

---

## Reporting Format

Every completed task should report:

```
### Task
<task name>

### Files Changed
- path/to/file1
- path/to/file2

### Commands Run
- pnpm typecheck
- pnpm build
- <other verification>

### Evidence
- <command output, test results, diffs, screenshots>

### Risks / Follow-ups
- <any known risks, open questions, or follow-up tasks>
```

---

## Safety Rules

- Never commit secrets or real credentials
- Never delete large working sections without explicit justification
- Never replace existing architecture only to match personal preference
- Never mark a task complete without verification evidence
- Never fabricate APIs, DB tables, env vars, or routes

---

## Industrial Focus

Domain vocabulary to use when naming things in `@heynxt/domain-models` and blueprints:

- plant
- line
- station
- asset
- operator
- supervisor
- technician
- work order
- execution step
- incident
- downtime
- defect
- CAPA (corrective and preventive action)
- lot / serial / genealogy
- maintenance
- audit event

Align with the entity names in the FactoryNXT reference repos to ease extraction and normalization. See `docs/adr/0003-industrial-blueprint-sources.md` for the full domain model extraction strategy.

---

## Read First If Present

Before touching the repository, read (in this order):

0. `graphify/README.md` — layout of knowledge graphs for this repo and references
1. `graphify/heynxt-core/GRAPH_REPORT.md` — structural map of this repo (paste its Session Memory block into your prompt before opening files)
2. `README.md` — project overview
3. `buildplan.md` — current phase and plan
4. `package.json` — workspace config and scripts
4. `pnpm-workspace.yaml` — package locations
5. `turbo.json` — task definitions
6. `tsconfig.base.json` — TypeScript config
7. `pyproject.toml` — (future: Python service config)
8. `docker-compose.yml` — (future: local dev services)
9. `vercel.json` — (future: production deployment)
10. `.env.example` — environment variables
11. `migrations/` — (future: database schema)
12. `packages/*/src/**/*.ts` — schema definitions
13. `apps/web/src/` — app entrypoints
14. `docs/` and `docs/adr/` — architecture documentation

---

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm build                # Build all packages
pnpm dev                  # Start all dev servers
pnpm lint                 # Lint all packages
pnpm typecheck            # Type-check all packages
pnpm test                 # Run tests (when implemented)
pnpm clean                # Clean build artifacts
```

---

## Reference Architecture Sources

1. **Coding Agent Substrate**: Vercel coding-agent-template
   - Provides agent execution patterns
   - See `docs/adr/0002-agent-substrate.md`

2. **Industrial Blueprints**: FactoryNXT repositories
   - FactoryNXT_PY_v2_Extrusion: Extrusion manufacturing domain
   - FactoryNxT_PY_V2: General industrial automation
   - See `docs/adr/0003-industrial-blueprint-sources.md`

3. **Monorepo Boundaries**: pnpm + Turbo
   - See `docs/adr/0001-monorepo-and-boundaries.md`

---

## Current Phase

**Phase 0 — Multi-Repo Audit** ✅ COMPLETE (2026-07-09)

Foundation is committed; reuse matrix documented; 9-phase revised buildplan published.

**Next**: Phase 1 — Product Control Plane Foundation
- First step: choose ORM (Drizzle vs. Prisma) and database (Neon serverless vs. local Postgres)
- Then: define control-plane Zod schemas in `packages/core-types/src/schemas/` (`user.ts`, `project.ts`, `task.ts`, `artifact.ts`, `generation-run.ts`, `rbac.ts`)
- Then: implement control-plane API routes and `apps/web` UI

See `buildplan.md` for full details.

---

## Task Completion Standard

A task is complete **only if** all of the following are true:

- The code exists (merged to main, not just "planned")
- The smallest relevant checks were run (`pnpm typecheck`, `pnpm lint`, relevant tests)
- Evidence was recorded (in the reporting format above)
- Remaining risks were stated (in "Risks / Follow-ups" section)

Per-phase exit criteria in `buildplan.md` must **also** be satisfied for phase-level work. A task with no evidence of verification is not complete, even if the code compiles.
