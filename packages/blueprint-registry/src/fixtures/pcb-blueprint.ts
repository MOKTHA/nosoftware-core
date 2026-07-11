/**
 * Example PCB/Electronics Blueprint — for testing blueprint registry
 */

import { z } from 'zod';

export const PCB_GENEALOGY_BLUEPRINT_ID = '2859be34-a06c-6d7h-bf5g-3c4d5e6f7g8h';
export const PCB_SERIAL_EXECUTION_BLUEPRINT_ID = '396acf45-b17d-7e8i-cg6h-4d5e6f7g8h9i';

/**
 * PCB Genealogy Blueprint — component-level traceability for PCB assembly.
 */
export const createPcbGenealogyBlueprint = (): z.infer<typeof import('@heynxt/core-types').BlueprintMetadata> => ({
  id: PCB_GENEALOGY_BLUEPRINT_ID,
  name: 'PCB Component Genealogy',
  description:
    'Complete traceability blueprint for PCB/electronics assembly. Tracks component placement genealogy from feeder reel → stencil → PcbPanel → individual PcbBoard with unique serial numbers. Includes AQL inspection plans, NCR (non-conformance reports), and CAPA workflows.',
  family: 'pcb-genealogy',
  domain: 'pcb-electronics',
  version: '1.0.0',
  sourceCommitHash: undefined, // TODO: populate from FactoryNxT_PY_V2 repo
  tags: [
    'traceability',
    'genealogy',
    'component-tracking',
    'reel-management',
    'inspection-plan',
    'ncr',
    'capa',
  ],
  sourceRepo: 'FactoryNxT_PY_V2',
  dependsOn: [], // base domain blueprint, no dependencies
  icon: 'fa-microchip',
  color: '#f57c00',
  status: 'published',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
});

/**
 * PCB Serial Execution Blueprint — work order lifecycle with barcode-scan enforcement.
 */
export const createPcbSerialExecutionBlueprint = (): z.infer<typeof import('@heynxt/core-types').BlueprintMetadata> => ({
  id: PCB_SERIAL_EXECUTION_BLUEPRINT_ID,
  name: 'PCB Serial Number Execution',
  description:
    'Work order execution blueprint for PCB assembly. Implements standard work order FSM (DRAFT→RELEASED→RUNNING→COMPLETED), routing DAG with immutable snapshots, and operation transaction enforcement via barcode scanning at each station.',
  family: 'serial-execution',
  domain: 'pcb-electronics',
  version: '1.0.0',
  sourceCommitHash: undefined, // TODO: populate from FactoryNxT_PY_V2 repo
  tags: ['work-order', 'routing', 'serial-numbering', 'operation-trace'],
  sourceRepo: 'FactoryNxT_PY_V2',
  dependsOn: [PCB_GENEALOGY_BLUEPRINT_ID], // requires genealogy for traceability
  icon: 'fa-barcode',
  color: '#7b1fa2',
  status: 'published',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
});

/**
 * Create a minimal set of PCB blueprints for testing.
 */
export function createPcbBlueprints(): Array<z.infer<typeof import('@heynxt/core-types').BlueprintMetadata>> {
  return [createPcbGenealogyBlueprint(), createPcbSerialExecutionBlueprint()];
}
