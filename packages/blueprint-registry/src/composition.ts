/**
 * @heynxt/blueprint-registry — Blueprint Composition Engine (Phase 5)
 *
 * Maps specs to one or more industrial blueprints deterministically.
 * Provides explainable, versioned composition plans with pack attachments.
 */

import { z } from 'zod';
import type {
  BlueprintMetadata,
  BlueprintFamily,
  BlueprintPack,
} from '@heynxt/core-types';

// ============================================================================
// Spec Input Schema (what we're composing against)
// ============================================================================

/**
 * Keywords extracted from a user spec that indicate requirements.
 */
export const SpecRequirementKeyword = z.enum([
  // Extrusion domain keywords
  'extrusion',
  'billet',
  'die-management',
  'setpoint-profile',
  'heat-treatment',

  // PCB/electronics keywords
  'pcb',
  'smt',
  'panel',
  'traceability',
  'genealogy',
  'component-tracking',
  'reel',
  'stencil',

  // Quality domain keywords
  'inspection',
  'ncr',
  'nonconformance',
  'capa',
  'defect',
  'tolerance',
  'measurement',

  // Production/execution keywords
  'work-order',
  'routing',
  'operation',
  'serial-numbering',
  'process-execution',

  // Maintenance/reliability keywords
  'maintenance',
  'pm-schedule',
  'calibration',
  'downtime',
  'repair',

  // Analytics/monitoring keywords
  'oee',
  'kpi',
  'dashboard',
  'reporting',
  'analytics',

  // Integration keywords
  'erp',
  'plc',
  'integration',
  'external-system',

  // Scheduling/optimization keywords
  'scheduling',
  'aps',
  'finite-capacity',
  'optimization',

  // Governance keywords
  'approval',
  'audit',
  'governance',
]);

export type SpecRequirementKeyword = z.infer<typeof SpecRequirementKeyword>;

/**
 * SpecInput — the minimal spec representation used for blueprint composition.
 */
export const SpecInput = z.object({
  // Human-readable name of what's being built
  name: z.string().min(1).max(200),

  // Free-text description (will be keyword-extracted)
  description: z.string().min(1).max(5000),

  // Explicitly declared domain preference (optional override)
  preferredDomain: z.enum(['extrusion', 'pcb-electronics']).optional(),

  // Required capabilities (explicit requirements)
  requiredCapabilities: z.array(SpecRequirementKeyword).default([]),

  // Optional preferences (preferred but not required)
  optionalPreferences: z.array(SpecRequirementKeyword).default([]),

  // Integration requirements
  integrations: z.array(
    z.enum(['erp', 'plc', 'mes', 'scada', 'other'])
  ).default([]),

  // Governance requirements
  requiresApprovals: z.boolean().default(false),
  requiresAuditTrail: z.boolean().default(true),
});

export type SpecInput = z.infer<typeof SpecInput>;

/**
 * Extract keywords from a spec description.
 */
