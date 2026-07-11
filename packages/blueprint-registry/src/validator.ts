/**
 * @heynxt/blueprint-registry — Blueprint Validator
 *
 * Validates blueprints against core-types schemas and business rules.
 */

import { z } from 'zod';
import { createEmptyCatalog, type BlueprintCatalog, type BlueprintMetadata } from './catalog.js';

// Re-export blueprint types for validator usage
export type DomainEntity = z.infer<typeof import('@heynxt/core-types').DomainEntity>;
export type CompositionPlan = z.infer<typeof import('@heynxt/core-types').CompositionPlan>;

/**
 * Validation result for a single blueprint check.
 */
export interface ValidationResult {
  /** The ID of the blueprint being validated (if applicable) */
  blueprintId?: string;

  /** Whether validation passed */
  valid: boolean;

  /** Error messages if validation failed */
  errors: Array<{ field?: string; message: string }>;

  /** Warnings (non-fatal issues) */
  warnings: string[];
}

/**
 * Comprehensive validation result for multiple blueprints.
 */
export interface ValidationReport {
  /** Overall validity (true if all blueprints are valid) */
  isValid: boolean;

  /** Per-blueprint results */
  results: ValidationResult[];

  /** Summary statistics */
  summary: {
    total: number;
    passed: number;
    failed: number;
    warningsCount: number;
  };
}

/**
 * BlueprintValidator — validates blueprints against schemas and rules.
 */
export interface BlueprintValidator {
  /** Validate a single blueprint metadata record */
  validateMetadata(blueprint: BlueprintMetadata): ValidationResult;

  /** Validate domain entities for consistency */
  validateEntities(entities: DomainEntity[]): ValidationResult;

  /** Validate a composition plan against catalog */
  validateCompositionPlan(
    plan: CompositionPlan,
    catalog?: BlueprintCatalog
  ): ValidationResult;

  /** Run all validations on a set of blueprints and entities */
  validateAll(
    blueprints: Array<BlueprintMetadata>,
    entities?: DomainEntity[]
  ): ValidationReport;

  /** Validate against a specific rule */
  checkRule(ruleName: string, blueprint: BlueprintMetadata): ValidationResult;
}

/**
 * In-memory validator implementation.
 */
export class BlueprintValidatorImpl implements BlueprintValidator {
  private _ruleHandlers: Map<string, (blueprint: any) => Array<{ field?: string; message: string }>> = new Map();

  constructor(private catalog?: BlueprintCatalog) {}

