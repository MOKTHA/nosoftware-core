# HeyNXT Core — Gap Analysis (Post-Audit)

**Date**: 2026-07-09
**Input**: graphify reports for all 4 repos (heynxt-core, FactoryNXT_PY_v2_Extrusion, FactoryNXT_PY_V2, coding-agent-template)
**Purpose**: Identify the gap between current state and target capabilities, then propose the smallest enabling slice.

---

## 1. Current State (from `graphify/heynxt-core/`)

| Concern | State |
|---|---|
| Monorepo scaffold | ✅ pnpm + Turbo + TypeScript config committed |
| Package boundaries | ✅ 5 packages + 1 app, acyclic dep graph |
| Schemas (`@heynxt/core-types`) | ❌ empty stub — `export {};` |
| Domain models | ❌ empty stub |
| Blueprint registry | ❌ empty stub |
| Prompt spec | ❌ empty stub |
| Agent adapter | ❌ empty stub |
| Web app source | ❌ `apps/web/src/` **does not exist** |
| Dependencies installed | ❌ `pnpm install` never run; no lockfile |
| Database / ORM | ❌ not chosen |
| Auth / RBAC | ❌ not implemented |
| Test / CI | ❌ none |
| Business logic | ❌ none |

**Verdict**: repo is scaffolding only. No runtime capability. Phase 0 audit is complete; implementation starts from zero.

---

## 2. Reference Repo Synthesis (from graphify reports)

### What `coding-agent-template` offers (agent execution substrate)

Already-implemented patterns that heynxt-core should **adapt, not rebuild**:

| Pattern | File / Location | Relevance to heynxt-core |
|---|---|---|
| Dispatcher + uniform `AgentExecutionResult` contract | `lib/sandbox/agents/index.ts` | Adopt for `@heynxt/agent-adapter` dispatcher |
| 6 agent adapters (claude/codex/copilot/cursor/gemini/opencode) | `lib/sandbox/agents/*.ts` | Each adapter's pattern is reusable — add industrial-specific adapters later |
| Streaming JSON stdout → DB row persistence | Writable chunk splitter with `drizzle.update({content: accumulated})` | Adopt for agent execution streaming capture |
| Background orchestration via Next.js `after()` | `app/api/tasks/route.ts` | Adopt for long-running sandbox work in heynxt-core's API layer |
| Session resumption via `sessionId` storage | stored on tasks row | Adopt for long-running generation runs |
| Per-user encrypted keys (AES-256-CBC) | `lib/crypto.ts` + `keys` table | Adopt pattern for user API-key management |
| Branch-per-task Git flow | `pushChangesToBranch` | Adopt for generated-app commit workflow |
| 7 DB tables (users, tasks, connectors, accounts, keys, taskMessages, settings) | `lib/db/schema.ts` | **Direct structural reference for heynxt-core's control plane** |

### What FactoryNXT_PY_v2_Extrusion offers (aluminum extrusion MES)

Already-implemented patterns that heynxt-core should **extract blueprints from**:

| Pattern | Model / File | Blueprint family to derive |
|---|---|---|
| Deterministic APS engine (30-min slot snapping, lock-preserved replan) | `app/services/aps_engine.py` | `aps-scheduling` blueprint pack |
| Die lifecycle FSM (22 states) | `app/models.py` → `Die` | `tool-lifecycle` blueprint pack |
| SetpointProfile (parameter bag keyed by alloy+process) | `SetpointProfile` | `process-recipe` blueprint pack |
| HeatTreatmentProgram (ordered stages JSON) | `HeatTreatmentProgram` | `heat-treatment` blueprint pack |
| RoutingMaster DAG + WorkOrderRoutingSnapshot | `models_routing.py` | `routing-dag` blueprint pack |
| ProcessRun (actuals vs setpoints) | `ProcessRun` | `process-execution` blueprint pack |
| OEE computation (A × P × Q) | KPIEngine | `oee` blueprint pack |
| ERPAdapter + PLCAdapter (integration pattern) | `services/erp_adapter.py`, `plc_adapter.py` | `erp-connector` / `plc-connector` packs |

### What FactoryNXT_PY_V2 offers (PCB/electronics MES)

