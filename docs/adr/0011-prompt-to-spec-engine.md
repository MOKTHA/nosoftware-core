# ADR-0011: Prompt-to-Spec Engine Architecture (Phase 4)

**Status**: Proposed  
**Date**: 2026-07-11  
**Authors**: Claude Code (session continuation from Phase 3 completion)

---

## Context

Phase 4 requires implementing the **Prompt-to-Spec Engine** — a system that transforms natural-language user prompts into structured, validated app specifications. This engine is the bridge between human intent and machine-executable generation instructions.

### Key Requirements (from buildplan.md Phase 4):

1. Define `PromptSpec` schema in `packages/core-types/src/schemas/prompt-spec.ts`
2. Implement prompt parsing that extracts intent/context keywords from natural language
3. Generate structured `SpecTemplate` output with app type, entities, workflows, screens, APIs
4. Create validation layer for structural and semantic completeness
5. Integrate with blueprint-registry (Phase 3) for blueprint selection hints
6. Support idempotency via stability hash (same prompt + context → same spec)

### Reference Patterns:

- **LLM-assisted parsing**: Use structured output mode (JSON schema enforced) to ensure parseability
- **Domain vocabulary**: Industrial manufacturing terms from FactoryNXT patterns (work orders, dies, billets, SMT stations, genealogy events)
- **Guardrails**: Validation rules for missing fields, inconsistencies, feasibility checks

---

## Decision

### 1. Schema Design — PromptSpec in `core-types`

**Location**: `packages/core-types/src/schemas/prompt-spec.ts` (NEW FILE - ~300 lines)

The prompt spec system consists of three layers:

#### Layer A: Context Hints
```typescript
PromptContext {
  domain: 'extrusion' | 'pcb-electronics' | 'general-manufacturing'
  persona: 'operator' | 'supervisor' | 'engineer' | 'planner' | 'admin'
  blueprintHints?: { family: string, version?: string }[]
  existingProjectContext?: { projectId: uuid, relevantEntities: string[] }
}
```

**Rationale**: Domain and persona guide blueprint selection; `blueprintHints` allow explicit user suggestions; `existingProjectContext` enables entity resolution continuity when continuing work on an existing project.

#### Layer B: SpecTemplate — Structured Output
```typescript
SpecTemplate {
  appType: 'mes' | 'aps' | 'kpi-dashboard' | 'work-order-tracker' 
         | 'quality-system' | 'maintenance-system' | 'custom'
  domain: PromptDomain (must align with blueprint availability)
  personas: PromptPersona[] (min 1, influences RBAC design)
  entities: string[] (min 1, e.g., "WorkOrder", "Die", "PcbBoard")
  workflows?: string[] ("work-order-lifecycle", "die-triage-fsm")
  screens?: ScreenDefinition[]
  apis?: ApiEndpointDefinition[]
  kpis?: string[] ("oee", "quality-rate", "throughput")
  integrations?: IntegrationDefinition[] (erp, plc, mes, custom-api)
  auditRequirements: 'none' | 'basic' | 'full' (default: basic)
  deploymentProfile: 'local-dev' | 'vercel-serverless' | 'self-hosted-k8s'
}
```

**Rationale**: This is the structured specification that Phase 5 will map to blueprints. Each field has clear industrial-domain meaning aligned with FactoryNXT patterns. The `auditRequirements` field anticipates Phase 9 governance hardening.

#### Layer C: PromptSpec — Persisted Record
```typescript
PromptSpec {
  id: uuid
  version: string (semantic versioning: 1.0.0, 1.0.1)
  
  rawPrompt: string (max 5000 chars, original user input)
  
  parsedIntent: { intent: string, keywords: string[], confidence: number }
  specTemplate: SpecTemplate
  
  context: PromptContext (default: empty object)
  blueprintHints?: BlueprintHint[] (for Phase 5 composition step)
  
  createdBy: uuid
  projectId: uuid
  
  createdAt: date
  updatedAt: date
  
  stabilityHash: string (SHA-256 of normalized prompt+context for deduplication)
}
```

**Rationale**: The `stabilityHash` enables idempotency — same prompt + context → same hash, which allows the system to detect duplicate prompts and avoid redundant spec generation. Versioning supports iterative refinement over time.

### 2. Input Schemas for Mutations

```typescript
CreatePromptInput {
  rawPrompt: string (min 1, max 5000)
  context?: PromptContext
  projectId: uuid
  createdBy: uuid
}

UpdateSpecInput {
  specTemplate: SpecTemplate.partial()
  blueprintHints?: BlueprintHint[]
}

ValidationErrors {
  field: string ("screens.0.name" format)
  message: string (human-readable error description)
}
```

**Rationale**: `CreatePromptInput` omits server-generated fields (id, timestamps, stabilityHash). `UpdateSpecInput` allows partial updates to spec template without touching raw prompt text. Validation errors use dot-notation field paths for precise UI error highlighting.

### 3. Module Structure in `packages/prompt-spec/src/`

**Future implementation (Phase 4 follow-up):**

```
packages/prompt-spec/src/
├── parser.ts       # Parse natural language → ParsedIntent + SpecTemplate draft
├── generator.ts    # Refine draft into complete SpecTemplate, select blueprint candidates
├── validation.ts   # Structural/semantic validation (missing fields, inconsistencies)
├── template.ts     # Spec templates with parameter substitution, constraint injection
└── integration.ts  # Integrate with blueprint-registry for selection hints
```

