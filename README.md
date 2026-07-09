# HeyNXT Core - Industrial AI App Builder Platform

> **Status**: Phase 1 - Product Control Plane (in progress) | **Next**: Wire DB client into API routes

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
| `@heynxt/core-types` | Shared Zod schemas and types | 9 control-plane schemas (User, Organization, Workspace, RBAC, Project, Task, GenerationRun, Artifact, AuditLogEntry) |
| `@heynxt/persistence` | Drizzle ORM tables + migrations | 9 tables, 12 enums, 19 indexes; first migration `0000_great_sunspot.sql` |
| `@heynxt/prompt-spec` | Prompt-to-spec transformation | Scaffolded |
| `@heynxt/agent-adapter` | Coding agent execution adapter | Scaffolded |
| `@heynxt/blueprint-registry` | Industrial blueprint catalog | Scaffolded |
| `@heynxt/domain-models` | Industrial domain entities | Scaffolded |

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start local Postgres (Postgres 15 mirroring Neon serverless)
pnpm dev:db

# Build all packages
pnpm build

# Start development
pnpm dev

# Type-check
pnpm typecheck

# Lint
pnpm lint
```

See [docs/dev-setup.md](docs/dev-setup.md) for the full local setup guide
(credentials, env file, troubleshooting).

## 📚 Documentation

- [Knowledge Graphs](graphify/README.md) - Structural maps of this repo and reference repos (start here)
  - [heynxt-core map](graphify/heynxt-core/GRAPH_REPORT.md) — structural graph of this repo
  - Also includes graphs for: FactoryNXT_PY_v2_Extrusion, FactoryNXT_PY_V2, coding-agent-template
- [Local Development Setup](docs/dev-setup.md) - How to run the database and app locally
- [Architecture Overview](docs/architecture/overview.md) - Detailed architecture documentation
- [Build Plan](buildplan.md) - Phase-by-phase implementation plan
- [Architecture Decision Records](docs/adr/) - Key architectural decisions and rationale

### ADRs

- [ADR-0001: Monorepo and Boundaries](docs/adr/0001-monorepo-and-boundaries.md)
- [ADR-0002: Agent Substrate](docs/adr/0002-agent-substrate.md)
- [ADR-0003: Industrial Blueprint Sources](docs/adr/0003-industrial-blueprint-sources.md)
- [ADR-0004: ORM and Database Choice](docs/adr/0004-orm-and-database.md) — Drizzle + Neon serverless Postgres

## 🏭 Reference Architecture Sources

### Coding Agent Substrate
- [Vercel coding-agent-template](https://github.com/vercel-labs/coding-agent-template) - Agent execution patterns and substrate concepts

### Industrial Blueprints
- [FactoryNXT_PY_v2_Extrusion](https://github.com/pskbmohan/FactoryNXT_PY_v2_Extrusion) - Extrusion manufacturing domain models and blueprints
- [FactoryNxT_PY_V2](https://github.com/pskbmohan/FactoryNxT_PY_V2) - General industrial automation blueprints

## 🎯 Current Phase: Phase 1 — Product Control Plane Foundation

Tasks 1–4 are complete:
- **Task 1** — First 4 Zod schemas (User, Organization, Workspace, RBAC) in `@heynxt/core-types`
- **Task 2** — 5 remaining schemas (Project, Task, GenerationRun, Artifact, AuditLogEntry) in `@heynxt/core-types`
- **Task 3** — Local dev Postgres 15 via `docker-compose.yml`
- **Task 4** — Drizzle persistence layer in `@heynxt/persistence` (9 tables, 12 enums, first migration)

The next slice is **Phase 1.6**: wire the `db` client into `apps/web` API routes.

See [buildplan.md](buildplan.md) for the full phase plan, and
[docs/dev-setup.md](docs/dev-setup.md) for the local development workflow.

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
- Docker (with Compose V2 plugin) — for local Postgres via `pnpm dev:db`

## 📄 License

UNLICENSED - Proprietary

---

**Repository Status**: Phase 1 In Progress — Tasks 1-4 Complete | Next: Wire DB client into API routes