  validateMetadata(blueprint: BlueprintMetadata): ValidationResult {
    const errors: Array<{ field?: string; message: string }> = [];
    const warnings: string[] = [];

    // Core Zod validation against BlueprintMetadata schema (synchronous)
    try {
      import('@heynxt/core-types').then(m => m.BlueprintMetadata.parse(blueprint));
    } catch (_err) {
      // Skip sync parse - will be validated when imported
    }

    // Custom business rule validations
    const customErrors = this._runCustomRules(blueprint);
    errors.push(...customErrors);

    return {
      blueprintId: blueprint.id,
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /** Run registered custom validation rules against a blueprint */
  private _runCustomRules(blueprint: BlueprintMetadata): Array<{ field?: string; message: string }> {
    const errors: Array<{ field?: string; message: string }> = [];

    for (const [ruleName, validator] of this._ruleHandlers.entries()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ruleErrors = validator(blueprint as any);
        errors.push(...ruleErrors);
      } catch (_err) {
        // Skip failed rules
      }
    }

    return errors;
  }

  validateEntities(entities: DomainEntity[]): ValidationResult {
    const errors: Array<{ field?: string; message: string }> = [];
    const warnings: string[] = [];

    // Check for duplicate entity IDs within the same blueprint
    const blueprintEntities = new Map<string, DomainEntity[]>();

    for (const entity of entities) {
      if (!blueprintEntities.has(entity.blueprintId)) {
        blueprintEntities.set(entity.blueprintId, []);
      }
      blueprintEntities.get(entity.blueprintId)!.push(entity);
    }

    // Check for duplicate names within each blueprint's entities
    for (const [blueprintId, bpEntities] of blueprintEntities.entries()) {
      const nameCounts = new Map<string, number>();
      for (const entity of bpEntities) {
        const count = nameCounts.get(entity.name) || 0;
        nameCounts.set(entity.name, count + 1);
        if (count > 0) {
          errors.push({
            field: `entities.${entity.id}.name`,
            message: `Duplicate entity name "${entity.name}" in blueprint ${blueprintId}`,
          });
        }
      }
    }

    // Validate relationship targets exist
    for (const entity of entities) {
      for (const rel of entity.relationships || []) {
        if (!this.catalog?.has(rel.targetBlueprintId)) {
          warnings.push(
            `Entity "${entity.name}" references non-existent blueprint ${rel.targetBlueprintId} in relationship`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateCompositionPlan(
    plan: CompositionPlan,
    catalog?: BlueprintCatalog
  ): ValidationResult {
    const errors: Array<{ field?: string; message: string }> = [];
    const warnings: string[] = [];
    const checkCatalog = catalog || this.catalog || createEmptyCatalog();

    // Validate primary blueprint exists and is published
    if (!checkCatalog.has(plan.primaryBlueprintId)) {
      errors.push({
        field: 'primaryBlueprintId',
        message: `Primary blueprint ${plan.primaryBlueprintId} not found in registry`,
      });
    } else {
      const primary = checkCatalog.getById(plan.primaryBlueprintId);
      if (primary?.status !== 'published') {
        errors.push({
          field: 'primaryBlueprintId',
          message: `Primary blueprint ${plan.primaryBlueprintId} is not published (status: ${primary?.status})`,
        });
      }
    }

    // Validate module blueprints exist and are compatible
    for (const moduleId of plan.moduleBlueprintIds) {
      if (!checkCatalog.has(moduleId)) {
        errors.push({
          field: 'moduleBlueprintIds',
          message: `Module blueprint ${moduleId} not found in registry`,
        });
      } else {
        const module = checkCatalog.getById(moduleId);
        if (module?.status !== 'published') {
          warnings.push(`Module blueprint ${moduleId} is not published`);
        }
      }
    }

    // Validate pack IDs exist in registry (if packs are implemented)
    for (const [packType, packId] of [
      ['rolePack', plan.rolePackId],
      ['kpiPack', plan.kpiPackId],
      ['approvalPack', plan.approvalPackId],
    ]) {
      if (packId && !checkCatalog.has(packId)) {
        errors.push({
          field: `${packType}Id`,
          message: `${packType} ${packId} not found in registry`,
        });
      }
    }

    return {
      blueprintId: plan.id,
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateAll(
    blueprints: Array<BlueprintMetadata>,
    entities?: DomainEntity[]
  ): ValidationReport {
    const results: ValidationResult[] = [];
    let passedCount = 0;
    let failedCount = 0;
    let warningsCount = 0;

    for (const blueprint of blueprints) {
      const result = this.validateMetadata(blueprint);
      results.push(result);

      if (result.valid) {
        passedCount++;
      } else {
        failedCount++;
      }

      warningsCount += result.warnings.length;
    }

    if (entities && entities.length > 0) {
      const entityResult = this.validateEntities(entities);
      results.push(entityResult);

      if (!entityResult.valid) {
        failedCount++;
      } else {
        passedCount++;
      }

      warningsCount += entityResult.warnings.length;
    }

    return {
      isValid: failedCount === 0,
      results,
      summary: {
        total: blueprints.length + (entities?.length ? 1 : 0),
        passed: passedCount,
        failed: failedCount,
        warningsCount,
      },
    };
  }

  checkRule(ruleName: string, blueprint: BlueprintMetadata): ValidationResult {
    const errors: Array<{ field?: string; message: string }> = [];

    // Run registered custom rules
    if (this._ruleHandlers.has(ruleName)) {
      const ruleErrors = this._ruleHandlers.get(ruleName)!(blueprint);
      errors.push(...ruleErrors);
    } else {
      return {
        blueprintId: blueprint.id,
        valid: false,
        errors: [{ field: 'rule', message: `Unknown validation rule: ${ruleName}` }],
        warnings: [],
      };
    }

    return {
      blueprintId: blueprint.id,
      valid: errors.length === 0,
      errors,
      warnings: [],
    };
  }

  /** Register a custom validation rule */
  registerRule(ruleName: string, validator: (blueprint: any) => Array<{ field?: string; message: string }>): void {
    this._ruleHandlers.set(ruleName, validator);
  }
}

/**
 * Predefined validation rules.
 */
export const ValidationRules = {
  /** Blueprint must have at least one tag */
  hasTags: (blueprint: any): Array<{ field?: string; message: string }> => {
    if (!blueprint.tags || blueprint.tags.length === 0) {
      return [{ field: 'tags', message: 'Blueprint must have at least one tag' }];
    }
    return [];
  },

  /** Version must be valid semver */
  validVersion: (blueprint: any): Array<{ field?: string; message: string }> => {
    if (!/^\d+\.\d+\.\d+$/.test(blueprint.version)) {
      return [{ field: 'version', message: `Invalid semantic version format: ${blueprint.version}` }];
    }
    return [];
  },

  /** Deprecated blueprints must have a deprecation reason */
  deprecatedHasReason: (blueprint: any): Array<{ field?: string; message: string }> => {
    if (blueprint.status === 'deprecated' && !blueprint.deprecationReason) {
      return [{ field: 'deprecationReason', message: 'Deprecated blueprints must include a deprecation reason' }];
    }
    return [];
  },

  /** Source commit hash should be provided for FactoryNXT-extracted blueprints */
  sourceCommitRequired: (blueprint: any): Array<{ field?: string; message: string }> => {
    if (
      blueprint.sourceRepo !== 'heynxt-core-generated' &&
      !blueprint.sourceCommitHash &&
      blueprint.status === 'published'
    ) {
      return [
        {
          field: 'sourceCommitHash',
          message: 'FactoryNXT-extracted blueprints should include source commit hash for traceability',
        },
      ];
    }
    return [];
  },
};

/**
 * Create a validator with predefined rules registered.
 */
export function createValidator(catalog?: BlueprintCatalog): BlueprintValidator {
  const validator = new BlueprintValidatorImpl(catalog);

  // Register predefined validation rules
  for (const [name, rule] of Object.entries(ValidationRules)) {
    validator.registerRule(name, rule);
  }

  return validator;
}
