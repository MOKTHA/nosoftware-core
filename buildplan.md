# HeyNXT Core — Build Plan

## Objective

Build HeyNXT Core into a production-grade industrial AI app builder.

The platform combines:
- a coding-agent execution layer based on `vercel-labs/coding-agent-template`
- an industrial blueprint layer derived from `FactoryNXT_PY_v2_Extrusion` and `FactoryNxT_PY_V2`
- a product control plane implemented in heynxt-core

HeyNXT Core is the platform that converts industrial intent into structured specs, reusable blueprints, validated code changes, and deployable industrial applications.

---

## Source-of-Truth Repositories

### 1) Coding agent execution reference
- `https://github.com/vercel-labs/coding-agent-template`

Use this repo as the architectural reference for:
- coding task lifecycle
- sandbox execution model
- task progress tracking
- GitHub-backed implementation workflow
- multi-agent orchestration patterns
- persistent task state

Do not reimplement these primitives unless heynxt-core has a verified requirement that the template cannot satisfy.

### 2) Industrial blueprint references
- `https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion`
- `https://github.com/pskbmohan/FactoryNxT_PY_V2`

Use these repos as blueprint sources for:
- industrial entities (equipment, materials, process runs)
- MES workflows (work orders, serial numbers, operation transactions)
- role models (operator certifications, RBAC)
- operational dashboards (OEE, KPIs, Gantt)
- API/resource structures (Flask blueprints, JSON REST endpoints)
- work order, material, traceability, quality, maintenance, and production execution logic
- UI and backend service patterns where reusable

Do not invent generic replacements for verified industrial models that already exist in these repos.

### 3) Product platform repository
- `heynxt-core`

This repository is responsible for:
- product control plane
- prompt-to-spec engine
- blueprint registry
- generation orchestration
- validation and approval flows
- reusable industrial app builder UX

---

## Architecture Intent

HeyNXT Core is structured into three logical layers, each mapped to concrete workspace packages:

### A. Control Plane
Maps to: `apps/web` (UI), future `packages/control-plane` (services), `@heynxt/core-types` (schemas).

Owns:
- users, organizations, workspaces
- projects, tasks, artifacts
- blueprint registry, generation runs
- approvals, deployment metadata

### B. Agent Execution Adapter
Maps to: `packages/agent-adapter`

Owns:
- integration with coding-agent execution runtime
- task packaging and execution request format
- branch naming and task-to-commit traceability
- sandbox run requests
- logs and evidence capture
- status sync

This layer adapts ideas and patterns from `vercel-labs/coding-agent-template` (uniform agent contract, sandboxed execution, streaming output, session resumption).

### C. Industrial Blueprint Engine
Maps to: `packages/blueprint-registry`, `packages/domain-models`, `packages/prompt-spec`

Owns:
- industrial domain packs (entities, relationships, constraints)
- blueprint extraction from reference repos
- workflow templates (routings, setpoint profiles)
- entity dictionaries
- screen and API skeleton patterns
- process-specific generation rules

This layer is grounded in `FactoryNXT_PY_v2_Extrusion` (aluminum extrusion: billets, dies, setpoint profiles, heat temper programs) and `FactoryNxT_PY_V2` (PCB/electronics: stations, feeders, PCB traceability, operation execution).

---

## Implementation Phases

### Phase 0 — Multi-Repo Audit ✓ COMPLETE

**Status**: Complete as of 2026-07-09

**Goal**: Understand the real starting point across all referenced repos and establish the foundation.

#### Completed Deliverables

**Foundation (monorepo scaffolding):**
- pnpm workspaces + Turbo orchestration
- Package boundaries: `core-types`, `domain-models`, `blueprint-registry`, `prompt-spec`, `agent-adapter`, `apps/web`
- TypeScript configuration across all packages (strict mode, ES2022)
- Documentation, ADRs, environment templates, Claude configuration

