# Architecture Overview

## System Context

HeyNXT Core is an **industrial AI app builder platform** that transforms manufacturing blueprints and natural-language prompts into AI-generated applications for industrial use cases. It sits at the intersection of:

- **Industrial Manufacturing** — real-world manufacturing processes, equipment, materials, and quality requirements
- **AI Code Generation** — LLM-powered agents that generate applications from specifications
- **Product Control Plane** — user-facing orchestration, monitoring, and management

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        HeyNXT Core System                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────────────┐  │
│  │  Control    │   │   Prompt-to-  │   │    Agent Execution         │  │
│  │  Plane UI   │──▶│   Spec        │──▶│    Runtime                 │  │
│  │ (apps/web)  │   │(prompt-spec) │   │  (agent-adapter)           │  │
│  └─────────────┘   └──────────────┘   └────────────────────────────┘  │
│         │                  │                       │                    │
│         │                  │                       │                    │
│         ▼                  ▼                       ▼                    │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────────────┐  │
│  │  Settings & │   │  Blueprint    │   │    Results &               │  │
│  │  Config     │   │  Registry     │   │    Artifacts               │  │
│  └─────────────┘   └──────────────┘   └────────────────────────────┘  │
│                          │                                            │
│                          ▼                                            │
│                 ┌──────────────────┐   ┌────────────────────────────┐  │
│                 │  Domain Models    │   │    Industrial Blueprint     │  │
│                 │ (domain-models)   │   │    Sources                 │  │
│                 └──────────────────┘   │  (FactoryNXT repos)        │  │
│                                        └────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Shared Schema Layer                             │   │
│  │               (@heynxt/core-types)                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Architectural Layers

### Layer 1: Shared Schema Layer (`@heynxt/core-types`)

The foundation contract layer. All inter-package communication flows through Zod schemas and TypeScript types defined here. This package has **zero runtime dependencies** — it defines the shared vocabulary.

**Responsibilities:**
- Define blueprint schemas (industrial recipe definitions)
- Define agent specification schemas (agent execution contracts)
- Define prompt spec schemas (prompt-to-spec input/output types)
- Define domain model base schemas (industrial entity foundations)
- Define execution result schemas (agent run outcomes)

**Key Principle:** Every other package imports from `core-types` — never from each other's internals. This prevents circular dependencies and ensures a single source of truth for data contracts.

---

### Layer 2: Domain Models Layer (`@heynxt/domain-models`)

Industrial domain entity definitions derived from manufacturing reference implementations (FactoryNXT_PY_V2 for electronics/PCB assembly, FactoryNXT_PY_v2_Extrusion for aluminum extrusion).

**Responsibilities:**
- Define equipment models: Machine, Station, Line, Cell
- Define process models: Recipe, WorkflowStep, SetpointProfile, HeatTreatmentProgram
- Define material models: RawMaterial, Intermediate, FinishedGood, AlloyComposition
- Define quality models: InspectionPlan, Measurement, Tolerance, DefectRecord
- Define production models: WorkOrder, SerialNumber, OperationTransaction
- Define routing models: RoutingMaster, RoutingStep, RoutingConnection (DAG)
- Define traceability models: Genealogy, TraceabilityRecord
- Define relationships and constraints between all entities

**Domain Vocabulary** (from reference repos):
- **Billet** — raw aluminum stock awaiting extrusion
- **Die** — extrusion tooling with lifecycle (New → Inspected → Testing → Nitrided → Available)
- **SetpointProfile** — process recipe: temperature, speed, pressure, force targets by alloy and profile
- **RoutingMaster** — manufacturing workflow as a DAG (directed acyclic graph)
- **ProcessRun** — execution of a process with actuals vs setpoints
- **OEE** — Overall Equipment Effectiveness (Availability × Performance × Quality)

---

### Layer 3: Blueprint Registry Layer (`@heynxt/blueprint-registry`)

Catalog and repository of industrial blueprints — reusable manufacturing recipe templates that serve as source material for AI-generated applications.

**Responsibilities:**
- Load blueprints from reference repositories (local and remote)
- Validate blueprints against core-types schemas
- Catalog blueprints with metadata, versioning, and categorization
- Query and filter blueprints by domain, equipment type, process type
- Track blueprint versions and compatibility
- Support blueprint provenance (which reference repo a blueprint was derived from)

**Blueprint Sources:**
- `FactoryNXT_PY_V2` — PCB/electronics assembly blueprints
- `FactoryNXT_PY_v2_Extrusion` — aluminum extrusion blueprints

---

### Layer 4: Prompt-to-Spec Layer (`@heynxt/prompt-spec`)

Transforms natural-language prompts and context into structured application specifications that agents can execute.

**Responsibilities:**
- Parse natural-language prompts
- Extract intent, context, and domain requirements
- Select appropriate blueprints based on prompt context
- Generate structured `SpecTemplate` instances
- Validate generated specs against domain constraints
- Support template-based spec generation

---

### Layer 5: Agent Adapter Layer (`@heynxt/agent-adapter`)

