# Graph Report - heynxt-core  (2026-07-11)

## Corpus Check
- 137 files · ~114,634 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1534 nodes · 2010 edges · 167 communities (87 shown, 80 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c97e5efd`
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

## God Nodes (most connected - your core abstractions)
1. `errorResponse()` - 24 edges
2. `badRequest()` - 23 edges
3. `LocalPathBlueprintLoader` - 21 edges
4. `parseJsonBody()` - 18 edges
5. `compilerOptions` - 18 edges
6. `HeyNXT Core — Claude Instructions` - 18 edges
7. `insertAuditEntry()` - 17 edges
8. `InMemoryBlueprintCatalog` - 17 edges
9. `requireAuth()` - 16 edges
10. `scripts` - 16 edges

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

## Communities (167 total, 80 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.05
Nodes (68): AlloyGrade, BilletStatus, DieStatus, ExtrusionBillet, ExtrusionBilletId, ExtrusionDie, ExtrusionDieId, ExtrusionOeeSnapshot (+60 more)

### Community 1 - "errorResponse"
Cohesion: 0.10
Nodes (48): GET(), POST(), GET(), POST(), GET(), buildAcceptUrl(), findPendingInvitation(), findUserByEmail() (+40 more)

### Community 2 - "index.ts"
Cohesion: 0.08
Nodes (17): AgentRuntime, BaseAgentRuntime, EventEmitter, ExecutionContext, ExecutionHandle, ExecutionValidation, InMemoryEventEmitter, OutputEvent (+9 more)

### Community 3 - "index.ts"
Cohesion: 0.09
Nodes (39): createDb(), db, DbClient, getDb(), HeyNxtDb, accounts, agentExecutionResults, agentSpecs (+31 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (45): dependencies, @auth/drizzle-adapter, drizzle-orm, @heynxt/agent-adapter, @heynxt/blueprint-registry, @heynxt/core-types, @heynxt/domain-models, @heynxt/persistence (+37 more)

### Community 5 - "HeyNXT Core - Foundation Summary"
Cohesion: 0.05
Nodes (38): 1. Monorepo with pnpm + Turbo, 2. Contract-First Architecture, 3. Agent Substrate Pattern, 4. Industrial Blueprint Sources, 5. TypeScript Configuration, Architecture Decision Records, Architecture Documentation, 🏗️ Architecture Summary (+30 more)

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
Cohesion: 0.11
Nodes (22): BlueprintDomain, BlueprintFamily, BlueprintFilter, BlueprintPagination, BlueprintSort, BlueprintTag, CatalogQueryResult, createEmptyCatalog() (+14 more)

### Community 12 - "ADR-0003: Industrial Blueprint Sources"
Cohesion: 0.07
Nodes (27): ADR-0003: Industrial Blueprint Sources, Blueprint Extraction Strategy, Blueprint Schema Design, Consequences, Context, Decision, Domain Model Derivation, FactoryNXT_PY_v2_Extrusion (Aluminum Extrusion) (+19 more)

### Community 13 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+18 more)

### Community 14 - "package.json"
Cohesion: 0.08
Nodes (25): dependencies, @heynxt/core-types, @heynxt/domain-models, zod, devDependencies, @types/node, typescript, exports (+17 more)

### Community 15 - "compilerOptions"
Cohesion: 0.08
Nodes (24): compilerOptions, allowJs, incremental, jsx, lib, module, moduleResolution, noEmit (+16 more)

### Community 16 - "4. Gap Analysis — What's Missing Between Current State and Target"
Cohesion: 0.08
Nodes (24): 1. Current State (from `graphify/heynxt-core/`), 2. Reference Repo Synthesis (from graphify reports), 3. Reuse Matrix (summary; full version in `buildplan.md` Phase 0), 4. Gap Analysis — What's Missing Between Current State and Target, 5. Summary: Three Blockers, One Slice, 6. Proposed Task 1, 7. Decision Required, Commands Run (+16 more)

### Community 17 - "Handover — Phase 3 COMPLETE sign-off"
Cohesion: 0.08
Nodes (24): Commit History (most recent first), ✅ COMPLETED: Option A — LocalPathBlueprintLoader Implementation, Core Schemas (`packages/core-types/src/schemas/blueprint.ts`), Documentation (`docs/adr/`), Domain Models (`packages/domain-models/src/entities/`), Files Changed (Phase 3), Handover — Phase 3 COMPLETE sign-off, Immediate Options (all valid next steps): (+16 more)

### Community 18 - "package.json"
Cohesion: 0.09
Nodes (23): dependencies, @heynxt/core-types, @heynxt/prompt-spec, zod, devDependencies, typescript, exports, import (+15 more)

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
Cohesion: 0.10
Nodes (21): 1) Coding agent execution reference, 2) Industrial blueprint reference — aluminum extrusion, 3) Industrial blueprint reference — PCB/electronics MES, Architecture Principles, Core Rules, Current Phase, Development Commands, External Reference Repositories (+13 more)

### Community 24 - "Graph Report — coding-agent-template"
Cohesion: 0.10
Nodes (20): 1. Adapter pattern for agents (`lib/sandbox/agents/index.ts`), 2. Sandboxed execution (`lib/sandbox/creation.ts` + `lib/sandbox/commands.ts`), 3. Streaming JSON output (claude.ts — reference implementation), 4. Session resumption, 5. Background orchestration via Next.js `after()`, 6. Per-user encrypted API keys + AI Gateway proxying, API Boundaries, Critical Files / High Blast Radius (+12 more)

### Community 25 - "workspace.ts"
Cohesion: 0.13
Nodes (16): WorkspacesPage(), Invitation, InvitationId, InvitationStatus, InvitationSummary, InviteUserInput, Organization, OrganizationId (+8 more)

### Community 27 - "control-plane.test.ts"
Cohesion: 0.16
Nodes (16): Artifact, ArtifactId, ArtifactKind, ArtifactStorageKind, ArtifactSummary, CreateArtifactInput, hasInlineContent(), ALLOWED_PROJECT_STATUS_TRANSITIONS (+8 more)

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
Cohesion: 0.15
Nodes (13): Container starts unhealthy, Daily Workflow, Database Details, `DATABASE_URL` connection refused, `docker compose: command not found`, Local Development Setup, Port 5432 already in use, Prerequisites (+5 more)

### Community 41 - "BlueprintValidatorImpl"
Cohesion: 0.27
Nodes (3): BlueprintMetadata, BlueprintValidator, BlueprintValidatorImpl

### Community 42 - "ADR-0009: Migrations — Forward-Only with Reset as Phase 1 Reversibility"
Cohesion: 0.17
Nodes (11): ADR-0009: Migrations — Forward-Only with Reset as Phase 1 Reversibility, Consequences, Context, Decision, Option A — Hand-write down migrations for every forward migration, Option B — Treat `pnpm db:migrate:reset` as the reversibility mechanism, Option C — Defer reversibility entirely to Phase 9, Options Considered (+3 more)

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
Cohesion: 0.22
Nodes (8): CreateWorkspaceForm(), errStyle, inputStyle, PageProps, tdStyle, thStyle, WorkspacesList(), Workspace

### Community 49 - "ADR-0002: Agent Substrate and Execution Model"
Cohesion: 0.20
Nodes (10): ADR-0002: Agent Substrate and Execution Model, Consequences, Context, Future Considerations, Implementation Notes, Negative, Neutral, Phase 5 Tasks (+2 more)

### Community 51 - "task.ts"
Cohesion: 0.22
Nodes (8): CreateTaskInput, isTaskTerminal(), TaskSummary, TaskType, User, UserId, UserStatus, UserSummary

### Community 52 - "auth.ts"
Cohesion: 0.25
Nodes (5): authConfig, ADR-0008, nextAuth, ADR-0008, config

### Community 53 - "rbac.ts"
Cohesion: 0.22
Nodes (8): getUserPermissions(), resolveOrganizationIdForRbac(), getRolePermissions(), Permission, ROLE_DEFINITIONS, RoleAssignment, RoleDefinition, RoleName

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
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.base.json, $schema

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

### Community 65 - "generation-run.ts"
Cohesion: 0.25
Nodes (7): CreateGenerationRunInput, GenerationRun, GenerationRunId, GenerationRunSnapshot, GenerationRunStatus, GenerationRunSummary, isGenerationRunTerminal()

### Community 66 - "Phase 3 — Industrial Blueprint Extraction"
Cohesion: 0.33
Nodes (6): Blueprint Extraction Targets, Dependencies, Exit Criteria, Initial Blueprint Families, Phase 3 — Industrial Blueprint Extraction, Risks

### Community 67 - "Phase 0 — Multi-Repo Audit ✓ COMPLETE"
Cohesion: 0.33
Nodes (6): Completed Deliverables, Cross-Repo Reuse Matrix, Exit Criteria, Files Changed, Gaps Documented, Phase 0 — Multi-Repo Audit ✓ COMPLETE

### Community 68 - "local-path.ts"
Cohesion: 0.40
Nodes (4): DEFAULT_FACTORY_NXT_SOURCES, FactoryNxtSourceConfig, ParsedPythonClass, ParsedPythonFile

### Community 69 - "audit-log.ts"
Cohesion: 0.33
Nodes (5): AuditAction, AuditEntityType, AuditLogEntry, AuditLogId, createStatusChangeEntry()

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
Cohesion: 0.40
Nodes (5): Rationale, Why Agent Substrate Pattern?, Why Not Agent Framework (LangChain, AutoGen)?, Why Not Direct API Integration?, Why Vercel coding-agent-template Specifically?

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
Cohesion: 0.50
Nodes (4): 1. Install dependencies, 2. Create your local env file, 3. Start the local Postgres container, First-Time Setup

### Community 84 - "extrusion-blueprint.ts"
Cohesion: 0.83
Nodes (3): createExtrusionBlueprints(), createExtrusionDieLifecycleBlueprint(), createExtrusionOperationsBlueprint()

### Community 85 - "pcb-blueprint.ts"
Cohesion: 0.83
Nodes (3): createPcbBlueprints(), createPcbGenealogyBlueprint(), createPcbSerialExecutionBlueprint()

## Knowledge Gaps
- **750 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `dev` (+745 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **80 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Implementation Phases` connect `Implementation Phases` to `Phase 3 — Industrial Blueprint Extraction`, `Phase 0 — Multi-Repo Audit ✓ COMPLETE`, `Phase 1 — Product Control Plane Foundation`, `Phase 2 — Agent Execution Integration`, `Phase 4 — Prompt-to-Spec Engine`, `Phase 5 — Blueprint Selection and Composition`, `Phase 6 — Generation Pipeline`, `Phase 7 — Validation and Review Loop`, `Phase 8 — Industrial Runtime Services`, `Phase 9 — Governance and Hardening`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `HeyNXT Core — Build Plan` connect `Implementation Phases` to `Source-of-Truth Repositories`, `Architecture Intent`, `README.md`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `WorkspaceId` connect `errorResponse` to `generation-run.ts`, `audit-log.ts`, `page.tsx`, `task.ts`, `rbac.ts`, `workspace.ts`, `control-plane.test.ts`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `NOTE: This file should not be edited`, `nextConfig`, `name` to the rest of the system?**
  _755 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05359937402190924 - nodes in this community are weakly interconnected._
- **Should `errorResponse` be split into smaller, more focused modules?**
  _Cohesion score 0.09905020352781546 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07581453634085213 - nodes in this community are weakly interconnected._