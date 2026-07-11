/**
 * @heynxt/blueprint-registry — Blueprint Loader Interface
 *
 * Defines the interface for loading blueprints from various sources:
 * - Local FactoryNXT repository paths
 * - Remote git repositories (future)
 * - In-memory registry entries (for testing)
 */

import { z } from 'zod';

/**
 * Type representing a blueprint entry in memory.
 * This is a placeholder for actual BlueprintMetadata during loading operations.
 */
export type BlueprintEntry = Record<string, unknown>;

/**
 * Source configuration for blueprint loading.
 */
export interface BlueprintSourceConfig {
  /** Unique identifier for this source */
  id: string;

  /** Source type: local-path | git-repo | in-memory */
  type: 'local-path' | 'git-repo' | 'in-memory';

  /** Path to FactoryNXT repository (for local/git sources) */
  path?: string;

  /** Git commit hash/branch for specific version (optional) */
  ref?: string;

  /** In-memory entries (only for in-memory type) */
  entries?: BlueprintEntry[];

  /** Authentication config for remote repos (if needed) */
  auth?: {
    type: 'token' | 'ssh';
    token?: string;
    sshKeyPath?: string;
  };
}

/**
 * Loader result with metadata about what was loaded.
 */
export interface LoadResult {
  /** Number of blueprints successfully loaded */
  blueprintsLoaded: number;

  /** Number of domain entities discovered */
  entitiesDiscovered: number;

  /** Any warnings encountered during loading */
  warnings: string[];

  /** Errors that prevented some blueprints from loading */
  errors: Array<{ blueprintId?: string; message: string }>;

  /** Source this result came from */
  sourceId: string;
}

/**
 * BlueprintLoader — interface for loading blueprints from various sources.
 *
 * Implementations should handle:
 * - Reading FactoryNXT repository structure (Python models)
 * - Extracting entity definitions and relationships
 * - Normalizing to HeyNXT schema format
 * - Validating loaded blueprints against core-types schemas
 */
export interface BlueprintLoader {
  /** Unique identifier for this loader instance */
  readonly id: string;

  /** Configuration used to create this loader */
  readonly config: BlueprintSourceConfig;

  /** Load all available blueprints from the source. Returns a load result with loaded entities. */
  loadAll(): Promise<LoadResult>;

  /** Load a specific blueprint by ID (if supported) */
  loadById(blueprintId: string): Promise<BlueprintEntry | null>;

  /** Check if this loader can handle the given source configuration */
  supports(config: BlueprintSourceConfig): boolean;

  /** Get metadata about what's available without loading full content */
  listAvailable(): Promise<Array<{ id: string; name: string; version: string }>>;
}

/**
 * In-memory blueprint registry for testing.
 * Stores blueprints in memory rather than from external sources.
 */
export class InMemoryBlueprintLoader implements BlueprintLoader {
  readonly id = 'in-memory';
  readonly config: BlueprintSourceConfig;

  private _blueprints: Map<string, BlueprintEntry> = new Map();

  constructor(entries?: BlueprintEntry[]) {
    this.config = {
      id: 'in-memory',
      type: 'in-memory',
      entries: entries || [],
    };

    if (entries) {
      for (const entry of entries) {
        const blueprintEntry = entry as Record<string, unknown>;
        if (blueprintEntry.id && blueprintEntry.name) {
          this._blueprints.set(blueprintEntry.id as string, blueprintEntry);
        }
      }
    }
  }

  async loadAll(): Promise<LoadResult> {
    return {
      blueprintsLoaded: this._blueprints.size,
      entitiesDiscovered: 0,
      warnings: [],
      errors: [],
      sourceId: this.id,
    };
  }

  async loadById(_blueprintId: string): Promise<BlueprintEntry | null> {
    return this._blueprints.get(_blueprintId) || null;
  }

  supports(config: BlueprintSourceConfig): boolean {
    return config.type === 'in-memory';
  }

  async listAvailable(): Promise<Array<{ id: string; name: string; version: string }>> {
    const result: Array<{ id: string; name: string; version: string }> = [];
    for (const [id, blueprint] of this._blueprints.entries()) {
      const b = blueprint as Record<string, unknown>;
      result.push({
        id,
        name: (b.name as string) || 'Unknown',
        version: (b.version as string) || '0.0.0',
      });
    }
    return result;
  }

  /** Add a blueprint to the in-memory registry */
  addBlueprint(blueprint: BlueprintEntry): void {
    const b = blueprint as Record<string, unknown>;
    if (b.id) {
      this._blueprints.set(b.id as string, blueprint);
    }
  }

  /** Clear all blueprints from the registry */
  clear(): void {
    this._blueprints.clear();
  }
}

/**
 * Factory function to create a loader based on configuration.
 */
export function createBlueprintLoader(config: BlueprintSourceConfig): BlueprintLoader {
  switch (config.type) {
    case 'in-memory':
      return new InMemoryBlueprintLoader(config.entries);
    case 'local-path':
      // TODO: Implement LocalPathBlueprintLoader for FactoryNXT repo paths
      throw new Error(`Local path loader not yet implemented. Config: ${JSON.stringify(config, null, 2)}`);
    case 'git-repo':
      // TODO: Implement GitRepoBlueprintLoader for remote repos
      throw new Error(`Git repo loader not yet implemented. Config: ${JSON.stringify(config, null, 2)}`);
    default:
      throw new Error(`Unknown blueprint source type: ${(config as { type: unknown }).type}`);
  }
}


/**
 * Composite loader that aggregates results from multiple sources.
 */
export class CompositeBlueprintLoader implements BlueprintLoader {
  readonly id = 'composite';
  readonly config: BlueprintSourceConfig;

  private loaders: BlueprintLoader[] = [];

  constructor(loaders: BlueprintLoader[]) {
    this.loaders = loaders;
    this.config = {
      id: 'composite',
      type: 'in-memory', // composite is a special case
    };
  }

  async loadAll(): Promise<LoadResult> {
    const results = await Promise.all(this.loaders.map(l => l.loadAll()));
    const totalBlueprints = results.reduce((sum, r) => sum + r.blueprintsLoaded, 0);
    const totalEntities = results.reduce((sum, r) => sum + r.entitiesDiscovered, 0);

    return {
      blueprintsLoaded: totalBlueprints,
      entitiesDiscovered: totalEntities,
      warnings: results.flatMap(r => r.warnings),
      errors: results.flatMap(r => r.errors),
      sourceId: this.id,
    };
  }

  async loadById(blueprintId: string): Promise<BlueprintEntry | null> {
    for (const loader of this.loaders) {
      const result = await loader.loadById(blueprintId);
      if (result) return result;
    }
    return null;
  }

  supports(_config: BlueprintSourceConfig): boolean {
    // Composite accepts any config since it delegates to sub-loaders
    return true;
  }

  async listAvailable(): Promise<Array<{ id: string; name: string; version: string }>> {
    const allResults = await Promise.all(this.loaders.map(l => l.listAvailable()));
    // Merge and deduplicate by ID
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string; version: string }> = [];

    for (const item of allResults.flatMap(r => r)) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }

    return result;
  }

  /** Add a loader to the composite */
  addLoader(loader: BlueprintLoader): void {
    this.loaders.push(loader);
  }
}
