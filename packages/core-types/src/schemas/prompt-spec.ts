import { z } from 'zod';

/**
 * PromptSpec schemas — Phase 4: Prompt-to-Spec Engine
 *
 * This module defines the structured representation of user prompts and their
 * transformation into actionable app specifications. The flow is:
 *
 *   UserPrompt → ParsedIntent → SpecTemplate → PersistedPromptSpec
 *
 * Each stage adds structure and validates against industrial-domain constraints.
 */

/* ==========================================================================
 * PromptContext — contextual information that shapes prompt interpretation
 * ========================================================================== */

/**
 * Domain hints — which manufacturing domain is the target?
 *
 * These are not exhaustive; they're keywords that guide blueprint selection
 * and entity resolution in Phase 4's parser/generator.
 */
export const PromptDomain = z.enum([
  'extrusion', // aluminum extrusion: billets, dies, setpoints, heat treatment
  'pcb-electronics', // PCB assembly: SMT lines, feeders, stencils, genealogy
  'general-manufacturing', // generic discrete manufacturing patterns
]);

/**
 * Persona hints — who is the user? What level of expertise/authority?
 */
export const PromptPersona = z.enum([
  'operator', // day-to-day execution, limited scope
  'supervisor', // team oversight, approvals, reporting
  'engineer', // process design, setpoint profiles, quality rules
  'planner', // APS/scheduling, work order orchestration
  'admin', // workspace configuration, RBAC, integrations
]);

/**
 * Blueprint hints — optional explicit blueprint suggestions from user
 */
export const BlueprintHint = z.object({
  family: z.string().describe('Blueprint family name (e.g., "extrusion-operations")'),
  version: z.string().optional().describe('Semantic version hint, e.g., "1.2.0"'),
});

/**
 * PromptContext — the surrounding context for a prompt that shapes interpretation
 */
export const PromptContext = z.object({
  domain: PromptDomain.optional().describe(
    'Target manufacturing domain; guides blueprint selection and entity resolution'
  ),
  persona: PromptPersona.optional().describe(
    'User persona; influences RBAC, screen complexity, and approval requirements'
  ),
  blueprintHints: z.array(BlueprintHint).optional().describe(
    'Explicit blueprint suggestions from user; used as hints for selection algorithm'
  ),
  existingProjectContext: z
    .object({
      projectId: z.string().uuid(),
      relevantEntities: z.array(z.string()).describe('Entity names known in current project'),
    })
    .optional()
    .describe(
      'When continuing work on an existing project, include this to resolve entities consistently'
    ),
});

/* ==========================================================================
 * SpecTemplate — structured output from prompt parsing
 * ========================================================================== */

/**
 * AppType — what kind of application is being requested?
 */
export const AppType = z.enum([
  'mes', // manufacturing execution system
  'aps', // advanced planning and scheduling
  'kpi-dashboard', // OEE, quality rate, throughput dashboards
  'work-order-tracker', // WO lifecycle and status tracking
  'quality-system', // NCR, CAPA, inspection plans
  'maintenance-system', // PM schedules, downtime tracking
  'custom', // custom app not fitting other categories
]);

/**
 * ScreenDefinition — a single screen in the generated app
 */
export const ScreenDefinition = z.object({
  name: z.string().describe('Screen identifier, e.g., "work-order-detail"'),
  purpose: z.string().describe('What this screen does from user perspective'),
  entities: z.array(z.string()).describe('Entities displayed/edited on this screen'),
  actions: z.array(z.string()).optional().describe('Actions available (create, edit, approve)'),
});

/**
 * ApiEndpointDefinition — an API endpoint the generated app should expose
 */
export const ApiEndpointDefinition = z.object({
  path: z.string().describe('REST path, e.g., "/api/work-orders"'),
  methods: z.array(z.enum(['GET', 'POST', 'PUT', 'DELETE'])).min(1),
  description: z.string(),
});

/**
 * IntegrationDefinition — external systems to integrate with
 */
export const IntegrationDefinition = z.object({
  type: z.enum(['erp', 'plc', 'mes', 'custom-api']).describe('Integration category'),
  name: z.string().describe('Human-readable name for this integration'),
  direction: z.enum(['inbound', 'outbound', 'bidirectional']).optional(),
});

/**
 * AuditRequirement — governance requirements for audit trail
 */
export const AuditRequirement = z.enum([
  'none', // no special audit needs
  'basic', // who/when on all mutations
  'full', // before/after values, immutable log, approval workflow support
]);

/**
 * DeploymentProfile — target deployment environment
 */
export const DeploymentProfile = z.enum([
  'local-dev', // local Postgres + Next.js dev server
  'vercel-serverless', // Vercel-hosted, Neon database
  'self-hosted-k8s', // Kubernetes deployment with external DB
]);

/**
 * SpecTemplate — the structured specification extracted from a prompt
 */
