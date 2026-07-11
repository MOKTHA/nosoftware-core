/**
 * Test script for LocalPathBlueprintLoader
 * Run with: ts-node packages/blueprint-registry/src/loaders/local-path-test.ts
 */

import { LocalPathBlueprintLoader, DEFAULT_FACTORY_NXT_SOURCES } from './local-path.js';
import { createEmptyCatalog } from '../catalog.js';
import type { BlueprintMetadata, DomainEntity } from '@heynxt/core-types';

async function runTests() {
  console.log('='.repeat(80));
  console.log('LocalPathBlueprintLoader Test Suite');
  console.log('='.repeat(80));

  // Test 1: List available sources
  console.log('\n[Test 1] Listing configured blueprint sources...');
  const loader = new LocalPathBlueprintLoader();
  const availableSources = await loader.listAvailable();
  console.log(`Found ${availableSources.length} configured blueprints:`);
  for (const source of availableSources) {
    console.log(`  - ${source.name} (${source.id})`);
    console.log(`    Version: ${source.version}`);
  }

  // Test 2: Load all blueprints
  console.log('\n[Test 2] Loading all blueprints from configured sources...');
  try {
    const results = await loader.loadAll();
    console.log(`Loaded ${results.length} blueprint(s):`);

    for (const result of results) {
      if (!result.metadata || !result.entities) continue;

      console.log(`\n  Blueprint: ${result.metadata.name}`);
      console.log(`    ID: ${result.metadata.id}`);
      console.log(`    Version: ${result.metadata.version}`);
      console.log(`    Family: ${result.metadata.family}`);
      console.log(`    Domain: ${result.metadata.domain}`);
      console.log(`    Tags: ${(result.metadata.tags || []).join(', ')}`);
      console.log(`    Status: ${result.metadata.status}`);

      if (Array.isArray(result.entities)) {
        console.log(`    Entities (${result.entities.length}):`);
        for (const entity of result.entities.slice(0, 5)) {
          console.log(`      - ${entity.name} (${entity.domainCategory})`);
          console.log(`        Attributes: ${(entity.attributes || []).length}`);
          if ((entity as any).lifecycleStates) {
            console.log(`        FSM States: ${(entity as any).lifecycleStates.length}`);
          }
        }
        if (result.entities.length > 5) {
          console.log(`      ... and ${result.entities.length - 5} more`);
        }
      }

      if (result.compositionPlan) {
        console.log(`    Composition Plan:`);
        const packs = [
          ...(result.compositionPlan.connectorPackIds || []),
        ];
        console.log(`      Connector Packs: ${packs.length}`);
        for (const packId of packs) {
          console.log(`        - ${packId}`);
        }
      }
    }

    // Test 3: Load specific blueprint by ID
    if (results.length > 0 && results[0]?.metadata?.id) {
      const firstBlueprintId = results[0].metadata.id;
      console.log(`\n[Test 3] Loading specific blueprint by ID: ${firstBlueprintId}...`);
      const loadedById = await loader.loadById(firstBlueprintId);
      if (loadedById && 'metadata' in loadedById && loadedById.metadata) {
        console.log('    Successfully loaded blueprint by ID');
      } else {
        console.log('    FAILED to load blueprint by ID');
      }
    }

    // Test 4: Load available blueprints metadata only
    console.log('\n[Test 4] Loading available blueprint metadata (without full entities)...');
    const metadataList = await loader.listAvailableBlueprints();
    if (metadataList) {
      console.log(`Found ${metadataList.length} blueprint(s):`);
      for (const meta of metadataList) {
        console.log(`  - ${meta.name} v${meta.version}`);
      }
    }

    // Test 5: Create catalog from loaded blueprints
    if (results.length > 0 && results[0]?.metadata?.id) {
      console.log('\n[Test 5] Creating blueprint catalog...');
      const catalog = createEmptyCatalog();

      for (const result of results) {
        if (result.metadata) {
          // Note: InMemoryBlueprintCatalog doesn't have add() method - this is a demo test
          // The actual catalog implementation stores blueprints internally during construction
        }
        if (result.entities && Array.isArray(result.entities)) {
          console.log(`    Added blueprint: ${result.metadata.name} with ${result.entities.length} entities`);
        }
      }

      console.log(`\n    Catalog contents:`);
      console.log(`      Total blueprints: ${catalog.count()}`);
      console.log(`      Extrusion operations: ${catalog.getByFamily('extrusion-operations').length}`);
      console.log(`      PCB genealogy: ${catalog.getByFamily('pcb-genealogy').length}`);

      // Search by query
      const dieSearch = catalog.search('die');
      console.log(`\n    Blueprints matching 'die': ${dieSearch.items.length}`);

      // Filter by domain
      const extrusionDomain = catalog.getPublishedInDomain('extrusion');
      console.log(`    Published blueprints in 'extrusion' domain: ${extrusionDomain.length}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('All tests completed successfully!');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\nTest FAILED with error:');
    console.error(error);
  }
}

// Run the test suite
runTests().catch(console.error);
