# ADR-0012: Prompt-to-Spec Engine Architecture

**Status**: Approved  
**Date**: 2026-07-11  
**Authors**: HeyNXT Core Team  

---

## Context and Problem Statement

### The Challenge

Users interact with the HeyNXT platform through natural-language prompts. Examples:

> "I need to track die lifecycle from inspection through nitriding, including testing stages."
> "Create a work order tracker that enforces routing steps in sequence."
> "Build an OEE dashboard for our SMT line showing availability, performance, and quality rates."

The system must transform these free-form prompts into **structured specifications** that can:
1. Be validated against industrial domain constraints
2. Reference extracted blueprints from the registry (Phase 3)
3. Drive code generation in Phase 6
4. Support revision history and iterative refinement

### Requirements for Prompt-to-Spec Engine

- **Idempotency**: Same prompt + same context → same spec hash (no duplicate specs for identical inputs)
- **Traceability**: Link parsed intent back to original user input
- **Extensibility**: Schema must accommodate future fields without breaking existing records
- **Validation**: Catch missing/inconsistent data before persisting
- **Blueprint integration**: Suggest relevant blueprints from Phase 3 registry

---

## Decision Drivers

1. **Deterministic hashing** enables deduplication and change detection
2. **Schema composition over inheritance** keeps validation composable
3. **Versioned spec templates** allow iterative refinement with audit trail
4. **Stability hash vs UUID**: Use SHA-256 of normalized prompt+context as the "canonical key" for idempotency checks; still assign a separate UUID as primary key

---

## Decision Options Considered

### Option A: LLM-Only Parsing (Rejected)

**Approach**: Send entire user prompt to an LLM, receive JSON spec template directly.

**Pros:**
- Flexible, handles ambiguous prompts well
- Can infer missing information via conversation

**Cons:**
- Non-deterministic — same prompt can yield different outputs
- Harder to validate/catch errors early
- Cost per parsing operation
- No clear "canonical key" for deduplication

### Option B: Keyword-Based Parsing (Selected)

**Approach**: Extract keywords and domain hints via regex/pattern matching, map to structured spec template fields. LLM used only for ambiguous cases or refinement.

**Pros:**
- Deterministic output from same input
- Fast, no external API calls required
- Easy to validate against known patterns
- Clear traceability between prompt text and parsed fields
- Stability hash enables idempotency

**Cons:**
- Less flexible than pure LLM parsing for ambiguous prompts
- Requires maintaining keyword/phrase mappings as domain grows

### Option C: Form-First Input (Rejected)

**Approach**: Skip natural-language input entirely; users fill structured forms to create specs.

**Pros:**
- Always valid JSON, no parsing needed
- Clear field requirements upfront

**Cons:**
- Poor UX for initial intent capture ("I just want to track dies...")
- Doesn't match how industrial engineers think about problems
- Defeats the purpose of "prompt-to-spec" value proposition

---

## Selected Approach: Keyword-Based Parsing with Stability Hash

### Schema Design Rationale

The `PromptSpec` schema in `packages/core-types/src/schemas/prompt-spec.ts` follows a three-layer structure:

#### Layer 1: PromptContext (Enriched Context)

```typescript
{
  domain: 'extrusion' | 'pcb-electronics' | 'general-manufacturing';
  persona: 'operator' | 'supervisor' | 'engineer' | 'planner' | 'admin';
  blueprintHints?: [{ family: string, version?: string }];
  existingProjectContext?: { projectId: UUID, relevantEntities: string[] };
}
```

**Why optional fields?**  
Not all prompts come with explicit context. The parser must handle bare prompts like "track work orders" without requiring domain/persona to be specified upfront. These get inferred or defaulted during parsing.

#### Layer 2: SpecTemplate (Structured Output)

```typescript
{
  appType: 'mes' | 'aps' | 'kpi-dashboard' | ...;
  domain: PromptDomain; // must align with available blueprints
  personas: string[]; // at least one persona required
  entities: string[]; // industrial entity names
  workflows?: string[]; // state machine identifiers
  screens?: ScreenDefinition[]; // optional UI details
  apis?: ApiEndpointDefinition[]; // optional API contract
  kpis?: string[]; // dashboard metrics
  integrations?: IntegrationDefinition[]; // external systems
  auditRequirements: 'none' | 'basic' | 'full';
  deploymentProfile: 'local-dev' | 'vercel-serverless' | 'self-hosted-k8s';
}
```

