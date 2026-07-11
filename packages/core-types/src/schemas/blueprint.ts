/**
 * @heynxt/core-types — Blueprint schemas (Phase 3)
 *
 * Industrial blueprint metadata and registry types derived from FactoryNXT reference repos.
 */

import { z } from 'zod';

// ============================================================================
// Blueprint Family & Domain Categories
// ============================================================================

export const BlueprintFamily = z.enum([
  // Extrusion domain (aluminum extrusion manufacturing)
  'extrusion-operations',
  'tool-lifecycle',
  'process-recipe',
  'heat-treatment',
  'routing-dag',
  'process-execution',

  // PCB/electronics MES domain
  'serial-execution',
  'work-order',
  'operation-trace',
  'pcb-genealogy',
  'quality-inspection',
  'quality-nonconformance',

  // Cross-domain capabilities
  'oee',
  'erp-connector',
  'plc-connector',
  'aps-scheduling',

  // Governance / cross-cutting
  'approval-workflow',
]);

export type BlueprintFamily = z.infer<typeof BlueprintFamily>;

/**
 * Domain categories for blueprint classification.
 * Each family belongs to one primary domain.
 */
export const BlueprintDomain = z.enum([
  'extrusion',      // Aluminum extrusion manufacturing
  'pcb-electronics', // PCB/electronics assembly MES
  'quality',        // Quality management (cross-domain)
  'maintenance',    // Reliability & maintenance (cross-domain)
  'integration',    // External system connectors
  'analytics',      // KPI, OEE, reporting
]);

export type BlueprintDomain = z.infer<typeof BlueprintDomain>;

/**
 * Blueprint tags for filtering and search.
 */
export const BlueprintTag = z.enum([
  'work-order',
  'routing',
  'traceability',
  'serial-numbering',
  'setpoint-profile',
  'heat-treatment',
  'die-management',
  'billet-tracking',
  'inspection-plan',
  'ncr',
  'capa',
  'pm-schedule',
  'calibration',
  'downtime',
  'oee',
  'erp-integration',
  'plc-integration',
  'scheduling',
  'finite-capacity',
  'genealogy',
  'component-tracking',
  'reel-management',
  'process-execution',
  'operation-trace',
]);

export type BlueprintTag = z.infer<typeof BlueprintTag>;

// ============================================================================
// Blueprint Metadata Schema
// ============================================================================

/**
 * BlueprintMetadata — the canonical metadata record for any industrial blueprint.
 *
 * Each blueprint represents a reusable pattern extracted from FactoryNXT reference repos:
 * - `FactoryNXT_PY_v2_Extrusion` (aluminum extrusion MES)
 * - `FactoryNxT_PY_V2` (PCB/electronics MES)
 *
 * Blueprints are versioned using semantic versioning and include a source commit hash
 * for traceability back to the reference implementation.
 */
export const BlueprintMetadata = z.object({
  // Identity
  id: z.string().uuid(),

  // Human-readable name (e.g., "Extrusion Operations", "PCB Genealogy")
  name: z.string().min(1).max(200),

  // Brief description of what the blueprint provides
  description: z.string().min(1).max(2000),

  // Classification
  family: BlueprintFamily,
  domain: BlueprintDomain,

  // Versioning (semantic versioning)
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  sourceCommitHash: z.string().min(7).max(40).optional(),

  // Tags for filtering/search
  tags: z.array(BlueprintTag).default([]),

  // Source attribution (which reference repo this was extracted from)
  sourceRepo: z.enum([
    'FactoryNXT_PY_v2_Extrusion',
    'FactoryNxT_PY_V2',
    'heynxt-core-generated',
  ]).default('FactoryNXT_PY_v2_Extrusion'),

  // Relationship to other blueprints
  dependsOn: z.array(z.string().uuid()).default([]),

  // Metadata for UI/catalog display
  icon: z.string().optional(), // e.g., 'fa-industry'
  color: z.string().optional(), // hex color for UI theming

  // Lifecycle state (draft → published → deprecated)
  status: z.enum(['draft', 'published', 'deprecated']).default('draft'),

  // Timestamps
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type BlueprintMetadata = z.infer<typeof BlueprintMetadata>;

/**
 * Subset used for catalog listings (minimal info).
 */
export const BlueprintSummary = BlueprintMetadata.pick({
  id: true,
  name: true,
  description: true,
  family: true,
  domain: true,
  version: true,
  status: true,
  tags: true,
});

export type BlueprintSummary = z.infer<typeof BlueprintSummary>;

/**
 * Input schema for creating a new blueprint (without server-generated fields).
 */
export const CreateBlueprintInput = BlueprintMetadata.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
});

export type CreateBlueprintInput = z.infer<typeof CreateBlueprintInput>;

/**
 * Input schema for updating an existing blueprint.
 */
export const UpdateBlueprintInput = BlueprintMetadata.omit({
  id: true,
  createdAt: true,
}).partial();

export type UpdateBlueprintInput = z.infer<typeof UpdateBlueprintInput>;

// ============================================================================
// Domain Entity Schema (entities defined by a blueprint)
// ============================================================================

/**
 * A domain entity is a named industrial concept defined within a blueprint.
 * Examples: `Die`, `Billet`, `SetpointProfile` (extrusion);
 *           `PcbPanel`, `GenealogyEvent`, `FeederReel` (PCB).
 */
