# Graph Report - heynxt-core  (2026-07-13)

## Corpus Check
- 256 files · ~183,815 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2684 nodes · 3942 edges · 196 communities (169 shown, 27 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `17e329e4`
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
- README.md
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
- route.ts
- page.tsx
- .env.example
- .gitignore
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
- vitest.config.ts
- drizzle.config.ts
- vitest.config.ts
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
- tenant-isolation.ts
- runtime-events.ts
- route.ts
- route.ts
- route.ts
- route.ts
- route.ts
- UserMenu.tsx
- audit-log.ts
- workspace.ts
- route.ts
- route.ts
- route.ts

## God Nodes (most connected - your core abstractions)
1. `errorResponse()` - 81 edges
2. `badRequest()` - 80 edges
3. `requireAuth()` - 56 edges
4. `parseJsonBody()` - 52 edges
5. `GenerationStageInput` - 28 edges
6. `GenerationStage` - 23 edges
7. `requirePermission()` - 21 edges
8. `ValidationStage` - 21 edges
9. `LocalPathBlueprintLoader` - 21 edges
10. `insertAuditEntry()` - 20 edges

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

## Communities (196 total, 27 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.17
Nodes (22): POST(), POST(), GET(), PATCH(), ADR-0006, POST(), ADR-0006, POST() (+14 more)

### Community 1 - "errorResponse"
Cohesion: 0.05
Nodes (68): AlloyGrade, BilletStatus, DieStatus, ExtrusionBillet, ExtrusionBilletId, ExtrusionDie, ExtrusionDieId, ExtrusionOeeSnapshot (+60 more)

### Community 2 - "index.ts"
Cohesion: 0.07
Nodes (17): AgentRuntime, BaseAgentRuntime, EventEmitter, ExecutionContext, ExecutionHandle, ExecutionValidation, InMemoryEventEmitter, OutputEvent (+9 more)

### Community 3 - "index.ts"
Cohesion: 0.04
Nodes (52): EventTransition, EventTransitionSchema, EventTriggerConfig, EventTriggerConfigSchema, FinalStateSchema, InitialStateSchema, ManualTransition, ManualTransitionSchema (+44 more)

### Community 4 - "dependencies"
Cohesion: 0.04
Nodes (48): ApprovalRequestTemplateSchema, DeliveryAttempt, DeliveryAttemptSchema, EmailNotificationConfig, EmailNotificationConfigSchema, EmailRecipient, EmailRecipientSchema, EquipmentDowntimeTemplateSchema (+40 more)

### Community 5 - "HeyNXT Core - Foundation Summary"
Cohesion: 0.04
Nodes (45): dependencies, @auth/drizzle-adapter, drizzle-orm, @heynxt/agent-adapter, @heynxt/blueprint-registry, @heynxt/core-types, @heynxt/domain-models, @heynxt/persistence (+37 more)

### Community 6 - "scripts"
Cohesion: 0.07
Nodes (45): agentExecutionResults, agentSpecs, agentStatusEnum, agentTypeEnum, executionResultStatusEnum, ADR-0008, aggregationWindowTypeEnum, InsertKpiCalculationJob (+37 more)

### Community 7 - "scripts"
Cohesion: 0.05
Nodes (42): ActionType, ActionTypeEnum, AlertActionConfig, AlertActionConfigSchema, ComparisonOperator, ComplexCondition, ComplexConditionSchema, ComplexConditionType (+34 more)

### Community 8 - "layout.tsx"
Cohesion: 0.05
Nodes (40): AggregationWindowType, AggregationWindowTypeEnum, DowntimeBreakdown, DowntimeBreakdownSchema, DowntimeEventSummary, DowntimeEventSummarySchema, DowntimeSnapshot, DowntimeSnapshotBaseSchema (+32 more)

### Community 9 - "FactoryNXT_PY_V2 — Structural Knowledge Graph"
Cohesion: 0.05
Nodes (34): BatchEventIngestRequest, BatchEventIngestRequestSchema, BatchEventIngestResponse, BatchEventIngestResponseSchema, DowntimeEvent, DowntimeEventSchema, EventFilter, EventFilterSchema (+26 more)

### Community 10 - "FactoryNXT_PY_v2_Extrusion — Structural Knowledge Graph"
Cohesion: 0.05
Nodes (36): author, description, devDependencies, turbo, typescript, engines, node, pnpm (+28 more)

### Community 11 - "index.ts"
Cohesion: 0.06
Nodes (34): drizzle-kit, dependencies, drizzle-orm, @heynxt/core-types, postgres, devDependencies, drizzle-kit, typescript (+26 more)

### Community 12 - "ADR-0003: Industrial Blueprint Sources"
Cohesion: 0.06
Nodes (33): execa, @octokit/rest, @octokit/types, @octokit/webhooks-types, dependencies, @heynxt/core-types, @heynxt/prompt-spec, @octokit/rest (+25 more)

### Community 13 - "compilerOptions"
Cohesion: 0.09
Nodes (23): ^build, .env, .env.example, .next/**, !.next/cache/**, dependsOn, outputs, cache (+15 more)

### Community 14 - "package.json"
Cohesion: 0.11
Nodes (22): ValidationStage, ApiEvidenceMetadata, ApiTestResult, ApiValidationResult, BuildEvidenceMetadata, BuildValidationResult, LintEvidenceMetadata, LintValidationResult (+14 more)

### Community 15 - "compilerOptions"
Cohesion: 0.09
Nodes (9): DEFAULT_BASE_PATH, DefaultEvidenceCaptureService, EvidenceArtifact, EvidenceCaptureService, EvidenceStorage, EvidenceStorageConfig, getEvidenceStorage(), LocalEvidenceStorage (+1 more)

### Community 16 - "4. Gap Analysis — What's Missing Between Current State and Target"
Cohesion: 0.07
Nodes (28): dependencies, @heynxt/core-types, @heynxt/domain-models, zod, devDependencies, tsx, @types/node, typescript (+20 more)

### Community 17 - "Handover — Phase 3 COMPLETE sign-off"
Cohesion: 0.08
Nodes (9): BlueprintEntry, BlueprintLoader, BlueprintSourceConfig, CompositeBlueprintLoader, createBlueprintLoader(), InMemoryBlueprintLoader, LoadResult, TODO: Implement LocalPathBlueprintLoader for FactoryNXT repo paths (+1 more)

### Community 18 - "package.json"
Cohesion: 0.07
Nodes (26): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+18 more)

### Community 19 - "package.json"
Cohesion: 0.12
Nodes (14): CreatePRStage, PRCreationResult, PREvidenceMetadata, CheckStatus, CheckStatusEnum, CompareCommitsWithBaseheadResponse, generateBranchName(), generatePRBody() (+6 more)

### Community 20 - "ADR-0010: Blueprint Registry Architecture"
Cohesion: 0.16
Nodes (21): applyManualOverride(), BLUEPRINT_MATCH_RULES, BlueprintOverride, checkBlueprintCompatibility(), composeBlueprintPlan(), CompositionResult, createCompositionPlanFromResult(), extractKeywords() (+13 more)

### Community 21 - "package.json"
Cohesion: 0.08
Nodes (24): compilerOptions, allowJs, incremental, jsx, lib, module, moduleResolution, noEmit (+16 more)

### Community 22 - "package.json"
Cohesion: 0.24
Nodes (7): GenerationStage, GenerationStageInput, GenerationStageOutput, PendingStage, StageResult, GenerateSchemaStage, ValidationStages

### Community 23 - "HeyNXT Core — Claude Instructions"
Cohesion: 0.09
Nodes (23): dependencies, zod, devDependencies, typescript, vitest, exports, import, typescript (+15 more)

### Community 24 - "Graph Report — coding-agent-template"
Cohesion: 0.11
Nodes (26): accounts, artifactKindEnum, artifactStorageKindEnum, auditActionEnum, auditEntityTypeEnum, auditLog, generationRuns, generationRunStatusEnum (+18 more)

### Community 25 - "workspace.ts"
Cohesion: 0.10
Nodes (21): dependencies, @heynxt/core-types, zod, devDependencies, typescript, exports, import, @heynxt/core-types (+13 more)

### Community 26 - "LocalPathBlueprintLoader"
Cohesion: 0.10
Nodes (21): dependencies, @heynxt/core-types, zod, devDependencies, typescript, exports, import, @heynxt/core-types (+13 more)

### Community 27 - "control-plane.test.ts"
Cohesion: 0.10
Nodes (10): BlueprintCatalog, BlueprintMetadata, BlueprintValidator, BlueprintValidatorImpl, CompositionPlan, createValidator(), DomainEntity, ValidationReport (+2 more)

### Community 28 - "blueprint.ts"
Cohesion: 0.10
Nodes (20): Artifact, ArtifactBase, ArtifactContentType, ArtifactId, ArtifactStorageType, ContentHash, DownloadArtifactRequest, DownloadArtifactResponse (+12 more)

### Community 30 - "ADR-0004: ORM and Database Choice for Control Plane"
Cohesion: 0.12
Nodes (17): WorkspacesPage(), Invitation, InvitationId, InvitationStatus, InvitationSummary, InviteUserInput, Organization, OrganizationId (+9 more)

### Community 31 - "Architecture Overview"
Cohesion: 0.12
Nodes (4): createStageExecution(), DefaultGenerationPipeline, MockGenerationStage, GenerationStageInput

### Community 32 - "page.tsx"
Cohesion: 0.09
Nodes (34): fileEvidenceService, kpiAggregation, notifications, rulesEngine, runtimeEvents, workflowDefinitions, CreatePipelineInput, GenerationArtifact (+26 more)

### Community 33 - "InMemoryBlueprintCatalog"
Cohesion: 0.11
Nodes (13): BlueprintDomain, BlueprintFamily, BlueprintMetadata, BlueprintPack, BlueprintSummary, BlueprintTag, CompositionPlan, CreateBlueprintInput (+5 more)

### Community 34 - "HeyNXT Core - Industrial AI App Builder Platform"
Cohesion: 0.11
Nodes (18): ApiEndpointDefinition, AppType, AuditRequirement, BlueprintHint, CreatePromptInput, DeploymentProfile, IntegrationDefinition, ParsedIntent (+10 more)

### Community 35 - "tsconfig.json"
Cohesion: 0.05
Nodes (38): 1. Monorepo with pnpm + Turbo, 2. Contract-First Architecture, 3. Agent Substrate Pattern, 4. Industrial Blueprint Sources, 5. TypeScript Configuration, Architecture Decision Records, Architecture Documentation, 🏗️ Architecture Summary (+30 more)

### Community 36 - "API Contract"
Cohesion: 0.14
Nodes (14): CreateTaskForm(), errStyle, inputStyle, ProjectOption, ADR-0006, WorkspaceOption, defaultStatusColor, getStatusColor() (+6 more)

### Community 37 - "ADR-0008 — Auth Library and OAuth Provider"
Cohesion: 0.14
Nodes (12): BlueprintDomain, BlueprintFamily, BlueprintFilter, BlueprintPagination, BlueprintSort, BlueprintTag, CatalogQueryResult, createEmptyCatalog() (+4 more)

### Community 38 - "agent-spec.ts"
Cohesion: 0.12
Nodes (31): POST(), VerifyArtifactInput, GET(), GET(), GET(), KPIsQueryParams, GET(), ApproveRollbackInput (+23 more)

### Community 39 - "page.tsx"
Cohesion: 0.27
Nodes (12): advance_task(), ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL, build_task_prompt(), check_all_done(), ensure_ollama_ready(), git_commit_push(), log() (+4 more)

### Community 41 - "BlueprintValidatorImpl"
Cohesion: 0.13
Nodes (14): apps, packages, compilerOptions, noEmit, exclude, extends, include, dist (+6 more)

### Community 42 - "ADR-0009: Migrations — Forward-Only with Reset as Phase 1 Reversibility"
Cohesion: 0.14
Nodes (11): AgentExecutionResult, AgentExecutionResultId, AgentSpec, AgentSpecId, AgentSpecSummary, AgentStatus, AgentType, CreateAgentSpecInput (+3 more)

### Community 43 - "CompositeBlueprintLoader"
Cohesion: 0.18
Nodes (11): CreateProjectForm(), errStyle, inputStyle, ADR-0006, WorkspaceOption, PageProps, ProjectsList(), ProjectsPage() (+3 more)

### Community 44 - "task-payload.ts"
Cohesion: 0.06
Nodes (32): API Boundaries, `app/routes/integrations.py` — ERP Adapter Patterns, `app/routes/operations.py` — Execution Engine, `app/routes/production.py` — Gantt Scheduler, Edit with Caution, Entry Points, FactoryNXT_PY_V2 — Structural Knowledge Graph, Governance (+24 more)

### Community 45 - "tsconfig.json"
Cohesion: 0.15
Nodes (12): InsertNotification, InsertNotificationDeliveryAttempt, InsertNotificationTemplate, Notification, notificationChannelEnum, NotificationDeliveryAttempt, notificationDeliveryAttempts, notificationPriorityEnum (+4 more)

### Community 50 - "BlueprintCatalog"
Cohesion: 0.12
Nodes (22): Artifact, ArtifactId, ArtifactKind, ArtifactStorageKind, ArtifactSummary, CreateArtifactInput, hasInlineContent(), CreateGenerationRunInput (+14 more)

### Community 51 - "task.ts"
Cohesion: 0.17
Nodes (10): CreateTaskPayloadInput, CreateTaskPayloadInputSchema, TaskPayload, TaskPayloadId, TaskPayloadIdSchema, TaskPayloadSchema, TaskPayloadSummary, TaskPayloadSummarySchema (+2 more)

### Community 52 - "auth.ts"
Cohesion: 0.14
Nodes (15): AuditLogsQueryParams, GET(), parseJsonField(), POST(), calculateQuotaStatus(), GET(), POST(), QuotasQueryParams (+7 more)

### Community 53 - "rbac.ts"
Cohesion: 0.17
Nodes (11): compilerOptions, outDir, rootDir, exclude, extends, include, dist, node_modules (+3 more)

### Community 54 - "ADR-0006 — `createdBy` Session Sweep Plan"
Cohesion: 0.18
Nodes (10): compilerOptions, lib, outDir, rootDir, extends, include, ES2022, src/**/* (+2 more)

### Community 55 - "ADR-0007 — Phase 1 UI Consolidation Pattern"
Cohesion: 0.22
Nodes (8): CreateWorkspaceForm(), errStyle, inputStyle, PageProps, tdStyle, thStyle, WorkspacesList(), Workspace

### Community 59 - "tsconfig.json"
Cohesion: 0.12
Nodes (15): artifacts, InsertRollbackArtifactMapping, InsertRollbackRequest, InsertSnapshot, InsertSnapshotMetadataStorage, RollbackArtifactMapping, rollbackArtifactMappings, RollbackRequest (+7 more)

### Community 60 - "tsconfig.json"
Cohesion: 0.06
Nodes (30): ADR-0012: Prompt-to-Spec Engine Architecture, Blueprint Integration (Phase 5 Bridge), Consequences, Context and Problem Statement, Decision Drivers, Decision Options Considered, Follow-Up Tasks for Phase 4 Implementation, Idempotency and Deduplication Flow (+22 more)

### Community 61 - "tsconfig.json"
Cohesion: 0.20
Nodes (9): Artifact, artifactContentTypeEnum, artifacts, artifactStorageTypeEnum, ArtifactVerificationLog, evidenceTypeEnum, InsertArtifact, InsertArtifactVerificationLog (+1 more)

### Community 62 - "tsconfig.json"
Cohesion: 0.25
Nodes (5): authConfig, ADR-0008, nextAuth, ADR-0008, config

### Community 64 - "InMemoryBlueprintLoader"
Cohesion: 0.22
Nodes (6): EXAMPLE_DIE_ENTITY, EXAMPLE_EXTRUSION_BLUEPRINT, EXAMPLE_GENEALOGY_EVENT_ENTITY, EXAMPLE_OPERATION_TRANSACTION_ENTITY, EXAMPLE_PCB_BLUEPRINT, EXAMPLE_WORK_ORDER_ENTITY

### Community 65 - "generation-run.ts"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.base.json, $schema

### Community 66 - "Phase 3 — Industrial Blueprint Extraction"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.base.json, $schema

### Community 67 - "Phase 0 — Multi-Repo Audit ✓ COMPLETE"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.base.json, $schema

### Community 68 - "local-path.ts"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.base.json, $schema

### Community 73 - "Phase 4 — Prompt-to-Spec Engine"
Cohesion: 0.07
Nodes (28): API Boundaries, Edit with Caution, Entry Points, Extrusion Add-on — APS (`models_aps.py`), Extrusion Core — Admin / User / Misc, Extrusion Core — Equipment, Extrusion Core — Integration, Extrusion Core — KPI / Alert (+20 more)

### Community 74 - "Phase 5 — Blueprint Selection and Composition"
Cohesion: 0.07
Nodes (27): ADR-0003: Industrial Blueprint Sources, Blueprint Extraction Strategy, Blueprint Schema Design, Consequences, Context, Decision, Domain Model Derivation, FactoryNXT_PY_v2_Extrusion (Aluminum Extrusion) (+19 more)

### Community 76 - "Phase 7 — Validation and Review Loop"
Cohesion: 0.48
Nodes (5): createDb(), db, DbClient, getDb(), HeyNxtDb

### Community 77 - "Phase 8 — Industrial Runtime Services"
Cohesion: 0.29
Nodes (6): ApprovalDecision, approvalDecisions, InsertApprovalDecision, InsertRerunRequest, RerunRequest, rerunRequests

### Community 83 - "First-Time Setup"
Cohesion: 0.40
Nodes (4): ValidationResultDbRecord, validationResults, ValidationRun, validationRuns

### Community 85 - "pcb-blueprint.ts"
Cohesion: 0.83
Nodes (3): createExtrusionBlueprints(), createExtrusionDieLifecycleBlueprint(), createExtrusionOperationsBlueprint()

### Community 86 - "next.config.mjs"
Cohesion: 0.83
Nodes (3): createPcbBlueprints(), createPcbGenealogyBlueprint(), createPcbSerialExecutionBlueprint()

### Community 98 - "README.md"
Cohesion: 0.07
Nodes (26): 1. Schema Design — PromptSpec in `core-types`, 2. Input Schemas for Mutations, 3. Module Structure in `packages/prompt-spec/src/`, 4. Export Strategy, 5. Idempotency via Stability Hash, ADR-0011: Prompt-to-Spec Engine Architecture (Phase 4), Alternative 1: LLM-Only Parsing, Alternative 2: Form-First Input (+18 more)

### Community 99 - "apps/web"
Cohesion: 0.08
Nodes (24): 1. Current State (from `graphify/heynxt-core/`), 2. Reference Repo Synthesis (from graphify reports), 3. Reuse Matrix (summary; full version in `buildplan.md` Phase 0), 4. Gap Analysis — What's Missing Between Current State and Target, 5. Summary: Three Blockers, One Slice, 6. Proposed Task 1, 7. Decision Required, Commands Run (+16 more)

### Community 100 - "apps/web/README.md"
Cohesion: 0.06
Nodes (31): API Routes Implemented (`apps/web/src/app/api/`), Approvals (`/api/approvals`), Artifacts Phase8 (`/api/artifacts/phase8`), Audit Logs (`/api/audit-logs`), Completed Phases, Current State: Phase 8 COMPLETE, Phase 9 COMPLETE, Exit Criteria Status, Graphify Update Status (Pending) (+23 more)

### Community 101 - "apps/web/package.json"
Cohesion: 0.09
Nodes (22): 1. Schema Design — Blueprint Metadata (in `core-types`), 2. Domain Entity Schema — Industrial Entities, 3. Registry Infrastructure — Three Interfaces, 4. Composition Plan Schema, ADR-0010: Blueprint Registry Architecture, Alternative 1: JSON-based Blueprint Storage (vs. DB schema), Alternative 2: LLM-assisted Blueprint Matching (vs. keyword-based), Alternative 3: Single Monolithic Blueprint Schema (vs. Family/Domain classification) (+14 more)

### Community 102 - "apps/web/src/index.ts"
Cohesion: 0.10
Nodes (20): 1. Adapter pattern for agents (`lib/sandbox/agents/index.ts`), 2. Sandboxed execution (`lib/sandbox/creation.ts` + `lib/sandbox/commands.ts`), 3. Streaming JSON output (claude.ts — reference implementation), 4. Session resumption, 5. Background orchestration via Next.js `after()`, 6. Per-user encrypted API keys + AI Gateway proxying, API Boundaries, Critical Files / High Blast Radius (+12 more)

### Community 103 - "apps/web/tsconfig.json"
Cohesion: 0.09
Nodes (22): 1) Coding agent execution reference, 2) Industrial blueprint reference — aluminum extrusion, 3) Industrial blueprint reference — PCB/electronics MES, Architecture Principles, CLI Behavior, Context Management, Core Rules, Current Phase (+14 more)

