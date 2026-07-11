/**
 * Example Extrusion Operations Blueprint — for testing blueprint registry
 */

import { z } from 'zod';

export const EXTRUSION_OPERATIONS_BLUEPRINT_ID = '06379c12-8e4a-4b5f-9d3e-1a2b3c4d5e6f';
export const EXTRUSION_DIE_LIFECYCLE_BLUEPRINT_ID = '1748ad23-9f5b-5c6g-ae4f-2b3c4d5e6f7g';

/**
 * Extrusion Operations Blueprint — the primary blueprint for aluminum extrusion MES.
 * Covers: billets, dies, setpoint profiles, heat treatment programs, process runs, OEE.
 */
export const createExtrusionOperationsBlueprint = (): z.infer<typeof import('@heynxt/core-types').BlueprintMetadata> => ({
  id: EXTRUSION_OPERATIONS_BLUEPRINT_ID,
  name: 'Aluminum Extrusion Operations',
  description:
    'Complete MES blueprint for aluminum extrusion manufacturing. Covers billet tracking, die lifecycle management (22-state FSM), setpoint profiles by alloy+process type, heat treatment programs, process execution with actual-vs-setpoint monitoring, and OEE KPI calculations.',
  family: 'extrusion-operations',
  domain: 'extrusion',
  version: '1.0.0',
  sourceCommitHash: undefined, // TODO: populate from FactoryNXT_PY_v2_Extrusion repo
  tags: [
    'die-management',
    'billet-tracking',
    'setpoint-profile',
    'heat-treatment',
    'process-execution',
    'oee',
  ],
  sourceRepo: 'FactoryNXT_PY_v2_Extrusion',
  dependsOn: [], // base domain blueprint, no dependencies
  icon: 'fa-industry',
  color: '#1976d2',
  status: 'published',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
});

/**
 * Extrusion Die Lifecycle Blueprint — tracks die manufacturing, qualification, service, and recycling.
 */
export const createExtrusionDieLifecycleBlueprint = (): z.infer<typeof import('@heynxt/core-types').BlueprintMetadata> => ({
  id: EXTRUSION_DIE_LIFECYCLE_BLUEPRINT_ID,
  name: 'Die Lifecycle Management',
  description:
    'Specialized blueprint for die tooling management. Implements the full 22-state lifecycle FSM from design through manufacturing, inspection, qualification, in-service use with service counting, maintenance/refurbishment, and final recycling.',
  family: 'tool-lifecycle',
  domain: 'extrusion',
  version: '1.0.0',
  sourceCommitHash: undefined, // TODO: populate from FactoryNXT_PY_v2_Extrusion repo
  tags: ['die-management'],
  sourceRepo: 'FactoryNXT_PY_v2_Extrusion',
  dependsOn: [EXTRUSION_OPERATIONS_BLUEPRINT_ID], // requires base extrusion operations
  icon: 'fa-cogs',
  color: '#388e3c',
  status: 'published',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
});

/**
 * Create a minimal set of extrusion blueprints for testing.
 */
export function createExtrusionBlueprints(): Array<z.infer<typeof import('@heynxt/core-types').BlueprintMetadata>> {
  return [createExtrusionOperationsBlueprint(), createExtrusionDieLifecycleBlueprint()];
}