| Pattern | Model / File | Blueprint family to derive |
|---|---|---|
| `scan_serial()` execution engine | `app/routes/operations.py` | `serial-execution` blueprint pack — **the textbook pattern** for validating routing order |
| WorkOrder FSM (DRAFT → RELEASED → RUNNING → COMPLETED) | `WorkOrder` | `work-order` blueprint pack |
| Barcode-scan-at-station traceability | `OperationTransaction`, `SerialNumber` | `operation-trace` blueprint pack |
| PCB genealogy (component-level, reel→feeder→board) | `GenealogyEvent`, `PcbPanel/Board` | `pcb-genealogy` blueprint pack |
| AQL inspection plans | `InspectionPlan` | `quality-inspection` blueprint pack |
| NCR/CAPA with root-cause | `NCR`, `Capa` | `quality-nonconformance` blueprint pack |
| OeeSnapshot (same formula as extrusion) | `OeeSnapshot` | `oee` blueprint pack (shared w/ extrusion) |

---

## 3. Reuse Matrix (summary; full version in `buildplan.md` Phase 0)

| From | To in heynxt-core | Disposition |
|---|---|---|
| Vercel template — dispatcher pattern | `packages/agent-adapter` | **Adopt verbatim** (adapt runtime only) |
| Vercel template — task/users/tasks/taskMessages schema shape | `packages/core-types` control plane schemas | **Adopt structure**, rename for industrial terminology |
| FactoryNXT models — every class in `models.py` | `packages/domain-models` | **Extract, normalize to Zod** |
| FactoryNXT state machines | `packages/blueprint-registry` workflow definitions | **Extract as blueprint packs** |
| FactoryNXT services (APS, ERP, PLC, KPI, simulator) | `packages/blueprint-registry` service packs + `runtime-services` (Phase 8) | **Extract logic, reimplement in TS** |
| heynxt-core scaffold | — | **Extend, don't rebuild** |

---

## 4. Gap Analysis — What's Missing Between Current State and Target

Gaps ordered by **unlocking value** (how much downstream work becomes possible):

### Gap 1: No installed dependencies — 🔴 BLOCKER
- `pnpm install` never run → no `node_modules/`, no lockfile
- **Impact**: Nothing compiles or runs. All downstream tasks blocked.
- **Close by**: `pnpm install`
- **Unlocks**: typecheck, build, test frameworks, ORM, DB

### Gap 2: No ORM / database choice — 🔴 BLOCKER for Phase 1
- Control plane entities (users, workspaces, projects, tasks, artifacts, generation runs) need persistence.
- **Impact**: Every Phase 1–9 capability blocked.
- **Decision needed**: Drizzle+Neon (matches Vercel template) vs. Prisma+Postgres (more mature, larger ecosystem).
- **Recommendation**: **Drizzle + Neon serverless** — the Vercel template's DB schema is directly mappable, the ORM patterns are identical, and this keeps cognitive cost low when building the agent-adapter in Phase 2. ADR to be created.
- **Unlocks**: Phase 1 control plane entities; Phase 2 task persistence; Phase 7 audit trails.

### Gap 3: No control-plane schemas — 🔴 BLOCKER for Phase 1
- `packages/core-types/src/schemas/` doesn't exist yet — all 5 packages are stubs.
- **Impact**: No shared vocabulary for downstream packages.
- **Minimum first cut**: `user.ts` (User, Organization, Workspace, Role) — the smallest set that makes everything downstream type-able.
- **Reference**: Vercel template's `users` + `accounts` tables provide the shape.
- **Unlocks**: RBAC in web; project/task creation; generation runs.

### Gap 4: No web app source — 🟡 Phase 6 blocker, not Phase 1
- `apps/web/src/` doesn't exist.
- **Defer** to Phase 6 when control plane entities are in place and need a UI.

### Gap 5: No agent adapter implementation — 🟡 Phase 2 blocker
- `packages/agent-adapter/` is an empty stub.
- **Defer** to Phase 2 after DB + control plane schemas.

### Gap 6: No blueprint extraction — 🟡 Phase 3 blocker
- `packages/blueprint-registry/` empty; `packages/domain-models/` empty.
- **Defer** to Phase 3 after control plane exists.

### Gap 7: No prompt-to-spec implementation — 🟡 Phase 4 blocker
- **Defer** to Phase 4.

### Gap 8: No generation pipeline, validation loop, runtime services, governance — 🟡 Phase 6–9 blockers
- All deferred.

---

## 5. Summary: Three Blockers, One Slice

The three blockers are **sequential**, not parallel:

1. **Install deps** — prerequisite for every subsequent line
2. **Choose ORM + DB** — ADR + configuration
3. **Define first control-plane schemas** — `User`, `Organization`, `Workspace`, `Role`

Closing these three gaps in one small slice unlocks **Phase 1 fully**, which unlocks Phases 2–9 downstream.