### Community 104 - "{ GET, POST }"
Cohesion: 0.14
Nodes (9): ArtifactKind, ArtifactKindEnum, getContentType(), POST(), UploadArtifactInput, ApiErrorBody, ForbiddenError, NextApiError (+1 more)

### Community 105 - "buildplan.md"
Cohesion: 0.12
Nodes (17): ADR-0001: Monorepo and Boundaries, Consequences, Context, Decision, Dependency Rules, Migration Plan, Monorepo Structure, Negative (+9 more)

### Community 106 - "docker-compose.yml"
Cohesion: 0.12
Nodes (17): ADR-0004: ORM and Database Choice for Control Plane, Consequences, Considered Alternatives, Context, Decision, Decisions locked in (Task 4), Follow-ups (all landed), Implementation status (as of 2026-07-09) (+9 more)

### Community 107 - "docs/adr/0001-monorepo-and-boundaries.md"
Cohesion: 0.12
Nodes (17): 1. Install dependencies, 2. Create your local env file, 3. Start the local Postgres container, Container starts unhealthy, Daily Workflow, Database Details, `DATABASE_URL` connection refused, `docker compose: command not found` (+9 more)

### Community 108 - "docs/adr/0002-agent-substrate.md"
Cohesion: 0.08
Nodes (26): 1. Adapter Pattern with Uniform Contract, 2. Sandboxed Execution, 3. Streaming Output, 4. Credential Management, 5. Resumable Sessions, Adaptation for HeyNXT, ADR-0002: Agent Substrate and Execution Model, Agent Spec Schema (+18 more)

