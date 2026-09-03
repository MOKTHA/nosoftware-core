/**
 * @heynxt/core-types — AppSpec schemas
 *
 * Defines the structured application specification produced by the
 * prompt-to-spec engine when an LLM generates a complete app description.
 *
 * The flow is:
 *   GenerateSpecInput → (LLM call) → AppSpecTemplate
 *
 * AppSpecTemplate bundles three concerns:
 *   - AppSpec: what the app looks like (entities, rules, UI)
 *   - AppBlueprintPlan: how to build it (domain models, constraints, hints)
 *   - params: extra key-value configuration for generation stages
 *
 * Naming note: the Phase 4 SpecTemplate (in prompt-spec.ts) describes the
 * manufacturing-domain spec extracted from a prompt. This AppSpecTemplate
 * is the broader LLM-generated wrapper used by the generation pipeline.
 *
 * Exported symbols:
 *
 *   FieldType, EntityField, Entity
 *     Schema-level building blocks for describing data models.
 *
 *   BusinessRule
 *     A named, versioned business rule with category and description.
 *
 *   UiRequirements
 *     Views and roles the generated app must support.
 *
 *   AppSpec
 *     Top-level application specification: entities + rules + UI.
 *
 *   AppBlueprintPlan
 *     Blueprint-side plan: domain models, constraints, rule hints.
 *
 *   AppSpecTemplate
 *     The combined deliverable: spec + blueprint plan + params.
 */

import { z } from 'zod';

/** ------------------------------------------------------------------ */
/*  Enums                                                              */
/** ------------------------------------------------------------------ */

/**
 * Supported field types for entity definitions.
 *
 * Maps roughly to common SQL / ORM column types so that the
 * generate-schema stage can emit migrations directly.
 */
export const FieldType = z.enum([
  'uuid',
  'string',
  'text',
  'integer',
  'decimal',
  'boolean',
  'timestamp',
  'enum',
  'json',
]);

export type FieldType = z.infer<typeof FieldType>;

/** ------------------------------------------------------------------ */
/*  Entity definitions                                                */
/** ------------------------------------------------------------------ */

/**
 * A single field (column) in an entity.
 *
 * `values` is only meaningful when `type` is `'enum'` — it lists the
 * allowed enum members.
 */
export const EntityField = z.object({
  /** Column / property name (e.g. "id", "status", "createdAt"). */
  name: z.string().min(1),

  /** Data type for this field. */
  type: FieldType,

  /** Whether this field is the primary key. Defaults to false. */
  primaryKey: z.boolean().optional(),

  /** Whether this field is nullable. Defaults to false (required). */
  nullable: z.boolean().optional(),

  /** Allowed values when `type` is `'enum'`. */
  values: z.array(z.string()).optional(),
});

export type EntityField = z.infer<typeof EntityField>;

/**
 * A data entity (table / model) in the application.
 *
 * `relationships` is a free-form list of relationship descriptions
 * (e.g. "Ticket belongsTo User via assigneeId"). The generate-schema
 * stage interprets these when emitting migrations and ORM models.
 */
export const Entity = z.object({
  /** Entity name in PascalCase (e.g. "Ticket", "User", "Comment"). */
  name: z.string().min(1),

  /** Fields that make up this entity. At least one required. */
  fields: z.array(EntityField).min(1),

  /** Free-form relationship descriptions. */
  relationships: z.array(z.string()).optional(),
});

export type Entity = z.infer<typeof Entity>;

/** ------------------------------------------------------------------ */
/*  Business rules                                                    */
/** ------------------------------------------------------------------ */

/**
 * A named business rule with category, description, and optional version.
 *
 * Rules are referenced by `ruleId` throughout the spec; the
 * `AppBlueprintPlan.ruleImplementationHints` map keyed by rule name
 * tells the generation stages *how* to implement each rule.
 */
