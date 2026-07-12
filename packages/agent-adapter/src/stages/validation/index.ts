/**
 * @heynxt/agent-adapter — Validation Stages Exports (Phase 7)
 *
 * Re-exports all validation stage implementations for the generation pipeline.
 */

// Stage classes
export { ValidateLintStage } from './validate-lint.js';
export { ValidateTypeCheckStage } from './validate-typecheck.js';
export { ValidateTestsStage } from './validate-tests.js';
export { ValidateMigrationsStage } from './validate-migrations.js';
export { ValidateBuildStage } from './validate-build.js';
export { ValidateRoutesStage } from './validate-routes.js';
export { ValidateApiStage } from './validate-api.js';
export { ValidatePermissionsStage } from './validate-permissions.js';
export { CreatePRStage } from './create-pr.js';

// Result schemas and metadata types
export {
  LintValidationResult,
  LintEvidenceMetadata,
} from './validate-lint.js';
export {
  TypeCheckValidationResult,
  TypeCheckEvidenceMetadata,
} from './validate-typecheck.js';
export {
  TestValidationResult,
  UnitTestMetadata,
  IntegrationTestMetadata,
  SmokeTestMetadata,
} from './validate-tests.js';
export {
  MigrationValidationResult,
  MigrationEvidenceMetadata,
} from './validate-migrations.js';
export {
  BuildValidationResult,
  BuildEvidenceMetadata,
} from './validate-build.js';
export {
  RouteValidationResult,
  RouteTestResult,
  RouteEvidenceMetadata,
} from './validate-routes.js';
export {
  ApiValidationResult,
  ApiTestResult,
  ApiEvidenceMetadata,
} from './validate-api.js';
export {
  PermissionsValidationResult,
  PermissionTestResult,
  PermissionsEvidenceMetadata,
} from './validate-permissions.js';

// PR Creation result schemas and metadata types (Phase 7.4)
export {
  PRCreationResult,
  PREvidenceMetadata,
} from './create-pr.js';

// GitHub API integration utilities (Phase 7.4)
export {
  GitHubConfig,
  CheckStatusEnum,
  ValidationSummaryComment,
  GitHubAPIClient,
  generateBranchName,
  generatePRTitle,
  generatePRBody,
} from './github-api.js';
