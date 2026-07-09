# HeyNXT Core - Industrial AI App Builder Platform

> **Status**: Phase 0 - Foundation Complete | **Next**: Phase 1 Schema Implementation

HeyNXT Core is the product control plane and orchestration layer for an industrial AI app builder platform. It combines coding-agent execution patterns with industrial manufacturing blueprints to enable AI-driven application generation for industrial use cases.

## 🎯 Purpose

This repository enables:
- **Prompt-to-Spec Transformation**: Convert natural language prompts into structured application specifications
- **Agent Orchestration**: Coordinate coding agents to generate applications from specs
- **Blueprint Registry**: Catalog and version industrial manufacturing blueprints
- **Domain Models**: Capture industrial manufacturing entities and relationships
- **Control Plane UI**: Provide user interface for managing the entire workflow

## 🏗️ Architecture Overview

HeyNXT Core uses a **layered monorepo** architecture with explicit boundaries between control plane, agent execution, and industrial domain logic.

```
┌─────────────────────────────────────────────────────────┐
│                    Control Plane UI                      │
│                     (apps/web)                           │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴─────────┬──────────┬──────────────┐
    │                  │          │              │
    ▼                  ▼          ▼              ▼
┌────────┐      ┌──────────┐  ┌────────┐  ┌─────────────┐
│ Prompt │      │  Agent   │  │Blueprint│  │   Domain    │
│  Spec  │      │ Adapter  │  │Registry │  │   Models    │
└────────┘      └──────────┘  └────────┘  └─────────────┘
    │                  │          │              │
    └──────────────────┴──────────┴──────────────┘
                    │
              ┌─────▼─────┐
              │Core Types │
              │ (Zod)     │
              └───────────┘
```

## 📦 Packages

| Package | Purpose | Status |
|---------|---------|--------|
| `@heynxt/web` | Next.js control plane UI | Scaffolded |
| `@heynxt/core-types` | Shared Zod schemas and types | Scaffolded |
| `@heynxt/prompt-spec` | Prompt-to-spec transformation | Scaffolded |
| `@heynxt/agent-adapter` | Coding agent execution adapter | Scaffolded |
| `@heynxt/blueprint-registry` | Industrial blueprint catalog | Scaffolded |
| `@heynxt/domain-models` | Industrial domain entities | Scaffolded |

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development
pnpm dev

# Type-check
pnpm typecheck

# Lint
pnpm lint
```

## 📚 Documentation

- [Knowledge Graphs](graphify/README.md) - Structural maps of this repo and reference repos (start here)
  - [heynxt-core map](graphify/heynxt-core/GRAPH_REPORT.md) — structural graph of this repo
  - Also includes graphs for: FactoryNXT_PY_v2_Extrusion, FactoryNXT_PY_V2, coding-agent-template
- [Architecture Overview](docs/architecture/overview.md) - Detailed architecture documentation
- [Build Plan](buildplan.md) - Phase-by-phase implementation plan
- [Architecture Decision Records](docs/adr/) - Key architectural decisions and rationale

### ADRs

- [ADR-0001: Monorepo and Boundaries](docs/adr/0001-monorepo-and-boundaries.md)
- [ADR-0002: Agent Substrate](docs/adr/0002-agent-substrate.md)
- [ADR-0003: Industrial Blueprint Sources](docs/adr/0003-industrial-blueprint-sources.md)

## 🏭 Reference Architecture Sources

### Coding Agent Substrate
- [Vercel coding-agent-template](https://github.com/vercel-labs/coding-agent-template) - Agent execution patterns and substrate concepts

### Industrial Blueprints
- [FactoryNXT_PY_v2_Extrusion](https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion) - Extrusion manufacturing domain models and blueprints
- [FactoryNxT_PY_V2](https://github.com/pskbmohan/FactoryNxT_PY_V2) - General industrial automation blueprints

## 🎯 Current Phase: Foundation (Phase 0)

The repository foundation is complete. Next steps:

1. **Phase 1**: Core Schema Foundation - Define Zod schemas in `@heynxt/core-types`
2. **Phase 2**: Domain Models - Implement industrial domain entities
3. **Phase 3**: Blueprint Registry - Catalog and load industrial blueprints
4. **Phase 4**: Prompt-to-Spec - Implement transformation logic
5. **Phase 5**: Agent Adapter - Integrate coding agent runtime
6. **Phase 6**: Control Plane UI - Build user interface

See [buildplan.md](buildplan.md) for detailed phase descriptions.

## 🤝 Contributing

### For Claude Sessions

When working on this repository:
1. **Extend, don't rebuild** - The foundation is intentionally minimal and correct
2. **Respect boundaries** - Each package has a clear scope and responsibility
3. **Contract-first** - Define schemas in `@heynxt/core-types` before implementation
4. **Follow TODOs** - Each package has TODO markers guiding implementation order
5. **Create ADRs** - Document architectural decisions in `docs/adr/`

See [CLAUDE.md](CLAUDE.md) for detailed guidance.

## 📋 Requirements

- Node.js >= 20.0.0
- pnpm >= 9.0.0

## 📄 License

UNLICENSED - Proprietary

---

**Repository Status**: Phase 0 Complete ✓ | Ready for Phase 1 Implementation
