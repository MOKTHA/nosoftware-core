# HeyNXT Core - Build Plan

This document defines the phase-by-phase implementation plan for HeyNXT Core, starting from the completed foundation (Phase 0) through full platform implementation.

## Phase 0: Foundation ✓ COMPLETE

**Status**: Complete as of 2026-07-09

### Deliverables
- ✓ Monorepo structure with pnpm workspaces and Turbo
- ✓ Package boundaries defined (core-types, prompt-spec, agent-adapter, blueprint-registry, domain-models)
- ✓ Next.js app scaffolded in `apps/web`
- ✓ TypeScript configuration across all packages
- ✓ Zod dependency established for schema validation
- ✓ Documentation infrastructure (README, ADRs, architecture docs)
- ✓ Claude configuration files
- ✓ Environment configuration templates

### Exit Criteria
- Foundation files created and committed
- All packages build successfully (stub implementations)
- Documentation explains architecture and next steps

## Phase 1: Core Schema Foundation

**Duration**: 1-2 weeks  
**Goal**: Define the contract layer that all other packages depend on

### Tasks

#### 1.1 Define Blueprint Schema
- File: `packages/core-types/src/schemas/blueprint.ts`
- Define Zod schema for industrial blueprints
- Include: metadata, version, source reference, parameters, constraints
- Export types: `Blueprint`, `BlueprintMetadata`, `BlueprintVersion`

#### 1.2 Define AgentSpec Schema
- File: `packages/core-types/src/schemas/agent-spec.ts`
- Define Zod schema for agent execution configuration
- Include: model selection, tool permissions, execution context, output format
- Export types: `AgentSpec`, `ExecutionConfig`, `AgentResult`

#### 1.3 Define PromptSpec Schema
- File: `packages/core-types/src/schemas/prompt-spec.ts`
- Define Zod schema for prompt-to-spec input/output
- Include: prompt text, context, generated spec structure, validation rules
- Export types: `PromptSpec`, `SpecTemplate`, `PromptContext`

#### 1.4 Define Domain Model Base Schema
- File: `packages/core-types/src/schemas/domain-base.ts`
- Define base Zod schemas for industrial domain entities
- Include: entity metadata, relationships, constraints
- Export types: `DomainEntity`, `EntityRelationship`, `EntityConstraint`

#### 1.5 Update core-types Package Exports
- File: `packages/core-types/src/index.ts`
- Export all schemas and types
- Ensure package builds successfully

### Exit Criteria
- All schemas defined with Zod validation
- TypeScript types inferred from schemas
- Package builds without errors
- Example validation tests demonstrating schema usage
- Other packages can import and use the schemas

### Dependencies
- None (foundation package)

### Risks
- Schema design may require iteration based on later phases
- Mitigation: Start with minimal viable schemas, document extension points

## Phase 2: Domain Models

**Duration**: 2-3 weeks  
**Goal**: Implement industrial domain entities derived from FactoryNXT repositories

### Tasks

#### 2.1 Research FactoryNXT Domain Models
- Analyze domain models in FactoryNXT_PY_v2_Extrusion
- Analyze domain models in FactoryNxT_PY_V2
- Identify common entities and relationships
- Document domain vocabulary and constraints

#### 2.2 Define Equipment Models
- File: `packages/domain-models/src/equipment.ts`
- Define equipment entities: Machine, Station, Line, Cell
- Include: metadata, capabilities, constraints, relationships
- Derive from reference repositories

#### 2.3 Define Process Models
- File: `packages/domain-models/src/process.ts`
- Define process entities: Recipe, WorkflowStep, Parameter, Constraint
- Include: execution logic, dependencies, validation rules
- Derive from reference repositories

#### 2.4 Define Material Models
- File: `packages/domain-models/src/material.ts`
- Define material entities: RawMaterial, Intermediate, FinishedGood
- Include: properties, transformations, quality requirements
- Derive from reference repositories

#### 2.5 Define Quality Models
- File: `packages/domain-models/src/quality.ts`
- Define quality entities: Measurement, Tolerance, Specification
- Include: measurement types, validation rules, acceptance criteria
- Derive from reference repositories

#### 2.6 Define Relationships and Constraints
- File: `packages/domain-models/src/relationships.ts`
- Define how entities relate to each other
- Include: composition, aggregation, dependencies
- Ensure referential integrity

#### 2.7 Update domain-models Package Exports
- File: `packages/domain-models/src/index.ts`
- Export all domain models
- Ensure package builds successfully

### Exit Criteria
- All domain models implemented with Zod schemas
- Models validated against reference repositories
- Package builds without errors
- Example domain model instances for testing
- Documentation of domain vocabulary

### Dependencies
- Phase 1: Core Schema Foundation (for base schemas)