**Rationale**: Separation of concerns allows each module to be unit-tested independently. The parser can use LLM-assisted parsing (future work), while validation is deterministic and testable without external dependencies.

### 4. Export Strategy

All schemas are exported from `packages/core-types/src/index.ts`:
```typescript
// Prompt-to-spec engine (Phase 4)
export * from './schemas/prompt-spec.js';
```

**Rationale**: Consistent with existing export pattern for Phase 2 (agent-spec, task-payload) and Phase 3 (blueprint). Consumers import via:
```typescript
import { PromptSpec, type PromptSpec } from '@heynxt/core-types';
//    ^^^ Zod schema     ^^^ TypeScript type
```

### 5. Idempotency via Stability Hash

The `stabilityHash` is computed as SHA-256 of normalized prompt+context:
1. Normalize rawPrompt (trim whitespace, normalize line endings)
2. Serialize context to canonical JSON (sorted keys, no trailing commas)
3. Concatenate: `${normalizedPrompt}||${canonicalContext}`
4. Compute SHA-256 hex digest

**Rationale**: Enables deduplication — if a user submits the same prompt twice with the same context, the system can detect this and return the existing spec rather than generating a duplicate. This is critical for UX (no "I already asked that" confusion) and cost optimization.

---

## Alternatives Considered

### Alternative 1: LLM-Only Parsing
Use an LLM to generate the full SpecTemplate directly from rawPrompt without intermediate ParsedIntent.

**Pros**: Potentially more accurate interpretation of nuanced prompts  
**Cons**: Non-deterministic (same prompt → different outputs), harder to test, higher latency/cost

**Decision**: Rejected for v1. We start with a deterministic parser that extracts keywords and intent, then use LLM-assisted refinement as an optional enhancement in Phase 4 follow-up. This keeps the core system testable and predictable.

### Alternative 2: Form-First Input
Skip natural language parsing entirely; provide a form UI for users to fill out SpecTemplate fields directly.

**Pros**: Fully deterministic, no parsing ambiguity  
**Cons**: Higher friction (users must understand domain vocabulary upfront), less discoverability

**Decision**: Rejected as primary approach but kept as fallback mode. The system supports "structured-input mode" when NL is ambiguous or user prefers explicit form entry. This hybrid approach balances ease-of-use with precision.

### Alternative 3: Versioning Strategy
Use semantic versioning (1.0.0, 1.0.1) vs. timestamp-based versions (2026-07-11T14:30:00Z).

**Pros**: Semantic versioning aligns with blueprint versioning; clearer iteration semantics  
**Cons**: Requires manual version management if user wants to explicitly bump major/minor

**Decision**: Adopt semantic versioning for consistency across the platform. Auto-increment patch version (X.Y.Z → X.Y.(Z+1)) on each update; allow explicit minor/major bumps via API flag when significant changes are made.

---

## Consequences

### Positive:
- **Clear contract between phases**: Phase 4 output (PromptSpec) is the input for Phase 5 (Blueprint Selection), creating a clean handoff
- **Testable validation layer**: Structural checks run without external dependencies, enabling fast unit tests
- **Idempotency support**: Stability hash prevents duplicate spec generation and enables caching strategies
- **Industrial-domain alignment**: Schema vocabulary matches FactoryNXT patterns, easing blueprint extraction mapping

### Negative:
- **Schema complexity grows**: 300+ line prompt-spec.ts file with many interdependent types requires careful documentation
- **LLM dependency for parsing**: Full NL→SpecTemplate accuracy may require LLM integration later (cost/latency considerations)
- **Versioning operational overhead**: Users must understand semantic versioning implications when updating specs

### Neutral:
- **Export duplication**: Both Zod schema and TypeScript type exported with same name is intentional (supports both runtime validation and compile-time typing)

---

## Implementation Notes

### Phase 4 Follow-up Tasks:
1. Implement `packages/prompt-spec/src/parser.ts` — keyword extraction, intent classification
2. Implement `packages/prompt-spec/src/validation.ts` — structural checks for required fields
3. Create sample prompts → SpecTemplate mappings (≥5 representative cases)
4. Integrate with blueprint-registry for hint generation based on domain/entity matching

### Testing Strategy:
- Unit tests for parser edge cases ("track work orders" → appType='work-order-tracker')
- Integration test: prompt → parsed → validated → persisted end-to-end flow
- Idempotency test: same input twice → same stabilityHash, second call returns existing spec

---

## References

- **buildplan.md Phase 4**: Full exit criteria and scope definition
- **ADR-0010 (Blueprint Registry)**: Predecessor phase; blueprint hints in PromptSpec will resolve to concrete blueprints here
- **FactoryNXT_PY_v2_Extrusion**: Domain vocabulary source for entities, workflows, KPIs
- **FactoryNxT_PY_V2**: PCB/electronics domain patterns

---

## Appendix: Schema File Location

**New file created this session**: `packages/core-types/src/schemas/prompt-spec.ts` (~300 lines)

Contains all Phase 4 schemas:
- PromptDomain, PromptPersona, BlueprintHint, PromptContext (context layer)
- AppType, ScreenDefinition, ApiEndpointDefinition, IntegrationDefinition, AuditRequirement, DeploymentProfile (spec template fields)
- SpecTemplate, ParsedIntent, PromptSpec (core records)
- CreatePromptInput, UpdateSpecInput, ValidationErrors (mutation schemas)
- ParseResult, ValidationResult (module output types)

All types are inferred from Zod schemas via `z.infer<typeof X>` for dual runtime/compile-time usage.
