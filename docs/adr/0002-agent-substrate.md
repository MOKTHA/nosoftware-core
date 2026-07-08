# ADR-0002: Agent Substrate and Execution Model

**Status**: Accepted  
**Date**: 2026-07-09  
**Author**: Architecture Team  
**Superseded By**: N/A

## Context

HeyNXT Core requires an agent execution layer to transform structured specifications into generated applications. This layer must:

1. **Execute coding agents** — LLM-powered agents that generate code, documentation, and configurations
2. **Support multiple agent backends** — Claude, Codex, Cursor, Copilot, etc.
3. **Provide sandboxing** — isolated execution environments for security and reproducibility
4. **Stream progress** — real-time feedback to users during long-running generation tasks
5. **Collect results** — artifacts, logs, and execution metadata
6. **Handle errors** — retry logic, fallback modes, and graceful degradation

We evaluated several approaches:

- **Direct API Integration** — call LLM APIs directly
- **Agent Framework** — use a framework like LangChain or AutoGen
- **Coding Agent Substrate** — adapt patterns from Vercel's coding-agent-template
- **Custom Agent Engine** — build from scratch

## Decision

We will adopt the **agent substrate pattern** from [Vercel's coding-agent-template](https://github.com/vercel-labs/coding-agent-template) and adapt it for industrial AI app generation.

### Agent Substrate Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Agent Adapter Layer                        │
│                  (@heynxt/agent-adapter)                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │ AgentRuntime │  (interface)                              │
│  │  Interface   │                                           │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌────────────────────────────────────────────────────┐    │
│  │         executeAgent(config: AgentSpec)            │    │
│  │                                                    │    │
│  │  1. Validate spec against AgentSpec schema         │    │
│  │  2. Select agent backend (Claude/Codex/Cursor)     │    │
│  │  3. Prepare execution environment (sandbox)        │    │
│  │  4. Inject credentials and configuration           │    │
│  │  5. Execute agent with streaming output            │    │
│  │  6. Collect results (artifacts, logs, metadata)    │    │
│  │  7. Handle errors and retries                      │    │
│  │  8. Cleanup and return AgentExecutionResult        │    │
│  │                                                    │    │
│  └────────────────────────────────────────────────────┘    │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  claude.ts   │  │  codex.ts    │  │  cursor.ts   │     │
│  │  (adapter)   │  │  (adapter)   │  │  (adapter)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ copilot.ts   │  │  gemini.ts   │  │  opencode.ts │     │
│  │  (adapter)   │  │  (adapter)   │  │  (adapter)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Sandbox Runtime                        │    │
│  │  (Vercel Sandbox or equivalent isolation layer)    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Patterns from Vercel coding-agent-template

#### 1. Adapter Pattern with Uniform Contract

Each agent backend implements the same interface:

```typescript
interface AgentExecutionResult {
  success: boolean;
  output: string;
  agentResponse?: string;
  cliName: string;
  changesDetected: boolean;
  error?: string;
  sessionId?: string;
}

async function executeAgent(config: AgentSpec): Promise<AgentExecutionResult> {
  // Validate spec
  // Select backend from config.agentType
  // Execute backend-specific adapter
  // Return uniform result
}
```

#### 2. Sandboxed Execution

Agents run in isolated environments (Vercel Sandbox or equivalent):
- Filesystem isolation
- Network boundaries
- Resource limits (CPU, memory, timeout)
- Ephemeral environments (auto-cleanup)

#### 3. Streaming Output

Agent stdout is captured via streams:
- JSON output format parsed line-by-line
- Real-time progress updates to UI
- Decoupled from request lifecycle (background execution)
- Persisted to database for replay/audit

#### 4. Credential Management

Per-user API keys encrypted at rest:
- Injected into agent execution environment
- Redacted from logs and UI
- Rotatable without code changes

#### 5. Resumable Sessions

Long-running tasks support resumption:
- Session ID captured on first execution
- Subsequent messages resume the same session
- Sandbox kept alive for interactive follow-ups

### Adaptation for HeyNXT

HeyNXT adapts these patterns for **industrial AI app generation**:

| Vercel Pattern | HeyNXT Adaptation |
|---|---|
| Single task (fix bug, add feature) | Multi-task (generate blueprint-based app) |
| User provides repo URL + task description | User provides prompt + selects blueprint |
| Agent modifies existing codebase | Agent generates new application from spec |
| Code committed to user's repo | Artifacts bundled as downloadable package |
| Single-shot or follow-up messages | Template-driven with parameter substitution |
| Dev server auto-started | App generation + validation + deployment pipeline |

### Agent Spec Schema

The `AgentSpec` schema defines the contract between control plane and agent adapter:

```typescript
const AgentSpec = z.object({
  agentType: z.enum(['claude', 'codex', 'cursor', 'copilot', 'gemini', 'opencode']),
  model: z.string().optional(),
  spec: z.any(), // SpecTemplate from prompt-spec
  context: z.object({
    blueprint: z.any(), // Blueprint from blueprint-registry
    domainModels: z.array(z.any()),
    constraints: z.record(z.any()),
  }),
  executionConfig: z.object({
    timeout: z.number().optional(),
    sandbox: z.object({
      enabled: z.boolean(),
      image: z.string().optional(),
      resources: z.object({
        cpu: z.string().optional(),
        memory: z.string().optional(),
      }).optional(),
    }),
    permissions: z.array(z.string()).optional(),
  }),
});
```

### Execution Flow

```
1. Control Plane creates AgentSpec from user prompt + blueprint selection
        │
        ▼
2. Agent Adapter validates spec against AgentSpec schema
        │
        ▼
3. Agent Adapter selects backend based on agentType
        │
        ▼
4. Agent Adapter prepares sandbox environment
   - Create isolated container
   - Install agent CLI (if not present)
   - Inject credentials
   - Set up project directory
        │
        ▼
5. Agent Adapter executes agent with spec as input
   - Stream stdout in real-time
   - Parse JSON output
   - Update execution progress in UI
        │
        ▼
6. Agent completes execution
   - Capture final result
   - Collect artifacts (code, docs, configs)
   - Generate execution report
        │
        ▼
7. Agent Adapter returns AgentExecutionResult
   - success/failure status
   - output and response text
   - artifact list
   - execution metadata (duration, tokens, cost)
        │
        ▼
8. Control Plane presents results to user
   - Show generated code
   - Provide download links
   - Allow deployment if valid
```

## Rationale

### Why Agent Substrate Pattern?

**Pros:**
- **Battle-Tested** — Vercel production-proven at scale
- **Multi-Backend** — single interface for multiple agent providers
- **Security-First** — sandboxing, credential encryption, log redaction
- **Observable** — streaming output, session tracking, audit trails
- **Extensible** — add new agent backends by implementing interface
- **Resilient** — built-in retry, timeout, and error handling

**Cons (mitigated):**
- **Complexity** — abstract interface adds indirection (mitigated by clear contracts)
- **Sandbox Overhead** — container spin-up time (mitigated by sandbox pooling/reuse)
- **Credential Management** — per-user key storage (mitigated by encryption at rest)

### Why Not Direct API Integration?

- No sandboxing → security risk
- No agent tooling → limited capabilities
- No streaming → poor UX
- No session management → no resumability
- Must build everything from scratch

### Why Not Agent Framework (LangChain, AutoGen)?

- Frameworks are often opinionated and hard to customize
- Framework lock-in risk
- Vercel pattern is lighter-weight and more flexible
- Industrial domain requires custom tooling that frameworks don't provide
- FactoryNXT reference repos show the value of tailored domain logic over generic frameworks

### Why Vercel coding-agent-template Specifically?

- **Production-Proven** — deployed and used at Vercel scale
- **Clean Architecture** — clear separation of concerns (adapters, sandbox, config)
- **Modern Stack** — Next.js, TypeScript, AI SDK, Vercel Sandbox
- **Security-First** — credential redaction, sandboxed execution, per-user isolation
- **Excellent Patterns** — uniform agent contract, streaming, session management
- **Industrial Adaptability** — patterns generalize well to blueprint-based generation

## Consequences

### Positive

- **Multi-Backend Support** — users can choose their preferred agent (Claude, Codex, etc.)
- **Production-Grade** — follows patterns proven at scale
- **Secure** — sandboxing and credential management built-in
- **Observable** — streaming progress and audit trails
- **Extensible** — add new backends without modifying core logic
- **Resumable** — long-running tasks can be continued

### Negative

- **Infrastructure Complexity** — requires sandbox runtime (Vercel or equivalent)
- **Credential Storage** — must implement encrypted key management
- **Agent CLI Dependencies** — requires installing and managing multiple CLI tools
- **Cost Tracking** — must track token usage across multiple providers

### Neutral

- **Vercel SDK Dependency** — if using Vercel Sandbox, tied to Vercel infrastructure
  - Mitigation: abstract sandbox behind interface, allow alternative implementations

## Implementation Notes

### Phase 5 Tasks

1. Define `AgentRuntime` interface
2. Implement adapter for Claude (first backend)
3. Implement adapter for Codex and Cursor
4. Integrate with Vercel AI SDK
5. Build sandbox creation and management
6. Implement streaming output capture
7. Build result collection and artifact bundling
8. Implement error handling and retry logic
9. Add execution monitoring dashboard
10. Write end-to-end agent execution tests

### Future Considerations

- **Agent Marketplace** — allow third-party agent backends
- **Custom Tools** — inject industrial-specific tools (blueprint validator, domain model resolver)
- **Multi-Agent Orchestration** — coordinate multiple agents for complex generation tasks
- **Cost Optimization** — route tasks to cost-effective agents based on complexity

## References

- [Vercel coding-agent-template](https://github.com/vercel-labs/coding-agent-template)
- [Vercel Sandbox Documentation](https://vercel.com/docs/sandbox)
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Anthropic Claude API](https://docs.anthropic.com)
- [OpenAI Codex API](https://platform.openai.com/docs)