All other gaps (web UI, agent adapter, blueprint registry, prompt-to-spec, validation, runtime, governance) are deferred and will be closed in their respective buildplan phases.

---

## 6. Proposed Task 1

**Task 1 — Unblock the foundation: install deps, commit ORM/DB decision, define first control-plane schemas**

### Sub-tasks

1. **1a. ADR-0004: ORM and database choice** (`docs/adr/0004-orm-and-database.md`)
   - Decision: **Drizzle + Neon serverless** (matching Vercel template pattern, per hard rule #1)
   - Rationale: DB schema shape directly mappable from Vercel template's `users/tasks/connectors/accounts/keys/taskMessages/settings`; ORM patterns identical; reduces cognitive cost in Phase 2 when integrating agent-adapter
   - Alternative considered: Prisma + local Postgres (documented but rejected)

2. **1b. Install dependencies** — run `pnpm install` once at repo root
   - Verify: `pnpm-lock.yaml` created, `node_modules/` populated, `pnpm typecheck` passes across all packages (stubs typecheck cleanly because they currently just `export {};`)
   - Artifact: lockfile committed

3. **1c. Define first control-plane schemas** in `packages/core-types/src/schemas/`:
   - `user.ts` — `User` Zod schema
   - `organization.ts` — `Organization` Zod schema
   - `workspace.ts` — `Workspace` Zod schema
   - `rbac.ts` — `Role` and `Permission` Zod schemas + role→permission map
   - All four re-exported from `packages/core-types/src/index.ts`
   - TypeScript types inferred via `z.infer<typeof User>`

4. **1d. Verify everything compiles**
   - `pnpm typecheck` → PASS
   - `pnpm build` → PASS (core-types package produces `dist/` with `.js` + `.d.ts`)
   - Add minimal runtime test: instantiate one `User`, validate it
   - Evidence: command output pasted in task report

### Files Changed by Task 1
- `docs/adr/0004-orm-and-database.md` (new, ~100 lines)
- `pnpm-lock.yaml` (generated by `pnpm install`)
- `packages/core-types/src/schemas/user.ts` (new, ~40 lines)
- `packages/core-types/src/schemas/organization.ts` (new, ~30 lines)
- `packages/core-types/src/schemas/workspace.ts` (new, ~30 lines)
- `packages/core-types/src/schemas/rbac.ts` (new, ~40 lines)
- `packages/core-types/src/index.ts` (edit, re-export new schemas)
- `packages/core-types/src/__tests__/schemas.test.ts` (new, minimal runtime validation test)

### Commands Run
- `pnpm install`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test` (once vitest or similar is added; otherwise skip)

### Why This Slice
- **Smallest**: one ADR + one install + four ~30-line schemas
- **Unlocks the most**: closes all three blockers; enables Phase 1 to proceed with control plane entities (Project, Task, Artifact, GenerationRun in follow-ups)
- **Merge-safe**: no runtime behavior changes; scaffold-only additions
- **Follows hard rules**:
  - (1) doesn't rebuild coding-agent runtime
  - (2) doesn't invent industrial workflows
  - (3-5) audit-first (via graphify, already done)
  - (7) small
  - (8) extends foundation, doesn't replace

### Risks / Open Questions (requiring sign-off)
- **⚠️ ORM choice**: recommendation is Drizzle+Neon, but Prisma+Postgres is defensible. Sign-off needed.
- **⚠️ Schema naming**: `User`, `Organization`, `Workspace` vs. alternatives like `Account`, `Tenant`, `Project`. Vercel template uses `users`/`accounts`/`workspaces`. Sign-off needed on naming convention.
- **⚠️ Test framework**: Vitest is the natural choice (ESM-native, works with pnpm workspaces); Jest is heavier. Defer choice to Task 2 unless Task 1 validation is needed.
- **⚠️ `pnpm install` requires network + pnpm >=9 locally**: if this fails in the environment, document error and proceed with manual lockfile review.

---

## 7. Decision Required

Task 1 is blocked on **3 choices** that must be made explicitly rather than inferred:

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | ORM | Drizzle (+ Neon serverless) · Prisma (+ Postgres) | **Drizzle** (matches Vercel template) |
| 2 | Schema naming | `User` / `Organization` / `Workspace` · `Account` / `Tenant` / `Project` | **`User` / `Organization` / `Workspace`** (matches Vercel template's terminology) |
| 3 | Test framework | Vitest · Jest | **Vitest** (ESM-native, lighter) |

Once these three are confirmed, Task 1 can execute in a single merge-safe commit.
