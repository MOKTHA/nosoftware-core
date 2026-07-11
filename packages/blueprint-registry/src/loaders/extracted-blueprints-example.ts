/**
 * Example of extracted blueprints from FactoryNXT repos
 *
 * This file demonstrates what the LocalPathBlueprintLoader produces when it parses
 * Python SQLAlchemy models and converts them to HeyNXT DomainEntity format.
 *
 * These are EXAMPLES based on actual FactoryNXT_PY_v2_Extrusion and FactoryNxT_PY_V2 repos.
 */

import { z } from 'zod';
import type { BlueprintMetadata, DomainEntity } from '@heynxt/core-types';

/**
 * Example extracted blueprint metadata — simulating what LocalPathBlueprintLoader produces
 * for the extrusion operations domain.
 */
export const EXAMPLE_EXTRUSION_BLUEPRINT: BlueprintMetadata = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Aluminum Extrusion Operations v1.0.0',
  description:
    'Complete MES blueprint for aluminum extrusion manufacturing extracted from FactoryNXT_PY_v2_Extrusion repository. Covers billets, dies (22-state FSM), setpoint profiles, heat treatment programs, process execution with actual-vs-setpoint monitoring, and OEE KPI calculations.',
  family: 'extrusion-operations',
  domain: 'extrusion',
  version: '1.0.0',
  sourceCommitHash: undefined, // Would be populated from git repo at extraction time
  tags: [
    'die-management',
    'billet-tracking',
    'setpoint-profile',
    'heat-treatment',
    'scheduling',
    'process-execution',
    'oee',
    'traceability',
  ],
  sourceRepo: 'FactoryNXT_PY_v2_Extrusion',
  dependsOn: [],
  status: 'published',
  createdAt: new Date('2026-07-11T00:00:00Z'),
  updatedAt: new Date('2026-07-11T00:00:00Z'),
};

/**
 * Example DomainEntity for Die — extracted from FactoryNXT_PY_v2_Extrusion models.py
 * Shows the 22-state FSM that is a key pattern in extrusion manufacturing.
 */
export const EXAMPLE_DIE_ENTITY: DomainEntity = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  blueprintId: EXAMPLE_EXTRUSION_BLUEPRINT.id,
  name: 'Die',
  description:
    'Aluminum extrusion die tooling with full lifecycle tracking from new through service, maintenance, and recycling.',
  domainCategory: 'equipment',
  attributes: [
    { name: 'id', type: 'uuid', required: true },
    { name: 'dieCode', type: 'string', required: true },
    { name: 'profileCode', type: 'string', required: false },
    { name: 'alloy', type: 'string', required: false },
    { name: 'supplier', type: 'string', required: false },
    { name: 'location', type: 'string', required: false },
    { name: 'status', type: 'string', required: true },
    { name: 'lifeCyclesTotal', type: 'integer', required: true },
    { name: 'erpAssetId', type: 'string', required: false },
    { name: 'description', type: 'text', required: false },
    { name: 'dieType', type: 'string', required: false },
    { name: 'manufacturer', type: 'string', required: false },
    { name: 'manufacturedDate', type: 'date', required: false },
    { name: 'pressCount', type: 'integer', required: true },
    { name: 'pressCountLimit', type: 'integer', required: false },
    { name: 'repairCount', type: 'integer', required: true },
    { name: 'nitridingCount', type: 'integer', required: true },
    { name: 'lastUsedAt', type: 'date', required: false },
    { name: 'lastRepairedAt', type: 'date', required: false },
  ],
  relationships: [
    {
      targetBlueprintId: EXAMPLE_EXTRUSION_BLUEPRINT.id,
      targetEntityName: 'DieInspection',
      relationType: 'one-to-many',
      cardinality: '1..N',
    },
    {
      targetBlueprintId: EXAMPLE_EXTRUSION_BLUEPRINT.id,
      targetEntityName: 'DieTest',
      relationType: 'one-to-many',
      cardinality: '1..N',
    },
    {
      targetBlueprintId: EXAMPLE_EXTRUSION_BLUEPRINT.id,
      targetEntityName: 'NitridingRecord',
      relationType: 'one-to-many',
      cardinality: '1..N',
    },
    {
      targetBlueprintId: EXAMPLE_EXTRUSION_BLUEPRINT.id,
      targetEntityName: 'DieFurnaceLog',
      relationType: 'one-to-many',
      cardinality: '1..N',
    },
    {
      targetBlueprintId: EXAMPLE_EXTRUSION_BLUEPRINT.id,
      targetEntityName: 'DieRepairRecord',
      relationType: 'one-to-many',
      cardinality: '1..N',
    },
  ],
  lifecycleStates: [
    'New',
    'Inspected',
    'TestingPending',
    'TestingPassed',
    'TestingFailed',
    'Rework',
    'NitridingPending',
    'Nitrided',
    'Available',
    'Rejected',
    'InFurnace',
    'InPress',
    'Repair',
    'Retired',
  ],
  createdAt: new Date('2026-07-11T00:00:00Z'),
  updatedAt: new Date('2026-07-11T00:00:00Z'),
};