### Community 109 - "docs/adr/0003-industrial-blueprint-sources.md"
Cohesion: 0.13
Nodes (15): ADRs, 🏗️ Architecture Overview, Coding Agent Substrate, 🤝 Contributing, 🎯 Current Phase: Phase 1 — Product Control Plane Foundation, 📚 Documentation, For Claude Sessions, HeyNXT Core - Industrial AI App Builder Platform (+7 more)

### Community 110 - "docs/adr/0004-orm-and-database.md"
Cohesion: 0.14
Nodes (13): API Contract, Artifacts, Generation Runs, Health, @heynxt/web, Local Setup, Package Dependencies (runtime), Projects (+5 more)

### Community 111 - "docs/architecture/overview.md"
Cohesion: 0.14
Nodes (13): ADR-0008 — Auth Library and OAuth Provider, Affected Code Surface (preview for next task), Affected Schema Surface, Consequences, Context, Costs / Tradeoffs, Decision, Exit Criteria for This Decision (+5 more)

### Community 112 - "docs/dev-setup.md"
Cohesion: 0.17
Nodes (11): ADR-0009: Migrations — Forward-Only with Reset as Phase 1 Reversibility, Consequences, Context, Decision, Option A — Hand-write down migrations for every forward migration, Option B — Treat `pnpm db:migrate:reset` as the reversibility mechanism, Option C — Defer reversibility entirely to Phase 9, Options Considered (+3 more)