### Risks
- Domain complexity may exceed initial estimates
- Mitigation: Start with extrusion domain only, expand in later iterations

## Phase 3: Blueprint Registry

**Duration**: 2-3 weeks  
**Goal**: Implement blueprint catalog and loading from reference repositories

### Tasks

#### 3.1 Define Blueprint Metadata Schema
- File: `packages/blueprint-registry/src/metadata.ts`
- Define blueprint metadata: name, version, description, source, tags
- Include: validation rules, search/filter capabilities

#### 3.2 Implement Blueprint Loader Interface
- File: `packages/blueprint-registry/src/loader.ts`
- Define interface for loading blueprints from sources
- Include: local filesystem, remote repositories, version control
- Support FactoryNXT_PY_v2_Extrusion and FactoryNxT_PY_V2 paths

#### 3.3 Implement Blueprint Catalog
- File: `packages/blueprint-registry/src/catalog.ts`
- Implement catalog for querying and filtering blueprints
- Include: search, filter by metadata, list by category/tag
- Support pagination and sorting

#### 3.4 Implement Blueprint Validator
- File: `packages/blueprint-registry/src/validator.ts`
- Validate blueprints against core-types schemas
- Include: schema validation, constraint checking, dependency verification
- Report validation errors clearly

#### 3.5 Implement Version Management
- File: `packages/blueprint-registry/src/version.ts`
- Track blueprint versions and compatibility
- Include: version history, compatibility matrix, upgrade paths

#### 3.6 Update blueprint-registry Package Exports
- File: `packages/blueprint-registry/src/index.ts`
- Export all registry components
- Ensure package builds successfully

### Exit Criteria
- Blueprint registry fully functional
- Can load blueprints from FactoryNXT repositories
- Catalog supports search, filter, and query operations
- Validation catches invalid blueprints
- Version management tracks blueprint evolution
- Package builds without errors
- Integration tests with sample blueprints

### Dependencies
- Phase 1: Core Schema Foundation
- Phase 2: Domain Models

### Risks
- Blueprint format may need refinement based on factory repos
- Mitigation: Iterate on schema design, document trade-offs

## Phase 4: Prompt-to-Spec Transformation

**Duration**: 2-3 weeks  
**Goal**: Implement logic to transform natural language prompts into structured specs

### Tasks

#### 4.1 Define Prompt Parser
- File: `packages/prompt-spec/src/parser.ts`
- Parse natural language prompts
- Extract intent, context, and requirements
- Include: template matching, keyword extraction, context detection

#### 4.2 Define Spec Generator
- File: `packages/prompt-spec/src/generator.ts`
- Generate structured specs from parsed prompts
- Include: blueprint selection, parameter mapping, constraint application
- Produce valid `SpecTemplate` instances

#### 4.3 Define Validation Rules
- File: `packages/prompt-spec/src/validation.ts`
- Validate generated specs against constraints
- Include: feasibility checks, resource validation, domain-specific rules
- Report validation errors with suggestions

#### 4.4 Define Template Engine
- File: `packages/prompt-spec/src/template.ts`
- Support spec templates and patterns
- Include: template selection, parameter substitution, constraint injection

#### 4.5 Implement Integration Points
- File: `packages/prompt-spec/src/integration.ts`
- Integrate with blueprint registry for blueprint selection
- Integrate with domain models for entity resolution
- Include: error handling, fallback strategies

#### 4.6 Update prompt-spec Package Exports
- File: `packages/prompt-spec/src/index.ts`
- Export all transformation components
- Ensure package builds successfully

### Exit Criteria
- Can parse natural language prompts
- Can generate valid specs from prompts
- Validation catches invalid specs
- Templates support common patterns
- Integration with blueprint registry functional
- Package builds without errors
- End-to-end tests: prompt → spec transformation

### Dependencies
- Phase 1: Core Schema Foundation
- Phase 2: Domain Models
- Phase 3: Blueprint Registry

### Risks
- Prompt parsing accuracy may vary
- Mitigation: Start with structured prompts, expand to natural language later

## Phase 5: Agent Adapter

**Duration**: 3-4 weeks  
**Goal**: Integrate coding agent runtime for spec execution

### Tasks

#### 5.1 Define Agent Runtime Interface
- File: `packages/agent-adapter/src/runtime.ts`
- Define interface for agent execution
- Include: spawn, execute, monitor, collect results
- Support streaming output and progress tracking

#### 5.2 Implement Vercel AI SDK Integration
- File: `packages/agent-adapter/src/vercel-sdk.ts`
- Integrate with Vercel AI SDK or similar agent substrate
- Include: model selection, tool configuration, permission management
- Handle agent lifecycle (spawn, execute, cleanup)

#### 5.3 Implement Result Collection
- File: `packages/agent-adapter/src/results.ts`
- Collect and structure agent execution results
- Include: output artifacts, execution logs, error tracking
- Support both streaming and batch collection