**Repository Audits (research-completed):**
- heynxt-core structure — foundation complete, packages scaffolded
- `vercel-labs/coding-agent-template` — architecture documented
  - Adapter pattern with uniform `executeAgentInSandbox` contract
  - `AgentType`: claude / codex / copilot / cursor / gemini / opencode
  - Sandboxed execution in Vercel Sandbox, streaming JSON stdout to `taskMessages` DB table
  - Per-user encrypted API keys, Next.js `after()` for background orchestration
  - Resumable sessions via `--resume <sessionId>`
  - Stack: Next.js 16, AI SDK 5, Drizzle + Neon Postgres, Vercel Sandbox, OAuth via arctic
- `FactoryNXT_PY_v2_Extrusion` — architecture documented
  - Flask 3.0 + SQLAlchemy + PostgreSQL, ~101 domain models across 3 files
  - Extrusion domain: Billets, Dies (lifecycle), SetpointProfiles, HeatTreatmentPrograms, ProcessRuns, OEE
  - APS engine with finite-capacity scheduling (1300-line deterministic greedy scheduler)
  - Visual routing builder (DAG), WorkOrderRoutingSnapshot (immutability pattern)
  - ERP adapter, PLC adapter, KPI engine, process simulator services
- `FactoryNxT_PY_V2` — architecture documented
  - Flask 3.0 + SQLAlchemy, ~55 domain models
  - PCB/electronics domain: SmtLine, FeederReel, Stencil, PcbPanel/Board, Genealogy
  - Operation execution engine (barcode-scan station model, enforces routing order)
  - Work order lifecycle (DRAFT → RELEASED → RUNNING → COMPLETED)
  - Visual routing builder identical in pattern to extrusion version

#### Cross-Repo Reuse Matrix

| Pattern / Component | heynxt-core | Vercel template | FactoryNXT Extrusion | FactoryNXT V2 | Disposition |
|---|---|---|---|---|---|
| Monorepo task orchestration | Yes | Yes (mono-repo Next.js app) | No | No | Adopt Turbo/pnpm from heynxt-core |
| Uniform agent contract | No | Yes | No | No | Adapt from Vercel template |
| Sandboxed execution | No | Yes (Vercel Sandbox) | No | No | Adopt; abstract behind interface |
| Streaming JSON stdout | No | Yes | No | No | Adopt for progress tracking |
| Session resumption | No | Yes (`--resume`) | No | No | Adopt for long-running tasks |
| Blueprint definition | No | N/A | SetpointProfile, HeatTreatmentProgram, RoutingMaster | Same | Extract and normalize |
| Work order lifecycle | No | N/A | WorkOrder status FSM | WorkOrder FSM | Adopt as reference model |
| Operation execution engine | No | N/A | Enforces routing order | Barcode-scan + routing | Adapt for validation layer |
| OEE / KPI calculation | No | N/A | KPIEngine | OeeSnapshot | Adopt model, reimplement |
| APS scheduling | No | N/A | ApsEngine | ScheduleOptimizer | Reference only initially |
| Industrial entity models | No | N/A | ~101 classes | ~55 classes | Extract, normalize, reuse via Zod schemas |
| Traceability / genealogy | No | N/A | GenealogyEvent, PcbPanel/Board | TraceabilityRecord | Extract as blueprint family |

#### Gaps Documented
- Core-types schemas are stubs — need Zod schema definitions (absorbed into Phases 1 and 3).
- No database / ORM yet — required for control plane entities in Phase 1.
- No agent runtime implementation — Phase 2 will implement against Vercel patterns.
- No blueprint extraction — Phase 3 will formalize the reference patterns into registry entries.
- No prompt-to-spec parsing — Phase 4.
- No governance, audit trail, or tenant isolation — Phase 9.

#### Exit Criteria
- [x] Architecture audit completed for all 4 repos
- [x] Reuse matrix completed
- [x] Gaps documented
- [x] Implementation plan (this document) revised to reflect real architecture

#### Files Changed
- Root scaffolding: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `tsconfig.json`
- Documentation: `README.md`, `CLAUDE.md`, `buildplan.md`, `FOUNDATION.md`
- Architecture: `docs/architecture/overview.md`, `docs/adr/0001-monorepo-and-boundaries.md`, `docs/adr/0002-agent-substrate.md`, `docs/adr/0003-industrial-blueprint-sources.md`
- Packages: 5 packages scaffolded (`core-types`, `prompt-spec`, `agent-adapter`, `blueprint-registry`, `domain-models`)
- App boundary: `apps/web` scaffolded (Next.js placeholder)
- Configuration: `.env.example`, `.gitignore`, `.claude/settings.json`