### Community 113 - "docs/gap-analysis.md"
Cohesion: 0.15
Nodes (12): InsertWorkflowDefinition, InsertWorkflowInstance, InsertWorkflowTransition, WorkflowDefinition, workflowDefinitions, workflowDefinitionStatusEnum, workflowDomainEnum, WorkflowInstance (+4 more)

### Community 115 - "packages/agent-adapter/package.json"
Cohesion: 0.12
Nodes (17): Architectural Layers, Architecture Overview, Blueprint Loading Flow, Data Flow, Extension Points, Layer 1: Shared Schema Layer (`@heynxt/core-types`), Layer 2: Domain Models Layer (`@heynxt/domain-models`), Layer 3: Blueprint Registry Layer (`@heynxt/blueprint-registry`) (+9 more)

### Community 116 - "packages/agent-adapter/src/index.ts"
Cohesion: 0.22
Nodes (8): ADR-0006 — `createdBy` Session Sweep Plan, Consequences, Context, Costs / Tradeoffs, Decision, Exit Criteria for the Sweep, Rationale, Sweep Plan

### Community 117 - "packages/agent-adapter/tsconfig.json"
Cohesion: 0.22
Nodes (8): ADR-0007 — Phase 1 UI Consolidation Pattern, Consequences, Context, Conventions, Costs / Tradeoffs, Decision, Rationale, Revisit Triggers