export function extractKeywords(spec: SpecInput): Set<SpecRequirementKeyword> {
  const text = `${spec.name} ${spec.description}`.toLowerCase();
  const extracted = new Set<SpecRequirementKeyword>();

  // Map keywords to their textual representations (lowercase terms that indicate this requirement)
  const keywordMap: Record<string, string[]> = {
    extrusion: ['extrusion', 'aluminum extrusion'],
    billet: ['billet', 'billets'],
    'die-management': ['die management', 'tooling'],
    'setpoint-profile': ['setpoint', 'profile', 'recipe', 'parameter setting'],
    'heat-treatment': ['heat treatment', 'quenching', 'tempering', 'annealing'],

    pcb: ['pcb', 'pcba', 'electronics assembly', 'smt'],
    traceability: ['traceability', 'component tracking'],
    genealogy: ['genealogy', 'assembly history', 'lineage'],
    component: ['component placement', 'chip placement'],
    reel: ['reel management', 'feeder management'],

    inspection: ['inspection', 'visual check', 'quality check'],
    ncr: ['ncr', 'nonconformance report', 'deviation'],
    capa: ['capa', 'corrective action', 'preventive action'],
    defect: ['defect', 'flaw detection', 'issue tracking'],

    'work-order': ['work order', 'wo', 'production job'],
    routing: ['routing', 'process sequence', 'operation flow'],
    operation: ['operation execution', 'process step'],
    'serial-numbering': ['serial numbering', 'serialization', 'sn assignment'],

    maintenance: ['preventive maintenance', 'pm schedule'],
    calibration: ['equipment calibration', 'calibration tracking'],
    downtime: ['downtime tracking', 'stoppage logging'],

    oee: ['oee calculation', 'efficiency metrics'],
    kpi: ['kpi dashboard', 'metric visualization'],
    reporting: ['reporting capabilities', 'analytics reports'],

    erp: ['erp integration', 'sap integration', 'enterprise resource planning'],
    plc: ['plc integration', 'controller communication', 'automation system'],
    scheduling: ['production scheduling', 'capacity optimization'],
  };

  for (const [keyword, terms] of Object.entries(keywordMap)) {
    const capability = keyword as SpecRequirementKeyword;
    if (terms.some(term => text.includes(term))) {
      extracted.add(capability);
    }
  }

  // Add explicit capabilities from the spec
  spec.requiredCapabilities.forEach(c => extracted.add(c));
  spec.optionalPreferences.forEach(p => extracted.add(p));

  return extracted;
}

// ============================================================================
// Composition Rules (keyword → blueprint mapping)
// ============================================================================

/**
 * Defines which blueprints should be selected for each keyword.
 */
const BLUEPRINT_MATCH_RULES: Record<SpecRequirementKeyword, {
  primary?: BlueprintFamily[];
  modules?: BlueprintFamily[];
  packs?: {
    role?: string[]; // pack IDs compatible with this requirement
    kpi?: string[];
    connector?: string[];
    approval?: string[];
  };
}> = {
  // Extrusion domain
  extrusion: {
    primary: ['extrusion-operations'],
    modules: ['routing-dag', 'process-execution'],
  },
  billet: {
    primary: ['extrusion-operations'],
    modules: [],
  },
  'die-management': {
    primary: ['tool-lifecycle'],
    modules: [],
  },
  'setpoint-profile': {
    primary: ['process-recipe'],
    packs: { kpi: ['oee-dashboard'] },
  },
  'heat-treatment': {
    primary: ['heat-treatment'],
    modules: [],
  },

  // PCB domain
  pcb: {
    primary: ['pcb-genealogy'],
    modules: ['serial-execution', 'operation-trace'],
  },
  traceability: {
    primary: ['pcb-genealogy'],
    modules: ['operation-trace'],
  },
  genealogy: {
    primary: ['pcb-genealogy'],
    modules: [],
  },
  component: {
    primary: ['pcb-genealogy'],
    modules: ['serial-execution'],
  },

  // Quality domain
  inspection: {
    modules: ['quality-inspection'],
    packs: { kpi: ['quality-dashboard'] },
  },
  ncr: {
    modules: ['quality-nonconformance'],
    packs: { approval: ['ncr-approval'] },
  },
  capa: {
    modules: ['quality-nonconformance'],
    packs: { approval: ['capa-workflow'] },
  },

  // Production domain
  'work-order': {
    primary: ['work-order'],
    modules: ['serial-execution'],
  },
  routing: {
    primary: ['routing-dag'],
    modules: [],
  },
  operation: {
    modules: ['operation-trace'],
  },
  'serial-numbering': {
    modules: ['serial-execution'],
  },

  // Maintenance domain
  maintenance: {
    modules: ['pm-schedule'],
    packs: { kpi: ['maintenance-dashboard'] },
  },

  // Analytics domain
  oee: {
    primary: ['oee'],
    packs: { kpi: ['oee-dashboard'] },
  },
  reporting: {
    packs: { role: ['reporter-role'] },
  },

  // Integration domain
  erp: {
    modules: ['erp-connector'],
    packs: { connector: ['sap-erp', 'oracle-erp'] },
  },
  plc: {
    modules: ['plc-connector'],
    packs: { connector: ['siemens-plc', 'rockwell-plc'] },
  },

  // Scheduling domain
  scheduling: {
    primary: ['aps-scheduling'],
    packs: { kpi: ['scheduling-dashboard'] },
  },

  // Governance
  approval: {
    packs: { approval: ['approval-workflow-standard'] },
  },
};

