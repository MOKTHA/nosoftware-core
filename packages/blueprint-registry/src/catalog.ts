/**
 * @heynxt/blueprint-registry — Blueprint Catalog
 *
 * Provides search, filter, list, paginate, and sort operations for blueprints.
 */

import { z } from 'zod';

// Re-export blueprint type enums and metadata for use in catalog queries
export type BlueprintFamily = z.infer<typeof import('@heynxt/core-types').BlueprintFamily>;
export type BlueprintDomain = z.infer<typeof import('@heynxt/core-types').BlueprintDomain>;
export type BlueprintTag = z.infer<typeof import('@heynxt/core-types').BlueprintTag>;
export type BlueprintMetadata = z.infer<typeof import('@heynxt/core-types').BlueprintMetadata>;

/**
 * Filter criteria for blueprint queries.
 */
export interface BlueprintFilter {
  /** Search query (matches against name/description) */
  q?: string;

  /** Filter by blueprint family */
  family?: BlueprintFamily | null;

  /** Filter by domain */
  domain?: BlueprintDomain | null;

  /** Filter by status (published, draft, deprecated) */
  status?: 'draft' | 'published' | 'deprecated' | null;

  /** Filter by tags (blueprint must have ALL of these tags) */
  tags?: BlueprintTag[] | null;

  /** Include deprecated blueprints in results? */
  includeDeprecated?: boolean;

  /** Minimum version constraint (semver comparison) */
  minVersion?: string;
}

/**
 * Sort options for blueprint queries.
 */
export interface BlueprintSort {
  field: 'name' | 'createdAt' | 'updatedAt' | 'version';
  direction: 'asc' | 'desc';
}

/**
 * Pagination parameters.
 */
export interface BlueprintPagination {
  /** Page number (1-indexed) */
  page?: number;

  /** Items per page */
  pageSize?: number;
}

/**
 * Result of a blueprint catalog query.
 */
export interface CatalogQueryResult<T> {
  /** Matching items */
  items: T[];

  /** Total count before pagination */
  total: number;

  /** Current page (1-indexed) */
  page: number;

  /** Items per page */
  pageSize: number;

  /** Total pages available */
  totalPages: number;

  /** Filter that was applied */
  filter: BlueprintFilter | undefined;

  /** Sort that was applied */
  sort?: BlueprintSort;
}

/**
 * BlueprintCatalog — interface for querying blueprints.
 */
export interface BlueprintCatalog {
  /** Get a blueprint by ID, returns null if not found */
  getById(id: string): BlueprintMetadata | null;

  /** List all available blueprints with optional filtering/pagination/sorting */
  list(
    filter?: BlueprintFilter,
    sort?: BlueprintSort,
    pagination?: BlueprintPagination
  ): CatalogQueryResult<BlueprintMetadata>;

  /** Search blueprints by query string and filters */
  search(
    q: string,
    filter?: Omit<BlueprintFilter, 'q'>,
    pagination?: BlueprintPagination
  ): CatalogQueryResult<BlueprintMetadata>;

  /** Get blueprints by family */
  getByFamily(family: BlueprintFamily): BlueprintMetadata[];

  /** Get published blueprints in a domain */
  getPublishedInDomain(domain: BlueprintDomain): BlueprintMetadata[];

  /** Find compatible blueprints for a given blueprint (dependsOn relationships) */
  findCompatible(blueprintId: string): BlueprintMetadata[];

  /** Check if a blueprint exists by ID */
  has(blueprintId: string): boolean;

  /** Get count of all blueprints (optionally filtered) */
  count(filter?: BlueprintFilter): number;
}

/**
 * In-memory catalog implementation for testing.
 */
export class InMemoryBlueprintCatalog implements BlueprintCatalog {
  private _blueprints: Map<string, BlueprintMetadata> = new Map();

  /** Add a blueprint to the catalog */
  add(blueprint: BlueprintMetadata): void {
    this._blueprints.set(blueprint.id, blueprint);
  }

  /** Remove a blueprint from the catalog */
  remove(blueprintId: string): boolean {
    return this._blueprints.delete(blueprintId);
  }

  getById(id: string): BlueprintMetadata | null {
    return this._blueprints.get(id) || null;
  }

