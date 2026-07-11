# ADR-0010: Blueprint Registry Architecture

**Status**: Proposed  
**Date**: 2026-07-11  
**Authors**: Claude Code (session continuation from Phase 2 completion)

---

## Context

Phase 3 requires implementing the **Blueprint Registry** — a catalog of industrial manufacturing blueprints extracted from FactoryNXT reference repositories. This registry will serve as the foundation for prompt-to-spec transformation (Phase 4) and generation pipeline (Phase 6).

### Key Requirements (from buildplan.md Phase 3):

1. Blueprint metadata schema with semantic versioning
2. Loader interface for loading blueprints from various sources (local FactoryNXT paths, remote repos, in-memory)
3. Catalog interface for search/filter/list/paginate operations
4. Validator interface to ensure blueprint integrity against core-types schemas
5. Version management and compatibility tracking

### Reference Patterns:

- **FactoryNXT_PY_v2_Extrusion**: ~101 domain models including Billets, Dies (22-state FSM), SetpointProfiles, HeatTreatmentPrograms, ProcessRuns, OEE KPIEngine
- **FactoryNxT_PY_V2**: ~55 domain models including SMT lines, FeederReels, PCB Panels/Boards, GenealogyEvents, OperationTransactions

---

## Decision

### 1. Schema Design — Blueprint Metadata (in `core-types`)

**Location**: `packages/core-types/src/schemas/blueprint.ts`

The blueprint metadata schema includes:

```typescript
BlueprintMetadata {
  id: uuid
  name: string              // Human-readable e.g., "Extrusion Operations"
  description: string       // Brief description (max 2000 chars)
  family: BlueprintFamily   // Enum of supported families
  domain: BlueprintDomain   // Primary classification
  version: semver           // Semantic versioning
  sourceCommitHash?: string // Traceability to reference repo
  tags: BlueprintTag[]      // For filtering/search
  sourceRepo: enum          // FactoryNXT_PY_v2_Extrusion | FactoryNxT_PY_V2 | heynxt-core-generated
  dependsOn: uuid[]         // Other blueprints this one requires
  status: draft|published|deprecated
  
  createdAt, updatedAt: date
}
```

**Rationale**: This schema balances richness (tags, dependencies, source attribution) with simplicity. The `sourceRepo` field explicitly tracks provenance from reference implementations.

### 2. Domain Entity Schema — Industrial Entities

**Location**: `packages/domain-models/src/entities/`

Three domain-specific entity files created:

1. **extrusion.ts** (~350 lines):
   - Billet (material tracking)
   - Die (22-state lifecycle FSM)
   - SetpointProfile (process parameters by alloy+type)
   - HeatTreatmentProgram (staged thermal profiles)
   - ProcessRun (actual execution vs setpoints)
   - OeeSnapshot (A×P×Q calculation)

2. **pcb.ts** (~400 lines):
   - SmtStation (line configuration)
   - FeederReel (component tracking)
   - Stencil (solder paste application)
   - PcbPanel/PcbBoard (traceability hierarchy)
   - GenealogyEvent (component-to-board linkage)
   - InspectionPlan/NonConformanceReport/CAPA (quality workflows)

3. **production.ts** (~250 lines):
   - WorkOrderStatus FSM (DRAFT→RELEASED→RUNNING→COMPLETED)
   - RoutingMaster/DAG (process flow definition)
   - WorkOrderRoutingSnapshot (immutable snapshot pattern)
   - OperationTransaction (barcode-scan execution enforcement)
   - SerialNumber (traceability registry)

**Rationale**: These schemas directly extract the verified patterns from FactoryNXT reference repos, normalized to TypeScript/Zod format. The entity count (~20 classes total) covers all critical MES capabilities while avoiding over-engineering.

### 3. Registry Infrastructure — Three Interfaces

**Location**: `packages/blueprint-registry/src/`

#### Loader Interface (`loader.ts`)
```typescript
BlueprintLoader {
  loadAll(): Promise<LoadResult>
  loadById(id): Promise<Blueprint | null>
  supports(config): boolean
  listAvailable(): Promise<Array<{id, name, version}>>
}
```

**Implementations**:
- `InMemoryBlueprintLoader` — for testing and development
- `LocalPathBlueprintLoader` — TODO: extract from FactoryNXT repo paths
- `GitRepoBlueprintLoader` — TODO: remote git repositories

#### Catalog Interface (`catalog.ts`)
```typescript
BlueprintCatalog {
  getById(id): Blueprint | null
  list(filter, sort, pagination): QueryResult<Blueprint[]>
  search(q, filter, pagination): QueryResult<Blueprint[]>
  getByFamily(family): Blueprint[]
  getPublishedInDomain(domain): Blueprint[]
  findCompatible(blueprintId): Blueprint[]
}
```

**Features**:
- Full-text search on name/description
- Filter by family/domain/status/tags/version
- Sorting by name/version/timestamps
- Pagination support (page, pageSize)
- Compatible blueprint lookup via `dependsOn` relationships

