/**
 * @heynxt/core-types — Generation Pipeline (Phase 6)
 *
 * Schemas for the multi-stage generation pipeline that transforms
 * spec + blueprint plan into implementation-ready outputs.
 */

import { z } from 'zod';

/** ------------------------------------------------------------------ */
/*  Generation Stage Types                                            */
/** ------------------------------------------------------------------ */

/**
 * Each stage produces one artifact family in a deterministic sequence.
 *
 * Phase 6 Exit Criteria: At least one complete path generates runnable output.
 */
export const GenerationStageName = z.enum([
  'normalize-spec',           // Stage 1: Normalize spec → canonical form, resolved references
  'resolve-blueprint-plan',   // Stage 2: Resolve blueprint composition → final snapshot
  'generate-schema',          // Stage 3: Generate schema → DB migrations, TS types, API contracts
  'generate-permissions',     // Stage 4: Generate permissions and roles → RBAC definitions
  'generate-backend',         // Stage 5: Generate backend modules → routes, services, repositories, models
  'generate-frontend',        // Stage 6: Generate frontend modules → pages, components, forms, lists
  'generate-workflows',       // Stage 7: Generate workflows → state machines, automations
  'generate-fixtures-tests',  // Stage 8: Generate fixtures/tests → seed data, unit/integration tests
  'generate-deployment',      // Stage 9: Generate deployment metadata → Dockerfile, env config, health checks
]);

export type GenerationStageName = z.infer<typeof GenerationStageName>;

/** Metadata about a single generation stage execution. */
export const GenerationStageExecution = z.object({
  /** Unique ID for this stage execution within the run. */
  id: z.string().uuid(),

  /** Stage name (from GenerationStageName enum). */
  stageName: GenerationStageName,

  /** Status of this stage. */
  status: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled']),

  /** Input hash from previous stage (for traceability). */
  inputHash: z.string().nullish(),

  /** Output hash for artifacts produced by this stage. */
  outputHash: z.string().nullish(),

  /** Duration in milliseconds (set on completion). */
  durationMs: z.number().int().nonnegative().nullish(),

  /** Human-readable summary of what was produced. */
  summary: z.string().nullish(),

  /** Error details if stage failed. */
  errorDetails: z.string().nullish(),

  startedAt: z.coerce.date().nullish(),
  completedAt: z.coerce.date().nullish(),
});

export type GenerationStageExecution = z.infer<typeof GenerationStageExecution>;

/** ------------------------------------------------------------------ */
/*  Stage Outputs & Artifacts                                       */
/** ------------------------------------------------------------------ */

/**
 * Base schema for all stage output artifacts.
 * Each stage produces zero or more artifacts with traceable lineage.
 */
export const GenerationArtifact = z.object({
  /** Unique artifact ID within the generation run. */
  id: z.string().uuid(),

  /** The generation run this artifact belongs to. */
  generationRunId: z.string().uuid(),

  /** Which stage produced this artifact. */
  stageName: GenerationStageName,

  /** Kind of artifact (file, config, metadata, etc.). */
  kind: z.enum([
    'source-file',        // Generated source code (.ts, .tsx, .js)
    'migration',          // Database migration file
    'type-definition',    // TypeScript type definitions
    'api-contract',       // API schema/contract (OpenAPI, etc.)
    'config-file',        // Configuration files (docker-compose, env, etc.)
    'rbac-definition',    // Role-based access control definition
    'workflow-def',       // Workflow/state machine definition
    'test-file',          // Test file (unit/integration)
    'fixture-data',       // Seed/fixture data
    'deployment-config',  // Deployment-specific metadata
    'diff',               // Diff between old and new versions
    'summary',            // Human-readable summary of generation
    'other',              // Other artifact types
  ]),

  /** Relative path within the generated output directory. */
  relativePath: z.string(),

  /** Content hash (SHA-256) for change detection. */
  contentHash: z.string().length(64),

  /** File size in bytes. */
  fileSizeBytes: z.number().int().nonnegative(),

  /** Whether this artifact is new vs. previous version of the run. */
  isNew: z.boolean(),

  /** Human-readable description of what was generated. */
  description: z.string(),

  createdAt: z.coerce.date(),
});

export type GenerationArtifact = z.infer<typeof GenerationArtifact>;

/** ------------------------------------------------------------------ */
/*  Stage Inputs & Outputs                                          */
/** ------------------------------------------------------------------ */