#### 5.4 Implement Error Handling and Retry
- File: `packages/agent-adapter/src/errors.ts`
- Handle agent execution errors gracefully
- Include: retry strategies, fallback modes, error reporting
- Support timeout and cancellation

#### 5.5 Implement Execution Monitoring
- File: `packages/agent-adapter/src/monitor.ts`
- Monitor agent execution in real-time
- Include: progress tracking, resource usage, performance metrics
- Support real-time UI updates

#### 5.6 Update agent-adapter Package Exports
- File: `packages/agent-adapter/src/index.ts`
- Export all adapter components
- Ensure package builds successfully

### Exit Criteria
- Agent runtime fully functional
- Can execute specs and collect results
- Error handling covers common failure modes
- Monitoring provides real-time feedback
- Integration with Vercel AI SDK stable
- Package builds without errors
- End-to-end tests: spec → agent execution → results

### Dependencies
- Phase 1: Core Schema Foundation
- Phase 4: Prompt-to-Spec Transformation

### Risks
- Agent substrate selection may need changes
- Mitigation: Abstract behind interface, allow swapping implementations

## Phase 6: Control Plane UI

**Duration**: 4-6 weeks  
**Goal**: Build user interface for managing the entire workflow

### Tasks

#### 6.1 Set Up Next.js Application Structure
- File: `apps/web/`
- Configure Next.js with TypeScript
- Set up routing, layouts, and common components
- Include: authentication, navigation, error handling

#### 6.2 Implement Blueprint Browser
- File: `apps/web/src/app/blueprints/`
- Build UI for browsing and searching blueprints
- Include: list view, detail view, filter/sort
- Integrate with blueprint-registry package

#### 6.3 Implement Prompt Interface
- File: `apps/web/src/app/prompt/`
- Build UI for entering prompts and viewing generated specs
- Include: prompt editor, spec preview, validation feedback
- Integrate with prompt-spec package

#### 6.4 Implement Agent Execution Dashboard
- File: `apps/web/src/app/execution/`
- Build UI for monitoring agent execution
- Include: real-time progress, logs, results viewer
- Integrate with agent-adapter package

#### 6.5 Implement Results Viewer
- File: `apps/web/src/app/results/`
- Build UI for viewing generated applications
- Include: artifact browser, code viewer, export options
- Support downloading and deploying results

#### 6.6 Implement Settings and Configuration
- File: `apps/web/src/app/settings/`
- Build UI for platform configuration
- Include: model selection, agent configuration, blueprint sources

### Exit Criteria
- UI fully functional and integrated with all packages
- Can browse blueprints, enter prompts, execute agents, view results
- Real-time monitoring works
- Settings can be configured
- UI is responsive and accessible
- Application builds and runs successfully

### Dependencies
- Phase 1-5: All previous phases

### Risks
- UI complexity may exceed estimates
- Mitigation: Start with MVP features, iterate based on feedback

## Phase 7: Integration and Testing

**Duration**: 2-3 weeks  
**Goal**: End-to-end testing and integration validation

### Tasks

#### 7.1 Write Integration Tests
- Test complete workflow: prompt → spec → agent → results
- Test blueprint loading and validation
- Test domain model relationships

#### 7.2 Write End-to-End Tests
- Test UI workflows
- Test real-world scenarios
- Test error handling and edge cases

#### 7.3 Performance Testing
- Benchmark agent execution
- Benchmark blueprint loading
- Optimize critical paths

#### 7.4 Security Review
- Review authentication and authorization
- Review API endpoints
- Review data handling and storage

### Exit Criteria
- All tests passing
- Performance meets targets
- Security review complete
- Ready for production deployment

### Dependencies
- Phase 1-6: All previous phases

## Phase 8: Documentation and Deployment

**Duration**: 1-2 weeks  
**Goal**: Prepare for production deployment

### Tasks

#### 8.1 Write User Documentation
- User guide for platform
- API documentation
- Troubleshooting guide

#### 8.2 Write Developer Documentation
- Developer onboarding guide
- Contributing guidelines
- Architecture deep-dive

#### 8.3 Set Up CI/CD
- Configure GitHub Actions or similar
- Automate testing and deployment
- Set up staging and production environments

#### 8.4 Deploy to Production
- Deploy to production environment
- Monitor initial usage
- Address any issues

### Exit Criteria
- Documentation complete
- CI/CD pipeline functional
- Production deployment successful
- Monitoring in place

### Dependencies
- Phase 7: Integration and Testing

## Summary

**Total Estimated Duration**: 17-24 weeks for full implementation

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6

**Parallel Work**: Phases 7-8 can overlap with Phase 6

**Next Task**: Phase 1 - Core Schema Foundation

See individual phase sections above for detailed task breakdowns.
