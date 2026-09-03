/**
 * @heynxt/agent-adapter — Generation Pipeline Orchestration (Phase 6)
 *
 * Multi-stage pipeline that transforms spec + blueprint plan into
 * implementation-ready outputs. Each stage is a deterministic transform
 * that can optionally invoke an agent for generative parts.
 */

import { z } from 'zod';
import type {
  GenerationStageName,
  GenerationStageExecution,
  GenerationArtifact,
  GenerationStageInput as CoreGenerationStageInput,
  GenerationStageOutput as CoreGenerationStageOutput,
  GenerationPipelineExecution,
  CreatePipelineInput,
  // Phase 7 validation types
  ValidationCheckType,
  ValidationResult,
  ValidationStageInput,
  ValidationStageOutput,
  ValidationStageName,
} from '@heynxt/core-types';

// Re-export core types for use in tests and stages
export type {
  GenerationStageName,
  GenerationStageExecution,
  GenerationArtifact,
};

// Also export the aliased types under their original names
export type GenerationStageInput = CoreGenerationStageInput;
export type GenerationStageOutput = CoreGenerationStageOutput;

// Phase 7 validation types (re-exported from core-types)
// Note: These are imported above and re-exported for convenience in agent-adapter consumers
export type {
  ValidationCheckType,
  ValidationResult,
  ValidationStageName,
  ValidationStageInput,
  ValidationStageOutput,
};

/** ------------------------------------------------------------------ */
/*  Pipeline Stage Interface                                        */
/** ------------------------------------------------------------------ */

/**
 * A generation stage is a deterministic transform that:
 * - Takes input from previous stages (or initial spec)
 * - Optionally invokes an agent/LLM for generative parts
 * - Produces artifacts with traceable lineage
 *
 * Each stage must be idempotent given the same inputs.
 */
export interface GenerationStage {
  /** Unique name of this stage (must match GenerationStageName enum). */
  readonly name: GenerationStageName;

  /** Human-readable description of what this stage does. */
  readonly description: string;

  /**
   * Execute this stage given the input.
   * @param input - Resolved inputs from previous stages
   * @returns Output containing artifacts produced by this stage
   */
  execute(input: GenerationStageInput): Promise<GenerationStageOutput>;

  /**
   * Validate whether this stage can run with the given input.
   * Called before execution to catch missing dependencies early.
   */
  validateInput(input: GenerationStageInput): boolean;
}

/** ------------------------------------------------------------------ */
/*  Validation Stage Interface (Phase 7)                            */
/** ------------------------------------------------------------------ */

/**
 * A validation stage performs automated checks on generated outputs.
 * Phase 7 Exit Criteria: Failed checks block promotion without override flag + reason.
 */
export interface ValidationStage {
  /** Unique name of this stage (must match ValidationStageName enum). */
  readonly name: ValidationStageName;

  /** Human-readable description of what this validation does. */
  readonly description: string;

  /**
   * Execute this validation stage given the input.
   * @param input - Artifacts to validate and spec context
   * @returns Output containing validation results and evidence URLs
   */
  execute(input: ValidationStageInput): Promise<ValidationStageOutput>;

  /**
   * Validate whether this stage can run with the given input.
   * Called before execution to catch missing dependencies early.
   */
  validateInput(input: GenerationStageInput): boolean; // Uses GenerationStageInput for compatibility
}

/** ------------------------------------------------------------------ */
/*  Pipeline Orchestrator                                           */
/** ------------------------------------------------------------------ */

/**
 * Execution result from a single stage within the pipeline.
 */
export interface StageResult {
  /** Order index for sorting stages in execution order. */
  orderIndex: number;

  /** Stage execution metadata (status, timing, etc.). */
  execution: GenerationStageExecution;

  /** Artifacts produced by this stage (if successful). */
  output?: GenerationStageOutput;
}

/**
 * Pipeline orchestrator that coordinates multi-stage generation.
 *
 * Each stage:
 * - Is a deterministic transform (spec + blueprint → artifact)
 * - Can optionally invoke an agent for generative parts
 * - Produces traceable outputs with input/output hashes
 */
export interface GenerationPipeline {
  /** Unique ID of this pipeline execution. */
  readonly id: string;

  /** Current status of the pipeline. */
  readonly status: 'pending' | 'running' | 'partial' | 'succeeded' | 'failed' | 'cancelled';

  /** Number of stages completed so far. */
  readonly completedStages: number;

  /** Total number of stages in this pipeline. */
  readonly totalStages: number;

  /** Stage-by-stage execution results (ordered by stage name). */
  getStageResults(): StageResult[];

  /** Start executing the pipeline (non-blocking). */
  start(): Promise<void>;

  /** Wait for all stages to complete and return final result. */
  collect(): Promise<GenerationPipelineExecution>;

  /** Cancel execution of the pipeline. */
  cancel(): void;

  /** Subscribe to stage completion events. */
  subscribe(
    handler: (result: StageResult) => void,
    onComplete?: () => void
  ): () => void; // returns unsubscribe function
}