/**
 * Example DomainEntity for WorkOrder — common to both extrusion and PCB repos.
 */
export const EXAMPLE_WORK_ORDER_ENTITY: DomainEntity = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  blueprintId: EXAMPLE_EXTRUSION_BLUEPRINT.id,
  name: 'WorkOrder',
  description:
    'Production work order with lifecycle management from draft through completion or cancellation.',
  domainCategory: 'production',
  attributes: [
    { name: 'id', type: 'uuid', required: true },
    { name: 'orderNumber', type: 'string', required: true },
    { name: 'partNumber', type: 'string', required: true },
    { name: 'description', type: 'text', required: false },
    { name: 'quantity', type: 'integer', required: true },
    { name: 'status', type: 'string', required: true },
    { name: 'dueDate', type: 'date', required: false },
    { name: 'scheduledStart', type: 'date', required: false },
    { name: 'scheduledEnd', type: 'date', required: false },
    { name: 'priority', type: 'string', required: false },
    { name: 'releasedAt', type: 'date', required: false },
    { name: 'startedAt', type: 'date', required: false },
    { name: 'completedAt', type: 'date', required: false },
  ],
  relationships: [
    {
      targetBlueprintId: EXAMPLE_EXTRUSION_BLUEPRINT.id,
      targetEntityName: 'SerialNumber',
      relationType: 'one-to-many',
      cardinality: '1..N',
    },
    {
      targetBlueprintId: EXAMPLE_EXTRUSION_BLUEPRINT.id,
      targetEntityName: 'OperationTransaction',
      relationType: 'one-to-many',
      cardinality: '1..N',
    },
  ],
  lifecycleStates: ['DRAFT', 'RELEASED', 'RUNNING', 'COMPLETED', 'CANCELLED'],
  createdAt: new Date('2026-07-11T00:00:00Z'),
  updatedAt: new Date('2026-07-11T00:00:00Z'),
};

/**
 * Example extracted blueprint metadata — PCB genealogy domain.
 */
export const EXAMPLE_PCB_BLUEPRINT: BlueprintMetadata = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  name: 'PCB Component Genealogy & Execution v1.0.0',
  description:
    'Complete MES blueprint for PCB/electronics assembly extracted from FactoryNxT_PY_V2 repository. Covers SMT line, feeder reels, stencils, PCB panels/boards, genealogy events with component-level traceability, operation execution engine with barcode-scan routing enforcement.',
  family: 'pcb-genealogy',
  domain: 'pcb-electronics',
  version: '1.0.0',
  sourceCommitHash: undefined, // Would be populated from git repo at extraction time
  tags: [
    'genealogy',
    'component-tracking',
    'reel-management',
    'traceability',
    'process-execution',
    'inspection-plan',
    'oee',
    'serial-numbering',
  ],
  sourceRepo: 'FactoryNxT_PY_V2',
  dependsOn: [],
  status: 'published',
  createdAt: new Date('2026-07-11T00:00:00Z'),
  updatedAt: new Date('2026-07-11T00:00:00Z'),
};

/**
 * Example DomainEntity for GenealogyEvent — PCB/component-level traceability.
 */