export const BusinessRule = z.object({
  /** Stable identifier for this rule (UUID). */
  ruleId: z.string().uuid(),

  /** Human-readable rule name (e.g. "SLA Escalation"). */
  name: z.string().min(1),

  /** What this rule does, in plain language. */
  description: z.string().min(1),

  /** Category for grouping (e.g. "escalation", "routing", "lifecycle"). */
  category: z.string().min(1),

  /** Monotonically increasing version; defaults to 1. */
  version: z.number().int().positive().optional(),
});

export type BusinessRule = z.infer<typeof BusinessRule>;

/** ------------------------------------------------------------------ */
/*  UI requirements                                                   */
/** ------------------------------------------------------------------ */

/**
 * High-level UI requirements for the generated application.
 *
 * `views` lists the screens / pages to generate.
 * `roles` lists the user roles that drive RBAC on those views.
 */
export const UiRequirements = z.object({
  /** View identifiers (e.g. "ticket_list", "dashboard"). */
  views: z.array(z.string().min(1)).min(1),

  /** Role identifiers (e.g. "admin", "support_agent"). */
  roles: z.array(z.string().min(1)).min(1),
});

export type UiRequirements = z.infer<typeof UiRequirements>;

/** ------------------------------------------------------------------ */
/*  AppSpec                                                           */
/** ------------------------------------------------------------------ */

/**
 * Top-level application specification.
 *
 * Describes *what* the generated app looks like: its data model,
 * business rules, and UI surface.
 */
export const AppSpec = z.object({
  /** Unique identifier for this application spec (UUID). */
  appId: z.string().uuid(),

  /** Human-readable application name. */
  appName: z.string().min(1),

  /** Data entities the app manages. */
  entities: z.array(Entity).min(1),

  /** Business rules the app enforces. */
  businessRules: z.array(BusinessRule).min(1),

  /** UI surface requirements. */
  uiRequirements: UiRequirements,
});

export type AppSpec = z.infer<typeof AppSpec>;

/** ------------------------------------------------------------------ */
/*  AppBlueprintPlan                                                  */
/** ------------------------------------------------------------------ */

/**
 * Blueprint-side plan that tells the generation pipeline *how* to
 * implement the AppSpec against a particular industrial blueprint.
 *
 * `domainModels` is intentionally `Record<string, unknown>` so that
 * different blueprints can carry different model shapes.
 */
export const AppBlueprintPlan = z.object({
  /** Unique identifier for this blueprint plan (UUID). */
  blueprintId: z.string().uuid(),

  /** Human-readable blueprint name. */
  blueprintName: z.string().min(1),

  /** Domain model definitions keyed by model name. */
  domainModels: z.record(z.string(), z.unknown()),

  /** Constraints the generation must respect. */
  constraints: z.array(z.string()),

  /** Hints mapping rule name → implementation strategy. */
  ruleImplementationHints: z.record(z.string(), z.string()),
});

export type AppBlueprintPlan = z.infer<typeof AppBlueprintPlan>;

/** ------------------------------------------------------------------ */
/*  AppSpecTemplate                                                   */
/** ------------------------------------------------------------------ */

/**
 * The combined deliverable from the prompt-to-spec LLM call.
 *
 * Bundles the application specification, the blueprint plan, and any
 * extra parameters the generation pipeline stages may need.
 *
 * Named `AppSpecTemplate` (not `SpecTemplate`) to avoid collision with
 * the Phase 4 `SpecTemplate` in prompt-spec.ts which describes the
 * manufacturing-domain spec extracted from a raw prompt.
 */
export const AppSpecTemplate = z.object({
  /** The application specification. */
  spec: AppSpec,

  /** The blueprint implementation plan. */
  blueprintPlan: AppBlueprintPlan,

  /** Extra parameters for generation stages. */
  params: z.record(z.string(), z.unknown()),
});

export type AppSpecTemplate = z.infer<typeof AppSpecTemplate>;
