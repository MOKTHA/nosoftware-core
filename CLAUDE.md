# HeyNXT Core - Claude Configuration

## Repository Overview

This is the product control plane and orchestration layer for an industrial AI app builder platform. The repository uses a monorepo structure with pnpm workspaces and Turbo for task orchestration.

## Architecture Principles

1. **Layered Separation**: Control plane, agent adapter, blueprint registry, prompt-to-spec, and domain models are separate packages with explicit boundaries
2. **Contract-First**: All inter-package communication goes through Zod schemas defined in `@heynxt/core-types`
3. **Incremental Building**: Each package has a clear TODO list for implementation phases
4. **Type Safety**: TypeScript with strict mode across all packages
5. **No Premature Implementation**: Scaffolding first, implementation follows the phase plan in buildplan.md

## Key Directories

```
apps/
  web/                    # Next.js control plane UI
packages/
  core-types/             # Shared Zod schemas and TypeScript types
  prompt-spec/            # Prompt-to-spec transformation logic
  agent-adapter/          # Coding agent execution adapter
  blueprint-registry/     # Industrial blueprint catalog
  domain-models/          # Industrial domain entities
docs/
  architecture/           # Architecture documentation
  adr/                    # Architecture Decision Records
```

## Development Commands

```bash
pnpm install              # Install dependencies
pnpm build               # Build all packages
pnpm dev                 # Start all dev servers
pnpm lint                # Lint all packages
pnpm typecheck           # Type-check all packages
```

## Working with This Repository

### For New Features
1. Check buildplan.md for the current phase
2. Implement within the appropriate package boundary
3. Update core-types if adding new schemas
4. Create ADR if making architectural changes
5. Follow the TODO markers in each package

### Package Dependencies
```
@heynxt/web depends on:
  - @heynxt/core-types
  - @heynxt/prompt-spec
  - @heynxt/agent-adapter
  - @heynxt/blueprint-registry
  - @heynxt/domain-models

@heynxt/agent-adapter depends on:
  - @heynxt/core-types
  - @heynxt/prompt-spec

@heynxt/blueprint-registry depends on:
  - @heynxt/core-types
  - @heynxt/domain-models

@heynxt/prompt-spec depends on:
  - @heynxt/core-types

@heynxt/domain-models depends on:
  - @heynxt/core-types

@heynxt/core-types depends on:
  - (none - foundation package)
```

### Reference Architecture Sources

1. **Coding Agent Substrate**: Vercel coding-agent-template
   - Provides agent execution patterns
   - See docs/adr/0002-agent-substrate.md

2. **Industrial Blueprints**: FactoryNXT repositories
   - FactoryNXT_PY_v2_Extrusion: Extrusion manufacturing domain
   - FactoryNxT_PY_V2: General industrial automation
   - See docs/adr/0003-industrial-blueprint-sources.md

## Next Steps

Check buildplan.md for the current implementation phase. The foundation is scaffolded; implementation begins with Phase 1: Core Schema Foundation.

## Important Notes

- DO NOT rebuild the foundation - extend it
- DO NOT implement features outside their designated package
- DO NOT skip the TODO markers - they guide implementation order
- DO follow the contract-first approach with Zod schemas
- DO create ADRs for architectural decisions