export const EXAMPLE_GENEALOGY_EVENT_ENTITY: DomainEntity = {
  id: '550e8400-e29b-41d4-a716-446655440004',
  blueprintId: EXAMPLE_PCB_BLUEPRINT.id,
  name: 'GenealogyEvent',
  description:
    'Component placement trace event linking components to their source reels, lot numbers, and PCB board locations.',
  domainCategory: 'traceability',
  attributes: [
    { name: 'id', type: 'uuid', required: true },
    { name: 'boardSerialNumber', type: 'string', required: true },
    { name: 'workOrderId', type: 'uuid', required: true },
    { name: 'machineId', type: 'string', required: false },
    { name: 'operatorId', type: 'string', required: true },
    { name: 'reelId', type: 'string', required: false },
    { name: 'componentLotNumber', type: 'string', required: false },
    { name: 'referenceDesignator', type: 'string', required: true },
    { name: 'placementTime', type: 'date', required: true },
  ],
  relationships: [
    {
      targetBlueprintId: EXAMPLE_PCB_BLUEPRINT.id,
      targetEntityName: 'PcbBoard',
      relationType: 'one-to-many' as const,
      cardinality: '1..N',
    },
    {
      targetBlueprintId: EXAMPLE_PCB_BLUEPRINT.id,
      targetEntityName: 'FeederReel',
      relationType: 'one-to-many' as const,
      cardinality: '1..N',
    },
  ],
  createdAt: new Date('2026-07-11T00:00:00Z'),
  updatedAt: new Date('2026-07-11T00:00:00Z'),
};

/**
 * Example DomainEntity for OperationTransaction — execution audit trail.
 */
export const EXAMPLE_OPERATION_TRANSACTION_ENTITY: DomainEntity = {
  id: '550e8400-e29b-41d4-a716-446655440005',
  blueprintId: EXAMPLE_PCB_BLUEPRINT.id,
  name: 'OperationTransaction',
  description:
    'Audit record of every operation performed against a serial number, capturing start/end times, results (OK/NG), and operator information.',
  domainCategory: 'production',
  attributes: [
    { name: 'id', type: 'integer', required: true },
    { name: 'workOrderId', type: 'uuid', required: true },
    { name: 'serialNumber', type: 'string', required: true },
    { name: 'routingStep', type: 'integer', required: true },
    { name: 'stationId', type: 'integer', required: false },
    { name: 'operatorId', type: 'string', required: true },
    { name: 'startTime', type: 'date', required: false },
    { name: 'endTime', type: 'date', required: false },
    { name: 'result', type: 'string', required: false },
    { name: 'remarks', type: 'text', required: false },
  ],
  relationships: [
    {
      targetBlueprintId: EXAMPLE_PCB_BLUEPRINT.id,
      targetEntityName: 'WorkOrder',
      relationType: 'one-to-many' as const,
      cardinality: '1..N',
    },
    {
      targetBlueprintId: EXAMPLE_PCB_BLUEPRINT.id,
      targetEntityName: 'Station',
      relationType: 'one-to-many' as const,
      cardinality: '1..N',
    },
  ],
  createdAt: new Date('2026-07-11T00:00:00Z'),
  updatedAt: new Date('2026-07-11T00:00:00Z'),
};

/**
 * Get all example extracted entities for testing.
 */
export function getExtractedEntities(): DomainEntity[] {
  return [
    EXAMPLE_DIE_ENTITY,
    EXAMPLE_WORK_ORDER_ENTITY,
    EXAMPLE_GENEALOGY_EVENT_ENTITY,
    EXAMPLE_OPERATION_TRANSACTION_ENTITY,
  ];
}

/**
 * Get example blueprints for testing.
 */
export function getExtractedBlueprints(): Array<{
  metadata: BlueprintMetadata;
  entities: DomainEntity[];
}> {
  return [
    { metadata: EXAMPLE_EXTRUSION_BLUEPRINT, entities: [EXAMPLE_DIE_ENTITY, EXAMPLE_WORK_ORDER_ENTITY] },
    { metadata: EXAMPLE_PCB_BLUEPRINT, entities: [EXAMPLE_GENEALOGY_EVENT_ENTITY, EXAMPLE_OPERATION_TRANSACTION_ENTITY] },
  ];
}