export const DomainEntity = z.object({
  // Identity within the blueprint context
  id: z.string().uuid(),

  // Blueprint this entity belongs to
  blueprintId: z.string().uuid(),

  // Entity name (e.g., "Die", "PcbPanel")
  name: z.string().min(1).max(200),

  // Brief description of what the entity represents
  description: z.string().optional(),

  // Domain category for this entity
  domainCategory: z.enum([
    'equipment',      // Machine, Station, Line, Cell, Die, Billet
    'process',        // Recipe, WorkflowStep, SetpointProfile, HeatTreatmentProgram
    'material',       // RawMaterial, Intermediate, FinishedGood, AlloyComposition
    'quality',        // InspectionPlan, Measurement, Tolerance, DefectRecord
    'production',     // WorkOrder, SerialNumber, OperationTransaction, RoutingStep
    'traceability',   // PcbPanel, PcbBoard, GenealogyEvent, TraceabilityRecord
    'reliability',    // PmSchedule, MaintenanceLog, CalibrationRecord, DowntimeEvent
  ]),

  // Attributes of this entity (name + type pairs)
  attributes: z.array(
    z.object({
      name: z.string().min(1).max(200),
      type: z.string(), // e.g., "string", "number", "date", "uuid"
      required: z.boolean().default(false),
    })
  ).default([]),

  // Relationships to other entities (by blueprintId + entityName)
  relationships: z.array(
    z.object({
      targetBlueprintId: z.string().uuid(),
      targetEntityName: z.string().min(1).max(200),
      relationType: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
      cardinality: z.enum(['1', '1..N']).default('1'),
    })
  ).default([]),

  // Lifecycle states (FSM) if applicable
  lifecycleStates: z.array(z.string()).optional(),

  // Metadata
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type DomainEntity = z.infer<typeof DomainEntity>;

/**
 * Subset for entity listings.
 */
export const DomainEntitySummary = DomainEntity.pick({
  id: true,
  name: true,
  description: true,
  domainCategory: true,
  attributes: true,
});

export type DomainEntitySummary = z.infer<typeof DomainEntitySummary>;

/**
 * Input for creating a new entity within a blueprint.
 */
export const CreateDomainEntityInput = DomainEntity.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1).max(200),
});

export type CreateDomainEntityInput = z.infer<typeof CreateDomainEntityInput>;

// ============================================================================
// Blueprint Pack (modular extension patterns)
// ============================================================================

/**
 * A blueprint pack is a modular component that can be attached to base blueprints.
 * Packs include: role packs, KPI packs, connector packs, approval/audit packs.
 */
export const BlueprintPack = z.object({
  id: z.string().uuid(),

  // Pack metadata (similar to BlueprintMetadata)
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  packType: z.enum([
    'role',           // Persona/RBAC variant
    'kpi',            // Dashboard/metrics pack
    'connector',      // ERP/PLC/external integration
    'approval',       // Governance overlay (approvals, audit)
    'workflow',       // State machine definition
  ]),

  version: z.string().regex(/^\d+\.\d+\.\d+$/),

  // Which base blueprints this pack extends
  compatibleWith: z.array(z.enum(['extrusion', 'pcb-electronics'])).default([]),

  status: z.enum(['draft', 'published', 'deprecated']).default('draft'),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type BlueprintPack = z.infer<typeof BlueprintPack>;

// ============================================================================
// Composition Plan (spec → blueprint resolution)
// ============================================================================

/**
 * A composition plan maps a spec to one or more blueprints deterministically.
 */
export const CompositionPlan = z.object({
  id: z.string().uuid(),

  // Spec this plan was generated for
  specId: z.string().uuid(),

  // Primary blueprint (base domain match)
  primaryBlueprintId: z.string().uuid(),

  // Optional module blueprints (add-ons that extend the base)
  moduleBlueprintIds: z.array(z.string().uuid()).default([]),

  // Attached packs
  rolePackId: z.string().uuid().optional(),
  kpiPackId: z.string().uuid().optional(),
  connectorPackIds: z.array(z.string().uuid()).default([]),
  approvalPackId: z.string().uuid().optional(),

  // Explainability: why each blueprint was selected
  selections: z.array(
    z.object({
      blueprintId: z.string().uuid(),
      reason: z.string(), // e.g., "added quality NCR pack because spec includes 'quality inspection' requirement"
      confidence: z.enum(['high', 'medium', 'low']).default('medium'),
    })
  ).default([]),

  // Registry version snapshot (which registry state was used)
  registrySnapshotVersion: z.string(),

  status: z.enum(['draft', 'confirmed', 'applied']).default('draft'),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CompositionPlan = z.infer<typeof CompositionPlan>;

/**
 * Input for creating a composition plan.
 */
export const CreateCompositionPlanInput = CompositionPlan.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1).max(200),
});

export type CreateCompositionPlanInput = z.infer<typeof CreateCompositionPlanInput>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a blueprint is ready for use (published status).
 */
export function isBlueprintPublished(metadata: z.infer<typeof BlueprintMetadata>): boolean {
  return metadata.status === 'published';
}

/**
 * Check if a blueprint has valid semantic versioning.
 */
export function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

/**
 * Get all blueprints in a given family.
 */
export function filterByFamily(
  blueprints: z.infer<typeof BlueprintMetadata>[],
  family: BlueprintFamily
): z.infer<typeof BlueprintMetadata>[] {
  return blueprints.filter(b => b.family === family);
}

/**
 * Get all published blueprints in a domain.
 */
export function getPublishedInDomain(
  blueprints: z.infer<typeof BlueprintMetadata>[],
  domain: BlueprintDomain
): z.infer<typeof BlueprintMetadata>[] {
  return blueprints.filter(b => b.domain === domain && b.status === 'published');
}

/**
 * Get entities belonging to a blueprint.
 */
export function getEntitiesForBlueprint(
  entities: DomainEntity[],
  blueprintId: string
): DomainEntity[] {
  return entities.filter(e => e.blueprintId === blueprintId);
}