---

### Phase 1 — Product Control Plane Foundation

**Goal**: Build the HeyNXT control plane with users, orgs, workspaces, projects, tasks, artifacts, approvals, and generation runs.

#### Scope

Control plane entities and data model:
- users, organizations, workspaces
- projects, tasks, artifacts
- blueprint references per project/task
- generation runs (each task produces 0..N runs)
- activity log
- status model (draft, running, completed, failed)
- basic RBAC (owner, editor, viewer per workspace)

Database and API:
- Choose ORM (Drizzle recommended — matches Vercel template pattern, or Prisma — more mature with Next.js)
- Choose database (Postgres, Neon serverless matches Vercel template; or local Postgres for dev)
- Expose REST or tRPC API surface for the UI
- Implement migrations

Schemas:
- Define core Zod schemas in `packages/core-types/src/schemas/` for:
  - `user.ts` — User, Organization, Workspace
  - `project.ts` — Project, ProjectStatus
  - `task.ts` — Task, TaskStatus (draft / queued / running / succeeded / failed)
  - `artifact.ts` — Artifact (output files, logs, diffs)
  - `generation-run.ts` — GenerationRun (ties a task to a set of artifacts)
  - `rbac.ts` — Role, Permission

UI scaffolding:
- Complete `apps/web` Next.js setup with auth (OAuth provider — GitHub and/or Vercel, following Vercel pattern)
- Implement basic navigation, settings, workspace switcher
- Implement project list / project detail views
- Implement task list (initially no generation — just CRUD)

#### Dependencies
- Phase 0 complete
- Decision: ORM and database selection

#### Exit Criteria
- [ ] A workspace can be created and a user invited
- [ ] A project can be created within a workspace
- [ ] A task can be created and assigned to a project
- [ ] A generation run can be tracked (initial status only — actual execution in Phase 2)
- [ ] An artifact can be attached to a project/task/generation-run
- [ ] Activity log records state transitions per entity
- [ ] Basic RBAC gates access (owner/editor/viewer)
- [ ] Migrations are repeatable and reversible
- [ ] Lint, typecheck, and build pass in CI

#### Risks
- ORM choice will affect all downstream phases — decide in week 1 and stick with it.
- Auth complexity (OAuth + multi-tenant) can balloon — start with single-provider, single-tenant; expand in Phase 9.

**Duration estimate**: 3–4 weeks

---

### Phase 2 — Agent Execution Integration

**Goal**: Integrate or adapt the coding-agent runtime pattern from `vercel-labs/coding-agent-template`.

#### Scope

Schemas in `packages/core-types/src/schemas/agent-spec.ts`:
- `AgentSpec` — agent type, model, execution config, tool permissions
- `AgentExecutionResult` — success, output, agentResponse, cliName, changesDetected, sessionId, error
- `ExecutionConfig` — timeout, sandbox image, resources, keepAlive
- `TaskPayload` — task packaged for agent execution (prompt, spec, blueprint context)

Adapter in `packages/agent-adapter/src/`:
- `runtime.ts` — `AgentRuntime` interface (spawn, execute, monitor, collect)
- `vercel-sdk.ts` (or equivalent) — integration with Vercel AI SDK or direct agent CLI
- `sandbox.ts` — sandbox creation and lifecycle management
- `results.ts` — result collection and artifact bundling
- `errors.ts` — retry, timeout, cancellation
- `monitor.ts` — streaming progress, JSON stdout parsing, real-time UI updates
- Per-agent adapters (claude, codex, cursor) following the uniform-contract pattern

Orchestration:
- `POST /api/tasks/:id/execute` — accepts task, packages payload, invokes sandbox, streams status
- Background execution via Next.js `after()` or equivalent (decouple HTTP response from long-running work)
- Branch-per-task conventions: generate branch name via AI (or deterministic slug), push artifacts as commit
- Status sync: task status transitions (queued → running → succeeded | failed)
- Persist evidence: logs, diffs, terminal output, artifact list