/** ------------------------------------------------------------------ */
/*  Pipeline Orchestrator Implementation                            */
/** ------------------------------------------------------------------ */

interface PendingStage {
  stageName: GenerationStageName;
  orderIndex: number;
}

export class DefaultGenerationPipeline implements GenerationPipeline {
  readonly id: string;
  private _status: 'pending' | 'running' | 'partial' | 'succeeded' | 'failed' | 'cancelled' = 'pending';
  private stageResults: StageResult[] = [];
  private pendingStages: PendingStage[] = [];
  private subscribers: Array<(result: StageResult) => void> = [];
  private onComplete?: () => void;
  private _abortController?: AbortController;

  constructor(
    private readonly input: CreatePipelineInput,
    private readonly stages: Map<GenerationStageName, GenerationStage>,
    private readonly requiredStages: Set<GenerationStageName>
  ) {
    this.id = crypto.randomUUID();

    // Initialize pending stages in execution order
    const stageOrderMap = new Map(
      (['normalize-spec', 'resolve-blueprint-plan', 'generate-schema', 'generate-permissions',
        'generate-backend', 'generate-frontend', 'generate-workflows',
        'generate-fixtures-tests', 'generate-deployment'] as GenerationStageName[]).map((name, idx) => [name, idx])
    );

    // Run ALL registered stages, not just required ones.
    // `requiredStages` controls whether a failure is fatal (aborts the
    // pipeline) vs tolerated (pipeline continues in 'partial' status).
    for (const stage of this.stages.values()) {
      this.pendingStages.push({
        stageName: stage.name,
        orderIndex: stageOrderMap.get(stage.name) ?? 999,
      });
    }

    // Sort by execution order
    this.pendingStages.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  get status(): 'pending' | 'running' | 'partial' | 'succeeded' | 'failed' | 'cancelled' {
    return this._status;
  }

  get completedStages(): number {
    return this.stageResults.filter(r => r.execution.status === 'succeeded').length;
  }

  get totalStages(): number {
    return this.pendingStages.length;
  }

  getStageResults(): StageResult[] {
    return [...this.stageResults];
  }

  async start(): Promise<void> {
    if (this._status !== 'pending') {
      throw new Error(`Pipeline already in ${this._status} state`);
    }

    this._abortController = new AbortController();
    const startTime = Date.now();

    // Process stages sequentially (can be parallelized with dependency tracking)
    for (const pending of this.pendingStages) {
      if (this._abortController?.signal.aborted) {
        this._status = 'cancelled';
        return;
      }

      const stage = this.stages.get(pending.stageName);
      if (!stage) {
        console.error(`Stage ${pending.stageName} not found in registry`);
        continue;
      }

      // Create execution record for this stage
      const executionId = crypto.randomUUID();
      const executionStart = Date.now();

      const stageExecution: GenerationStageExecution = {
        id: executionId,
        stageName: pending.stageName,
        status: 'running',
        startedAt: new Date(),
      };

      // Execute the stage
      const resultOrderIndex = this.pendingStages.indexOf(pending);
      try {
        if (!stage.validateInput(this.input.initialInput)) {
          throw new Error(`Stage ${pending.stageName} validation failed`);
        }

        const output = await stage.execute(this.input.initialInput);

        const executionEnd = Date.now();
        stageExecution.status = 'succeeded';
        stageExecution.outputHash = output.outputHash;
        stageExecution.summary = output.summary;
        stageExecution.durationMs = executionEnd - executionStart;
        stageExecution.completedAt = new Date();

        this.stageResults.push({ orderIndex: resultOrderIndex, execution: stageExecution, output });

      } catch (err) {
        const executionEnd = Date.now();
        const errorDetails = err instanceof Error ? err.message : String(err);

        stageExecution.status = 'failed';
        stageExecution.errorDetails = errorDetails;
        stageExecution.durationMs = executionEnd - executionStart;
        stageExecution.completedAt = new Date();

        this.stageResults.push({ orderIndex: resultOrderIndex, execution: stageExecution });

        // Notify subscribers before checking required-stage early exit
        this.notifySubscribers();

        // Mark pipeline as failed if a required stage failed
        if (this.requiredStages.has(pending.stageName)) {
          this._status = 'failed';
          return;
        } else {
          this._status = 'partial';
        }
      }

      // Notify subscribers of stage completion (success path)
      this.notifySubscribers();
    }

    // Finalize pipeline status
    const totalDuration = Date.now() - startTime;
    if (this._status === 'pending') {
      this._status = this.stageResults.every(r => r.execution.status === 'succeeded')
        ? 'succeeded'
        : 'partial';
    }

    // Store final output hash from last successful stage
    const lastSuccessful = [...this.stageResults]
      .filter(r => r.execution.status === 'succeeded')
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .pop();

    if (lastSuccessful?.output) {
      this.finalOutputHash = lastSuccessful.output.outputHash;
    }

    // Notify completion callback
    if (this.onComplete) {
      setTimeout(() => this.onComplete!(), 0);
    }
  }

  async collect(): Promise<GenerationPipelineExecution> {
    while (!['succeeded', 'failed', 'partial', 'cancelled'].includes(this._status)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const totalDuration = this.stageResults.reduce((acc, r) =>
      acc + (r.execution.durationMs ?? 0), 0);

    return {
      id: this.id,
      generationRunId: this.input.generationRunId,
      initialInput: this.input.initialInput,
      stages: this.stageResults.map(r => r.execution),
      finalOutputHash: this.finalOutputHash,
      status: this._status,
      totalDurationMs: totalDuration,
      startedAt: new Date(Date.now() - (totalDuration + 100)),
      completedAt: new Date(),
    };
  }

  cancel(): void {
    if (this._abortController) {
      this._abortController.abort();
    }
    // Mark all pending stages as cancelled
    for (const result of this.stageResults) {
      if (result.execution.status === 'running') {
        result.execution.status = 'cancelled';
        result.execution.completedAt = new Date();
      }
    }
    this._status = 'cancelled';
  }

  subscribe(
    handler: (result: StageResult) => void,
    onComplete?: () => void
  ): () => void {
    this.subscribers.push(handler);
    if (onComplete) {
      this.onComplete = onComplete;
    }
    return () => {
      const idx = this.subscribers.indexOf(handler);
      if (idx !== -1) {
        this.subscribers.splice(idx, 1);
      }
    };
  }

  /** Notify all subscribers with the most recently pushed stage result. */
  private notifySubscribers(): void {
    const lastResult = this.stageResults[this.stageResults.length - 1];
    if (lastResult) {
      for (const subscriber of this.subscribers) {
        try {
          subscriber(lastResult);
        } catch (e) {
          console.error('Subscriber error:', e);
        }
      }
    }
  }

  private get finalOutputHash(): string | null {
    // Implementation detail - stored in class state
    return null;
  }
  private set finalOutputHash(value: string | null) {
    // No-op for now - placeholder for future implementation
  }
}

/** ------------------------------------------------------------------ */
/*  Pipeline Builder                                                */
/** ------------------------------------------------------------------ */

export interface PipelineBuilder {
  addStage(stage: GenerationStage): PipelineBuilder;
  addRequiredStage(name: GenerationStageName): PipelineBuilder;
  build(): GenerationPipeline;
}

export class DefaultPipelineBuilder implements PipelineBuilder {
  private stages = new Map<GenerationStageName, GenerationStage>();
  private requiredStages = new Set<GenerationStageName>();

  addStage(stage: GenerationStage): PipelineBuilder {
    this.stages.set(stage.name, stage);
    return this;
  }

  addRequiredStage(name: GenerationStageName): PipelineBuilder {
    this.requiredStages.add(name);
    return this;
  }

  build(input?: CreatePipelineInput): DefaultGenerationPipeline {
    if (this.requiredStages.size === 0) {
      throw new Error('At least one required stage must be specified');
    }
    const pipeline = new DefaultGenerationPipeline(
      input ?? {} as CreatePipelineInput,
      this.stages,
      this.requiredStages
    );
    return pipeline;
  }
}

/** ------------------------------------------------------------------ */
/*  Stage Factory Helpers                                           */
/** ------------------------------------------------------------------ */

export function createStageExecution(
  stageName: GenerationStageName,
  status: 'pending' | 'running' | 'succeeded' | 'failed',
  inputHash?: string,
  outputHash?: string,
  summary?: string,
  errorDetails?: string
): GenerationStageExecution {
  const executionId = crypto.randomUUID();
  return {
    id: executionId,
    stageName,
    status,
    inputHash: inputHash ?? null,
    outputHash: outputHash ?? null,
    durationMs: null,
    summary: summary ?? null,
    errorDetails: errorDetails ?? null,
    startedAt: new Date(),
    completedAt: null,
  };
}

/** ------------------------------------------------------------------ */
/*  Mock/Stub Stages for Testing                                    */
/** ------------------------------------------------------------------ */

export class MockGenerationStage implements GenerationStage {
  readonly name: GenerationStageName;
  readonly description: string;

  constructor(
    stageName: GenerationStageName,
    description: string,
    private mockOutput?: Partial<GenerationStageOutput>
  ) {
    this.name = stageName;
    this.description = description;
  }

  validateInput(input: GenerationStageInput): boolean {
    return true; // Mock accepts any input
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const outputHash = `hash-${this.name}-${Date.now()}`;

    return {
      inputHash: crypto.randomUUID(),
      outputHash,
      artifacts: [
        {
          id: crypto.randomUUID(),
          generationRunId: '00000000-0000-0000-0000-000000000000', // Will be set by caller
          stageName: this.name,
          kind: 'summary',
          relativePath: `output/${this.name}.md`,
          contentHash: outputHash.slice(-64),
          fileSizeBytes: 1024,
          isNew: true,
          description: `Generated ${this.description}`,
          createdAt: new Date(),
        },
      ],
      summary: this.mockOutput?.summary ?? `Completed ${this.name} stage`,
      warnings: [],
    };
  }
}