/** Input passed to a generation stage. Contains resolved references from prior stages. */
export const GenerationStageInputSchema = z.object({
  /** The normalized spec in canonical form. */
  spec: z.record(z.unknown()),

  /** Resolved blueprint plan snapshot. */
  blueprintPlan: z.record(z.unknown()).nullish(),

  /** Artifacts produced by previous stage (if any). */
  previousStageArtifacts: z.array(z.string()).optional(), // artifact IDs or paths

  /** Stage-specific input parameters. */
  params: z.record(z.unknown()).default({}),
});

export type GenerationStageInput = z.infer<typeof GenerationStageInputSchema>;

/** Alias for backward compatibility with agent-adapter imports */
export const GenerationStageInput = GenerationStageInputSchema;

/** Output produced by a generation stage. Contains artifacts and metadata. */
export const GenerationStageOutputSchema = z.object({
  /** Input hash this output was derived from. */
  inputHash: z.string(),

  /** Output hash for downstream stages to reference. */
  outputHash: z.string(),

  /** Artifacts produced by this stage. */
  artifacts: z.array(GenerationArtifact),

  /** Human-readable summary of what was generated. */
  summary: z.string(),

  /** Warnings during generation (non-fatal). */
  warnings: z.array(z.string()).default([]),
});

export type GenerationStageOutput = z.infer<typeof GenerationStageOutputSchema>;

/** Alias for backward compatibility with agent-adapter imports */
export const GenerationStageOutput = GenerationStageOutputSchema;

/** ------------------------------------------------------------------ */
/*  Pipeline Orchestration                                          */
/** ------------------------------------------------------------------ */

/** Complete pipeline execution record. Tracks all stages and their results. */
export const GenerationPipelineExecution = z.object({
  /** Unique ID for this pipeline execution. */
  id: z.string().uuid(),

  /** The generation run this pipeline is part of. */
  generationRunId: z.string().uuid(),

  /** Input passed to the first stage. */
  initialInput: GenerationStageInput,

  /** Stage-by-stage execution results (ordered by stage name). */
  stages: z.array(GenerationStageExecution),

  /** Final output hash from last successful stage. */
  finalOutputHash: z.string().nullish(),

  /** Overall status of the pipeline execution. */
  status: z.enum([
    'pending',     // not yet started
    'running',     // at least one stage is running/in-progress
    'partial',     // some stages succeeded, others failed
    'succeeded',   // all stages completed successfully
    'failed',      // pipeline failed (at least one required stage failed)
    'cancelled',   // pipeline was cancelled by user or system
  ]),

  /** Total duration of pipeline execution. */
  totalDurationMs: z.number().int().nonnegative().nullish(),

  startedAt: z.coerce.date().nullish(),
  completedAt: z.coerce.date().nullish(),
});

export type GenerationPipelineExecution = z.infer<typeof GenerationPipelineExecution>;

/** Input for creating a new pipeline execution. */
export const CreatePipelineInput = z.object({
  /** The generation run this pipeline is part of. */
  generationRunId: z.string().uuid(),

  /** Initial input passed to the first stage. */
  initialInput: GenerationStageInput,
});

export type CreatePipelineInput = z.infer<typeof CreatePipelineInput>;

/** ------------------------------------------------------------------ */
/*  Pipeline Configuration                                          */
/** ------------------------------------------------------------------ */

/** Which stages are required for a successful generation. */
export const RequiredStages = z.array(GenerationStageName).default([
  'normalize-spec',
  'resolve-blueprint-plan',
  'generate-schema',
  'generate-permissions',
]);

export type RequiredStages = z.infer<typeof RequiredStages>;

/** Stage execution order (topological sort of dependencies). */
export const StageExecutionOrder: GenerationStageName[] = [
  'normalize-spec',           // 1. No dependencies
  'resolve-blueprint-plan',   // 2. Depends on normalized spec
  'generate-schema',          // 3. Depends on blueprint plan
  'generate-permissions',     // 4. Depends on schema (for RBAC types)
  'generate-backend',         // 5. Depends on permissions, schema
  'generate-frontend',        // 6. Depends on backend contracts
  'generate-workflows',       // 7. Can run in parallel with frontend/backend
  'generate-fixtures-tests',  // 8. Depends on all generated code
  'generate-deployment',      // 9. Final stage, depends on everything
];

/** Stage dependencies (which stages must complete before this one). */
export const StageDependencies: Record<GenerationStageName, GenerationStageName[]> = {
  'normalize-spec': [],
  'resolve-blueprint-plan': ['normalize-spec'],
  'generate-schema': ['resolve-blueprint-plan'],
  'generate-permissions': ['generate-schema'],
  'generate-backend': ['generate-schema', 'generate-permissions'],
  'generate-frontend': ['generate-backend'],
  'generate-workflows': ['generate-schema'],
  'generate-fixtures-tests': [
    'generate-backend',
    'generate-frontend',
    'generate-workflows',
  ],
  'generate-deployment': [
    'generate-backend',
    'generate-frontend',
    'generate-fixtures-tests',
  ],
};