Git-backed change flow:
- Each generation run produces a commit on an AI-named branch
- Evidence includes: spec version, blueprint versions, agent logs, diff, test results
- Task-to-commit traceability recorded in generation_run metadata

#### Dependencies
- Phase 1 (task model exists)
- Decision: sandbox runtime (Vercel Sandbox, Docker, or similar)

#### Exit Criteria
- [ ] A task can be submitted to the execution layer
- [ ] Task state transitions are observable in heynxt-core (status sync works)
- [ ] Evidence and logs are persisted (streaming capture functional)
- [ ] Git-backed change flow is modeled: branch-per-task with commit metadata
- [ ] At least one agent backend (Claude via Anthropic API or Vercel AI Gateway) is working end-to-end
- [ ] Failure paths produce actionable error messages and artifacts
- [ ] Lint, typecheck, and tests (including adapter-level tests) pass

#### Risks
- Sandbox runtime choice (Vercel Sandbox vs. Docker vs. cloud) affects deployment model — decide early.
- Streaming JSON parsing is subtle — unit test the parser thoroughly.

**Duration estimate**: 3–4 weeks

---

### Phase 3 — Industrial Blueprint Extraction

**Goal**: Convert the two FactoryNXT repos into reusable industrial blueprint assets.

#### Blueprint Extraction Targets

Entity models (Zod schemas in `packages/domain-models/`):
- Equipment: Machine, Station, Line, Cell, Die, Billet
- Process: Recipe, WorkflowStep, SetpointProfile, HeatTreatmentProgram, ProcessRun
- Material: RawMaterial, Intermediate, FinishedGood, AlloyComposition, FeederReel, Stencil
- Quality: InspectionPlan, Measurement, Tolerance, DefectRecord, NCR, CAPA
- Production: WorkOrder, SerialNumber, OperationTransaction, RoutingStep, RoutingMaster
- Traceability: PcbPanel, PcbBoard, GenealogyEvent, TraceabilityRecord, RepairRecord
- Reliability: PmSchedule, MaintenanceLog, CalibrationRecord, DowntimeEvent, OeeSnapshot

Registry in `packages/blueprint-registry/`:
- Blueprint metadata schema (name, version, description, source, domain, tags)
- Blueprint loader (from local FactoryNXT repo paths or remote)
- Blueprint catalog (search, filter, list, paginate, sort)
- Blueprint validator (against core-types schemas)
- Version management (history, compatibility matrix, upgrade paths)

#### Initial Blueprint Families

- Extrusion operations (aluminum extrusion: billets → dies → pressing → quench → cut → finish)
- Production execution (work orders, operation transactions, serial numbering)
- Quality workflows (inspection, NCR, CAPA, golden boards, AQL sampling)
- Maintenance orchestration (PM schedules, calibration, repair)
- Downtime / incident handling (downtime events, OEE loss buckets, alerts)
- Traceability / genealogy (component placement, lot tracking, genealogy events)
- Work order and materials (WO lifecycle, BOM, inventory, kitting)

#### Dependencies
- Phase 1 (control plane for persisting blueprint metadata)
- Phase 1 core-types schemas (Blueprint, DomainEntity)

#### Exit Criteria
- [ ] Blueprint registry exists with working loader, catalog, validator, and versioning
- [ ] Blueprint metadata is versioned (semantic versioning with source commit hash)
- [ ] At least 2 blueprint families are extracted and normalized
- [ ] Registry can load blueprints from FactoryNXT repositories (local path config)
- [ ] Validation catches invalid blueprints with clear error messages
- [ ] Example blueprint instances for testing (1 per family, minimal)
- [ ] Registry exports are consumed by prompt-spec (Phase 4)

#### Risks
- Extrusion and PCB domains have overlapping concepts with divergent semantics — extract carefully, document differences.
- Reference repos use Flask/SQLAlchemy patterns that don't map 1:1 to TypeScript Zod — extract semantics, not code.

**Duration estimate**: 3–4 weeks

---

### Phase 4 — Prompt-to-Spec Engine

**Goal**: Turn user prompts into structured app specifications.

#### Scope

