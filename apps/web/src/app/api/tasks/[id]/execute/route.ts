/**
 * POST /api/tasks/:id/execute — Execute a task with an agent runtime.
 *
 * This endpoint wires the control plane to the agent execution layer:
 *   1. Validates the task exists and is executable
 *   2. Creates an AgentExecutionResult record with 'running' status
 *   3. Spawns the agent via background task (Next.js API route pattern)
 *   4. Returns immediately; progress streamed to client via SSE or polling
 *
 * Request: POST /api/tasks/:id/execute
 * Body: CreateTaskPayloadInput (from core-types)
 *   { agentSpecId, priority?, inputData?, executionParams?, contextFrom? }
 *
 * Response 202: { executionResult: AgentExecutionResult, taskStatus: 'running' }
 * Response 401: Not authenticated
 * Response 404: Task not found
 * Response 409: Task already running or in terminal state
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { CreateTaskPayloadInput, type AgentExecutionResult } from '@heynxt/core-types';
import { db, tasks, agentSpecs, agentExecutionResults } from '@heynxt/persistence';
import { TaskStatus, ExecutionResultStatus as CoreExecutionResultStatus } from '@heynxt/core-types';
import { StubAgentRuntime, type SpawnConfig } from '@heynxt/agent-adapter';

import { badRequest, errorResponse, parseJsonBody } from '@/lib/api';
import { requireAuth } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/execute
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate the request
    const session = await requireAuth();
    const userId = session.user.id;

    // Get task ID from URL params (Next.js App Router pattern)
    const { id: taskId } = await params;

    if (!taskId || !uuidValidate(taskId)) {
      throw badRequest('Invalid task ID', 'INVALID_TASK_ID');
    }

    // Validate the task exists and is executable
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      throw badRequest('Task not found', 'TASK_NOT_FOUND');
    }

    const taskStatus = TaskStatus.parse(task.status);

    // Check if task is in an executable state
    if (['succeeded', 'failed', 'cancelled'].includes(taskStatus)) {
      throw badRequest(
        `Cannot execute task in terminal state: ${taskStatus}`,
        'TASK_TERMINAL_STATE'
      );
    }

    if (taskStatus === 'running') {
      throw badRequest('Task already running', 'TASK_ALREADY_RUNNING');
    }

    // Parse the execution payload
    const body = await parseJsonBody(req);
    const input: CreateTaskPayloadInput = CreateTaskPayloadInput.parse(body);

    // Get the agent spec to determine which runtime to use
    const agentSpec = await db.query.agentSpecs.findFirst({
      where: eq(agentSpecs.id, input.agentSpecId),
    });

    if (!agentSpec) {
      throw badRequest('Agent spec not found', 'AGENT_SPEC_NOT_FOUND');
    }

    if (agentSpec.status === 'deprecated') {
      throw badRequest('Cannot use deprecated agent spec', 'SPEC_DEPRECATED');
    }

    // Initialize the appropriate runtime based on agent type
    const runtime = new StubAgentRuntime(); // TODO: Add factory for different runtimes

    // Validate config before execution
    const validation = runtime.validateConfig({
      id: agentSpec.id,
      displayName: 'Stub Spec',
      type: agentSpec.type as any,
      status: agentSpec.status as any,
      systemPrompt: null,
      taskDescription: null,
      config: agentSpec.config as any,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!validation.valid) {
      throw badRequest(
        `Agent spec validation failed: ${validation.errors.join(', ')}`,
        'SPEC_VALIDATION_FAILED'
      );
    }

    // Create the execution result record with 'running' status
    const now = new Date();
    const executionId = randomUUID();

    await db.insert(agentExecutionResults).values({
      id: executionId,
      agentSpecId: input.agentSpecId,
      taskId,
      status: CoreExecutionResultStatus.parse('running') as any,
      rawPayload: null,
      summary: null,
      errorDetails: null,
      startedAt: now,
      completedAt: now,
    });

    // Schedule background execution via Next.js API pattern
    // Note: In production, this should use a proper queue/background job system
    void executeAgentInBackground({
      executionId,
      taskId,
      agentSpecId: input.agentSpecId,
      runtime,
    });

    // Return 202 Accepted with initial execution result
    return NextResponse.json(
      {
        executionResult: {
          id: executionId,
          agentSpecId: input.agentSpecId,
          taskId,
          status: CoreExecutionResultStatus.parse('running') as any,
          rawPayload: null,
          summary: null,
          errorDetails: null,
          startedAt: now,
          completedAt: now,
        } as AgentExecutionResult,
        taskStatus: 'running' as const,
      },
      { status: 202 }
    );

  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Bad request')) {
      return errorResponse(err);
    }
    return errorResponse(err);
  }
}

// Background execution function - runs after response is sent
async function executeAgentInBackground(opts: {
  executionId: string;
  taskId: string;
  agentSpecId: string;
  runtime: StubAgentRuntime;
}): Promise<void> {
  const { executionId, taskId, agentSpecId, runtime } = opts;

  try {
    // Create a stub spec for the spawn call - must match AgentSpec schema
    const stubSpec: any = {
      id: agentSpecId,
      displayName: 'Stub Spec',
      type: 'stub-shell' as const,
      status: 'active' as const,
      systemPrompt: null,
      taskDescription: null,
      config: {
        timeoutSeconds: 300,
        retryBudgetSeconds: 60,
        autoRetry: true,
        modelOverride: null,
        temperature: null,
        toolSet: null,
        contextSources: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const handle = await runtime.spawn({
      spec: stubSpec,
      onOutput: (event) => {
        // TODO: Stream events to client via SSE or store in DB
        console.log('Agent output event:', event);
      },
    });

    // Collect the result when execution completes
    const result = await handle.collect();

    // Update the database with final status
    await db
      .update(agentExecutionResults)
      .set({
        status: CoreExecutionResultStatus.parse(result.status) as any,
        summary: result.summary,
        errorDetails: result.errorDetails,
        rawPayload: null as any,
        completedAt: new Date(),
      })
      .where(eq(agentExecutionResults.id, executionId));

    // Update task status based on execution result
    const taskStatus = result.status === 'succeeded' ? 'succeeded' : 'failed';
    await db
      .update(tasks)
      .set({
        status: TaskStatus.parse(taskStatus),
        completedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

  } catch (err) {
    console.error('Agent execution failed:', err);

    // Update with failure status
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    await db
      .update(agentExecutionResults)
      .set({
        status: 'failed' as const,
        errorDetails: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(agentExecutionResults.id, executionId));

    // Also update task status on failure
    await db
      .update(tasks)
      .set({
        status: TaskStatus.parse('failed'),
        completedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));
  }
}

// Simple UUID validation helper
function uuidValidate(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    uuid
  );
}
