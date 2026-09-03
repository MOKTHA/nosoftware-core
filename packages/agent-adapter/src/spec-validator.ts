/**
 * @heynxt/agent-adapter — Spec Validation Gate
 *
 * Validates an AppSpecTemplate before it enters the generation pipeline.
 * Returns structured errors and warnings so the caller can decide
 * whether to proceed, fix, or abort.
 */

import type { AppSpecTemplate } from '@heynxt/core-types';

/** ------------------------------------------------------------------ */
/*  Result type                                                       */
/** ------------------------------------------------------------------ */

export interface SpecValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** ------------------------------------------------------------------ */
/*  UUID v4 regex                                                     */
/** ------------------------------------------------------------------ */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ------------------------------------------------------------------ */
/*  Validator                                                         */
/** ------------------------------------------------------------------ */

/**
 * Validate an AppSpecTemplate for completeness and consistency.
 *
 * Errors are hard blockers — the pipeline should not start.
 * Warnings are non-blocking observations (e.g. "fewer than 2 entities").
 */
export function validateSpecTemplate(
  input: AppSpecTemplate,
): SpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { spec, blueprintPlan } = input;

  // ── AppSpec checks ──────────────────────────────────────────────

  if (!spec.appName || spec.appName.trim().length === 0) {
    errors.push('spec.appName must be non-empty.');
  }

  if (!spec.entities || spec.entities.length === 0) {
    errors.push('spec.entities must contain at least one entity.');
  } else {
    // Warn if fewer than 2 entities
    if (spec.entities.length < 2) {
      warnings.push(
        'spec.entities has fewer than 2 entities — consider adding more for a realistic app.',
      );
    }

    // Every entity must have at least one field
    for (const entity of spec.entities) {
      if (!entity.fields || entity.fields.length === 0) {
        errors.push(
          `Entity "${entity.name}" must have at least one field.`,
        );
      }
    }
  }

  if (!spec.businessRules || spec.businessRules.length === 0) {
    errors.push('spec.businessRules must contain at least one rule.');
  } else {
    for (const rule of spec.businessRules) {
      if (!rule.description || rule.description.trim().length === 0) {
        errors.push(
          `Business rule "${rule.name}" must have a non-empty description.`,
        );
      }
    }
  }

  if (
    !spec.uiRequirements.views ||
    spec.uiRequirements.views.length === 0
  ) {
    errors.push('spec.uiRequirements.views must contain at least one view.');
  }

  if (
    !spec.uiRequirements.roles ||
    spec.uiRequirements.roles.length === 0
  ) {
    errors.push('spec.uiRequirements.roles must contain at least one role.');
  }

  // ── BlueprintPlan checks ────────────────────────────────────────

  if (!UUID_RE.test(blueprintPlan.blueprintId)) {
    errors.push(
      `blueprintPlan.blueprintId must be a valid UUID (got "${blueprintPlan.blueprintId}").`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
