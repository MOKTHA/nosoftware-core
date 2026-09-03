/**
 * @heynxt/prompt-spec
 *
 * Prompt-to-spec transformation layer.
 * Translates natural-language prompts into structured application
 * specifications that the generation pipeline can execute.
 *
 * Exports:
 *   generateSpecTemplate  — LLM-backed spec generator (OpenRouter)
 *   GenerateSpecInput     — input type for generateSpecTemplate
 *   helpdeskTicketingFixture — hardcoded fixture for testing
 *
 * Re-exports from @heynxt/core-types:
 *   AppSpec, AppSpecTemplate, AppBlueprintPlan,
 *   FieldType, EntityField, Entity,
 *   BusinessRule, UiRequirements
 */

// Spec generator
export { generateSpecTemplate } from './generate.js';
export type { GenerateSpecInput } from './generate.js';

// Fixtures
export { helpdeskTicketingFixture } from './fixtures/helpdesk-ticketing.js';

// Re-export app-spec types from core-types for convenience
export {
  FieldType,
  EntityField,
  Entity,
  BusinessRule,
  UiRequirements,
  AppSpec,
  AppBlueprintPlan,
  AppSpecTemplate,
} from '@heynxt/core-types';
