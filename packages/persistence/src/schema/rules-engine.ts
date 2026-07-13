/**
 * Drizzle table definition for `rules` and `rule_violations`.
 *
 * Phase 8 — Industrial Runtime Services: Rules engine tables.
 * Business rules that are evaluated at runtime (e.g., "temperature > threshold → alert").
 */
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums for rule definitions
// ---------------------------------------------------------------------------

export const ruleStatusEnum = text('status', {
  enum: ['draft', 'active', 'disabled'],
});

export const violationSeverityEnum = text('severity', {
  enum: ['info', 'warning', 'error', 'critical'],
});

export const ruleDomainEnum = text('domain', {
  enum: [
    'quality',
    'process',
    'equipment',
    'production',
    'safety',
    'custom',
  ],
});

// ---------------------------------------------------------------------------
// Table: rules (rule definitions)
// ---------------------------------------------------------------------------

/**
 * Stores business rule definitions. Each rule has conditions that are
 * evaluated against incoming events, and actions to take when triggered.
 */
export const rules = pgTable(
  'rules',
  {
    /** UUID string. */
    id: text('id').primaryKey(),

    /** Rule name. */
    name: text('name').notNull(),

    /** Optional description. */
    description: text('description'),

    /** Rule status. */
    status: ruleStatusEnum.notNull().default('draft'),

    /** Domain category. */
    domain: ruleDomainEnum.notNull(),

    /** Rule conditions (JSON array of condition objects). */
    conditions: jsonb('conditions').$type<unknown>().notNull(),

    /** Rule actions to take when triggered (JSON array of action objects). */
    actions: jsonb('actions').$type<unknown>().notNull(),

    /** Evaluation window configuration (optional time-based restrictions). */
    evaluationWindow: jsonb('evaluationWindow').$type<unknown>(),

    /** FK dependencies (other rules that must pass before this one is evaluated). */
    dependencies: jsonb('dependencies').$type<unknown>(),

    /** Created by user ID. */
    createdBy: text('createdBy').notNull(),

    createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }),
  },
  (table) => ({
    domainIdx: index('rules_domain_idx').on(table.domain),
    statusIdx: index('rules_status_idx').on(table.status),
    createdByIdx: index('rules_createdBy_idx').on(table.createdBy),
  }),
);

// ---------------------------------------------------------------------------
// Table: rule_violations (rule triggers)
// ---------------------------------------------------------------------------

/**
 * Records when a rule fires and creates a violation/alert. This is the
 * audit trail of all rule evaluations that resulted in actions.
 */
export const ruleViolations = pgTable(
  'rule_violations',
  {
    /** UUID string (server-generated if not provided). */
    id: text('id').primaryKey(),

    /** FK to the rule that was violated/fired. */
    ruleId: text('ruleId')
      .notNull()
      .references(() => rules.id),

    /** Severity level of this violation. */
    severity: violationSeverityEnum.notNull(),

    /** The context data that triggered the violation (snapshot). */
    contextSnapshot: jsonb('contextSnapshot').$type<unknown>().notNull(),

    /** Which condition(s) failed/triggered (JSON array of condition results). */
    triggerDetails: jsonb('triggerDetails').$type<unknown>(),

    /** Actions that were taken as a result. */
    actionsTaken: jsonb('actionsTaken').$type<unknown>(),

    /** When the violation was acknowledged (if applicable). */
    acknowledgedAt: timestamp('acknowledgedAt', { mode: 'date' }),

    /** Who acknowledged it. */
    acknowledgedBy: text('acknowledgedBy'),

    /** When the issue was resolved (if applicable). */
    resolvedAt: timestamp('resolvedAt', { mode: 'date' }),

    /** Resolution notes. */
    resolutionNotes: text('resolutionNotes'),

    createdAt: timestamp('createdAt', { mode: 'date' }).notNull(),
  },
  (table) => ({
    ruleIdx: index('rule_violations_ruleId_idx').on(table.ruleId),
    severityIdx: index(
      'rule_violations_severity_idx',
    ).on(table.severity),
    acknowledgedByIdx: index(
      'rule_violations_acknowledgedBy_idx',
    ).on(table.acknowledgedBy),
  }),
);

// ---------------------------------------------------------------------------
// Table: rule_evaluation_log (evaluation audit trail)
// ---------------------------------------------------------------------------

/**
 * Records every evaluation of a rule, regardless of whether it triggered.
 * This is useful for debugging and tuning rule conditions.
 */
export const ruleEvaluationLog = pgTable(
  'rule_evaluation_log',
  {
    /** UUID string. */
    id: text('id').primaryKey(),

    /** FK to the rule that was evaluated. */
    ruleId: text('ruleId')
      .notNull()
      .references(() => rules.id),

    /** When the evaluation occurred. */
    evaluatedAt: timestamp('evaluatedAt', { mode: 'date' }).notNull(),

    /** The data that was evaluated (snapshot). */
    contextSnapshot: jsonb('contextSnapshot').$type<unknown>().notNull(),

    /** Results of each condition evaluation. */
    conditionResults: jsonb('conditionResults').$type<unknown>(),

    /** Whether all conditions passed. */
    allConditionsPassed: text('allConditionsPassed', {
      enum: ['true', 'false'],
    }).notNull(),

    /** Which action triggered (if any). */
    triggeredActionIndex: integer('triggeredActionIndex'),

    /** Error message if evaluation failed. */
    error: text('error'),
  },
  (table) => ({
    ruleIdx: index(
      'rule_evaluation_log_ruleId_idx',
    ).on(table.ruleId),
    evaluatedAtIdx: index(
      'rule_evaluation_log_evaluatedAt_idx',
    ).on(table.evaluatedAt),
  }),
);

// ---------------------------------------------------------------------------
// Type Exports
// ---------------------------------------------------------------------------

/** Rule definition record type. */
export type RuleDefinition = typeof rules.$inferSelect;

/** Insertable rule (without id, createdAt, updatedAt). */
export type InsertRule = Omit<
  typeof rules.$inferInsert,
  'id' | 'createdAt' | 'updatedAt'
>;

/** Rule violation record type. */
export type RuleViolation = typeof ruleViolations.$inferSelect;

/** Insertable rule violation (without id). */
export type InsertRuleViolation = Omit<
  typeof ruleViolations.$inferInsert,
  'id' | 'createdAt'
>;

/** Rule evaluation log record type. */
export type RuleEvaluationLog = typeof ruleEvaluationLog.$inferSelect;

/** Insertable rule evaluation log (without id). */
export type InsertRuleEvaluationLog = Omit<
  typeof ruleEvaluationLog.$inferInsert,
  'id'
>;
