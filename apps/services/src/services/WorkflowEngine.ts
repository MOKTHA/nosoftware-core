/**
 * Core workflow engine - executes workflow state machines.
 */

import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db, workflowDefinitions, workflowInstances, workflowTransitions } from '@heynxt/persistence';
import type { WorkflowDefinition, WorkflowInstance, InsertWorkflowTransition } from '@heynxt/persistence';
import { withTransaction } from '../database/db';

export interface TransitionResult {
  success: boolean;
  fromState: string;
  toState: string;
  transitionId?: string;
  error?: string;
}

/**
 * Workflow engine for executing state machine transitions.
 */
export class WorkflowEngine {
  /**
   * Load a workflow definition by ID.
   */
  static async getDefinition(definitionId: string): Promise<WorkflowDefinition | null> {
    const [definition] = await db
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, definitionId));

    return definition ?? null;
  }

  /**
   * Create a new workflow instance from a definition.
   */
  static async createInstance(
    definitionId: string,
    triggerEvent: string,
    metadata?: Record<string, any>
  ): Promise<WorkflowInstance | null> {
    const definition = await this.getDefinition(definitionId);

    if (!definition) {
      throw new Error(`Workflow definition not found: ${definitionId}`);
    }

    if (definition.status !== 'published') {
      throw new Error(`Cannot start workflow with status: ${definition.status}`);
    }

    // Parse states and transitions from JSON strings
    const states = this.parseStates(definition.states);
    const initialStates = Array.isArray(states) ? states : [];
    const initialState = initialStates.length > 0 ? initialStates[0] : 'idle';

    const [instance] = await db
      .insert(workflowInstances)
      .values({
        id: crypto.randomUUID(),
        definitionId,
        definitionVersion: definition.version,
        status: 'running' as const,
        currentState: initialState,
        contextData: metadata ?? {},
      })
      .returning();

    if (!instance || !instance.id) {
      throw new Error('Failed to create workflow instance');
    }

    return instance;
  }

  /**
   * Get a workflow instance by ID.
   */
  static async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
    const [instance] = await db
      .select()
      .from(workflowInstances)
      .where(eq(workflowInstances.id, instanceId));

    return instance ?? null;
  }

  /**
   * Execute a state transition for an active workflow instance.
   */
  static async executeTransition(
    instanceId: string,
    triggerEvent: string,
    metadata?: Record<string, any>
  ): Promise<TransitionResult> {
    const result = await withTransaction(async (client) => {
      // Get current instance (without forUpdate as it's not supported in this Drizzle version)
      const [instance] = await db
        .select()
        .from(workflowInstances)
        .where(eq(workflowInstances.id, instanceId))
        .execute(client);

      if (!instance) {
        return { success: false, fromState: '', toState: '', error: 'Instance not found' };
      }

      if (instance.status !== 'running') {
        return {
          success: false,
          fromState: instance.currentState || '',
          toState: '',
          error: `Cannot transition workflow in status: ${instance.status}`,
        };
      }

      // Get definition for transitions
      const [definition] = await db
        .select()
        .from(workflowDefinitions)
        .where(eq(workflowDefinitions.id, instance.definitionId))
        .execute(client);

      if (!definition) {
        return { success: false, fromState: '', toState: '', error: 'Definition not found' };
      }

      // Parse transitions and find matching transition for trigger event
      const transitions = this.parseTransitions(definition.transitions);
      const matchingTransition = transitions.find((t) => t.from === instance.currentState && t.event === triggerEvent);

      if (!matchingTransition) {
        return {
          success: false,
          fromState: instance.currentState || 'unknown',
          toState: '',
          error: `No transition found for event "${triggerEvent}" in state "${instance.currentState}"`,
        };
      }

      // Execute the transition (update instance state and log)
      const newStatus = matchingTransition.target === 'end' ? 'completed' : 'running';
      const newState = matchingTransition.target === 'end' ? 'completed' : matchingTransition.target;

      await db
        .update(workflowInstances)
        .set({
          currentState: newState,
          status: newStatus,
          updatedAt: new Date(),
          contextData: { ...(instance.contextData as any), ...metadata },
        })
        .where(eq(workflowInstances.id, instanceId))
        .execute(client);

      // Log the transition with required id and createdAt fields
      const [transition] = await db
        .insert(workflowTransitions)
        .values({
          id: crypto.randomUUID(),
          instanceId,
          fromState: instance.currentState || 'unknown',
          toState: newState,
          triggerType: 'event' as const,
          eventName: triggerEvent,
          metadata: metadata ?? {},
          createdAt: new Date(),
        })
        .returning()
        .execute(client);

      if (!transition) {
        throw new Error('Failed to create transition record');
      }

      return { success: true, fromState: instance.currentState || 'unknown', toState: newState, transitionId: transition.id };
    });

    return result;
  }

  /**
   * Pause a running workflow instance.
   */
  static async pauseInstance(instanceId: string): Promise<boolean> {
    const [instance] = await db
      .update(workflowInstances)
      .set({ status: 'pending' }) // pending = paused state
      .where(eq(workflowInstances.id, instanceId))
      .returning();

    return !!instance;
  }

  /**
   * Resume a paused workflow instance.
   */
  static async resumeInstance(instanceId: string): Promise<boolean> {
    const [instance] = await db
      .update(workflowInstances)
      .set({ status: 'running' })
      .where(eq(workflowInstances.id, instanceId))
      .returning();

    return !!instance;
  }

  /**
   * Cancel a workflow instance.
   */
  static async cancelInstance(instanceId: string): Promise<boolean> {
    const [instance] = await db
      .update(workflowInstances)
      .set({ status: 'cancelled' })
      .where(eq(workflowInstances.id, instanceId))
      .returning();

    return !!instance;
  }

  /**
   * Parse states from JSON string.
   */
  private static parseStates(statesJson: unknown): string[] {
    try {
      const parsed = typeof statesJson === 'string' ? JSON.parse(statesJson) : statesJson;
      if (Array.isArray(parsed)) return parsed;

      // If it's an object with stateIds array
      if (typeof parsed === 'object' && parsed !== null && 'stateIds' in parsed) {
        const data = parsed as any;
        return Array.isArray(data.stateIds) ? data.stateIds : [];
      }

      return ['idle']; // Default fallback state
    } catch {
      return ['idle']; // Default fallback state
    }
  }

  /**
   * Parse transitions from JSON string.
   */
  private static parseTransitions(transitionsJson: unknown): Array<{
    id?: string;
    from: string;
    event: string;
    target: string;
    condition?: string;
  }> {
    try {
      const parsed = typeof transitionsJson === 'string' ? JSON.parse(transitionsJson) : transitionsJson;

      if (Array.isArray(parsed)) return parsed;

      // If it's an object with transitions array
      if (typeof parsed === 'object' && parsed !== null && 'transitions' in parsed) {
        const data = parsed as any;
        return Array.isArray(data.transitions) ? data.transitions : [];
      }

      return []; // No transitions defined
    } catch {
      return []; // No transitions defined
    }
  }

  /**
   * Get workflow instance history (transitions).
   */
  static async getInstanceHistory(instanceId: string): Promise<Array<{ id: string; fromState: string; toState: string; eventName?: string | null; createdAt: Date }>> {
    return await db
      .select({
        id: workflowTransitions.id,
        fromState: workflowTransitions.fromState,
        toState: workflowTransitions.toState,
        eventName: workflowTransitions.eventName,
        createdAt: workflowTransitions.createdAt,
      })
      .from(workflowTransitions)
      .where(eq(workflowTransitions.instanceId, instanceId))
      .orderBy(workflowTransitions.createdAt);
  }

  /**
   * Check if a transition is valid for the current state.
   */
  static canTransition(definition: WorkflowDefinition, currentState: string, event: string): boolean {
    const transitions = this.parseTransitions(definition.transitions);
    return transitions.some((t) => t.from === currentState && t.event === event);
  }
}