#### Validator Interface (`validator.ts`)
```typescript
BlueprintValidator {
  validateMetadata(blueprint): ValidationResult
  validateEntities(entities): ValidationResult
  validateCompositionPlan(plan, catalog): ValidationResult
  validateAll(blueprints, entities): ValidationReport
}
```

**Predefined Rules**:
- `hasTags` — must have at least one tag
- `validVersion` — semver format validation
- `deprecatedHasReason` — deprecated blueprints need deprecation reason
- `sourceCommitRequired` — FactoryNXT-extracted blueprints should include commit hash for traceability

### 4. Composition Plan Schema

**Location**: `packages/core-types/src/schemas/blueprint.ts` (included)

```typescript
CompositionPlan {
  id: uuid
  specId: uuid              // The prompt-derived spec this plan addresses
  primaryBlueprintId: uuid  // Base domain match
  moduleBlueprintIds: uuid[] // Optional extensions
  
  // Attached packs (modular add-ons)
  rolePackId?: uuid         // RBAC variant
  kpiPackId?: uuid          // Dashboard/metrics pack
  connectorPackIds: uuid[]  // ERP/PLC integrations
  approvalPackId?: uuid     // Governance overlay
  
  selections: {              // Explainability log
    blueprintId: uuid
    reason: string          // e.g., "added quality NCR pack because..."
    confidence: high|medium|low
  }[]
  
  registrySnapshotVersion: string  // Which registry state was used
}
```

**Rationale**: The composition plan captures the deterministic resolution of a spec to blueprints, with explainability (`reason` field) for audit trails. This supports Phase 7's requirement that "failed checks block promotion" and reviewers can understand why specific blueprints were selected.

---

## Implementation Approach

### Phase 3 Tasks (sequential):

1. **Schema definition** — `core-types/src/schemas/blueprint.ts` ✅ DONE
2. **Domain entity schemas** — `domain-models/entities/` (extrusion, pcb, production) ✅ DONE
3. **Registry infrastructure**:
   - Loader interface + InMemory implementation ✅ DONE
   - Catalog interface + InMemory implementation ✅ DONE
   - Validator interface + predefined rules ✅ DONE
4. **Blueprint loader implementations** — TODO: LocalPathBlueprintLoader for FactoryNXT repo extraction
5. **Initial blueprint instances** — TODO: Create minimal extrusion and PCB blueprints as test fixtures

### Dependencies on Other Phases:

- ✅ Phase 1 complete (control plane schemas exist)
- ✅ Phase 2 complete (agent execution integrated, doesn't block)
- ⏳ Phase 4 depends on this phase's outputs (prompt-spec will consume registry)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| FactoryNXT extraction complexity may be higher than anticipated | Phase 3 delays | Start with minimal "hello world" blueprints, iterate toward full extraction |
| Semver comparison edge cases in catalog filtering | Incorrect blueprint selection | Use established semver library for production implementation |
| Overlap between extrusion and PCB domains causing confusion | Schema duplication or ambiguity | Document differences explicitly; both use `WorkOrder` but with different semantics |

---

## Alternatives Considered

### Alternative 1: JSON-based Blueprint Storage (vs. DB schema)

**Option**: Store blueprints as JSON documents in a document store (MongoDB, PostgreSQL JSONB).

**Rejected because**: 
- Zod schemas provide runtime validation at the API boundary
- Tabular representation better supports filtering/searching/catalog operations
- Aligns with existing Phase 1 Drizzle ORM pattern for control plane entities

### Alternative 2: LLM-assisted Blueprint Matching (vs. keyword-based)

**Option**: Use an LLM to match spec keywords to blueprint metadata tags automatically.

**Deferred because**: 
- Keyword-based matching is simpler and deterministic
- Can add LLM layer in Phase 4 as an enhancement
- Keeps v1 implementation testable without external API dependencies

### Alternative 3: Single Monolithic Blueprint Schema (vs. Family/Domain classification)

**Option**: One generic blueprint schema with arbitrary metadata fields.

**Rejected because**: 
- Typed enums (`BlueprintFamily`, `BlueprintDomain`) enable filtering/search at query time
- Explicit domain categories help users discover relevant blueprints
- Aligns with the "explainable composition" requirement in Phase 5

---

## Next Steps (for next session)

1. Implement `LocalPathBlueprintLoader` to extract FactoryNXT Python models into HeyNXT format
2. Create initial blueprint instances for testing:
   - Extrusion Operations blueprint (base domain)
   - PCB Genealogy blueprint (traceability focus)
3. Add vitest tests for catalog query operations and validation rules
4. Verify `pnpm typecheck` passes across all packages

---

## References

- [buildplan.md Phase 3](../buildplan.md#phase-3--industrial-blueprint-extraction)
- [FactoryNXT_PY_v2_Extrusion repository](https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion)
- [FactoryNxT_PY_V2 repository](https://github.com/pskbmohan/FactoryNxT_PY_V2)