// ============================================================================
// Composition Algorithm
// ============================================================================

/**
 * A selection reason explains why a blueprint was included.
 */
export const SelectionReason = z.object({
  blueprintId: z.string().uuid(),
  blueprintName: z.string(),
  blueprintFamily: z.string(),
  reason: z.string(), // human-readable explanation
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
  selectionType: z.enum(['primary', 'module', 'pack']),
});

export type SelectionReason = z.infer<typeof SelectionReason>;

/**
 * Compose a blueprint plan from a spec.
 * Returns deterministic, explainable selections with versioned registry snapshot references.
 */
export function composeBlueprintPlan(
  spec: SpecInput,
  blueprints: BlueprintMetadata[],
  packs?: BlueprintPack[]
): CompositionResult {
  const keywords = extractKeywords(spec);

  // Track which blueprints were selected and why
  const selections: SelectionReason[] = [];

  // Determine primary blueprint (base domain match)
  let primaryBlueprintId: string | null = null;

  if (spec.preferredDomain) {
    // User explicitly specified a domain preference
    const candidates = blueprints.filter(
      b => b.domain === spec.preferredDomain && b.status === 'published'
    );
    if (candidates.length > 0) {
      primaryBlueprintId = candidates[0].id;
      selections.push({
        blueprintId: candidates[0].id,
        blueprintName: candidates[0].name,
        blueprintFamily: candidates[0].family,
        reason: `Primary domain match per user preference (${spec.preferredDomain})`,
        confidence: 'high',
        selectionType: 'primary',
      });
    }
  } else {
    // Auto-detect domain from keywords
    const extrusionKeywords = ['extrusion', 'billet', 'die-management', 'heat-treatment'];
    const pcbKeywords = ['pcb', 'traceability', 'genealogy', 'smt'];

    const extrusionScore = extrusionKeywords.filter(k => keywords.has(k as SpecRequirementKeyword)).length;
    const pcbScore = pcbKeywords.filter(k => keywords.has(k as SpecRequirementKeyword)).length;

    if (extrusionScore >= pcbScore && extrusionScore > 0) {
      // Extrusion domain preferred
      const candidates = blueprints.filter(
        b => (b.domain === 'extrusion' || b.family === 'extrusion-operations') && b.status === 'published'
      );
      if (candidates.length > 0) {
        primaryBlueprintId = candidates[0].id;
        selections.push({
          blueprintId: candidates[0].id,
          blueprintName: candidates[0].name,
          blueprintFamily: candidates[0].family,
          reason: `Primary domain auto-detected as extrusion (${extrusionScore} matching keywords)`,
          confidence: 'high',
          selectionType: 'primary',
        });
      }
    } else if (pcbScore > 0) {
      // PCB domain preferred
      const candidates = blueprints.filter(
        b => b.domain === 'pcb-electronics' && b.status === 'published'
      );
      if (candidates.length > 0) {
        primaryBlueprintId = candidates[0].id;
        selections.push({
          blueprintId: candidates[0].id,
          blueprintName: candidates[0].name,
          blueprintFamily: candidates[0].family,
          reason: `Primary domain auto-detected as PCB/electronics (${pcbScore} matching keywords)`,
          confidence: 'high',
          selectionType: 'primary',
        });
      }
    }
  }

  // Select module blueprints based on requirements
  for (const keyword of keywords) {
    const rule = BLUEPRINT_MATCH_RULES[keyword];
    if (!rule) continue;

    // Process primary rules first (skip if already selected as primary)
    if (rule.primary && !primaryBlueprintId) {
      for (const family of rule.primary) {
        const candidate = blueprints.find(
          b => b.family === family && b.status === 'published'
        );
        if (candidate) {
          primaryBlueprintId = candidate.id;
          selections.push({
            blueprintId: candidate.id,
            blueprintName: candidate.name,
            blueprintFamily: candidate.family,
            reason: `Primary match for requirement "${keyword}"`,
            confidence: 'high',
            selectionType: 'primary',
          });
          break; // Only one primary per spec
        }
      }
    }

    // Process module rules
    if (rule.modules) {
      for (const family of rule.modules) {
        const candidate = blueprints.find(
          b => b.family === family && b.status === 'published'
        );
        if (candidate && !selections.some(s => s.blueprintId === candidate.id)) {
          selections.push({
            blueprintId: candidate.id,
            blueprintName: candidate.name,
            blueprintFamily: candidate.family,
            reason: `Module added for requirement "${keyword}"`,
            confidence: 'medium',
            selectionType: 'module',
          });
        }
      }
    }

    // Process pack attachments
    if (rule.packs) {
      const keywordLabel = keyword.replace('-', ' ');

      // Connector packs
      if (rule.packs.connector && spec.integrations.length > 0) {
        for (const packId of rule.packs.connector) {
          selections.push({
            blueprintId: packId,
            blueprintName: `${packId} connector`,
            blueprintFamily: 'connector' as BlueprintFamily, // placeholder - pack metadata
            reason: `Connector pack attached for "${keywordLabel}" integration`,
            confidence: 'medium',
            selectionType: 'pack',
          });
        }
      }

      // KPI packs
      if (rule.packs.kpi) {
        selections.push({
          blueprintId: rule.packs.kpi[0],
          blueprintName: `${rule.packs.kpi[0]} dashboard`,
          blueprintFamily: 'analytics' as BlueprintFamily, // placeholder - pack metadata
          reason: `KPI pack attached for "${keywordLabel}" visualization`,
          confidence: 'medium',
          selectionType: 'pack',
        });
      }

      // Approval packs
      if (rule.packs.approval && (spec.requiresApprovals || spec.requiresAuditTrail)) {
        selections.push({
          blueprintId: rule.packs.approval[0],
          blueprintName: `${rule.packs.approval[0]} workflow`,
          blueprintFamily: 'approval-workflow' as BlueprintFamily, // placeholder - pack metadata
          reason: `Approval pack attached for governance requirement`,
          confidence: 'high',
          selectionType: 'pack',
        });
      }
    }
  }

  // Add approval workflow if user requires it (but no other approval pack selected)
  if (spec.requiresApprovals && !selections.some(s => s.selectionType === 'pack' && s.blueprintName.toLowerCase().includes('approval'))) {
    selections.push({
      blueprintId: 'approval-workflow-standard',
      blueprintName: 'Standard Approval Workflow',
      blueprintFamily: 'approval-workflow' as BlueprintFamily, // placeholder - pack metadata
      reason: `Approval workflow added per user requirement (requiresApprovals=true)`,
      confidence: 'high',
      selectionType: 'pack',
    });
  }

  // Generate registry snapshot version for audit trail
  const registrySnapshotVersion = generateRegistrySnapshotVersion(blueprints, packs ?? []);

  return {
    selections,
    primaryBlueprintId: primaryBlueprintId || null,
    moduleBlueprintIds: selections.filter(s => s.selectionType === 'module').map(s => s.blueprintId),
    registrySnapshotVersion,
    specName: spec.name,
  };
}

