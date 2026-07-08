# ADR-0003: Industrial Blueprint Sources

**Status**: Accepted  
**Date**: 2026-07-09  
**Author**: Architecture Team  
**Superseded By**: N/A

## Context

HeyNXT Core requires industrial blueprints as source material for AI-generated applications. Blueprints are reusable manufacturing recipe templates that encode domain knowledge, process constraints, and equipment relationships.

We evaluated several approaches for sourcing blueprints:

1. **Build from Scratch** — design blueprints without reference implementations
2. **Acquire Existing MES Systems** — adapt from open-source or commercial MES
3. **Partner with Manufacturers** — co-develop with industrial partners
4. **Extract from Reference Repositories** — derive blueprints from proven FactoryNXT implementations

## Decision

We will use the **FactoryNXT reference repositories** as the primary blueprint sources:

1. **[FactoryNXT_PY_v2_Extrusion](https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion)** — aluminum extrusion MES (extrusion domain)
2. **[FactoryNXT_PY_V2](https://github.com/pskbmohan/FactoryNXT_PY_V2)** — PCB/electronics assembly MES (SMT domain)

These repositories contain **production-proven domain models, process workflows, and recipe definitions** that will be adapted into HeyNXT blueprints.

### Reference Repository Characteristics

#### FactoryNXT_PY_v2_Extrusion (Aluminum Extrusion)

**Tech Stack:**
- Flask 3.0 web application (MES)
- SQLAlchemy ORM with PostgreSQL
- ~101 domain models across 3 files
- APS (Advanced Planning & Scheduling) engine
- Visual routing builder (DAG-based)

**Domain Coverage:**
- **Billets** — raw aluminum stock (alloy, diameter, length, lot, quantity)
- **Dies** — extrusion tooling with lifecycle (New → Inspected → Testing → Nitrided → Available)
- **Setpoint Profiles** — process recipes: temperature, speed, pressure, force by alloy and profile
- **Process Lines** — HLS, Pressing, Quenching, Puller, Stretching, Final Cut stages
- **Heat Treatment** — T5/T6 temper programs with multi-stage recipes
- **Finishing** — anodizing, coating, powder colors (RAL codes)
- **Containers** — material handling with weighing and movements
- **Logistics** — packaging specs, barcoded orders, shipments
- **Quality** — inspections, NCRs, defect tracking, traceability
- **OEE** — Overall Equipment Effectiveness (Availability × Performance × Quality)

**Key Blueprint Concepts:**
- `SetpointProfile`: process recipe keyed by `process_type + alloy + profile_code` with versioned `parameters` JSON
- `HeatTreatmentProgram`: temper recipe as ordered `stages` JSON with `temper_designation`
- `RoutingMaster → RoutingStepV2 → RoutingConnection`: DAG-based manufacturing workflow
- `WorkOrderRoutingSnapshot`: immutable routing copy at WO release (important immutability pattern)
- `AlloyComposition`: material spec as JSON tolerance ranges

#### FactoryNXT_PY_V2 (PCB/Electronics Assembly)

**Tech Stack:**
- Flask 3.0 web application (MES)
- SQLAlchemy ORM with PostgreSQL
- ~55 domain models
- Visual routing builder (similar to extrusion version)
- Operation execution engine (barcode-scan station model)

**Domain Coverage:**
- **Shop-Floor Topology** — Plant, Line, SmtLine, Machine, Station
- **Orders & Production** — WorkOrder, SerialNumber, OperationTransaction, ProductionSchedule
- **Product Definition** — BOMItem (bill of materials), RoutingStep
- **SMT Materials** — FeederReel (splice tracking), SolderPasteLot (floor-life), Stencil (print-count)
- **PCB Traceability** — PcbPanel → PcbBoard, UnitHistory, GenealogyEvent (component-level)
- **Quality** — NCR, CAPA, DefectRecord, InspectionPlan (AQL sampling), GoldenBoard
- **Machine Reliability** — PM Schedule, MaintenanceLog, CalibrationRecord, DowntimeEvent, OEE
- **Governance** — Role, UserProfile, OperatorCertification, AuditLog, ElectronicSignature

**Key Blueprint Concepts:**
- `RoutingMaster`: manufacturing workflow header with revision control (DRAFT → RELEASED → OBSOLETE)
- `RoutingStepV2`: operation node with station link, cycle time, QC flags
- `RoutingConnection`: directed edge enabling parallel/branching flows
- `WorkOrderRoutingSnapshot`: frozen routing at WO release
- `OperationTransaction`: immutable barcode-scan execution record
- `InspectionPlan`: AQL sampling with accept/reject limits

### Blueprint Extraction Strategy

We will **NOT** directly copy models from FactoryNXT repositories. Instead, we will:

1. **Analyze Domain Models** — understand the entity relationships and constraints
2. **Extract Domain Vocabulary** — identify key entities, processes, and workflows
3. **Abstract Blueprint Patterns** — generalize recipe/parameter structures
4. **Define Core Schemas** — create Zod schemas in `@heynxt/core-types` that capture:
   - Blueprint metadata (name, version, source, description)
   - Process specifications (setpoints, parameters, constraints)
   - Routing definitions (steps, connections, DAG structure)
   - Material specifications (compositions, tolerances)
   - Quality requirements (inspections, tests, acceptance criteria)
5. **Implement Blueprint Loader** — fetch blueprints from reference repos or custom sources
6. **Catalog Blueprints** — organize by domain (extrusion, PCB, general manufacturing)

### Blueprint Schema Design

Based on FactoryNXT patterns, blueprints will include:

```typescript
// Blueprint metadata
const BlueprintMetadata = z.object({
  id: z.string().uuid(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  source: z.enum(['factorynxt_extrusion', 'factorynxt_pcb', 'custom']),
  sourceRef: z.string().optional(), // e.g., git commit hash or repo path
  domain: z.enum(['aluminum_extrusion', 'pcb_assembly', 'general_manufacturing']),
  tags: z.array(z.string()),
  created: z.date(),
  updated: z.date(),
});

// Process recipe (inspired by SetpointProfile, HeatTreatmentProgram)
const ProcessRecipe = z.object({
  processType: z.string(), // HLS, PRESSING, QUENCHING, HEAT_TREATMENT, etc.
  parameters: z.record(z.unknown()), // JSON parameter bag
  constraints: z.record(z.unknown()).optional(),
  alloy: z.string().optional(),
  profileCode: z.string().optional(),
  stages: z.array(z.object({
    name: z.string(),
    targetTemp: z.number().optional(),
    durationMin: z.number().optional(),
    // ... other stage parameters
  })).optional(),
});

// Manufacturing routing (inspired by RoutingMaster → RoutingStepV2 → RoutingConnection)
const ManufacturingRouting = z.object({
  routingCode: z.string(),
  revision: z.string(),
  status: z.enum(['DRAFT', 'RELEASED', 'OBSOLETE']),
  steps: z.array(z.object({
    stepNo: z.number(),
    operationName: z.string(),
    stationType: z.string(),
    cycleTime: z.number(),
    qcRequired: z.boolean().optional(),
    parallel: z.boolean().optional(),
  })),
  connections: z.array(z.object({
    fromStep: z.number(),
    toStep: z.number(),
  })).optional(),
});

// Blueprint combines these
const Blueprint = z.object({
  metadata: BlueprintMetadata,
  processRecipes: z.array(ProcessRecipe).optional(),
  routing: ManufacturingRouting.optional(),
  materialSpecs: z.array(z.unknown()).optional(),
  qualityRequirements: z.array(z.unknown()).optional(),
  domainModels: z.array(z.unknown()).optional(),
});
```

### Domain Model Derivation

Domain models in `@heynxt/domain-models` will be derived from FactoryNXT patterns:

#### From FactoryNXT_PY_v2_Extrusion:

```typescript
// Equipment
const Die = z.object({
  id: z.string().uuid(),
  dieCode: z.string(),
  dieType: z.enum(['solid', 'hollow', 'semi_hollow']),
  alloy: z.string(),
  status: z.enum(['new', 'inspected', 'testing_pending', 'testing_passed',
                  'nitriding_pending', 'nitrided', 'available', 'rejected']),
  pressCount: z.number(),
  pressCountLimit: z.number(),
  nitridingCount: z.number(),
});

const Billet = z.object({
  id: z.string().uuid(),
  alloy: z.string(),
  diameterMm: z.number(),
  lengthMm: z.number(),
  lotNumber: z.string(),
  quantityKg: z.number(),
  inspected: z.boolean(),
});

// Process
const SetpointProfile = z.object({
  id: z.string().uuid(),
  processType: z.string(), // HLS, PRESSING, QUENCHING, etc.
  alloy: z.string(),
  profileCode: z.string(),
  version: z.string(),
  parameters: z.record(z.unknown()),
});

const ProcessRun = z.object({
  id: z.string().uuid(),
  profileId: z.string().uuid(),
  startTime: z.date(),
  endTime: z.date().optional(),
  actuals: z.record(z.unknown()),
  status: z.enum(['running', 'completed', 'failed', 'aborted']),
});
```

#### From FactoryNXT_PY_V2:

```typescript
// Equipment
const Machine = z.object({
  id: z.string().uuid(),
  machineCode: z.string(),
  machineType: z.string(),
  lineId: z.string().uuid().optional(),
  status: z.enum(['available', 'running', 'maintenance', 'offline']),
});

const Station = z.object({
  id: z.string().uuid(),
  stationCode: z.string(),
  stationType: z.string(),
  machineId: z.string().uuid().optional(),
});

// Production
const WorkOrder = z.object({
  id: z.string().uuid(),
  orderNumber: z.string(),
  partNumber: z.string(),
  quantity: z.number(),
  status: z.enum(['DRAFT', 'RELEASED', 'RUNNING', 'COMPLETED', 'CANCELLED']),
  scheduledStart: z.date(),
  scheduledEnd: z.date(),
  releasedAt: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
});

// Quality
const InspectionPlan = z.object({
  id: z.string().uuid(),
  targetCode: z.string(),
  operationStep: z.string(),
  sampleSize: z.number(),
  acceptLimit: z.number(),
  rejectLimit: z.number(),
});
```

## Rationale

### Why FactoryNXT Repositories?

**Pros:**
- **Production-Proven** — real MES systems with real manufacturing data
- **Rich Domain Models** — ~156 combined models covering extrusion + PCB domains
- **Process Workflows** — tested routing, scheduling, quality, and traceability logic
- **Recipe Patterns** — setpoint profiles, heat treatment programs, alloy compositions
- **Immutability Patterns** — WO routing snapshots, operation transactions
- **Scheduling Logic** — APS engine with finite capacity, constraints, versioning
- **Quality Systems** — AQL inspection, NCR tracking, OEE calculation
- **Traceability** — component-level genealogy, operation audit trails

**Cons (mitigated):**
- **Legacy Code** — Flask apps with some duplication (mitigated by extracting patterns, not code)
- **No Formal Docs** — architecture in code, not written (mitigated by thorough analysis)
- **Domain Complexity** — extrusion + PCB are specific verticals (mitigated by abstracting core patterns)

### Why Not Build from Scratch?

- **Months of Domain Research** — would require interviewing manufacturers, understanding processes
- **Risk of Missing Critical Patterns** — immutability, versioning, snapshots are non-obvious
- **No Production Validation** — untested models would lead to generation errors
- **Slower Time to Market** — would delay platform launch significantly

### Why Not Commercial MES?

- **Cost** — commercial MES systems are expensive (licensing + customization)
- **Vendor Lock-In** — dependency on vendor for updates and support
- **Black Box** — limited insight into domain logic
- **Over-Engineered** — most features not needed for blueprint generation

### Why Not Open-Source MES?

- **Limited Options** — few true open-source MES systems exist
- **Lack of Modern Patterns** — many are legacy systems with outdated architectures
- **No AI Integration** — none designed for AI-driven app generation
- **FactoryNXT is Uniquely Suited** — custom-built with AI adaptation in mind

## Consequences

### Positive

- **Domain Knowledge** — leverage years of manufacturing expertise encoded in reference repos
- **Faster Development** — extract patterns instead of reinventing them
- **Production-Grade** — blueprints based on proven, tested systems
- **Comprehensive Coverage** — extrusion (aluminum) + PCB (electronics) domains covered
- **Extensible** — custom blueprints can be added alongside reference-derived ones
- **Validated** — domain patterns validated in real manufacturing environments

### Negative

- **Domain Specificity** — initial blueprints are extrusion/PCB specific
  - Mitigation: abstract core patterns to support other domains later
- **Extraction Effort** — requires careful analysis and schema design
  - Mitigation: systematic approach, validate against reference repos
- **Version Drift** — reference repos may evolve
  - Mitigation: pin to specific versions/commits, track upstream changes

### Neutral

- **Flask → TypeScript Migration** — extracting Python models into TypeScript Zod schemas
  - This is a translation effort, not a copy-paste

## Implementation Plan

### Phase 1: Core Schema Foundation (Weeks 1-2)

1. Analyze FactoryNXT domain models in detail
2. Design core blueprint schemas in `@heynxt/core-types`
3. Design base domain model schemas
4. Create Zod schemas with validation rules

### Phase 2: Domain Models (Weeks 3-5)

1. Implement extrusion domain models in `@heynxt/domain-models`
2. Implement PCB domain models
3. Define relationships and constraints
4. Create example domain model instances

### Phase 3: Blueprint Registry (Weeks 6-8)

1. Implement blueprint loader (fetch from FactoryNXT repos or local paths)
2. Implement blueprint validator (validate against schemas)
3. Implement blueprint catalog (search, filter, query)
4. Implement version management
5. Load initial blueprints from reference repos

## Migration Plan

Not applicable — this is the initial architecture.

## Future Considerations

- **Additional Domains** — add automotive, pharmaceutical, food & beverage blueprints
- **Partner Integration** — co-develop blueprints with manufacturing partners
- **Blueprint Marketplace** — allow third-party blueprint contributions
- **AI-Enhanced Blueprints** — use AI to optimize parameters and suggest improvements
- **Blueprint Versioning** — semantic versioning with breaking change detection

## References

- [FactoryNXT_PY_v2_Extrusion](https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion)
- [FactoryNXT_PY_V2](https://github.com/pskbmohan/FactoryNXT_PY_V2)
- [FactoryNXT Extrusion README and Design Docs](https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion/blob/main/README.md)
- [FactoryNXT Extrusion APS Implementation](https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion/blob/main/APS_IMPLEMENTATION_SUMMARY.md)