### Community 118 - "packages/blueprint-registry/package.json"
Cohesion: 0.22
Nodes (9): Cross-Repo Navigation, File Contents, Graphify — Unified Repo Map, How Graphs Are Generated, How to Use This Map, Layout, Priority Order for Any Repo, Refreshing a Graph (+1 more)

### Community 119 - "packages/blueprint-registry/src/index.ts"
Cohesion: 0.25
Nodes (7): ADR-0005 — Client Form Pattern (fetch + router.refresh), Consequences, Context, Costs / Tradeoffs, Decision, Rationale, Revisit When

### Community 120 - "packages/blueprint-registry/tsconfig.json"
Cohesion: 0.17
Nodes (11): InsertSecret, InsertSecretAccessLog, InsertSecretRotationHistory, rotationPolicyEnum, Secret, SecretAccessLog, secretAccessLogs, SecretRotationHistory (+3 more)

### Community 121 - "packages/core-types/package.json"
Cohesion: 0.31
Nodes (9): DELETE(), evaluateCondition(), EvaluateRuleInput, GET(), getFieldFromContext(), parseJsonField(), POST(), PUT() (+1 more)

### Community 122 - "packages/core-types/src/index.ts"
Cohesion: 0.60
Nodes (5): buildAcceptUrl(), findPendingInvitation(), findUserByEmail(), generateToken(), POST()

