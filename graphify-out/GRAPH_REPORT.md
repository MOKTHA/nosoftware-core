# Graph Report - heynxt-core  (2026-07-12)

## Corpus Check
- 218 files · ~157,219 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2258 nodes · 3060 edges · 241 communities (144 shown, 97 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7a56f2ab`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
- errorResponse
- index.ts
- index.ts
- dependencies
- HeyNXT Core - Foundation Summary
- scripts
- scripts
- layout.tsx
- FactoryNXT_PY_V2 — Structural Knowledge Graph
- FactoryNXT_PY_v2_Extrusion — Structural Knowledge Graph
- index.ts
- ADR-0003: Industrial Blueprint Sources
- compilerOptions
- package.json
- compilerOptions
- 4. Gap Analysis — What's Missing Between Current State and Target
- Handover — Phase 3 COMPLETE sign-off
- package.json
- package.json
- ADR-0010: Blueprint Registry Architecture
- package.json
- package.json
- HeyNXT Core — Claude Instructions
- Graph Report — coding-agent-template
- workspace.ts
- LocalPathBlueprintLoader
- control-plane.test.ts
- blueprint.ts
- ADR-0001: Monorepo and Boundaries
- ADR-0004: ORM and Database Choice for Control Plane
- Architecture Overview
- page.tsx
- InMemoryBlueprintCatalog
- HeyNXT Core - Industrial AI App Builder Platform
- tsconfig.json
- API Contract
- ADR-0008 — Auth Library and OAuth Provider
- agent-spec.ts
- page.tsx
- Local Development Setup
- BlueprintValidatorImpl
- ADR-0009: Migrations — Forward-Only with Reset as Phase 1 Reversibility
- CompositeBlueprintLoader
- task-payload.ts
- tsconfig.json
- Decision
- page.tsx
- ADR-0002: Agent Substrate and Execution Model
- BlueprintCatalog
- task.ts
- auth.ts
- rbac.ts
- ADR-0006 — `createdBy` Session Sweep Plan
- ADR-0007 — Phase 1 UI Consolidation Pattern
- Graphify — Unified Repo Map
- tsconfig.json
- extracted-blueprints-example.ts
- tsconfig.json
- tsconfig.json
- tsconfig.json
- tsconfig.json
- ADR-0005 — Client Form Pattern (fetch + router.refresh)
- InMemoryBlueprintLoader
- generation-run.ts
- Phase 3 — Industrial Blueprint Extraction
- Phase 0 — Multi-Repo Audit ✓ COMPLETE
- local-path.ts
- audit-log.ts
- Implementation Phases
- Phase 1 — Product Control Plane Foundation
- Phase 2 — Agent Execution Integration
- Phase 4 — Prompt-to-Spec Engine
- Phase 5 — Blueprint Selection and Composition
- Phase 6 — Generation Pipeline
- Phase 7 — Validation and Review Loop
- Phase 8 — Industrial Runtime Services
- Phase 9 — Governance and Hardening
- Rationale
- @heynxt/persistence
- Source-of-Truth Repositories
- Architecture Intent
- First-Time Setup
- extrusion-blueprint.ts
- pcb-blueprint.ts
- next.config.mjs
- next-env.d.ts
- index.ts
- .claude/settings.json
- .env.example
- .gitignore
- CLAUDE.md
- FOUNDATION.md
- HANDOVER.md
- README.md
- apps/web
- apps/web/README.md
- apps/web/package.json
- apps/web/src/index.ts
- apps/web/tsconfig.json
- { GET, POST }
- buildplan.md
- docker-compose.yml
- docs/adr/0001-monorepo-and-boundaries.md
- docs/adr/0002-agent-substrate.md
- docs/adr/0003-industrial-blueprint-sources.md
- docs/adr/0004-orm-and-database.md
- docs/architecture/overview.md
- docs/dev-setup.md
- docs/gap-analysis.md
- package.json
- packages/agent-adapter/package.json
- packages/agent-adapter/src/index.ts
- packages/agent-adapter/tsconfig.json
- packages/blueprint-registry/package.json
- packages/blueprint-registry/src/index.ts
- packages/blueprint-registry/tsconfig.json
- packages/core-types/package.json
- packages/core-types/src/index.ts
- packages/core-types/src/schemas/artifact.ts
- packages/core-types/src/schemas/audit-log.ts
- packages/core-types/src/schemas/control-plane.test.ts
- packages/core-types/src/schemas/generation-run.ts
- packages/core-types/src/schemas/organization.ts
- packages/core-types/src/schemas/project.ts
- packages/core-types/src/schemas/rbac.ts
- packages/core-types/src/schemas/task.ts
- packages/core-types/src/schemas/user.ts
- packages/core-types/src/schemas/workspace.ts
- packages/core-types/tsconfig.json
- packages/core-types/vitest.config.ts
- packages/domain-models/package.json
- packages/domain-models/src/index.ts
- packages/domain-models/tsconfig.json
- packages/persistence/README.md
- packages/persistence/drizzle.config.ts
- packages/persistence/drizzle/0000_great_sunspot.sql
- packages/persistence/drizzle/meta
- packages/persistence/package.json
- packages/persistence/src/index.ts
- packages/persistence/src/schema/artifacts.ts
- packages/persistence/src/schema/audit-log.ts
- packages/persistence/src/schema/generation-runs.ts
- packages/persistence/src/schema/index.ts
- packages/persistence/src/schema/organizations.ts
- packages/persistence/src/schema/projects.ts
- packages/persistence/src/schema/role-assignments.ts
- packages/persistence/src/schema/tasks.ts
- packages/persistence/src/schema/users.ts
- packages/persistence/src/schema/workspaces.ts
- packages/persistence/tsconfig.json
- packages/persistence/vitest.config.ts
- packages/prompt-spec/package.json
- packages/prompt-spec/src/index.ts
- packages/prompt-spec/tsconfig.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- tsconfig.base.json
- tsconfig.json
- turbo.json
- validator.ts
- artifact.ts
- Architectural Layers
- workspace.ts
- Troubleshooting
- ValidateRoutesStage
- GenerateBackendStage
- GenerateFixturesTestsStage
- GenerateFrontendStage
- validation-stage.ts
- ValidateBuildStage
- DefaultPipelineBuilder
- GenerateWorkflowsStage
- ResolveBlueprintPlanStage
- ValidateTestsStage
- rbac.ts
- ValidateMigrationsStage
- route.ts
- Task P1-T1 — Phase 1: ORM + DB selection, ADR 0004
- Task P1-T2 — Phase 1: Zod schemas: user, org, workspace, project, task, artifact, generation-run, rbac
- Task P1-T3 — Phase 1: DB migrations + ORM layer
- Task P1-T4 — Phase 1: Control plane API routes (REST/tRPC)
- Task P1-T5 — Phase 1: Next.js auth + workspace UI
- Task P1-T6 — Phase 1: RBAC middleware + activity log
- Task P2-T1 — Phase 2: AgentSpec + AgentExecutionResult Zod schemas
- Task P2-T2 — Phase 2: AgentRuntime interface + Vercel AI SDK adapter
- Task P2-T3 — Phase 2: Sandbox lifecycle manager
- Task P2-T4 — Phase 2: Streaming JSON stdout parser + progress tracker
- Task P2-T5 — Phase 2: Branch-per-task Git flow + task-to-commit traceability
- Task P2-T6 — Phase 2: POST /api/tasks/:id/execute end-to-end wiring
- Task P3-T1 — Phase 3: domain-models: Equipment + Process Zod schemas
- Task P3-T2 — Phase 3: domain-models: Material + Quality + Production schemas
- Task P3-T3 — Phase 3: domain-models: Traceability + Reliability schemas
- Task P3-T4 — Phase 3: blueprint-registry: loader + catalog + validator
- Task P3-T5 — Phase 3: Blueprint family extraction: Extrusion + Production Execution
- Task P3-T6 — Phase 3: Blueprint family extraction: Quality + Maintenance + Traceability
- Task P4-T1 — Phase 4: PromptSpec + SpecTemplate Zod schemas
- Task P4-T2 — Phase 4: Prompt parser (NL → structured intent)
- Task P4-T3 — Phase 4: Spec generator (intent → SpecTemplate via LLM)
- Task P4-T4 — Phase 4: Spec validation + idempotency test
- Task P5-T1 — Phase 5: Blueprint selection algorithm (keyword → scored candidates)
- Task P5-T2 — Phase 5: Composition engine (base + module + role + KPI packs)
- Task P5-T3 — Phase 5: Versioned blueprint plan + manual override with audit trail
- Task P6-T1 — Phase 6: Generation pipeline orchestrator (9-stage runner)
- Task P6-T2 — Phase 6: Stage 1-3: Normalize spec + resolve blueprint + generate schema
- Task P6-T3 — Phase 6: Stage 4-6: Permissions + backend modules + frontend modules
- Task P6-T4 — Phase 6: Stage 7-9: Workflows + fixtures/tests + deployment metadata
- Task P6-T5 — Phase 6: End-to-end: prompt → generated runnable app slice
- Task P7-T1 — Phase 7: Automated validation suite (lint + typecheck + test + migrations + smoke)
- Task P7-T2 — Phase 7: PR creation automation with evidence attachment
- Task P7-T3 — Phase 7: Review loop: approve/reject → rerun with feedback
- Task P8-T1 — Phase 8: Workflow engine: state machine executor with audit trail
- Task P8-T2 — Phase 8: Event ingestion service (PLC signals, barcode scans, sensors)
- Task P8-T3 — Phase 8: Rules engine + KPI aggregation (OEE, throughput, quality rate)
- Task P8-T4 — Phase 8: Notification + scheduler services
- Task P9-T1 — Phase 9: Tenant isolation enforcement + workspace-scoped data access audit
- Task P9-T2 — Phase 9: Immutable audit log (all state-changing ops)
- Task P9-T3 — Phase 9: Secret management + per-workspace secret scopes
- Task P9-T4 — Phase 9: Quota enforcement + observability (Prometheus, Grafana, Loki)
- Task P9-T5 — Phase 9: Rollback system + one-click revert per generation run
- Task P9-T6 — Phase 9: Production readiness: security review + runbook + pilot sign-off
- 🎯 Key Design Decisions
- GenerationPipeline
- GeneratePermissionsStage
- NormalizeSpecStage
- ValidateLintStage
- ValidateTypeCheckStage
- POST
- HeyNXT Autonomous Loop Session
- 🚀 Getting Started
- 📚 Documentation Structure
- 📝 Notes
- generate_task_prompts.sh
- NextApiError

## God Nodes (most connected - your core abstractions)
1. `GenerationStageInput` - 28 edges
2. `errorResponse()` - 27 edges
3. `badRequest()` - 26 edges
4. `GenerationStage` - 23 edges
5. `ValidationStage` - 21 edges
6. `LocalPathBlueprintLoader` - 21 edges
7. `parseJsonBody()` - 20 edges
8. `insertAuditEntry()` - 19 edges
9. `requireAuth()` - 19 edges
10. `GenerationStageOutput` - 19 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --references--> `Invitation`  [EXTRACTED]
  apps/web/src/app/api/invitations/route.ts → packages/core-types/src/schemas/invitation.ts
- `POST()` --references--> `InviteUserInput`  [EXTRACTED]
  apps/web/src/app/api/invitations/route.ts → packages/core-types/src/schemas/invitation.ts
- `POST()` --references--> `CreateTaskPayloadInput`  [EXTRACTED]
  apps/web/src/app/api/tasks/[id]/execute/route.ts → packages/core-types/src/schemas/task-payload.ts
- `POST()` --references--> `CreateWorkspaceInput`  [EXTRACTED]
  apps/web/src/app/api/workspaces/route.ts → packages/core-types/src/schemas/workspace.ts
- `ProjectsPage()` --references--> `WorkspaceId`  [EXTRACTED]
  apps/web/src/app/projects/page.tsx → packages/core-types/src/schemas/workspace.ts

## Import Cycles
- None detected.

## Communities (241 total, 97 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.05
Nodes (68): AlloyGrade, BilletStatus, DieStatus, ExtrusionBillet, ExtrusionBilletId, ExtrusionDie, ExtrusionDieId, ExtrusionOeeSnapshot (+60 more)

### Community 1 - "errorResponse"
Cohesion: 0.16
Nodes (31): POST(), POST(), GET(), PATCH(), ADR-0006, POST(), ADR-0006, TODO: Stream events to client via SSE or store in DB (+23 more)

### Community 2 - "index.ts"
Cohesion: 0.08
Nodes (17): AgentRuntime, BaseAgentRuntime, EventEmitter, ExecutionContext, ExecutionHandle, ExecutionValidation, InMemoryEventEmitter, OutputEvent (+9 more)

### Community 3 - "index.ts"
Cohesion: 0.09
Nodes (43): createDb(), db, DbClient, getDb(), HeyNxtDb, accounts, agentExecutionResults, agentSpecs (+35 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (45): dependencies, @auth/drizzle-adapter, drizzle-orm, @heynxt/agent-adapter, @heynxt/blueprint-registry, @heynxt/core-types, @heynxt/domain-models, @heynxt/persistence (+37 more)

### Community 5 - "HeyNXT Core - Foundation Summary"
Cohesion: 0.11
Nodes (19): 🏗️ Architecture Summary, 📦 Created File Tree, Files Created, ✅ Foundation Complete, ✅ Foundation Verification Checklist, HeyNXT Core - Foundation Summary, 📖 Key Principles, Layer Responsibilities (+11 more)

### Community 6 - "scripts"
Cohesion: 0.05
Nodes (36): author, description, devDependencies, turbo, typescript, engines, node, pnpm (+28 more)

### Community 7 - "scripts"
Cohesion: 0.06
Nodes (34): drizzle-kit, dependencies, drizzle-orm, @heynxt/core-types, postgres, devDependencies, drizzle-kit, typescript (+26 more)

### Community 8 - "layout.tsx"
Cohesion: 0.07
Nodes (29): metadata, RootLayout(), initialsFor(), SessionUser, UserMenu(), UserMenuProps, ^build, .env (+21 more)

### Community 9 - "FactoryNXT_PY_V2 — Structural Knowledge Graph"
Cohesion: 0.06
Nodes (32): API Boundaries, `app/routes/integrations.py` — ERP Adapter Patterns, `app/routes/operations.py` — Execution Engine, `app/routes/production.py` — Gantt Scheduler, Edit with Caution, Entry Points, FactoryNXT_PY_V2 — Structural Knowledge Graph, Governance (+24 more)

### Community 10 - "FactoryNXT_PY_v2_Extrusion — Structural Knowledge Graph"
Cohesion: 0.07
Nodes (28): API Boundaries, Edit with Caution, Entry Points, Extrusion Add-on — APS (`models_aps.py`), Extrusion Core — Admin / User / Misc, Extrusion Core — Equipment, Extrusion Core — Integration, Extrusion Core — KPI / Alert (+20 more)

### Community 11 - "index.ts"
Cohesion: 0.14
Nodes (12): BlueprintDomain, BlueprintFamily, BlueprintFilter, BlueprintPagination, BlueprintSort, BlueprintTag, CatalogQueryResult, createEmptyCatalog() (+4 more)

### Community 12 - "ADR-0003: Industrial Blueprint Sources"
Cohesion: 0.07
Nodes (27): ADR-0003: Industrial Blueprint Sources, Blueprint Extraction Strategy, Blueprint Schema Design, Consequences, Context, Decision, Domain Model Derivation, FactoryNXT_PY_v2_Extrusion (Aluminum Extrusion) (+19 more)

### Community 13 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+18 more)

### Community 14 - "package.json"
Cohesion: 0.07
Nodes (28): dependencies, @heynxt/core-types, @heynxt/domain-models, zod, devDependencies, tsx, @types/node, typescript (+20 more)

### Community 15 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowJs, incremental, jsx, lib, module, moduleResolution, noEmit (+16 more)

### Community 16 - "4. Gap Analysis — What's Missing Between Current State and Target"
Cohesion: 0.08
Nodes (24): 1. Current State (from `graphify/heynxt-core/`), 2. Reference Repo Synthesis (from graphify reports), 3. Reuse Matrix (summary; full version in `buildplan.md` Phase 0), 4. Gap Analysis — What's Missing Between Current State and Target, 5. Summary: Three Blockers, One Slice, 6. Proposed Task 1, 7. Decision Required, Commands Run (+16 more)

### Community 17 - "Handover — Phase 3 COMPLETE sign-off"
Cohesion: 0.09
Nodes (21): Completed Phases, Current Issues / Technical Debt, Current State: Phase 6 COMPLETE, Phase 7 IN PROGRESS, ✅ DONE: Evidence Storage Backend (Phase 7.3), Exit Criteria Progress (Phase 7), Files Changed in This Phase (Commit 5f13525), Handover — Phase 7 Mid-Implementation (2026-07-12), Latest Update: Session 2026-07-12 (Post-handover commit 287d6d6) (+13 more)

### Community 18 - "package.json"
Cohesion: 0.06
Nodes (33): execa, @octokit/rest, @octokit/types, @octokit/webhooks-types, dependencies, @heynxt/core-types, @heynxt/prompt-spec, @octokit/rest (+25 more)

### Community 19 - "package.json"
Cohesion: 0.09
Nodes (23): dependencies, zod, devDependencies, typescript, vitest, exports, import, typescript (+15 more)

### Community 20 - "ADR-0010: Blueprint Registry Architecture"
Cohesion: 0.09
Nodes (22): 1. Schema Design — Blueprint Metadata (in `core-types`), 2. Domain Entity Schema — Industrial Entities, 3. Registry Infrastructure — Three Interfaces, 4. Composition Plan Schema, ADR-0010: Blueprint Registry Architecture, Alternative 1: JSON-based Blueprint Storage (vs. DB schema), Alternative 2: LLM-assisted Blueprint Matching (vs. keyword-based), Alternative 3: Single Monolithic Blueprint Schema (vs. Family/Domain classification) (+14 more)

### Community 21 - "package.json"
Cohesion: 0.10
Nodes (21): dependencies, @heynxt/core-types, zod, devDependencies, typescript, exports, import, @heynxt/core-types (+13 more)

### Community 22 - "package.json"
Cohesion: 0.10
Nodes (21): dependencies, @heynxt/core-types, zod, devDependencies, typescript, exports, import, @heynxt/core-types (+13 more)

### Community 23 - "HeyNXT Core — Claude Instructions"
Cohesion: 0.08
Nodes (23): 1) Coding agent execution reference, 2) Industrial blueprint reference — aluminum extrusion, 3) Industrial blueprint reference — PCB/electronics MES, Architecture Principles, CLI Behavior, Context Management, Core Rules, Current Phase (+15 more)

### Community 24 - "Graph Report — coding-agent-template"
Cohesion: 0.10
Nodes (20): 1. Adapter pattern for agents (`lib/sandbox/agents/index.ts`), 2. Sandboxed execution (`lib/sandbox/creation.ts` + `lib/sandbox/commands.ts`), 3. Streaming JSON output (claude.ts — reference implementation), 4. Session resumption, 5. Background orchestration via Next.js `after()`, 6. Per-user encrypted API keys + AI Gateway proxying, API Boundaries, Critical Files / High Blast Radius (+12 more)

### Community 25 - "workspace.ts"
Cohesion: 0.09
Nodes (24): WorkspacesList(), WorkspacesPage(), Invitation, InvitationId, InvitationStatus, InvitationSummary, InviteUserInput, Organization (+16 more)

### Community 27 - "control-plane.test.ts"
Cohesion: 0.08
Nodes (44): GET(), GET(), GET(), GET(), GET(), TasksPage(), Artifact, ArtifactId (+36 more)

### Community 28 - "blueprint.ts"
Cohesion: 0.11
Nodes (13): BlueprintDomain, BlueprintFamily, BlueprintMetadata, BlueprintPack, BlueprintSummary, BlueprintTag, CompositionPlan, CreateBlueprintInput (+5 more)

### Community 29 - "ADR-0001: Monorepo and Boundaries"
Cohesion: 0.12
Nodes (17): ADR-0001: Monorepo and Boundaries, Consequences, Context, Decision, Dependency Rules, Migration Plan, Monorepo Structure, Negative (+9 more)

### Community 30 - "ADR-0004: ORM and Database Choice for Control Plane"
Cohesion: 0.12
Nodes (17): ADR-0004: ORM and Database Choice for Control Plane, Consequences, Considered Alternatives, Context, Decision, Decisions locked in (Task 4), Follow-ups (all landed), Implementation status (as of 2026-07-09) (+9 more)

### Community 31 - "Architecture Overview"
Cohesion: 0.12
Nodes (17): Architectural Layers, Architecture Overview, Blueprint Loading Flow, Data Flow, Extension Points, Layer 1: Shared Schema Layer (`@heynxt/core-types`), Layer 2: Domain Models Layer (`@heynxt/domain-models`), Layer 3: Blueprint Registry Layer (`@heynxt/blueprint-registry`) (+9 more)

### Community 32 - "page.tsx"
Cohesion: 0.14
Nodes (14): CreateTaskForm(), errStyle, inputStyle, ProjectOption, ADR-0006, WorkspaceOption, defaultStatusColor, getStatusColor() (+6 more)

### Community 34 - "HeyNXT Core - Industrial AI App Builder Platform"
Cohesion: 0.13
Nodes (15): ADRs, 🏗️ Architecture Overview, Coding Agent Substrate, 🤝 Contributing, 🎯 Current Phase: Phase 1 — Product Control Plane Foundation, 📚 Documentation, For Claude Sessions, HeyNXT Core - Industrial AI App Builder Platform (+7 more)

### Community 35 - "tsconfig.json"
Cohesion: 0.13
Nodes (14): apps, packages, compilerOptions, noEmit, exclude, extends, include, dist (+6 more)

### Community 36 - "API Contract"
Cohesion: 0.14
Nodes (13): API Contract, Artifacts, Generation Runs, Health, @heynxt/web, Local Setup, Package Dependencies (runtime), Projects (+5 more)

### Community 37 - "ADR-0008 — Auth Library and OAuth Provider"
Cohesion: 0.14
Nodes (13): ADR-0008 — Auth Library and OAuth Provider, Affected Code Surface (preview for next task), Affected Schema Surface, Consequences, Context, Costs / Tradeoffs, Decision, Exit Criteria for This Decision (+5 more)

### Community 38 - "agent-spec.ts"
Cohesion: 0.14
Nodes (11): AgentExecutionResult, AgentExecutionResultId, AgentSpec, AgentSpecId, AgentSpecSummary, AgentStatus, AgentType, CreateAgentSpecInput (+3 more)

### Community 39 - "page.tsx"
Cohesion: 0.18
Nodes (11): CreateProjectForm(), errStyle, inputStyle, ADR-0006, WorkspaceOption, PageProps, ProjectsList(), ProjectsPage() (+3 more)

### Community 40 - "Local Development Setup"
Cohesion: 0.12
Nodes (17): 1. Install dependencies, 2. Create your local env file, 3. Start the local Postgres container, Container starts unhealthy, Daily Workflow, Database Details, `DATABASE_URL` connection refused, `docker compose: command not found` (+9 more)

### Community 41 - "BlueprintValidatorImpl"
Cohesion: 0.10
Nodes (10): BlueprintCatalog, BlueprintMetadata, BlueprintValidator, BlueprintValidatorImpl, CompositionPlan, createValidator(), DomainEntity, ValidationReport (+2 more)

### Community 42 - "ADR-0009: Migrations — Forward-Only with Reset as Phase 1 Reversibility"
Cohesion: 0.17
Nodes (11): ADR-0009: Migrations — Forward-Only with Reset as Phase 1 Reversibility, Consequences, Context, Decision, Option A — Hand-write down migrations for every forward migration, Option B — Treat `pnpm db:migrate:reset` as the reversibility mechanism, Option C — Defer reversibility entirely to Phase 9, Options Considered (+3 more)

### Community 43 - "CompositeBlueprintLoader"
Cohesion: 0.08
Nodes (9): BlueprintEntry, BlueprintLoader, BlueprintSourceConfig, CompositeBlueprintLoader, createBlueprintLoader(), InMemoryBlueprintLoader, LoadResult, TODO: Implement LocalPathBlueprintLoader for FactoryNXT repo paths (+1 more)

### Community 44 - "task-payload.ts"
Cohesion: 0.17
Nodes (10): CreateTaskPayloadInput, CreateTaskPayloadInputSchema, TaskPayload, TaskPayloadId, TaskPayloadIdSchema, TaskPayloadSchema, TaskPayloadSummary, TaskPayloadSummarySchema (+2 more)

### Community 45 - "tsconfig.json"
Cohesion: 0.17
Nodes (11): compilerOptions, outDir, rootDir, exclude, extends, include, dist, node_modules (+3 more)

### Community 47 - "Decision"
Cohesion: 0.18
Nodes (11): 1. Adapter Pattern with Uniform Contract, 2. Sandboxed Execution, 3. Streaming Output, 4. Credential Management, 5. Resumable Sessions, Adaptation for HeyNXT, Agent Spec Schema, Agent Substrate Architecture (+3 more)

### Community 48 - "page.tsx"
Cohesion: 0.29
Nodes (6): CreateWorkspaceForm(), errStyle, inputStyle, PageProps, tdStyle, thStyle

### Community 49 - "ADR-0002: Agent Substrate and Execution Model"
Cohesion: 0.13
Nodes (15): ADR-0002: Agent Substrate and Execution Model, Consequences, Context, Future Considerations, Implementation Notes, Negative, Neutral, Phase 5 Tasks (+7 more)

### Community 50 - "BlueprintCatalog"
Cohesion: 0.11
Nodes (22): ValidationStage, ApiEvidenceMetadata, ApiTestResult, ApiValidationResult, BuildEvidenceMetadata, BuildValidationResult, LintEvidenceMetadata, LintValidationResult (+14 more)

### Community 51 - "task.ts"
Cohesion: 0.06
Nodes (30): ADR-0012: Prompt-to-Spec Engine Architecture, Blueprint Integration (Phase 5 Bridge), Consequences, Context and Problem Statement, Decision Drivers, Decision Options Considered, Follow-Up Tasks for Phase 4 Implementation, Idempotency and Deduplication Flow (+22 more)

### Community 52 - "auth.ts"
Cohesion: 0.25
Nodes (5): authConfig, ADR-0008, nextAuth, ADR-0008, config

### Community 53 - "rbac.ts"
Cohesion: 0.07
Nodes (26): 1. Schema Design — PromptSpec in `core-types`, 2. Input Schemas for Mutations, 3. Module Structure in `packages/prompt-spec/src/`, 4. Export Strategy, 5. Idempotency via Stability Hash, ADR-0011: Prompt-to-Spec Engine Architecture (Phase 4), Alternative 1: LLM-Only Parsing, Alternative 2: Form-First Input (+18 more)

### Community 54 - "ADR-0006 — `createdBy` Session Sweep Plan"
Cohesion: 0.22
Nodes (8): ADR-0006 — `createdBy` Session Sweep Plan, Consequences, Context, Costs / Tradeoffs, Decision, Exit Criteria for the Sweep, Rationale, Sweep Plan

### Community 55 - "ADR-0007 — Phase 1 UI Consolidation Pattern"
Cohesion: 0.22
Nodes (8): ADR-0007 — Phase 1 UI Consolidation Pattern, Consequences, Context, Conventions, Costs / Tradeoffs, Decision, Rationale, Revisit Triggers

### Community 56 - "Graphify — Unified Repo Map"
Cohesion: 0.22
Nodes (9): Cross-Repo Navigation, File Contents, Graphify — Unified Repo Map, How Graphs Are Generated, How to Use This Map, Layout, Priority Order for Any Repo, Refreshing a Graph (+1 more)

### Community 57 - "tsconfig.json"
Cohesion: 0.18
Nodes (10): compilerOptions, lib, outDir, rootDir, extends, include, ES2022, src/**/* (+2 more)

### Community 58 - "extracted-blueprints-example.ts"
Cohesion: 0.22
Nodes (6): EXAMPLE_DIE_ENTITY, EXAMPLE_EXTRUSION_BLUEPRINT, EXAMPLE_GENEALOGY_EVENT_ENTITY, EXAMPLE_OPERATION_TRANSACTION_ENTITY, EXAMPLE_PCB_BLUEPRINT, EXAMPLE_WORK_ORDER_ENTITY

### Community 59 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.base.json, $schema

### Community 60 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.base.json, $schema

### Community 61 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.base.json, $schema

### Community 62 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.base.json, $schema

### Community 63 - "ADR-0005 — Client Form Pattern (fetch + router.refresh)"
Cohesion: 0.25
Nodes (7): ADR-0005 — Client Form Pattern (fetch + router.refresh), Consequences, Context, Costs / Tradeoffs, Decision, Rationale, Revisit When

### Community 64 - "InMemoryBlueprintLoader"
Cohesion: 0.09
Nodes (10): DEFAULT_BASE_PATH, DefaultEvidenceCaptureService, EvidenceArtifact, EvidenceCaptureService, EvidenceStorage, EvidenceStorageConfig, getEvidenceStorage(), LocalEvidenceStorage (+2 more)

### Community 65 - "generation-run.ts"
Cohesion: 0.12
Nodes (14): CreatePRStage, PRCreationResult, PREvidenceMetadata, CheckStatus, CheckStatusEnum, CompareCommitsWithBaseheadResponse, generateBranchName(), generatePRBody() (+6 more)

### Community 66 - "Phase 3 — Industrial Blueprint Extraction"
Cohesion: 0.33
Nodes (6): Blueprint Extraction Targets, Dependencies, Exit Criteria, Initial Blueprint Families, Phase 3 — Industrial Blueprint Extraction, Risks

### Community 67 - "Phase 0 — Multi-Repo Audit ✓ COMPLETE"
Cohesion: 0.33
Nodes (6): Completed Deliverables, Cross-Repo Reuse Matrix, Exit Criteria, Files Changed, Gaps Documented, Phase 0 — Multi-Repo Audit ✓ COMPLETE

### Community 68 - "local-path.ts"
Cohesion: 0.16
Nodes (21): applyManualOverride(), BLUEPRINT_MATCH_RULES, BlueprintOverride, checkBlueprintCompatibility(), composeBlueprintPlan(), CompositionResult, createCompositionPlanFromResult(), extractKeywords() (+13 more)

### Community 69 - "audit-log.ts"
Cohesion: 0.24
Nodes (7): GenerationStage, GenerationStageInput, GenerationStageOutput, PendingStage, StageResult, GenerateSchemaStage, ValidationStages

### Community 70 - "Implementation Phases"
Cohesion: 0.40
Nodes (5): Definition of Done, HeyNXT Core — Build Plan, Implementation Phases, Objective, Summary

### Community 71 - "Phase 1 — Product Control Plane Foundation"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 1 — Product Control Plane Foundation, Risks, Scope

### Community 72 - "Phase 2 — Agent Execution Integration"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 2 — Agent Execution Integration, Risks, Scope

### Community 73 - "Phase 4 — Prompt-to-Spec Engine"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 4 — Prompt-to-Spec Engine, Risks, Scope

### Community 74 - "Phase 5 — Blueprint Selection and Composition"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 5 — Blueprint Selection and Composition, Risks, Scope

### Community 75 - "Phase 6 — Generation Pipeline"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 6 — Generation Pipeline, Risks, Scope

### Community 76 - "Phase 7 — Validation and Review Loop"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 7 — Validation and Review Loop, Risks, Scope

### Community 77 - "Phase 8 — Industrial Runtime Services"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 8 — Industrial Runtime Services, Risks, Scope

### Community 78 - "Phase 9 — Governance and Hardening"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 9 — Governance and Hardening, Risks, Scope

### Community 79 - "Rationale"
Cohesion: 0.17
Nodes (19): CreatePipelineInput, GenerationArtifact, GenerationPipelineExecution, GenerationStageExecution, GenerationStageInput, GenerationStageInputSchema, GenerationStageName, GenerationStageOutput (+11 more)

### Community 80 - "@heynxt/persistence"
Cohesion: 0.40
Nodes (4): Design decisions, @heynxt/persistence, References, What it exposes

### Community 81 - "Source-of-Truth Repositories"
Cohesion: 0.50
Nodes (4): 1) Coding agent execution reference, 2) Industrial blueprint references, 3) Product platform repository, Source-of-Truth Repositories

### Community 82 - "Architecture Intent"
Cohesion: 0.50
Nodes (4): A. Control Plane, Architecture Intent, B. Agent Execution Adapter, C. Industrial Blueprint Engine

### Community 83 - "First-Time Setup"
Cohesion: 0.11
Nodes (18): ApiEndpointDefinition, AppType, AuditRequirement, BlueprintHint, CreatePromptInput, DeploymentProfile, IntegrationDefinition, ParsedIntent (+10 more)

### Community 84 - "extrusion-blueprint.ts"
Cohesion: 0.83
Nodes (3): createExtrusionBlueprints(), createExtrusionDieLifecycleBlueprint(), createExtrusionOperationsBlueprint()

### Community 85 - "pcb-blueprint.ts"
Cohesion: 0.83
Nodes (3): createPcbBlueprints(), createPcbGenealogyBlueprint(), createPcbSerialExecutionBlueprint()

### Community 167 - "validator.ts"
Cohesion: 0.12
Nodes (4): createStageExecution(), DefaultGenerationPipeline, MockGenerationStage, GenerationStageInput

### Community 168 - "artifact.ts"
Cohesion: 0.27
Nodes (12): advance_task(), ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, build_task_prompt(), check_all_done(), ensure_ollama_ready(), git_commit_push(), log() (+4 more)

### Community 176 - "validation-stage.ts"
Cohesion: 0.20
Nodes (9): ApprovalDecision, PRMetadata, RerunRequest, ValidationCheckResult, ValidationCheckTypeExtended, ValidationEvidence, ValidationRunRecord, ValidationRunRecordType (+1 more)

### Community 182 - "rbac.ts"
Cohesion: 0.38
Nodes (5): ForbiddenError, getUserPermissions(), hasPermission(), PermissionScope, resolveOrganizationIdForRbac()

### Community 184 - "route.ts"
Cohesion: 0.60
Nodes (5): buildAcceptUrl(), findPendingInvitation(), findUserByEmail(), generateToken(), POST()

### Community 185 - "Task P1-T1 — Phase 1: ORM + DB selection, ADR 0004"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T1 — Phase 1: ORM + DB selection, ADR 0004

### Community 186 - "Task P1-T2 — Phase 1: Zod schemas: user, org, workspace, project, task, artifact, generation-run, rbac"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T2 — Phase 1: Zod schemas: user, org, workspace, project, task, artifact, generation-run, rbac

### Community 187 - "Task P1-T3 — Phase 1: DB migrations + ORM layer"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T3 — Phase 1: DB migrations + ORM layer

### Community 188 - "Task P1-T4 — Phase 1: Control plane API routes (REST/tRPC)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T4 — Phase 1: Control plane API routes (REST/tRPC)

### Community 189 - "Task P1-T5 — Phase 1: Next.js auth + workspace UI"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T5 — Phase 1: Next.js auth + workspace UI

### Community 190 - "Task P1-T6 — Phase 1: RBAC middleware + activity log"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T6 — Phase 1: RBAC middleware + activity log

### Community 191 - "Task P2-T1 — Phase 2: AgentSpec + AgentExecutionResult Zod schemas"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T1 — Phase 2: AgentSpec + AgentExecutionResult Zod schemas

### Community 192 - "Task P2-T2 — Phase 2: AgentRuntime interface + Vercel AI SDK adapter"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T2 — Phase 2: AgentRuntime interface + Vercel AI SDK adapter

### Community 193 - "Task P2-T3 — Phase 2: Sandbox lifecycle manager"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T3 — Phase 2: Sandbox lifecycle manager

### Community 194 - "Task P2-T4 — Phase 2: Streaming JSON stdout parser + progress tracker"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T4 — Phase 2: Streaming JSON stdout parser + progress tracker

### Community 195 - "Task P2-T5 — Phase 2: Branch-per-task Git flow + task-to-commit traceability"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T5 — Phase 2: Branch-per-task Git flow + task-to-commit traceability

### Community 196 - "Task P2-T6 — Phase 2: POST /api/tasks/:id/execute end-to-end wiring"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T6 — Phase 2: POST /api/tasks/:id/execute end-to-end wiring

### Community 197 - "Task P3-T1 — Phase 3: domain-models: Equipment + Process Zod schemas"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T1 — Phase 3: domain-models: Equipment + Process Zod schemas

### Community 198 - "Task P3-T2 — Phase 3: domain-models: Material + Quality + Production schemas"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T2 — Phase 3: domain-models: Material + Quality + Production schemas

### Community 199 - "Task P3-T3 — Phase 3: domain-models: Traceability + Reliability schemas"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T3 — Phase 3: domain-models: Traceability + Reliability schemas

### Community 200 - "Task P3-T4 — Phase 3: blueprint-registry: loader + catalog + validator"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T4 — Phase 3: blueprint-registry: loader + catalog + validator

### Community 201 - "Task P3-T5 — Phase 3: Blueprint family extraction: Extrusion + Production Execution"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T5 — Phase 3: Blueprint family extraction: Extrusion + Production Execution

### Community 202 - "Task P3-T6 — Phase 3: Blueprint family extraction: Quality + Maintenance + Traceability"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T6 — Phase 3: Blueprint family extraction: Quality + Maintenance + Traceability

### Community 203 - "Task P4-T1 — Phase 4: PromptSpec + SpecTemplate Zod schemas"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P4-T1 — Phase 4: PromptSpec + SpecTemplate Zod schemas

### Community 204 - "Task P4-T2 — Phase 4: Prompt parser (NL → structured intent)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P4-T2 — Phase 4: Prompt parser (NL → structured intent)

### Community 205 - "Task P4-T3 — Phase 4: Spec generator (intent → SpecTemplate via LLM)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P4-T3 — Phase 4: Spec generator (intent → SpecTemplate via LLM)

### Community 206 - "Task P4-T4 — Phase 4: Spec validation + idempotency test"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P4-T4 — Phase 4: Spec validation + idempotency test

### Community 207 - "Task P5-T1 — Phase 5: Blueprint selection algorithm (keyword → scored candidates)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P5-T1 — Phase 5: Blueprint selection algorithm (keyword → scored candidates)

### Community 208 - "Task P5-T2 — Phase 5: Composition engine (base + module + role + KPI packs)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P5-T2 — Phase 5: Composition engine (base + module + role + KPI packs)

### Community 209 - "Task P5-T3 — Phase 5: Versioned blueprint plan + manual override with audit trail"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P5-T3 — Phase 5: Versioned blueprint plan + manual override with audit trail

### Community 210 - "Task P6-T1 — Phase 6: Generation pipeline orchestrator (9-stage runner)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T1 — Phase 6: Generation pipeline orchestrator (9-stage runner)

### Community 211 - "Task P6-T2 — Phase 6: Stage 1-3: Normalize spec + resolve blueprint + generate schema"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T2 — Phase 6: Stage 1-3: Normalize spec + resolve blueprint + generate schema

### Community 212 - "Task P6-T3 — Phase 6: Stage 4-6: Permissions + backend modules + frontend modules"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T3 — Phase 6: Stage 4-6: Permissions + backend modules + frontend modules

### Community 213 - "Task P6-T4 — Phase 6: Stage 7-9: Workflows + fixtures/tests + deployment metadata"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T4 — Phase 6: Stage 7-9: Workflows + fixtures/tests + deployment metadata

### Community 214 - "Task P6-T5 — Phase 6: End-to-end: prompt → generated runnable app slice"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T5 — Phase 6: End-to-end: prompt → generated runnable app slice

### Community 215 - "Task P7-T1 — Phase 7: Automated validation suite (lint + typecheck + test + migrations + smoke)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P7-T1 — Phase 7: Automated validation suite (lint + typecheck + test + migrations + smoke)

### Community 216 - "Task P7-T2 — Phase 7: PR creation automation with evidence attachment"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P7-T2 — Phase 7: PR creation automation with evidence attachment

### Community 217 - "Task P7-T3 — Phase 7: Review loop: approve/reject → rerun with feedback"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P7-T3 — Phase 7: Review loop: approve/reject → rerun with feedback

### Community 218 - "Task P8-T1 — Phase 8: Workflow engine: state machine executor with audit trail"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P8-T1 — Phase 8: Workflow engine: state machine executor with audit trail

### Community 219 - "Task P8-T2 — Phase 8: Event ingestion service (PLC signals, barcode scans, sensors)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P8-T2 — Phase 8: Event ingestion service (PLC signals, barcode scans, sensors)

### Community 220 - "Task P8-T3 — Phase 8: Rules engine + KPI aggregation (OEE, throughput, quality rate)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P8-T3 — Phase 8: Rules engine + KPI aggregation (OEE, throughput, quality rate)

### Community 221 - "Task P8-T4 — Phase 8: Notification + scheduler services"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P8-T4 — Phase 8: Notification + scheduler services

### Community 222 - "Task P9-T1 — Phase 9: Tenant isolation enforcement + workspace-scoped data access audit"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T1 — Phase 9: Tenant isolation enforcement + workspace-scoped data access audit

### Community 223 - "Task P9-T2 — Phase 9: Immutable audit log (all state-changing ops)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T2 — Phase 9: Immutable audit log (all state-changing ops)

### Community 224 - "Task P9-T3 — Phase 9: Secret management + per-workspace secret scopes"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T3 — Phase 9: Secret management + per-workspace secret scopes

### Community 225 - "Task P9-T4 — Phase 9: Quota enforcement + observability (Prometheus, Grafana, Loki)"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T4 — Phase 9: Quota enforcement + observability (Prometheus, Grafana, Loki)

### Community 226 - "Task P9-T5 — Phase 9: Rollback system + one-click revert per generation run"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T5 — Phase 9: Rollback system + one-click revert per generation run

### Community 227 - "Task P9-T6 — Phase 9: Production readiness: security review + runbook + pilot sign-off"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T6 — Phase 9: Production readiness: security review + runbook + pilot sign-off

### Community 228 - "🎯 Key Design Decisions"
Cohesion: 0.33
Nodes (6): 1. Monorepo with pnpm + Turbo, 2. Contract-First Architecture, 3. Agent Substrate Pattern, 4. Industrial Blueprint Sources, 5. TypeScript Configuration, 🎯 Key Design Decisions

### Community 234 - "POST"
Cohesion: 0.50
Nodes (4): executeAgentInBackground(), POST(), uuidValidate(), TaskStatus

### Community 235 - "HeyNXT Autonomous Loop Session"
Cohesion: 0.40
Nodes (4): Absolute Rules, Completion Signal Format (MANDATORY — output EXACTLY one of these), HeyNXT Autonomous Loop Session, Read Before Executing

### Community 236 - "🚀 Getting Started"
Cohesion: 0.40
Nodes (5): Development Commands, 🚀 Getting Started, Installation, Prerequisites, Verification

### Community 237 - "📚 Documentation Structure"
Cohesion: 0.50
Nodes (4): Architecture Decision Records, Architecture Documentation, 📚 Documentation Structure, Root Documentation

### Community 238 - "📝 Notes"
Cohesion: 0.50
Nodes (4): Assumptions Made, Future Considerations, Known Limitations, 📝 Notes

## Knowledge Gaps
- **1014 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `dev` (+1009 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **97 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `StubAgentRuntime` connect `index.ts` to `POST`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `POST()` connect `POST` to `errorResponse`, `index.ts`, `task-payload.ts`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `TaskStatus` connect `POST` to `control-plane.test.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `NOTE: This file should not be edited`, `nextConfig`, `name` to the rest of the system?**
  _1019 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05359937402190924 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07518796992481203 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08514013749338974 - nodes in this community are weakly interconnected._