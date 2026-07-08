# ADR-0001: Monorepo and Boundaries

**Status**: Accepted  
**Date**: 2026-07-09  
**Author**: Architecture Team  
**Superseded By**: N/A

## Context

HeyNXT Core is an industrial AI app builder with multiple distinct concerns:

1. **Control Plane UI** — user-facing web application
2. **Agent Execution** — integration with LLM-powered coding agents
3. **Blueprint Management** — cataloging and loading industrial blueprints
4. **Prompt Transformation** — converting prompts to specifications
5. **Industrial Domain Models** — manufacturing entities and processes

These concerns are tightly coupled at the data level (they all share the same domain vocabulary: blueprints, agents, specs, domain models) but loosely coupled at the execution level (they can evolve independently).

## Decision

We will use a **pnpm workspace monorepo** with **explicit package boundaries** to separate concerns while maintaining shared contracts.

### Monorepo Structure

```
heynxt-core/
├── apps/
│   └── web/                    # Next.js control plane UI
├── packages/
│   ├── core-types/             # Shared Zod schemas and types
│   ├── prompt-spec/            # Prompt-to-spec transformation
│   ├── agent-adapter/          # Coding agent execution adapter
│   ├── blueprint-registry/     # Industrial blueprint catalog
│   └── domain-models/          # Industrial domain entities
├── docs/
│   ├── architecture/           # Architecture documentation
│   └── adr/                    # Architecture Decision Records
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### Package Boundaries

Each package has a single responsibility and explicit public API:

| Package | Responsibility | Depends On |
|---------|---------------|-----------|
| `@heynxt/core-types` | Schema contracts (Zod) | (nothing) |
| `@heynxt/domain-models` | Industrial entities | `core-types` |
| `@heynxt/blueprint-registry` | Blueprint catalog | `core-types`, `domain-models` |
| `@heynxt/prompt-spec` | Prompt transformation | `core-types` |
| `@heynxt/agent-adapter` | Agent execution | `core-types`, `prompt-spec` |
| `@heynxt/web` | Control plane UI | all packages |

### Dependency Rules

1. **`core-types` is the leaf** — all packages depend on it, it depends on nothing
2. **No circular dependencies** — enforced via TypeScript path resolution
3. **Cross-package imports go through public exports only** — no internal path imports
4. **Web is the root consumer** — depends on all packages, no package depends on it

## Rationale

### Why Monorepo?

**Pros:**
- **Atomic Changes** — schema changes in `core-types` are immediately reflected across all packages
- **Shared Contracts** — Zod schemas defined once in `core-types` used everywhere prevents drift
- **Developer Experience** — single repo, single install, single build command
- **Version Consistency** — all packages move together, no version mismatch risk
- **Local Development** — changes across package boundaries require no publishing

**Cons (mitigated):**
- **Build Coordination** — Turbo DAG-based build system handles dependency ordering
- **Large Codebase** — clear directory structure and package boundaries prevent sprawl
- **CI Complexity** — Turbo caching and workspaces simplify CI configuration

### Why pnpm Workspaces?

- **Disk Efficiency** — deduplicates dependencies across packages
- **Speed** — significantly faster than npm/yarn for monorepos
- **Strict Mode** — prevents phantom dependencies
- **Native Workspaces** — built-in workspace protocol

### Why Turbo?

- **Task Orchestration** — builds packages in correct dependency order
- **Caching** — avoids redundant work across builds
- **Parallelism** — runs independent tasks concurrently
- **Incremental Builds** — only rebuilds what changed

### Why These Specific Boundaries?

The boundaries reflect the **natural seams** in the domain:

1. **`core-types`** — the contract layer. Schema changes are high-impact, so they're isolated for visibility and enforcement.

2. **`domain-models`** — industrial vocabulary. Derived from FactoryNXT reference repos (extrusion domain: billets, dies, setpoint profiles, process runs; PCB domain: stations, feeders, PCBs). Kept separate because domain modeling is a distinct discipline from agent execution or prompt transformation.

3. **`blueprint-registry`** — catalog and loading logic. Blueprints are the "source material" for generation. Separated because loading, validation, and versioning are distinct concerns from the blueprints' internal structure.

4. **`prompt-spec`** — transformation logic. Prompt parsing and spec generation are a distinct pipeline stage. Separated because this logic evolves independently (different algorithms, different validation rules).

5. **`agent-adapter`** — execution bridge. Agent execution is infrastructure-heavy (sandboxing, streaming, error handling). Separated because agent backends are pluggable (Claude, Codex, Cursor, etc.).

6. **`web`** — UI layer. Control plane is the only app-level concern. Separated because UI framework (Next.js) and rendering concerns are distinct from backend logic.

## Consequences

### Positive

- **Clear Ownership** — each package has a single team/developer responsible
- **Enforced Boundaries** — TypeScript prevents accidental cross-package dependencies
- **Incremental Development** — packages can be built and tested independently
- **Reusability** — `core-types` and `domain-models` can be published as npm packages later if needed
- **Testing Isolation** — each package has its own tests, preventing test suite bloat

### Negative

- **Build Orchestration** — requires Turbo configuration and understanding
- **Package Versioning** — all packages are private for now, but publishing would require versioning discipline
- **Onboarding** — new developers must understand workspace structure
- **Tooling Overhead** — pnpm, Turbo, TypeScript path resolution must be configured correctly

### Neutral

- **No Shared Config Package** — TypeScript config is duplicated across packages. This is intentional to keep packages independently buildable.

## Migration Plan

Not applicable — this is the initial architecture.

## References

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [FactoryNXT_PY_v2_Extrusion](https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion) — reference for domain model boundaries
- [FactoryNXT_PY_V2](https://github.com/pskbmohan/FactoryNXT_PY_V2) — reference for domain model boundaries