Schemas in `packages/core-types/src/schemas/prompt-spec.ts`:
- `PromptSpec` — prompt text + context + constraints
- `PromptContext` — domain, persona, blueprint hints, existing project context
- `SpecTemplate` — structured output: app type, domain, personas, entities, workflows, screens, APIs, KPIs, integrations, audit requirements, deployment profile

Prompt parsing in `packages/prompt-spec/src/`:
- `parser.ts` — parse natural-language prompt, extract intent and context keywords
- `generator.ts` — generate `SpecTemplate` from parsed prompt, selects blueprint candidates
- `validation.ts` — structural and semantic validation (missing fields, inconsistencies, feasibility)
- `template.ts` — spec templates, parameter substitution, constraint injection
- `integration.ts` — integrate with blueprint-registry for blueprint selection, domain-models for entity resolution

LLM integration:
- Use LLM (Claude/GPT via Vercel AI SDK or direct API) to assist prompt parsing and spec synthesis
- Structured output mode (JSON schema enforced) to ensure spec is parseable
- Prompt engineering + guardrails for industrial-domain accuracy
- Fallback to structured-input mode when NL is ambiguous

#### Dependencies
- Phase 1 (control plane for specs)
- Phase 3 (blueprint registry and domain models available for selection)

#### Exit Criteria
- [ ] Prompt produces a persisted versioned spec
- [ ] Spec can reference extracted blueprints (from Phase 3 registry)
- [ ] Invalid or incomplete specs surface clear errors (validation layer works)
- [ ] LLM-assisted parsing produces valid `SpecTemplate` instances for ≥5 representative prompts
- [ ] Spec can be previewed and edited in a form before commit
- [ ] Spec generation is idempotent (same prompt + same context → same spec hash)
- [ ] End-to-end test: prompt → parsed → spec → validated → persisted

#### Risks
- LLM parsing accuracy varies — mitigate with structured schemas, validation, and user review loop.
- Industrial domain vocabulary requires curated prompt engineering — document edge cases.

**Duration estimate**: 2–3 weeks

---

### Phase 5 — Blueprint Selection and Composition

**Goal**: Map specs to one or more industrial blueprints deterministically.

#### Scope

Composition logic in `packages/blueprint-registry/src/composition.ts`:
- Choose one base blueprint (primary domain match)
- Compose optional module blueprints (add-ons that extend the base)
- Attach role pack (personas / RBAC variant)
- Attach KPI pack (dashboards / metrics)
- Attach connector pack (ERP / PLC / external integrations)
- Attach approval/audit pack (governance overlay)

Composition rules:
- Deterministic: spec inputs + registry state → deterministic blueprint plan (same input → same output)
- Explainable: each blueprint addition includes a reason (e.g., "added quality NCR pack because spec includes 'quality inspection' requirement")
- Versioned: blueprint plan version tied to registry versions at time of composition

Selection algorithm:
- Match spec domain keywords against blueprint metadata tags
- Weight by blueprint compatibility
- Rank candidates, surface top-N for user confirmation
- Allow manual override with audit-trail record

#### Dependencies
- Phase 3 (blueprints are cataloged and versioned)
- Phase 4 (specs exist to match against)

#### Exit Criteria
- [ ] A spec resolves to a deterministic blueprint plan
- [ ] Blueprint composition is explainable (each blueprint inclusion has a reason)
- [ ] Composition is versioned (plan references registry snapshot)
- [ ] Manual override records the rationale
- [ ] Unit tests cover ≥5 spec → blueprint-plan resolutions
- [ ] Performance: composition completes in <2s for registry sizes up to 100 blueprints

#### Risks
- Keyword-based matching is brittle — consider LLM-assisted matching with validation.
- Composition combinatorics grow — bound the pack combinations supported in v1.

**Duration estimate**: 2–3 weeks

---

### Phase 6 — Generation Pipeline

**Goal**: Produce implementation-ready outputs from spec + blueprint plan.

#### Scope

Generation stages (each produces one artifact family):
1. Normalize spec — canonical spec form, resolved references
2. Resolve blueprint composition — final blueprint plan snapshot
3. Generate schema — database schema (migrations), TS types, API contracts
4. Generate permissions and roles — RBAC definitions, role-based access rules
5. Generate backend modules — routes, services, repositories, models
6. Generate frontend modules — pages, components, forms, lists
7. Generate workflows — workflow definitions (state machines, automations)
8. Generate fixtures/tests — seed data, unit tests, integration tests
9. Generate deployment metadata — Dockerfile, environment config, health checks