### Community 123 - "packages/core-types/src/schemas/artifact.ts"
Cohesion: 0.22
Nodes (10): executeAgentInBackground(), POST(), TODO: Stream events to client via SSE or store in DB, uuidValidate(), metadata, RootLayout(), AuthenticatedSession, getSession() (+2 more)

### Community 124 - "packages/core-types/src/schemas/audit-log.ts"
Cohesion: 0.33
Nodes (6): Blueprint Extraction Targets, Dependencies, Exit Criteria, Initial Blueprint Families, Phase 3 — Industrial Blueprint Extraction, Risks

### Community 125 - "packages/core-types/src/schemas/control-plane.test.ts"
Cohesion: 0.33
Nodes (6): Completed Deliverables, Cross-Repo Reuse Matrix, Exit Criteria, Files Changed, Gaps Documented, Phase 0 — Multi-Repo Audit ✓ COMPLETE

### Community 126 - "packages/core-types/src/schemas/generation-run.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T1 — Phase 1: ORM + DB selection, ADR 0004

### Community 127 - "packages/core-types/src/schemas/organization.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T2 — Phase 1: Zod schemas: user, org, workspace, project, task, artifact, generation-run, rbac

### Community 128 - "packages/core-types/src/schemas/project.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T3 — Phase 1: DB migrations + ORM layer

### Community 129 - "packages/core-types/src/schemas/rbac.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T4 — Phase 1: Control plane API routes (REST/tRPC)

### Community 130 - "packages/core-types/src/schemas/task.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T5 — Phase 1: Next.js auth + workspace UI

### Community 131 - "packages/core-types/src/schemas/user.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P1-T6 — Phase 1: RBAC middleware + activity log

### Community 132 - "packages/core-types/src/schemas/workspace.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T1 — Phase 2: AgentSpec + AgentExecutionResult Zod schemas

### Community 133 - "packages/core-types/tsconfig.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T2 — Phase 2: AgentRuntime interface + Vercel AI SDK adapter

### Community 134 - "packages/core-types/vitest.config.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T3 — Phase 2: Sandbox lifecycle manager

### Community 135 - "packages/domain-models/package.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T4 — Phase 2: Streaming JSON stdout parser + progress tracker

### Community 136 - "packages/domain-models/src/index.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T5 — Phase 2: Branch-per-task Git flow + task-to-commit traceability

