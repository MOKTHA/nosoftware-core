/**
 * Drizzle table definition for `workflow_definitions` and `workflow_instances`.
 *
 * Phase 8 — Industrial Runtime Services: Workflow engine tables.
 * Based on FactoryNXT patterns (WorkOrder FSM, Routing FSM).
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums for workflow definitions
// ---------------------------------------------------------------------------

export const workflowDefinitionStatusEnum = text('status', {
  enum: ['draft', 'published', 'deprecated'],
});

export const workflowDomainEnum = text('domain', {
  enum: [
    'work-order',
    'routing',
    'quality',
    'maintenance',
    'inventory',
    'custom',
  ],
});

// ---------------------------------------------------------------------------
// Table: workflow_definitions
// ---------------------------------------------------------------------------

/**
 * Stores workflow definition metadata (the state machine template).
 */
export const workflowDefinitions = pgTable(
  'workflow_definitions',
  {
    /** UUID string. */
    id: text('id').primaryKey(),

    /** Workflow name. */
    name: text('name').notNull(),

    /** Optional description. */
    description: text('description'),

    /** Semantic version (x.y.z). */
    version: text('version').notNull(),

    /** Definition status. */
    status: workflowDefinitionStatusEnum.notNull().default('draft'),

    /** Domain category. */
    domain: workflowDomainEnum.notNull(),

    /** Workflow states (JSON array of state objects). */
    states: jsonb('states').$type<unknown>().notNull(),

    /** Workflow transitions (JSON array of transition objects). */
    transitions: jsonb('transitions').$type<unknown>(),

    /** Created by user ID. */
    createdBy: text('createdBy').notNull(),

    createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }),
  },
  (table) => ({
    domainIdx: index('workflow_definitions_domain_idx').on(table.domain),
    statusIdx: index('workflow_definitions_status_idx').on(table.status),
    createdByIdx: index(
      'workflow_definitions_createdBy_idx',
    ).on(table.createdBy),
  }),
);

// ---------------------------------------------------------------------------
// Enums for workflow instances (runtime)
// ---------------------------------------------------------------------------

export const workflowInstanceStatusEnum = text('status', {
  enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
});

// ---------------------------------------------------------------------------
// Table: workflow_instances
// ---------------------------------------------------------------------------

/**
 * Stores running workflow instance state.
 */
export const workflowInstances = pgTable(
  'workflow_instances',
  {
    /** UUID string. */
    id: text('id').primaryKey(),

    /** FK to the definition this instance is based on. */
    definitionId: text('definitionId')
      .notNull()
      .references(() => workflowDefinitions.id),

    /** Version of the definition used (snapshot at start). */
    definitionVersion: text('version').notNull(),

    /** Current status. */
    status: workflowInstanceStatusEnum.notNull().default('pending'),

    /** Currently active state ID. */
    currentState: text('currentState').notNull(),

    /** Runtime context data (JSON object). */
    contextData: jsonb('contextData').$type<unknown>().default({}),

    createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).notNull(),
    completedAt: timestamp('completedAt', { mode: 'date' }),
  },
  (table) => ({
    definitionIdx: index(
      'workflow_instances_definitionId_idx',
    ).on(table.definitionId),
    statusIdx: index('workflow_instances_status_idx').on(table.status),
    stateIdx: index('workflow_instances_currentState_idx').on(table.currentState),
  }),
);

// ---------------------------------------------------------------------------
// Table: workflow_transitions (audit trail)
// ---------------------------------------------------------------------------

/**
 * Records each state transition for audit and debugging.
 */
export const workflowTransitions = pgTable(
  'workflow_transitions',
  {
    /** UUID string. */
    id: text('id').primaryKey(),

    /** FK to the instance that made this transition. */
    instanceId: text('instanceId')
      .notNull()
      .references(() => workflowInstances.id),

    /** Source state ID. */
    fromState: text('fromState').notNull(),

    /** Target state ID. */
    toState: text('toState').notNull(),

    /** Transition trigger type (event, timer, manual, webhook). */
    triggerType: text('triggerType', {
      enum: ['event', 'timer', 'manual', 'webhook'],
    }).notNull(),

    /** Event name that triggered the transition. */
    eventName: text('eventName'),

    /** Transition metadata (JSON object). */
    metadata: jsonb('metadata').$type<unknown>(),

    createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  },
  (table) => ({
    instanceIdx: index(
      'workflow_transitions_instanceId_idx',
    ).on(table.instanceId),
    stateIdx: index(
      'workflow_transitions_state_idx',
    ).on(table.fromState, table.toState),
  }),
);

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Workflow definition record type. */
export type WorkflowDefinition = typeof workflowDefinitions.$inferSelect;

/** Insertable workflow definition (without id). */
export type InsertWorkflowDefinition = Omit<
  typeof workflowDefinitions.$inferInsert,
  'id' | 'createdAt' | 'updatedAt'
>;

/** Workflow instance record type. */
export type WorkflowInstance = typeof workflowInstances.$inferSelect;

/** Insertable workflow instance (without id). */
export type InsertWorkflowInstance = Omit<
  typeof workflowInstances.$inferInsert,
  'id' | 'createdAt' | 'updatedAt' | 'completedAt'
>;

/** Workflow transition record type. */
export type WorkflowTransition = typeof workflowTransitions.$inferSelect;

/** Insertable workflow transition (without id). */
export type InsertWorkflowTransition = Omit<
  typeof workflowTransitions.$inferInsert,
  'id' | 'createdAt'
>;