**Why optional arrays for screens/apis?**  
Early-stage specs may not have UI/API details yet. The parser extracts what's confidently inferred; users can refine via form editing before generation. This mirrors how industrial engineers think: "I need work order tracking" → later specify "and a dashboard showing throughput".

#### Layer 3: PromptSpec (Persisted Record)

```typescript
{
  id: UUID; // primary key, assigned on creation
  version: string; // semantic version (1.0.0, 1.0.1, ...)
  
  rawPrompt: string; // original user input (preserved for audit)
  parsedIntent: { intent: string, keywords: string[], confidence: number };
  specTemplate: SpecTemplate; // structured output from parsing
  
  context: PromptContext; // what shaped interpretation
  blueprintHints?: BlueprintHint[]; // suggestions for Phase 5 composition
  
  createdBy: UUID; projectId: UUID;
  createdAt: date; updatedAt: date;
  
  stabilityHash: string; // SHA-256 of normalized prompt+context (idempotency key)
}
```

**Why both `id` (UUID) and `stabilityHash`?**  
- `id`: Primary key for database, API references, version tracking. Always unique per record.
- `stabilityHash`: Deterministic hash used to detect duplicate intent. Same prompt + context = same hash → skip creation or link to existing spec.

**Stability Hash Algorithm:**
```typescript
function computeStabilityHash(rawPrompt: string, context: PromptContext): string {
  const normalized = JSON.stringify({
    prompt: rawPrompt.trim().toLowerCase(),
    domain: context.domain || 'general-manufacturing',
    persona: context.persona || 'operator',
    projectId: context.projectId, // if extending existing project
  });
  return sha256(normalized).slice(0, 16); // first 16 chars sufficient for deduplication
}
```

**Why not use hash as ID?**  
Because we want to support spec revisions. A user might refine a spec over multiple iterations; each revision gets a new UUID but shares the same `stabilityHash` family (can be linked in UI).

---

## Idempotency and Deduplication Flow

```
User submits prompt: "track die lifecycle" + context { domain: 'extrusion', persona: 'engineer' }

1. Compute stabilityHash = sha256(normalized(prompt, context))
   → Result: "a3f7b9c2d4e8..."

2. Query DB for existing specs with same stabilityHash within last 30 days
   → Found spec ID `spec-xyz` created 1 week ago by same user

3. Return to user:
   "You have a similar spec already. Want to continue editing it instead of creating a new one?"

4a. If user accepts: redirect to existing spec (no duplicate created)
4b. If user insists: create new spec with new UUID, but link in UI as "duplicate" for awareness
```

**Why 30-day window?**  
Short enough to avoid cluttering long-running projects with stale duplicates; long enough to catch iterative refinement attempts.

---

## Validation Strategy

### Structural Validation (Zod Runtime)

All `PromptSpec` instances are validated against the Zod schema before persistence:

```typescript
const result = PromptSpec.safeParse(specData);
if (!result.success) {
  // Return field-level errors to UI for correction
}
```

**Validation rules enforced:**
- `entities`: must have at least one entity name
- `personas`: must have at least one persona
- `appType`/`domain`: must align (e.g., 'aps' app type requires 'extrusion' or 'general-manufacturing')
- `stabilityHash`: format check (hex string, 16+ chars)

### Semantic Validation (Business Rules)

Additional checks beyond schema:
- **Blueprint compatibility**: Does the requested domain have available blueprints in registry? If not, warn user.
- **Entity resolution**: Do referenced entities exist in project context or are they new? Flag for review if ambiguous.
- **Workflow consistency**: Are workflow state machine names consistent with known FSMs (e.g., "die-triage-fsm" has 14 states)?

---

## Blueprint Integration (Phase 5 Bridge)

The `blueprintHints` field in `PromptSpec` stores parser suggestions for Phase 5 composition:

```typescript
{
  blueprintHints: [
    { family: 'extrusion-operations', version: '1.0.0' }, // high-confidence match
    { family: 'tool-lifecycle', version: '1.2.3' },       // partial match (die management only)
  ]
}
```

**How hints are generated:**
1. Parser extracts keywords from `rawPrompt` → ["track", "lifecycle", "die"]
2. Keywords matched against blueprint metadata tags in registry
3. Top-N matches returned as hints with confidence scores

**Phase 5 composition step will:**
- Resolve these hints to concrete blueprint IDs (or skip if user prefers manual selection)
- Validate compatibility between selected blueprints
- Generate `CompositionPlan` that ties spec → blueprint(s) for generation