Pipeline orchestration in `packages/agent-adapter/src/generation-pipeline.ts`:
- Each stage is a deterministic transform (spec + blueprint → artifact)
- Each stage can optionally invoke an agent (LLM) for generative parts
- Deterministic scaffolding (templates) + LLM-fleshed logic (where patterns vary)
- Each stage's output is traceable (stage name, input hash, output artifact hash)

Output format:
- Each stage produces one or more artifacts (files, code, configs)
- Artifacts are attached to the generation run in control plane
- Diff view for each artifact (what was produced vs. previous version)

#### Dependencies
- Phase 4 (spec is well-formed)
- Phase 5 (blueprint plan is resolved)
- Phase 2 (agent execution handles generative stages)

#### Exit Criteria
- [ ] One blueprint path generates a runnable slice (a real, testable app output)
- [ ] Outputs are traceable to spec and blueprint versions (lineage preserved)
- [ ] Pipeline is re-runnable (idempotent given same inputs)
- [ ] Each stage is individually testable (unit tests on stage transforms)
- [ ] End-to-end: prompt → spec → blueprint plan → generated app with tests

#### Risks
- Generative stages are non-deterministic — mitigate with snapshot versioning and test harness.
- Quality of generated code depends heavily on blueprint quality — Phase 3 blueprint extraction is critical.

**Duration estimate**: 4–6 weeks

---

### Phase 7 — Validation and Review Loop

**Goal**: Prove the generated result works before promoting it.

#### Scope

Automated validation checks:
- Lint (ESLint, formatting)
- Typecheck (TypeScript strict)
- Tests (unit, integration, smoke)
- Migrations (apply and rollback cleanly)
- Build (production build succeeds)
- Route smoke tests (every generated route returns expected status)
- API smoke tests (generated API endpoints respond correctly)
- Permissions checks (role-based access enforced)

Review flow:
- Generated change creates a pull request (or diff) with evidence
- Evidence includes: all check results, spec version, blueprint plan version, agent logs
- Review loop: reviewer approves → merges; reviewer rejects → triggers re-run with feedback
- Reruns are possible with same inputs or with modified spec
- Re-run produces new evidence set (no stale evidence allowed in promotion)

Evidence capture (ties to Phase 2):
- Persist validation logs, diffs, screenshots, test reports as artifacts
- Evidence is immutable once attached to a generation run

#### Dependencies
- Phase 6 (something to validate)
- Phase 2 (agent runtime for re-runs)

#### Exit Criteria
- [ ] Generated changes have evidence (logs, test results, screenshots)
- [ ] Failed checks block promotion (no bypass without override flag + reason)
- [ ] Reruns are possible with and without feedback
- [ ] Re-run produces fresh evidence (no stale artifacts)
- [ ] PR creation is automated with evidence attached as comments
- [ ] ≥95% of generated outputs pass validation on first run (track via metrics)

#### Risks
- Validation strictness vs. speed tradeoff — tune thresholds per project maturity.
- False-positive failures will erode trust — track and minimize via Phase 9.

**Duration estimate**: 2–3 weeks

---

### Phase 8 — Industrial Runtime Services

**Goal**: Support long-running industrial logic that should not live only in generation or UI.

#### Scope

Runtime services (implemented as separate packages or in `apps/services`):
- **Workflow engine** — execute state machines for generated workflow definitions (work order FSM, routing FSM, approval FSM)
- **Event ingestion** — accept PLC signals, barcode scans, sensor data, external events
- **Rules engine** — evaluate business rules at runtime (e.g., "billet temperature out of range → alert")
- **File/evidence service** — persist and serve artifacts, logs, attachments
- **Notification service** — email, Slack, webhook notifications for approvals, failures, KPI thresholds
- **Scheduler** — cron-like jobs, recurring validations, KPI aggregation jobs
- **KPI aggregation** — compute OEE, throughput, quality rate from event stream

Service contracts (in `packages/core-types`):
- Define service interfaces so generated apps and runtime services speak the same schema language
- Runtime services are optional — some generated apps won't need them

