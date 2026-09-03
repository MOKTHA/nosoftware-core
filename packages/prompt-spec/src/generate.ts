/**
 * @heynxt/prompt-spec — Spec Template Generator
 *
 * Calls an LLM via the OpenRouter API to produce a complete
 * AppSpecTemplate from a high-level app description and a selected
 * blueprint. The response is validated against the Zod schema before
 * being returned to the caller.
 *
 * Environment:
 *   OPENROUTER_API_KEY — required; read from process.env at call time.
 */

import { AppSpecTemplate } from '@heynxt/core-types';

/** ------------------------------------------------------------------ */
/*  Input type                                                        */
/** ------------------------------------------------------------------ */

export interface GenerateSpecInput {
  appName: string;
  description: string;
  blueprintId: string;
  blueprintName: string;
  blueprintDomainModels: Record<string, unknown>;
  blueprintConstraints: string[];
}

/** ------------------------------------------------------------------ */
/*  Constants                                                         */
/** ------------------------------------------------------------------ */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-3-5-sonnet';

/** ------------------------------------------------------------------ */
/*  Prompt construction                                               */
/** ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are a senior software architect. Given an app description and a selected blueprint, produce a complete application specification as JSON.

The JSON must conform to this exact shape:

{
  "spec": {
    "appId": "<uuid>",
    "appName": "<string>",
    "entities": [
      {
        "name": "<string>",
        "fields": [
          { "name": "<string>", "type": "<FieldType>", "primaryKey?": true, "nullable?": true, "values?": ["..."] }
        ],
        "relationships?": ["<string>"]
      }
    ],
    "businessRules": [
      { "ruleId": "<uuid>", "name": "<string>", "description": "<string>", "category": "<string>", "version?": <number> }
    ],
    "uiRequirements": {
      "views": ["<string>"],
      "roles": ["<string>"]
    }
  },
  "blueprintPlan": {
    "blueprintId": "<uuid>",
    "blueprintName": "<string>",
    "domainModels": { "<name>": <model> },
    "constraints": ["<string>"],
    "ruleImplementationHints": { "<ruleName>": "<strategy>" }
  },
  "params": {}
}

FieldType is one of: uuid, string, text, integer, decimal, boolean, timestamp, enum, json.

Return ONLY the JSON object. No markdown fences, no explanation.`;

function buildUserPrompt(input: GenerateSpecInput): string {
  return [
    `App Name: ${input.appName}`,
    `Description: ${input.description}`,
    '',
    `Blueprint Name: ${input.blueprintName}`,
    `Blueprint ID: ${input.blueprintId}`,
    '',
    'Blueprint Domain Models:',
    JSON.stringify(input.blueprintDomainModels, null, 2),
    '',
    'Blueprint Constraints:',
    input.blueprintConstraints.map((c) => `- ${c}`).join('\n'),
    '',
    'Generate a complete AppSpecTemplate JSON for this application. Include realistic entities with fields, business rules, UI requirements, and a blueprint plan with rule implementation hints.',
  ].join('\n');
}

/** ------------------------------------------------------------------ */
/*  Markdown fence stripper                                           */
/** ------------------------------------------------------------------ */

function stripMarkdownFences(raw: string): string {
  let text = raw.trim();
  // Remove ```json ... ``` or ``` ... ``` wrappers
  if (text.startsWith('```')) {
    // Strip opening fence (optionally with language tag)
    text = text.replace(/^```[a-zA-Z]*\n?/, '');
    // Strip closing fence
    text = text.replace(/\n?```\s*$/, '');
  }
  return text.trim();
}

/** ------------------------------------------------------------------ */
/*  Main function                                                     */
/** ------------------------------------------------------------------ */

/**
 * Generate a validated AppSpecTemplate by calling an LLM via OpenRouter.
 *
 * @throws {Error} When OPENROUTER_API_KEY is not set.
 * @throws {Error} When the API call fails.
 * @throws {Error} When the LLM response does not match the AppSpecTemplate schema.
 */
export async function generateSpecTemplate(
  input: GenerateSpecInput,
): Promise<AppSpecTemplate> {
  const apiKey = process.env['OPENROUTER_API_KEY'];
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is not set. Set it in the environment before calling generateSpecTemplate.',
    );
  }

  // Build the request payload
  const body = {
    model: MODEL,
    messages: [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      { role: 'user' as const, content: buildUserPrompt(input) },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  };

  // Call OpenRouter
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '(no body)');
    throw new Error(
      `OpenRouter API error ${response.status}: ${errorBody}`,
    );
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const rawContent = json.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error(
      'OpenRouter returned an empty response. No content in choices[0].message.content.',
    );
  }

  // Strip markdown fences if the LLM wrapped the JSON
  const cleaned = stripMarkdownFences(rawContent);

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}\n\nRaw response:\n${cleaned.slice(0, 500)}`,
    );
  }

  // Validate against the Zod schema
  const result = AppSpecTemplate.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(
      `LLM response does not match AppSpecTemplate schema:\n${issues}`,
    );
  }

  return result.data;
}