### Community 137 - "packages/domain-models/tsconfig.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P2-T6 — Phase 2: POST /api/tasks/:id/execute end-to-end wiring

### Community 138 - "packages/persistence/README.md"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T1 — Phase 3: domain-models: Equipment + Process Zod schemas

### Community 139 - "packages/persistence/drizzle.config.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T2 — Phase 3: domain-models: Material + Quality + Production schemas

### Community 140 - "packages/persistence/drizzle/0000_great_sunspot.sql"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T3 — Phase 3: domain-models: Traceability + Reliability schemas

### Community 141 - "packages/persistence/drizzle/meta"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T4 — Phase 3: blueprint-registry: loader + catalog + validator

### Community 142 - "packages/persistence/package.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T5 — Phase 3: Blueprint family extraction: Extrusion + Production Execution

### Community 143 - "packages/persistence/src/index.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P3-T6 — Phase 3: Blueprint family extraction: Quality + Maintenance + Traceability

### Community 144 - "packages/persistence/src/schema/artifacts.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P4-T1 — Phase 4: PromptSpec + SpecTemplate Zod schemas

### Community 145 - "packages/persistence/src/schema/audit-log.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P4-T2 — Phase 4: Prompt parser (NL → structured intent)

### Community 146 - "packages/persistence/src/schema/generation-runs.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P4-T3 — Phase 4: Spec generator (intent → SpecTemplate via LLM)

### Community 147 - "packages/persistence/src/schema/index.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P4-T4 — Phase 4: Spec validation + idempotency test

### Community 148 - "packages/persistence/src/schema/organizations.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P5-T1 — Phase 5: Blueprint selection algorithm (keyword → scored candidates)

### Community 149 - "packages/persistence/src/schema/projects.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P5-T2 — Phase 5: Composition engine (base + module + role + KPI packs)

### Community 150 - "packages/persistence/src/schema/role-assignments.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P5-T3 — Phase 5: Versioned blueprint plan + manual override with audit trail

### Community 151 - "packages/persistence/src/schema/tasks.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T1 — Phase 6: Generation pipeline orchestrator (9-stage runner)

### Community 152 - "packages/persistence/src/schema/users.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T2 — Phase 6: Stage 1-3: Normalize spec + resolve blueprint + generate schema

### Community 153 - "packages/persistence/src/schema/workspaces.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T3 — Phase 6: Stage 4-6: Permissions + backend modules + frontend modules

### Community 154 - "packages/persistence/tsconfig.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T4 — Phase 6: Stage 7-9: Workflows + fixtures/tests + deployment metadata

### Community 155 - "packages/persistence/vitest.config.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P6-T5 — Phase 6: End-to-end: prompt → generated runnable app slice

### Community 156 - "packages/prompt-spec/package.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P7-T1 — Phase 7: Automated validation suite (lint + typecheck + test + migrations + smoke)

### Community 157 - "packages/prompt-spec/src/index.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P7-T2 — Phase 7: PR creation automation with evidence attachment

### Community 158 - "packages/prompt-spec/tsconfig.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P7-T3 — Phase 7: Review loop: approve/reject → rerun with feedback

### Community 159 - "vitest.config.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P8-T1 — Phase 8: Workflow engine: state machine executor with audit trail

### Community 160 - "drizzle.config.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P8-T2 — Phase 8: Event ingestion service (PLC signals, barcode scans, sensors)

### Community 161 - "vitest.config.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P8-T3 — Phase 8: Rules engine + KPI aggregation (OEE, throughput, quality rate)

### Community 162 - "pnpm-lock.yaml"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P8-T4 — Phase 8: Notification + scheduler services

### Community 163 - "pnpm-workspace.yaml"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T1 — Phase 9: Tenant isolation enforcement + workspace-scoped data access audit

### Community 164 - "tsconfig.base.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T2 — Phase 9: Immutable audit log (all state-changing ops)

### Community 165 - "tsconfig.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T3 — Phase 9: Secret management + per-workspace secret scopes

### Community 166 - "turbo.json"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T4 — Phase 9: Quota enforcement + observability (Prometheus, Grafana, Loki)

### Community 167 - "validator.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T5 — Phase 9: Rollback system + one-click revert per generation run

### Community 168 - "artifact.ts"
Cohesion: 0.33
Nodes (5): Completion, Context, Execution Protocol (CLAUDE.md Work Order), Exit Criteria, Task P9-T6 — Phase 9: Production readiness: security review + runbook + pilot sign-off

### Community 169 - "Architectural Layers"
Cohesion: 0.40
Nodes (5): Definition of Done, HeyNXT Core — Build Plan, Implementation Phases, Objective, Summary

### Community 170 - "workspace.ts"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 1 — Product Control Plane Foundation, Risks, Scope

### Community 171 - "Troubleshooting"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 2 — Agent Execution Integration, Risks, Scope