Bridges the control plane to coding-agent execution runtimes. Inspired by the Vercel coding-agent-template substrate pattern.

**Responsibilities:**
- Define agent runtime interface (spawn, execute, monitor, collect)
- Integrate with LLM-powered coding agents
- Manage agent lifecycle and configuration
- Handle streaming output and real-time progress tracking
- Collect execution results and artifacts
- Implement error handling, retry, and fallback strategies
- Support multiple agent backends (pluggable)

**Agent Substrate Pattern** (from Vercel coding-agent-template):
- Agents receive structured specs as input
- Agents execute in sandboxed environments
- Results are collected as artifacts (code files, documentation, configs)
- Execution is observable (logs, progress, metrics)

---

### Layer 6: Control Plane UI (`apps/web`)

Next.js application providing the user-facing interface for the entire platform.

**Responsibilities:**
- Blueprint browser and catalog UI
- Prompt input and spec preview interface
- Agent execution dashboard with real-time monitoring
- Results viewer and artifact browser
- Settings and configuration management
- User authentication and authorization

---

## Data Flow

### Standard Generation Flow

```
1. User enters prompt in Control Plane UI
        │
        ▼
2. Prompt-to-Spec parses prompt, extracts intent & context
        │
        ▼
3. Blueprint Registry selects matching blueprint(s)
        │
        ▼
4. Prompt-to-Spec generates SpecTemplate
   (references blueprint, domain models, constraints)
        │
        ▼
5. Agent Adapter receives SpecTemplate
   (validates against AgentSpec schema)
        │
        ▼
6. Agent executes in sandboxed environment
   (streaming progress to UI)
        │
        ▼
7. Results collected (code, docs, artifacts)
        │
        ▼
8. Results presented to user in Control Plane UI
```

### Blueprint Loading Flow

```
1. Blueprint Registry loads blueprint sources
   (from FactoryNXT_PY_V2, FactoryNXT_PY_v2_Extrusion, or custom)
        │
        ▼
2. Blueprints validated against core-types schemas
        │
        ▼
3. Blueprints cataloged with metadata and versioning
        │
        ▼
4. Blueprints available for selection in prompt-to-spec
```

---

## Package Dependency Graph

```
@heynxt/web
  ├── @heynxt/core-types
  ├── @heynxt/prompt-spec
  │     └── @heynxt/core-types
  ├── @heynxt/agent-adapter
  │     ├── @heynxt/core-types
  │     └── @heynxt/prompt-spec (for SpecTemplate types)
  ├── @heynxt/blueprint-registry
  │     ├── @heynxt/core-types
  │     └── @heynxt/domain-models
  │           └── @heynxt/core-types
  └── @heynxt/domain-models
        └── @heynxt/core-types
```

**Dependency Rules:**
1. `@heynxt/core-types` is the **leaf dependency** — everything depends on it, it depends on nothing
2. Packages depend on `core-types` directly — never transitively through other packages
3. `@heynxt/web` is the **root consumer** — it depends on all packages but no package depends on it
4. No circular dependencies allowed
5. Package boundaries are enforced — cross-package imports go through public exports only

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Monorepo | pnpm workspaces + Turbo | Fast, disk-efficient, task orchestration |
| Language | TypeScript (strict mode) | Type safety, IDE support, schema inference from Zod |
| Schemas | Zod | Runtime validation, TypeScript type inference, composable |
| UI Framework | Next.js 14 | SSR/SSG, API routes, React ecosystem |
| Agent Substrate | Vercel coding-agent-template patterns | Proven agent execution patterns, sandboxed environments |
| Industrial Domain | FactoryNXT reference repos | Real-world manufacturing domain models, proven MES patterns |

---

## Security Considerations

1. **Agent Sandboxing** — agents execute in isolated environments; control plane manages permissions
2. **Blueprint Provenance** — blueprints are validated and versioned; source is always tracked
3. **Schema Validation** — all data crossing package boundaries is validated with Zod
4. **Authentication** — control plane UI requires authentication (to be implemented)
5. **Audit Trail** — agent executions, blueprint changes, and spec generations are logged

---

## Extension Points

The architecture is designed for extension:

- **New blueprints** — add to Blueprint Registry without modifying core logic
- **New agent backends** — implement AgentRuntime interface in agent-adapter
- **New domains** — add domain models to domain-models package
- **New spec templates** — extend prompt-spec template engine
- **New UI features** — add pages to apps/web without modifying packages

---

## References

- [Vercel coding-agent-template](https://github.com/vercel-labs/coding-agent-template) — agent substrate patterns
- [FactoryNXT_PY_V2](https://github.com/pskbmohan/FactoryNXT_PY_V2) — PCB/electronics MES reference
- [FactoryNXT_PY_v2_Extrusion](https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion) — aluminum extrusion MES reference
- [ADR-0001: Monorepo and Boundaries](../adr/0001-monorepo-and-boundaries.md)
- [ADR-0002: Agent Substrate](../adr/0002-agent-substrate.md)
- [ADR-0003: Industrial Blueprint Sources](../adr/0003-industrial-blueprint-sources.md)
