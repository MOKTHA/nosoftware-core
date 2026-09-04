/**
 * @heynxt/agent-adapter — Stage 3: Generate Schema (Phase 5)
 *
 * Stub mode: generates artifact metadata from the blueprint plan entities.
 *
 * Live mode (sandbox + LLM available): calls the LLM to produce a Drizzle
 * ORM schema, writes it into the sandbox, and runs `npx drizzle-kit push`.
 *
 * Context reads:  sessionId, databaseUrl
 * Context writes: schemaGenerated
 */

import type { GenerationStage, GenerationStageInput, GenerationStageOutput } from '../generation-pipeline.js';
import type { PipelineContext } from '../pipeline-context.js';

export class GenerateSchemaStage implements GenerationStage {
  readonly name = 'generate-schema' as const;
  readonly description = 'Generate schema → DB migrations, TS types, API contracts';

  constructor(private readonly ctx?: PipelineContext) {}

  validateInput(input: GenerationStageInput): boolean {
    return input.blueprintPlan !== null && input.blueprintPlan !== undefined;
  }

  async execute(input: GenerationStageInput): Promise<GenerationStageOutput> {
    const inputHash = await this.computeHash(JSON.stringify(input.blueprintPlan));

    // Live mode: call LLM → write schema → migrate in sandbox
    if (
      this.ctx?.sessionId &&
      process.env['OPENROUTER_API_KEY'] &&
      process.env['NEON_API_KEY']
    ) {
      await this.generateSchemaInSandbox(input);
    }

    // Always return artifact metadata (stub-compatible)
    const artifacts = this.generateSchemaArtifacts(
      input.blueprintPlan as Record<string, unknown>,
      input.params,
    );

    return {
      inputHash,
      outputHash: inputHash,
      artifacts,
      summary: `Generated database migrations and type definitions for ${artifacts.length} entity types`,
      warnings: [],
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Live mode: LLM + Sandbox                                         */
  /* ------------------------------------------------------------------ */

  private async generateSchemaInSandbox(input: GenerationStageInput): Promise<void> {
    const { SandboxSession } = await import('@heynxt/sandbox');
    const { callOpenRouter } = await import('../llm.js');

    const session = await SandboxSession.resume(this.ctx!.sessionId!);

    const rawSchema = await callOpenRouter({
      model: 'anthropic/claude-sonnet-4',
      systemPrompt: [
        'You are a Drizzle ORM schema generator for PostgreSQL (Neon serverless).',
        'Output ONLY valid TypeScript for a single lib/schema.ts file.',
        '',
        '## Import exactly this:',
        'import { pgTable, text, integer, boolean, timestamp, uuid, serial, varchar } from "drizzle-orm/pg-core";',
        '',
        '## Column conventions (MANDATORY for every table):',
        '- id: uuid("id").primaryKey().defaultRandom()',
        '- createdAt: timestamp("created_at").defaultNow().notNull()',
        '- updatedAt: timestamp("updated_at").defaultNow().notNull()',
        '',
        '## Column type rules:',
        '- Names/titles: text("column_name").notNull()',
        '- Emails: text("email").notNull()',
        '- Descriptions/notes: text("description")',
        '- Status/enums: text("status").notNull().default("active")',
        '- Counts/quantities: integer("quantity").notNull().default(0)',
        '- Booleans: boolean("is_active").notNull().default(true)',
        '- Foreign keys: uuid("user_id").notNull()',
        '',
        '## Foreign key / relation rules:',
        '- For foreign keys, use: uuid("user_id").notNull()  (just a uuid column)',
        '- Name FK columns as <related_entity>_id in snake_case (e.g. user_id, project_id, category_id)',
        '- Use camelCase for the JS property: userId: uuid("user_id").notNull()',
        '- The frontend will use the column name to show a dropdown of related records',
        '',
        '## General rules:',
        '- Use snake_case for DB column names in the string arg: text("first_name")',
        '- Use camelCase for the JS property: firstName: text("first_name")',
        '- Export every table with `export const`',
        '- Make every required field .notNull() with a sensible .default() where possible',
        '- Do NOT use serial() for IDs — use uuid().defaultRandom()',
        '- Do NOT generate an adminUsers table — it is provided by the scaffold',
        '- No markdown fences, no explanations, no ```typescript blocks',
      ].join('\n'),
      userPrompt: `Generate a Drizzle ORM schema for these entities:\n${JSON.stringify(input.spec, null, 2)}`,
    });

    // Strip markdown fences the LLM may wrap output in
    let schemaCode = rawSchema.replace(/^```[a-z]*\n?/gm, '').replace(/```$/gm, '').trim();

    // Append the admin_users table required by the auth scaffold
    const { ADMIN_USERS_SCHEMA_APPEND } = await import('@heynxt/sandbox');
    schemaCode += '\n' + ADMIN_USERS_SCHEMA_APPEND;

    await session.writeFile('/workspace/app/lib/schema.ts', schemaCode);

    // Run migration — fail loudly if it doesn't work
    const pushResult = await session.runCommand('npx', ['drizzle-kit', 'push'], {
      cwd: '/workspace/app',
    });

    if (pushResult.exitCode !== 0) {
      throw new Error(
        `drizzle-kit push failed (exit ${pushResult.exitCode}):\n${pushResult.stderr || pushResult.stdout}`,
      );
    }

    if (this.ctx) {
      this.ctx.schemaGenerated = true;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Stub artifact generation (always runs)                            */
  /* ------------------------------------------------------------------ */

  private generateSchemaArtifacts(
    blueprintPlan: Record<string, unknown>,
    params: Record<string, unknown>,
  ): Array<import('@heynxt/core-types').GenerationArtifact> {
    const artifacts: Array<import('@heynxt/core-types').GenerationArtifact> = [];
    const entities = (blueprintPlan.entities as Array<Record<string, unknown>>) ?? [];

    for (const entity of entities) {
      const entityName = (entity.name as string) ?? 'UnknownEntity';

      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'migration' as const,
        relativePath: `migrations/20240101_create_${entityName.toLowerCase()}.sql`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 1024,
        isNew: true,
        description: `Migration for ${entityName}`,
        createdAt: new Date(),
      });

      artifacts.push({
        id: crypto.randomUUID(),
        generationRunId: '00000000-0000-0000-0000-000000000000',
        stageName: this.name,
        kind: 'type-definition' as const,
        relativePath: `types/${entityName}.ts`,
        contentHash: crypto.randomUUID().slice(-64),
        fileSizeBytes: 512,
        isNew: true,
        description: `Type definition for ${entityName}`,
        createdAt: new Date(),
      });
    }

    artifacts.push({
      id: crypto.randomUUID(),
      generationRunId: '00000000-0000-0000-0000-000000000000',
      stageName: this.name,
      kind: 'api-contract' as const,
      relativePath: 'contracts/openapi.json',
      contentHash: crypto.randomUUID().slice(-64),
      fileSizeBytes: 2048,
      isNew: true,
      description: 'OpenAPI specification for generated API endpoints',
      createdAt: new Date(),
    });

    return artifacts;
  }

  private async computeHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