export const SpecTemplate = z.object({
  appType: AppType.describe('Primary application category'),
  domain: PromptDomain.describe(
    'Manufacturing domain; must align with blueprint availability'
  ),
  personas: z.array(PromptPersona).min(1).describe(
    'Personas this app supports; influences RBAC design'
  ),
  entities: z.array(z.string()).min(1).describe(
    'Industrial entity names the app works with (e.g., "WorkOrder", "Die", "PcbBoard")'
  ),
  workflows: z.array(z.string()).optional().describe(
    'Named workflows/state machines (e.g., "work-order-lifecycle", "die-triage-fsm")'
  ),
  screens: z.array(ScreenDefinition).optional().describe('Screens to generate'),
  apis: z.array(ApiEndpointDefinition).optional().describe('API endpoints to expose'),
  kpis: z.array(z.string()).optional().describe(
    'KPIs/dashboards required (e.g., "oee", "quality-rate", "throughput")'
  ),
  integrations: z.array(IntegrationDefinition).optional().describe(
    'External systems to integrate with'
  ),
  auditRequirements: AuditRequirement.default('basic').describe(
    'Audit trail depth required for compliance/governance'
  ),
  deploymentProfile: DeploymentProfile.describe(
    'Target deployment environment; affects generated infrastructure'
  ),
});

/* ==========================================================================
 * PromptSpec — persisted record of prompt + parsed spec
 * ========================================================================== */

/**
 * ParsedIntent — what the parser extracted from the raw prompt
 */
export const ParsedIntent = z.object({
  intent: z.string().describe('Primary action verb/noun (e.g., "track work orders")'),
  keywords: z.array(z.string()).describe('Extracted domain-specific keywords'),
  confidence: z.number().min(0).max(1).describe('Parser confidence score'),
});

/**
 * PromptSpec — the complete persisted record tying prompt to spec
 */
export const PromptSpec = z.object({
  id: z.string().uuid(),
  version: z.string().describe('Semantic version of this spec (1.0.0, 1.0.1, etc.)'),

  // Raw input
  rawPrompt: z.string().max(5000).describe('Original user prompt text'),

  // Parsed components
  parsedIntent: ParsedIntent.describe('What the parser extracted from the prompt'),
  specTemplate: SpecTemplate.describe('Structured specification derived from prompt'),

  // Context at time of parsing
  context: PromptContext.optional().default({}).describe(
    'Context that shaped interpretation; empty object if none provided'
  ),

  // Blueprint selection hints (Phase 5 will resolve these)
  blueprintHints: z.array(BlueprintHint).optional().describe(
    'Blueprints suggested by parser for Phase 5 composition step'
  ),

  // Metadata
  createdBy: z.string().uuid(),
  projectId: z.string().uuid(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),

  // Stability hash — same prompt + context → same hash (idempotency check)
  stabilityHash: z.string().describe(
    'SHA-256 of normalized prompt+context; enables deduplication'
  ),
});

/* ==========================================================================
 * Input Schemas — mutations for creating/updating prompts and specs
 * ========================================================================== */

/**
 * CreatePromptInput — what a caller provides to create a new prompt spec
 */
export const CreatePromptInput = z.object({
  rawPrompt: z.string().min(1).max(5000),
  context: PromptContext.optional(),
  projectId: z.string().uuid(),
  createdBy: z.string().uuid(),
});

/**
 * UpdateSpecInput — what a caller provides to edit an existing spec
 */
export const UpdateSpecInput = z.object({
  specTemplate: SpecTemplate.partial(),
  blueprintHints: z.array(BlueprintHint).optional(),
});

/**
 * ValidationErrors — structured validation errors for specs
 */
export const ValidationErrors = z.object({
  field: z.string().describe('Field path, e.g., "screens.0.name"'),
  message: z.string().describe('Human-readable error description'),
});

/* ==========================================================================
 * Export types for Phase 4 modules in packages/prompt-spec/src/
 * ========================================================================== */

/**
 * ParseResult — output of the parser module
 */
export const ParseResult = z.object({
  success: z.boolean(),
  intent: ParsedIntent.optional(),
  specTemplate: SpecTemplate.optional(),
  errors: z.array(ValidationErrors).optional(),
});

/**
 * ValidationResult — output of the validation module
 */
export const ValidationResult = z.object({
  valid: z.boolean(),
  errors: z.array(ValidationErrors),
  warnings: z.array(z.string()).optional(),
});

/* ==========================================================================
 * Type exports for consumers of @heynxt/core-types
 * All types are inferred from the Zod schemas above using `z.infer<typeof X>`
 * Consumers can use either form:
 *   import { PromptSpec, type PromptSpec } from '@heynxt/core-types';
 * ========================================================================== */

export type PromptDomain = z.infer<typeof PromptDomain>;
export type PromptPersona = z.infer<typeof PromptPersona>;
export type BlueprintHint = z.infer<typeof BlueprintHint>;
export type PromptContext = z.infer<typeof PromptContext>;

export type AppType = z.infer<typeof AppType>;
export type ScreenDefinition = z.infer<typeof ScreenDefinition>;
export type ApiEndpointDefinition = z.infer<typeof ApiEndpointDefinition>;
export type IntegrationDefinition = z.infer<typeof IntegrationDefinition>;
export type AuditRequirement = z.infer<typeof AuditRequirement>;
export type DeploymentProfile = z.infer<typeof DeploymentProfile>;

export type SpecTemplate = z.infer<typeof SpecTemplate>;
export type ParsedIntent = z.infer<typeof ParsedIntent>;
export type PromptSpec = z.infer<typeof PromptSpec>;
export type CreatePromptInput = z.infer<typeof CreatePromptInput>;
export type UpdateSpecInput = z.infer<typeof UpdateSpecInput>;
export type ValidationErrors = z.infer<typeof ValidationErrors>;
export type ParseResult = z.infer<typeof ParseResult>;
export type ValidationResult = z.infer<typeof ValidationResult>;
