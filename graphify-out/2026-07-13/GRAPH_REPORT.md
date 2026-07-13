# Graph Report - /home/mohan/heynxt-core  (2026-07-13)

## Corpus Check
- 241 files · ~171,880 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1700 nodes · 2735 edges · 98 communities (71 shown, 27 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

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

## God Nodes (most connected - your core abstractions)
1. `errorResponse()` - 33 edges
2. `badRequest()` - 32 edges
3. `GenerationStageInput` - 28 edges
4. `requireAuth()` - 25 edges
5. `parseJsonBody()` - 24 edges
6. `GenerationStage` - 23 edges
7. `requirePermission()` - 21 edges
8. `ValidationStage` - 21 edges
9. `LocalPathBlueprintLoader` - 21 edges
10. `insertAuditEntry()` - 19 edges

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

## Communities (98 total, 27 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.09
Nodes (61): GET(), POST(), GET(), POST(), GET(), buildAcceptUrl(), findPendingInvitation(), findUserByEmail() (+53 more)

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
Cohesion: 0.08
Nodes (38): agentExecutionResults, agentSpecs, agentStatusEnum, agentTypeEnum, executionResultStatusEnum, ADR-0008, aggregationWindowTypeEnum, InsertKpiCalculationJob (+30 more)

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
Cohesion: 0.07
Nodes (29): metadata, RootLayout(), initialsFor(), SessionUser, UserMenu(), UserMenuProps, ^build, .env (+21 more)

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
Cohesion: 0.17
Nodes (16): accounts, artifactKindEnum, artifacts, artifactStorageKindEnum, generationRuns, generationRunStatusEnum, projects, projectStatusEnum (+8 more)

### Community 25 - "workspace.ts"
Cohesion: 0.10
Nodes (21): dependencies, @heynxt/core-types, zod, devDependencies, typescript, exports, import, @heynxt/core-types (+13 more)

### Community 26 - "LocalPathBlueprintLoader"
Cohesion: 0.10
Nodes (21): dependencies, @heynxt/core-types, zod, devDependencies, typescript, exports, import, @heynxt/core-types (+13 more)

### Community 27 - "control-plane.test.ts"
Cohesion: 0.15
Nodes (9): BlueprintMetadata, BlueprintValidator, BlueprintValidatorImpl, CompositionPlan, createValidator(), DomainEntity, ValidationReport, ValidationResult (+1 more)

### Community 28 - "blueprint.ts"
Cohesion: 0.10
Nodes (20): Artifact, ArtifactBase, ArtifactContentType, ArtifactId, ArtifactStorageType, ContentHash, DownloadArtifactRequest, DownloadArtifactResponse (+12 more)

### Community 30 - "ADR-0004: ORM and Database Choice for Control Plane"
Cohesion: 0.12
Nodes (16): WorkspacesPage(), AuditAction, AuditEntityType, AuditLogEntry, AuditLogId, createStatusChangeEntry(), Organization, OrganizationId (+8 more)

### Community 31 - "Architecture Overview"
Cohesion: 0.12
Nodes (4): createStageExecution(), DefaultGenerationPipeline, MockGenerationStage, GenerationStageInput

### Community 32 - "page.tsx"
Cohesion: 0.16
Nodes (17): fileEvidenceService, kpiAggregation, notifications, rulesEngine, runtimeEvents, workflowDefinitions, ValidationCheckType, ValidationResult (+9 more)

### Community 33 - "InMemoryBlueprintCatalog"
Cohesion: 0.11
Nodes (13): BlueprintDomain, BlueprintFamily, BlueprintMetadata, BlueprintPack, BlueprintSummary, BlueprintTag, CompositionPlan, CreateBlueprintInput (+5 more)

### Community 34 - "HeyNXT Core - Industrial AI App Builder Platform"
Cohesion: 0.11
Nodes (18): ApiEndpointDefinition, AppType, AuditRequirement, BlueprintHint, CreatePromptInput, DeploymentProfile, IntegrationDefinition, ParsedIntent (+10 more)

### Community 35 - "tsconfig.json"
Cohesion: 0.11
Nodes (17): CreatePipelineInput, GenerationArtifact, GenerationPipelineExecution, GenerationStageExecution, GenerationStageInput, GenerationStageInputSchema, GenerationStageName, GenerationStageOutput (+9 more)

### Community 36 - "API Contract"
Cohesion: 0.14
Nodes (14): CreateTaskForm(), errStyle, inputStyle, ProjectOption, ADR-0006, WorkspaceOption, defaultStatusColor, getStatusColor() (+6 more)

### Community 37 - "ADR-0008 — Auth Library and OAuth Provider"
Cohesion: 0.14
Nodes (12): BlueprintDomain, BlueprintFamily, BlueprintFilter, BlueprintPagination, BlueprintSort, BlueprintTag, CatalogQueryResult, createEmptyCatalog() (+4 more)

### Community 38 - "agent-spec.ts"
Cohesion: 0.20
Nodes (11): auditActionEnum, auditEntityTypeEnum, auditLog, invitations, invitationStatusEnum, ADR-0008, organizations, organizationStatusEnum (+3 more)

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
Cohesion: 0.17
Nodes (11): Invitation, InvitationId, InvitationStatus, InvitationSummary, InviteUserInput, getRolePermissions(), Permission, ROLE_DEFINITIONS (+3 more)

### Community 45 - "tsconfig.json"
Cohesion: 0.15
Nodes (12): InsertNotification, InsertNotificationDeliveryAttempt, InsertNotificationTemplate, Notification, notificationChannelEnum, NotificationDeliveryAttempt, notificationDeliveryAttempts, notificationPriorityEnum (+4 more)

### Community 50 - "BlueprintCatalog"
Cohesion: 0.26
Nodes (9): ALLOWED_PROJECT_STATUS_TRANSITIONS, CreateProjectInput, isProjectStatusTransitionAllowed(), Project, ProjectLookupKey, ProjectSlug, ProjectStatus, ProjectSummary (+1 more)

### Community 51 - "task.ts"
Cohesion: 0.17
Nodes (10): CreateTaskPayloadInput, CreateTaskPayloadInputSchema, TaskPayload, TaskPayloadId, TaskPayloadIdSchema, TaskPayloadSchema, TaskPayloadSummary, TaskPayloadSummarySchema (+2 more)

### Community 52 - "auth.ts"
Cohesion: 0.17
Nodes (11): InsertRule, InsertRuleEvaluationLog, InsertRuleViolation, RuleDefinition, ruleDomainEnum, RuleEvaluationLog, rules, ruleStatusEnum (+3 more)

### Community 53 - "rbac.ts"
Cohesion: 0.17
Nodes (11): compilerOptions, outDir, rootDir, exclude, extends, include, dist, node_modules (+3 more)

### Community 54 - "ADR-0006 — `createdBy` Session Sweep Plan"
Cohesion: 0.18
Nodes (10): compilerOptions, lib, outDir, rootDir, extends, include, ES2022, src/**/* (+2 more)

### Community 55 - "ADR-0007 — Phase 1 UI Consolidation Pattern"
Cohesion: 0.22
Nodes (8): CreateWorkspaceForm(), errStyle, inputStyle, PageProps, tdStyle, thStyle, WorkspacesList(), Workspace

### Community 60 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): CreateTaskInput, isTaskTerminal(), TaskSummary, TaskType, User, UserId, UserStatus, UserSummary

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
Cohesion: 0.25
Nodes (7): Artifact, ArtifactId, ArtifactKind, ArtifactStorageKind, ArtifactSummary, CreateArtifactInput, hasInlineContent()

### Community 74 - "Phase 5 — Blueprint Selection and Composition"
Cohesion: 0.25
Nodes (7): CreateGenerationRunInput, GenerationRun, GenerationRunId, GenerationRunSnapshot, GenerationRunStatus, GenerationRunSummary, isGenerationRunTerminal()

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

## Knowledge Gaps
- **651 isolated node(s):** `nextConfig`, `name`, `version`, `private`, `dev` (+646 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `POST()` connect `index.ts` to `index.ts`, `task.ts`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `TaskStatus` connect `index.ts` to `BlueprintCatalog`, `tsconfig.json`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `NOTE: This file should not be edited`, `nextConfig`, `name` to the rest of the system?**
  _656 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08732309545317675 - nodes in this community are weakly interconnected._
- **Should `errorResponse` be split into smaller, more focused modules?**
  _Cohesion score 0.05359937402190924 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07380520266182698 - nodes in this community are weakly interconnected._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.03773584905660377 - nodes in this community are weakly interconnected._