### Community 172 - "ValidateRoutesStage"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 4 — Prompt-to-Spec Engine, Risks, Scope

### Community 173 - "GenerateBackendStage"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 5 — Blueprint Selection and Composition, Risks, Scope

### Community 174 - "GenerateFixturesTestsStage"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 6 — Generation Pipeline, Risks, Scope

### Community 175 - "GenerateFrontendStage"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 7 — Validation and Review Loop, Risks, Scope

### Community 176 - "validation-stage.ts"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 8 — Industrial Runtime Services, Risks, Scope

### Community 177 - "ValidateBuildStage"
Cohesion: 0.40
Nodes (5): Dependencies, Exit Criteria, Phase 9 — Governance and Hardening, Risks, Scope

### Community 178 - "DefaultPipelineBuilder"
Cohesion: 0.40
Nodes (4): Absolute Rules, Completion Signal Format (MANDATORY — output EXACTLY one of these), HeyNXT Autonomous Loop Session, Read Before Executing

### Community 179 - "GenerateWorkflowsStage"
Cohesion: 0.40
Nodes (4): Design decisions, @heynxt/persistence, References, What it exposes

### Community 180 - "ResolveBlueprintPlanStage"
Cohesion: 0.50
Nodes (4): 1) Coding agent execution reference, 2) Industrial blueprint references, 3) Product platform repository, Source-of-Truth Repositories

### Community 181 - "ValidateTestsStage"
Cohesion: 0.50
Nodes (4): A. Control Plane, Architecture Intent, B. Agent Execution Adapter, C. Industrial Blueprint Engine

### Community 182 - "rbac.ts"
Cohesion: 0.22
Nodes (8): CreateTaskInput, isTaskTerminal(), TaskSummary, TaskType, User, UserId, UserStatus, UserSummary

### Community 183 - "tenant-isolation.ts"
Cohesion: 0.22
Nodes (8): AccessControlLog, accessControlLogs, InsertAccessControlLog, InsertTenantIsolationRule, isolationRuleTypeEnum, isolationScopeEnum, TenantIsolationRule, tenantIsolationRules

### Community 184 - "runtime-events.ts"
Cohesion: 0.25
Nodes (7): eventPriorityEnum, EventProcessingLog, eventSourceEnum, InsertEventProcessingLog, InsertRuntimeEvent, RuntimeEvent, runtimeEvents

### Community 185 - "route.ts"
Cohesion: 0.47
Nodes (5): ApprovalsQueryParams, DecisionInput, GET(), POST(), RollbackStatusEnum

### Community 186 - "route.ts"
Cohesion: 0.53
Nodes (5): BulkEventsInput, EventsQueryParams, GET(), POST(), RuntimeEventSchema

### Community 187 - "route.ts"
Cohesion: 0.53
Nodes (5): GET(), NotificationsQueryParams, POST(), SendNotificationInput, simulateNotificationDelivery()

### Community 188 - "route.ts"
Cohesion: 0.53
Nodes (5): evaluateCondition(), EvaluateRuleInput, getFieldFromContext(), parseJsonField(), POST()

### Community 189 - "route.ts"
Cohesion: 0.53
Nodes (5): CreateRuleInput, GET(), parseJsonField(), POST(), RulesQueryParams

### Community 190 - "UserMenu.tsx"
Cohesion: 0.40
Nodes (4): initialsFor(), SessionUser, UserMenu(), UserMenuProps

### Community 191 - "audit-log.ts"
Cohesion: 0.33
Nodes (5): AuditAction, AuditEntityType, AuditLogEntry, AuditLogId, createStatusChangeEntry()

### Community 192 - "workspace.ts"
Cohesion: 0.33
Nodes (5): CreateWorkspaceInput, WorkspaceLookupKey, WorkspaceSlug, WorkspaceStatus, WorkspaceSummary

### Community 193 - "route.ts"
Cohesion: 0.60
Nodes (4): ApprovalQueryParams, CreateApprovalDecisionInput, GET(), POST()

### Community 194 - "route.ts"
Cohesion: 0.60
Nodes (4): CreateValidationRunInput, GET(), POST(), ValidationRunsQueryParams

### Community 195 - "route.ts"
Cohesion: 0.60
Nodes (4): CreateWorkflowDefinitionInput, GET(), POST(), WorkflowDefinitionsQueryParams

## Knowledge Gaps
- **1270 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `dev` (+1265 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `POST()` connect `packages/core-types/src/schemas/artifact.ts` to `index.ts`, `index.ts`, `agent-spec.ts`, `task.ts`, `auth.ts`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `TaskStatus` connect `packages/core-types/src/schemas/artifact.ts` to `BlueprintCatalog`, `rbac.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `NOTE: This file should not be edited`, `nextConfig`, `name` to the rest of the system?**
  _1276 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `errorResponse` be split into smaller, more focused modules?**
  _Cohesion score 0.05359937402190924 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07380520266182698 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03773584905660377 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._