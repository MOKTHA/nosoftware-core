/**
 * @heynxt/blueprint-registry
 *
 * Industrial blueprint registry and catalog.
 * Manages the collection of manufacturing/industrial blueprints that
 * serve as source material for AI-generated applications.
 *
 * Blueprints are derived from reference implementations like:
 * - FactoryNXT_PY_v2_Extrusion (extrusion manufacturing)
 * - FactoryNxT_PY_V2 (general industrial automation)
 */

// Export loader interface and implementations
export {
  type BlueprintSourceConfig,
  type LoadResult,
  type BlueprintLoader,
  InMemoryBlueprintLoader,
  createBlueprintLoader,
  CompositeBlueprintLoader,
} from './loader.js';

// Export LocalPathBlueprintLoader for FactoryNXT repo extraction
export {
  type FactoryNxtSourceConfig,
  DEFAULT_FACTORY_NXT_SOURCES,
  LocalPathBlueprintLoader,
} from './loaders/local-path.js';

// Export catalog interface and implementations
export {
  type BlueprintFilter,
  type BlueprintSort,
  type BlueprintPagination,
  type CatalogQueryResult,
  type BlueprintCatalog,
  InMemoryBlueprintCatalog,
  createEmptyCatalog,
} from './catalog.js';

// Export validator interface and implementations
export {
  type ValidationResult,
  type ValidationReport,
  type BlueprintValidator,
  BlueprintValidatorImpl,
  ValidationRules,
  createValidator,
} from './validator.js';

// Export test fixtures (for development/testing)
export * as ExtrusionBlueprints from './fixtures/extrusion-blueprint.js';
export * as PcbBlueprints from './fixtures/pcb-blueprint.js';