#### Dependencies
- Phase 1 (control plane for runtime config)
- Phase 6 (generated apps rely on durable runtime services)

#### Exit Criteria
- [ ] Generated apps can rely on durable runtime services (workflow, event, rules, files, notifications)
- [ ] Industrial workflows (e.g., work order lifecycle) are not trapped inside frontend code
- [ ] Runtime services are independently testable and observable
- [ ] Event ingestion supports ≥100 events/sec with durable persistence
- [ ] Workflow engine executes deterministic state transitions with audit trail

#### Risks
- Runtime services add operational complexity — keep v1 narrow to what generated apps actually need.
- Service coupling risks — each service must be independently deployable.

**Duration estimate**: 4–6 weeks

---

### Phase 9 — Governance and Hardening

**Goal**: Make the platform safe for internal and pilot production use.

#### Scope

Tenant isolation:
- Enforce workspace-scoped data access everywhere
- Audit all cross-workspace queries
- Ensure data leakage is impossible between workspaces

Approvals:
- Explicit approval requirement for: generated apps promoted to production, blueprint modifications, spec changes with material impact
- Approver must be in a role with `approve` permission

Audit logs:
- Immutable append-only logs for all state-changing operations (user, timestamp, action, before/after values)
- Searchable via API and UI
- Retention policy documented

Secret boundaries:
- Secrets (API keys, DB credentials) stored in a secrets manager (not in env files or code)
- Per-workspace secret scopes (secrets don't leak across workspaces)
- Secret rotation support

Quotas:
- Per-tenant quotas: agent runs per day, storage, compute time
- Soft and hard limits with notifications
- Quota override requires admin approval

Observability:
- Structured logging everywhere (JSON, request-correlated)
- Metrics (Prometheus-style) for: agent run success rate, generation latency, validation pass rate
- Distributed tracing across services and agent runs
- Dashboards for ops and tenant health

Rollback:
- Every generated app has rollback points (snapshot per generation run)
- Rollback is a one-click operation with audit trail recording

#### Dependencies
- Phases 1–8 (everything hardened)

#### Exit Criteria
- [ ] Pilot-safe operating model exists (security review + runbook)
- [ ] Audit trail captures all state-changing operations
- [ ] Approvals are explicit and recorded in audit log
- [ ] Secrets are not stored in code or env files
- [ ] Quotas enforced (over-usage triggers notifications and then blocks)
- [ ] Observability shows real-time platform health
- [ ] Rollback tested: one generation run rollbacked without data loss

#### Risks
- Governance can slow development — pilot with minimal governance, then scale.
- Secret management adds deployment complexity — decide on provider early.

**Duration estimate**: 3–4 weeks

---

## Definition of Done

A phase is complete only when **all** of the following are true:

| Evidence | Description |
|---|---|
| Implementation exists | Code is merged to main branch |
| Verification commands are run | `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` all pass |
| Evidence is captured | Test output, logs, screenshots, or other proof attached to PR or stored in artifact storage |
| Changed files are listed | PR description lists changed files with brief rationale |
| Risks are documented | Any new risks or tradeoffs are documented in the PR or in a follow-up ADR |

Per-phase exit criteria (listed in Phase section) must **also** be satisfied. A phase with all checkboxes unchecked is not done, even if Definition of Done items pass.

---

## Summary

**Total Estimated Duration**: 27–41 weeks for full implementation

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

**Parallelizable Work**:
- Phase 3 (blueprints) and Phase 2 (agent execution) can overlap partially with Phase 1 (control plane) after the data model stabilizes
- Phase 8 (runtime services) can overlap with Phase 7 (validation)
- Phase 9 (governance) can begin early as a parallel stream that matures through each phase

**Next Task**: Phase 1 — Product Control Plane Foundation
- First concrete step: choose ORM (Drizzle or Prisma) and database (Neon serverless or local Postgres).
- Then: define control-plane Zod schemas in `packages/core-types/src/schemas/` (`user.ts`, `project.ts`, `task.ts`, `artifact.ts`, `generation-run.ts`, `rbac.ts`).
- Then: implement control-plane API routes and Next.js UI in `apps/web`.