  list(
    filter?: BlueprintFilter,
    sort?: BlueprintSort,
    pagination?: BlueprintPagination
  ): CatalogQueryResult<BlueprintMetadata> {
    let items = Array.from(this._blueprints.values());

    // Apply filters
    if (filter) {
      const { q, family, domain, status, tags, includeDeprecated } = filter;

      if (!includeDeprecated) {
        items = items.filter(b => b.status !== 'deprecated');
      }

      if (family) {
        items = items.filter(b => b.family === family);
      }

      if (domain) {
        items = items.filter(b => b.domain === domain);
      }

      if (status) {
        items = items.filter(b => b.status === status);
      }

      if (tags && tags.length > 0) {
        items = items.filter(b => tags.every(tag => b.tags.includes(tag)));
      }

      if (q) {
        const query = q.toLowerCase();
        items = items.filter(b =>
          b.name.toLowerCase().includes(query) ||
          b.description?.toLowerCase().includes(query)
        );
      }

      if (filter.minVersion) {
        items = items.filter(b => this._semverGte(b.version, filter!.minVersion!));
      }
    }

    // Apply sorting
    if (sort) {
      const { field, direction } = sort;
      items.sort((a, b) => {
        let aVal: string | Date = '';
        let bVal: string | Date = '';

        switch (field) {
          case 'name':
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case 'version':
            // Simple semver comparison for sorting
            aVal = this._normalizeVersionForSort(a.version);
            bVal = this._normalizeVersionForSort(b.version);
            break;
          default:
            aVal = (a[field] as Date | string) || '';
            bVal = (b[field] as Date | string) || '';
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 20;
    const total = items.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = items.slice(startIndex, startIndex + pageSize);

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
      filter,
      sort,
    };
  }

  search(
    q: string,
    filter?: Omit<BlueprintFilter, 'q'>,
    pagination?: BlueprintPagination
  ): CatalogQueryResult<BlueprintMetadata> {
    return this.list({ ...filter, q }, undefined, pagination);
  }

  getByFamily(family: BlueprintFamily): BlueprintMetadata[] {
    const results = Array.from(this._blueprints.values()).filter(b => b.family === family);
    return this._sortByName(results);
  }

  getPublishedInDomain(domain: BlueprintDomain): BlueprintMetadata[] {
    const results = Array.from(this._blueprints.values()).filter(b => b.domain === domain && b.status === 'published');
    return this._sortByName(results);
  }

  findCompatible(blueprintId: string): BlueprintMetadata[] {
    const blueprint = this.getById(blueprintId);
    if (!blueprint) return [];

    // Find blueprints that depend on this one (reverse lookup via dependsOn)
    const compatible = Array.from(this._blueprints.values()).filter(
      b => b.dependsOn.includes(blueprintId) && b.status === 'published'
    );
    return this._sortByName(compatible);
  }

  has(blueprintId: string): boolean {
    return this._blueprints.has(blueprintId);
  }

  count(filter?: BlueprintFilter): number {
    let items = Array.from(this._blueprints.values());

    if (filter) {
      const { includeDeprecated, family, domain, status } = filter;

      if (!includeDeprecated) {
        items = items.filter(b => b.status !== 'deprecated');
      }

      if (family) {
        items = items.filter(b => b.family === family);
      }

      if (domain) {
        items = items.filter(b => b.domain === domain);
      }

      if (status) {
        items = items.filter(b => b.status === status);
      }
    }

    return items.length;
  }

  /** Helper: semver greater-than-or-equal comparison */
  private _semverGte(version1: string, version2: string): boolean {
    const v1 = this._parseSemver(version1);
    const v2 = this._parseSemver(version2);

    if (v1.major !== v2.major) return v1.major > v2.major;
    if (v1.minor !== v2.minor) return v1.minor > v2.minor;
    return v1.patch >= v2.patch;
  }

  /** Helper: parse semver string to components */
  private _parseSemver(version: string): { major: number; minor: number; patch: number } {
    const [majorStr, minorStr, patchStr] = version.split('.');

    // Ensure strings are defined before parsing
    if (!majorStr || !minorStr || !patchStr) {
      return { major: 0, minor: 0, patch: 0 };
    }

    return {
      major: parseInt(majorStr, 10) || 0,
      minor: parseInt(minorStr, 10) || 0,
      patch: parseInt(patchStr, 10) || 0,
    };
  }

  /** Helper: normalize version for sorting (pads components) */
  private _normalizeVersionForSort(version: string): string {
    const parts = version.split('.');

    // Ensure all parts are defined before processing
    if (parts.length !== 3 || !parts.every(p => p)) {
      return '000000000';
    }

    const padded = parts.map(n => parseInt(n, 10).toString().padStart(3, '0'));
    return padded.join('');
  }

  /** Helper: sort blueprints by name alphabetically */
  private _sortByName(blueprints: BlueprintMetadata[]): BlueprintMetadata[] {
    return blueprints.sort((a, b) => a.name.localeCompare(b.name));
  }
}

/**
 * Create an empty in-memory catalog.
 */
export function createEmptyCatalog(): BlueprintCatalog {
  return new InMemoryBlueprintCatalog();
}