---

## Versioning Strategy

Each `PromptSpec` maintains a version history via the `version` field:

```typescript
{
  id: "spec-abc123",
  version: "1.0.1", // incremented on each edit
  
  rawPrompt: "track die lifecycle...",
  
  parsedIntent: { intent: "...", keywords: [...], confidence: 0.85 },
  specTemplate: { appType: "mes", domain: "extrusion", ... },
  
  context: { domain: "extrusion", persona: "engineer" },
  blueprintHints: [{ family: "extrusion-operations" }],
  
  createdBy: "user-xyz", projectId: "proj-123",
  createdAt: "2026-07-11T...", updatedAt: "2026-07-12T...",
  stabilityHash: "a3f7b9c2d4e8..."
}
```

**Version increment rules:**
- `1.0.0` → initial creation
- `1.0.1`, `1.0.2`, ... on each user edit/refinement
- Major version bump (`1.x.x` → `2.0.0`) for breaking changes (e.g., appType change from 'mes' to 'aps')

**Why not store full versions in DB?**  
Because the schema is designed to be backward-compatible; we only need current state + raw prompt for audit trail. Full version history can be derived if needed via separate table, but v1 keeps it simple: one spec = one active version with metadata about creation/editing timestamps.

---

## Implementation Notes for Phase 4 Follow-Up

### Modules to Implement in `packages/prompt-spec/src/`

| Module | Responsibility | Dependencies |
|--------|----------------|--------------|
| `parser.ts` | Extract keywords, intent from raw prompt; map to SpecTemplate fields | None (pure function) |
| `generator.ts` | Refine draft spec into complete SpecTemplate; fill optional fields via heuristics | parser.ts output |
| `validation.ts` | Structural validation (Zod), semantic checks (blueprint compatibility, entity resolution) | schema exports from core-types |
| `template.ts` | Spec templates with parameter substitution for common patterns | generator.ts |
| `integration.ts` | Query blueprint-registry for hints; resolve entities against project context | parser.ts output + registry API |

### Stability Hash Computation (Pseudocode)

```typescript
import { createHash } from 'crypto';

export function computeStabilityHash(rawPrompt: string, context: PromptContext): string {
  const normalized = JSON.stringify({
    prompt: rawPrompt.trim().toLowerCase(),
    domain: context.domain ?? 'general-manufacturing',
    persona: context.persona ?? 'operator',
    projectId: context.existingProjectContext?.projectId ?? null,
  });

  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}
```

### Key Design Decisions Summary

| Decision | Rationale |
|----------|-----------|
| Keyword-based parsing (not pure LLM) | Deterministic output, fast, no API cost per parse |
| Stability hash for deduplication | Enables idempotency checks; same input = same canonical key |
| UUID primary key + stability hash separate | Support spec revisions while still detecting duplicates |
| Optional fields in SpecTemplate (screens, apis) | Early-stage specs don't need full UI/API details; refine iteratively |
| `blueprintHints` as parser suggestions | Bridges to Phase 5 composition step; user can override before generation |

---

## Consequences

### Positive
- **Idempotent spec creation** prevents duplicate work for users with similar intents
- **Fast parsing** without external API dependencies (no latency, no cost per operation)
- **Clear traceability** from raw prompt → parsed intent → structured spec
- **Extensible schema** supports future fields via optional arrays/objects

### Negative
- **Less flexible than LLM-only parsing** for highly ambiguous prompts; may require follow-up clarification questions in UI
- **Keyword mapping maintenance** required as domain vocabulary grows (new entity names, workflows)

### Neutral
- **Schema versioning complexity**: If core-types schemas change significantly, existing PromptSpec records may need migration logic. v1 keeps this simple by focusing on stable fields first.

---

## Follow-Up Tasks for Phase 4 Implementation

1. Implement `parser.ts` with keyword extraction rules for extrusion/pcb domains
2. Add stability hash computation utility in `packages/prompt-spec/src/utils/hash.ts`
3. Create validation rules in `validation.ts` for blueprint compatibility checks
4. Wire up prompt-spec module to consume from @heynxt/blueprint-registry (Phase 5 integration)

---

## References

- Phase 3: Blueprint Registry Architecture — ADR-0010
- Phase 2: Agent Execution Integration — ADR-0002
- Build Plan — Section on Prompt-to-Spec Engine (Phase 4 exit criteria)