/** ------------------------------------------------------------------ */
/*  Validation Stage Types (Phase 7)                                */
/** ------------------------------------------------------------------ */

/**
 * Type of validation check being performed.
 * Phase 7 Exit Criteria: All automated checks must be defined and executable.
 * Note: This is distinct from prompt-spec's ValidationResult which is for LLM output validation.
 */
export const ValidationCheckType = z.enum([
  'lint',                // ESLint/formatting checks on generated code
  'typecheck',           // TypeScript strict mode compilation verification
  'unit-tests',          // Unit test execution
  'integration-tests',   // Integration test execution
  'smoke-tests',         // Smoke tests (basic functionality)
  'migration-verify',    // Migration apply and rollback testing
  'build',               // Production build verification
  'route-smoke',         // Route status checks (every route returns expected status)
  'api-smoke',           // API endpoint smoke tests
  'permissions-check',   // Role-based access enforcement verification
  'pr-creation',         // Phase 7.4: Pull request creation with evidence attachment
]);

export type ValidationCheckType = z.infer<typeof ValidationCheckType>;

/**
 * A validation stage performs automated checks on generated outputs.
 * Phase 7 Exit Criteria: Failed checks block promotion without override flag + reason.
 */
export const ValidationStageName = z.enum([
  'validate-lint',
  'validate-typecheck',
  'validate-tests',
  'validate-migrations',
  'validate-build',
  'validate-routes',
  'validate-api',
  'validate-permissions',
  'create-pr', // Phase 7.4: PR creation stage
]);

export type ValidationStageName = z.infer<typeof ValidationStageName>;

/**
 * Result of a single validation check (Phase 7).
 * Note: This is distinct from Phase 4's prompt ValidationResult which validates LLM output.
 * Phase 7 Exit Criteria: Failed checks block promotion without override flag + reason.
 */
export const ValidationResult = z.object({
  /** Unique ID for this validation result. */
  id: z.string().uuid(),

  /** Type of validation performed. */
  checkType: ValidationCheckType,

  /** Status of the validation check. */
  status: z.enum(['passed', 'failed', 'skipped']),

  /** Evidence URL/path - where logs, reports, screenshots are stored. */
  evidenceUrl: z.string().url(),

  /** Execution duration in milliseconds. */
  durationMs: z.number().int().nonnegative(),

  /** Detailed output/logs from the validation run. */
  outputLog: z.string(),

  /** Test summary (e.g., "12/15 tests passed"). */
  testSummary: z.string().nullish(),

  /** Number of issues found (errors, warnings). */
  issueCount: z.number().int().nonnegative().default(0),

  /** Whether this check blocks promotion when failed. */
  blocksPromotion: z.boolean().default(true),

  startedAt: z.coerce.date(),
  completedAt: z.coerce.date(),
});

export type ValidationResult = z.infer<typeof ValidationResult>;

/** Output produced by a validation stage. Contains validation results and evidence. */
export const ValidationStageOutputSchema = z.object({
  /** Input hash this output was derived from. */
  inputHash: z.string(),

  /** Output hash for downstream stages to reference. */
  outputHash: z.string(),

  /** Validation results produced by this stage. */
  results: z.array(ValidationResult),

  /** Human-readable summary of what was validated. */
  summary: z.string(),

  /** Warnings during validation (non-fatal). */
  warnings: z.array(z.string()).default([]),
});

export type ValidationStageOutput = z.infer<typeof ValidationStageOutputSchema>;

/** Alias for backward compatibility with agent-adapter imports */
export const ValidationStageOutput = ValidationStageOutputSchema;

/** Input passed to a validation stage. Contains artifacts to validate. */
export const ValidationStageInputSchema = z.object({
  /** The normalized spec in canonical form. */
  spec: z.record(z.unknown()),

  /** Resolved blueprint plan snapshot (for context). */
  blueprintPlan: z.record(z.unknown()).nullish(),

  /** Artifacts produced by previous stages (to be validated). */
  artifactsToValidate: z.array(z.string()).optional(), // artifact IDs or paths

  /** Stage-specific validation parameters. */
  params: z.record(z.unknown()).default({}),
});

export type ValidationStageInput = z.infer<typeof ValidationStageInputSchema>;

/** Alias for backward compatibility with agent-adapter imports */
export const ValidationStageInput = ValidationStageInputSchema;