/**
 * Generate a deterministic registry snapshot version based on current blueprints.
 */
function generateRegistrySnapshotVersion(
  blueprints: BlueprintMetadata[],
  packs?: BlueprintPack[]
): string {
  // Create a hash of all blueprint IDs and versions currently in the registry
  const ids = [...blueprints, ...(packs ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(b => `${b.id}:${b.version}`)
    .join('|');

  // Simple hash (in production, use SHA-256 or similar)
  let hash = 0;
  for (let i = 0; i < ids.length; i++) {
    const char = ids.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return `v${Math.abs(hash).toString(16).substring(0, 8)}-${blueprints.length}B`;
}

/**
 * Composition result returned from composeBlueprintPlan.
 */
export const CompositionResult = z.object({
  // List of all selections with explanations
  selections: z.array(SelectionReason),

  // Primary blueprint ID (null if no match found)
  primaryBlueprintId: z.string().uuid().nullable(),

  // Module blueprint IDs
  moduleBlueprintIds: z.array(z.string().uuid()),

  // Registry snapshot version for audit trail
  registrySnapshotVersion: z.string(),

  // Spec name this plan was generated for
  specName: z.string(),
});

export type CompositionResult = z.infer<typeof CompositionResult>;

/**
 * Validate a composition result against the current registry.
 */
export function validateCompositionPlan(
  result: CompositionResult,
  blueprintsById: Map<string, BlueprintMetadata>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check primary blueprint exists and is published
  if (result.primaryBlueprintId) {
    const primary = blueprintsById.get(result.primaryBlueprintId);
    if (!primary || !('id' in primary)) {
      errors.push(`Primary blueprint ${result.primaryBlueprintId} not found in registry`);
    } else if (primary.status !== 'published') {
      warnings.push(`Primary blueprint ${result.primaryBlueprintId} is not published (status: ${primary.status})`);
    }
  }

  // Check module blueprints exist and are published
  for (const moduleId of result.moduleBlueprintIds) {
    const module = blueprintsById.get(moduleId);
    if (!module || !('id' in module)) {
      errors.push(`Module blueprint ${moduleId} not found in registry`);
    } else if (module.status !== 'published') {
      warnings.push(`Module blueprint ${moduleId} is not published (status: ${module.status})`);
    }
  }

  // Check all selections reference valid blueprints/packs
  for (const selection of result.selections) {
    const found = blueprintsById.has(selection.blueprintId);
    if (!found && selection.selectionType !== 'pack') {
      warnings.push(`Selection ${selection.blueprintId} may not correspond to a known blueprint`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Create a CompositionPlan from a composition result.
 */
export function createCompositionPlanFromResult(
  result: CompositionResult,
  specId: string,
  overrides?: {
    status?: 'draft' | 'confirmed' | 'applied';
    rolePackId?: string;
    kpiPackId?: string;
    connectorPackIds?: string[];
    approvalPackId?: string;
  }
): CreateCompositionPlanInput {
  return {
    specId,
    primaryBlueprintId: result.primaryBlueprintId ?? '', // will be validated before save
    moduleBlueprintIds: result.moduleBlueprintIds,
    registrySnapshotVersion: result.registrySnapshotVersion,
    status: overrides?.status ?? 'draft',

    // Map selections to pack IDs (in production, this would query a pack catalog)
    rolePackId: result.selections.find(s => s.blueprintName.includes('reporter-role'))?.blueprintId,
    kpiPackId: result.selections.find(s => s.blueprintName.includes('dashboard'))?.blueprintId,
    connectorPackIds: result.selections
      .filter(s => s.selectionType === 'pack' && s.blueprintName.toLowerCase().includes('connector'))
      .map(s => s.blueprintId),
    approvalPackId: result.selections.find(s => ['approval', 'workflow'].every(term => s.blueprintName.toLowerCase().includes(term)))?.blueprintId,

    // Convert selections to composition plan format
    selections: result.selections.map(s => ({
      blueprintId: s.blueprintId,
      reason: s.reason,
      confidence: s.confidence,
    })),

    name: `Composition for ${result.specName}`,
  };
}

/**
 * Validation report for composition validation.
 */
export const ValidationResult = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type ValidationResult = z.infer<typeof ValidationResult>;

// ============================================================================
// Deterministic Composition Guarantees
// ============================================================================

/**
 * Ensure deterministic output by sorting selections consistently.
 */
export function normalizeSelections(
  selections: SelectionReason[]
): SelectionReason[] {
  return [...selections].sort((a, b) => {
    // Sort by confidence (high first), then by type (primary > module > pack), then by name
    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    const typeOrder = { primary: 0, module: 1, pack: 2 };

    if (confidenceOrder[a.confidence] !== confidenceOrder[b.confidence]) {
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    }
    if (typeOrder[a.selectionType] !== typeOrder[b.selectionType]) {
      return typeOrder[a.selectionType] - typeOrder[b.selectionType];
    }
    return a.blueprintName.localeCompare(b.blueprintName);
  });
}

/**
 * Check compatibility between two blueprints.
 */
export function checkBlueprintCompatibility(
  blueprintA: BlueprintMetadata,
  blueprintB: BlueprintMetadata,
  blueprintsById: Map<string, BlueprintMetadata>
): boolean {
  // Check explicit dependencies
  const aDependsOn = new Set(blueprintA.dependsOn);
  const bDependsOn = new Set(blueprintB.dependsOn);

  if (aDependsOn.has(blueprintB.id) || bDependsOn.has(blueprintA.id)) {
    // Explicit dependency exists — check circular dependencies
    return !hasCircularDependency([blueprintA, blueprintB], blueprintsById);
  }

  // Check domain compatibility
  if (blueprintA.domain !== blueprintB.domain &&
      !(isCrossDomainCompatible(blueprintA, blueprintB) || isCrossDomainCompatible(blueprintB, blueprintA))) {
    return false;
  }

  return true;
}

/**
 * Check if two blueprints can work together (cross-domain compatibility).
 */
function isCrossDomainCompatible(base: BlueprintMetadata, extension: BlueprintMetadata): boolean {
  // Connector packs are compatible with any domain
  if (extension.family === 'erp-connector' || extension.family === 'plc-connector') {
    return true;
  }

  // Analytics blueprints can extend any domain
  if (extension.domain === 'analytics') {
    return true;
  }

  return false;
}

/**
 * Check for circular dependencies in a list of blueprints.
 */
export function hasCircularDependency(
  blueprintIds: string[],
  blueprintsById: Map<string, BlueprintMetadata>
): boolean {
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(id: string): boolean {
    if (recStack.has(id)) return true; // circular dependency found
    if (visited.has(id)) return false;

    visited.add(id);
    recStack.add(id);

    const blueprint = blueprintsById.get(id);
    if (blueprint) {
      for (const depId of blueprint.dependsOn) {
        if (dfs(depId)) return true;
      }
    }

    recStack.delete(id);
    return false;
  }

  for (const id of blueprintIds) {
    if (dfs(id)) return true;
  }

  return false;
}

// ============================================================================
// Manual Override Support
// ============================================================================

/**
 * User override for manual blueprint selection.
 */
export const BlueprintOverride = z.object({
  // Which spec this override applies to
  specId: z.string().uuid(),

  // What the user wants instead (or in addition to) auto-selection
  primaryBlueprintId: z.string().uuid(),

  // Why they chose it (audit trail)
  reason: z.string().min(1).max(2000),

  // Override confidence (user knows best, but we track for analytics)
  userConfidence: z.enum(['high', 'medium', 'low']).default('high'),
});

export type BlueprintOverride = z.infer<typeof BlueprintOverride>;

/**
 * Apply a manual override to a composition result.
 */
export function applyManualOverride(
  result: CompositionResult,
  override: BlueprintOverride
): CompositionResult {
  // Update primary blueprint ID
  const newPrimaryBlueprintId = override.primaryBlueprintId;

  // Add override reason as a selection
  const overrideSelection: SelectionReason = {
    blueprintId: override.primaryBlueprintId,
    blueprintName: 'Manually selected',
    blueprintFamily: 'manual-override' as BlueprintFamily, // placeholder - user choice
    reason: `Manual override by user: ${override.reason}`,
    confidence: override.userConfidence,
    selectionType: 'primary',
  };

  return {
    ...result,
    primaryBlueprintId: newPrimaryBlueprintId,
    selections: [overrideSelection, ...result.selections],
  };
}
